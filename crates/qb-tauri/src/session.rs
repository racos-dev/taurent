use std::sync::Arc;
use std::sync::Mutex;

use qb_core::{
    client::{normalize_server_url, qb_probe, qbittorrent_login},
    ServerIdentity, SessionManager, SessionState, SessionStatus,
};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

use crate::server_repo::{
    get_server_meta as repo_get_server_meta, get_server_password as repo_get_server_password,
    select_server_and_persist as repo_select_server_and_persist, ServerRepoStateHandle,
};

/// Parse the qBittorrent app version string and determine if pause/resume is supported.
/// qBittorrent v5+ removed /pause and /resume endpoints in favor of /stop and /start.
/// Version format: "v5.0.1", "v4.4.0", etc. The leading 'v' is optional.
fn parse_app_version_for_pause_resume(version: &str) -> bool {
    let v = version.trim_start_matches('v');
    if let Some(major) = v.split('.').next().and_then(|s| s.parse::<u32>().ok()) {
        // qBittorrent v5+ removed pause/resume; use stop/start instead
        return major < 5;
    }
    // Unknown version, assume older (pause/resume supported) for safety
    true
}

const STARTUP_PROBE_PATH: &str = "/api/v2/app/version";

fn summarize_cookie(cookie: &str) -> String {
    let suffix: String = cookie
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    format!("<redacted:{} chars..{}>", cookie.chars().count(), suffix)
}

fn probe_body_summary(data: &serde_json::Value) -> Option<String> {
    match data {
        serde_json::Value::Null => None,
        serde_json::Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.chars().take(120).collect())
            }
        }
        other => {
            let summary = other.to_string();
            if summary.is_empty() {
                None
            } else {
                Some(summary.chars().take(120).collect())
            }
        }
    }
}

fn startup_probe_failure_message(status_code: u16, body_summary: Option<&str>) -> String {
    let status_summary = if status_code == 403 {
        "HTTP 403 Forbidden; qBittorrent rejected the session cookie or authenticated request headers after login"
            .to_string()
    } else {
        format!("HTTP {}", status_code)
    };

    match body_summary {
        Some(body) => format!(
            "Login succeeded, but the first protected request {} failed with {} (body: {:?})",
            STARTUP_PROBE_PATH, status_summary, body
        ),
        None => format!(
            "Login succeeded, but the first protected request {} failed with {}",
            STARTUP_PROBE_PATH, status_summary
        ),
    }
}

async fn load_startup_pause_resume_capability(
    client: &reqwest::Client,
    base_url: &str,
    sid_cookie: &str,
    server_id: &str,
) -> Result<bool, String> {
    log::info!(
        "Login succeeded for server_id={}; validating first protected request path={} with cookie={}",
        server_id,
        STARTUP_PROBE_PATH,
        summarize_cookie(sid_cookie)
    );

    let probe = qb_probe(client, base_url, sid_cookie, STARTUP_PROBE_PATH)
        .await
        .map_err(|error| {
            format!(
                "Login succeeded, but the first protected request {} failed before session connect: {}",
                STARTUP_PROBE_PATH, error
            )
        })?;

    if probe.status_code != 200 {
        let body_summary = probe_body_summary(&probe.data);
        let message = startup_probe_failure_message(probe.status_code, body_summary.as_deref());
        log::error!(
            "Startup protected request rejected: server_id={}, path={}, status={}, cookie={}, body={:?}",
            server_id,
            STARTUP_PROBE_PATH,
            probe.status_code,
            summarize_cookie(sid_cookie),
            body_summary
        );
        return Err(message);
    }

    let version = probe.data.as_str().unwrap_or("");
    log::info!(
        "Startup protected request succeeded: server_id={}, path={}, version={}",
        server_id,
        STARTUP_PROBE_PATH,
        version
    );
    Ok(parse_app_version_for_pause_resume(version))
}

pub type SessionStateHandle = Arc<Mutex<SessionManager>>;

pub fn create_session_state() -> SessionStateHandle {
    Arc::new(Mutex::new(SessionManager::new()))
}

#[tauri::command]
pub fn get_session_state(state: State<'_, SessionStateHandle>) -> SessionState {
    let session = state.lock().unwrap();
    session.get_state().clone()
}

#[tauri::command]
pub fn get_session_status(state: State<'_, SessionStateHandle>) -> SessionStatus {
    let session = state.lock().unwrap();
    session.get_state().status
}

#[tauri::command]
pub fn get_session_generation(state: State<'_, SessionStateHandle>) -> u64 {
    let session = state.lock().unwrap();
    session.get_state().session_generation
}

#[tauri::command]
pub async fn session_connect(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    server_id: String,
    server_name: String,
    server_url: String,
    server_username: String,
    server_password: String,
) -> Result<u64, String> {
    let identity = ServerIdentity {
        id: server_id.clone(),
        name: server_name,
        url: server_url.clone(),
        username: server_username.clone(),
        password: server_password.clone(),
    };

    let generation = {
        let mut session = state.lock().unwrap();
        session.set_connecting(identity.clone())
    };

    emit_session_changed(
        &app,
        generation,
        Some(server_id.clone()),
        SessionStatus::Connecting,
        None,
    );

    let login_result = qbittorrent_login(&server_url, &server_username, &server_password).await;

    match login_result {
        Ok((client, sid_cookie)) => {
            let normalized_url = normalize_server_url(&server_url, "https://");
            let supports_pause_resume = match load_startup_pause_resume_capability(
                &client,
                &normalized_url,
                &sid_cookie,
                &server_id,
            )
            .await
            {
                Ok(supports_pause_resume) => supports_pause_resume,
                Err(error_message) => {
                    let mut session = state.lock().unwrap();
                    let generation = session.set_error(error_message.clone());
                    emit_session_changed(
                        &app,
                        generation,
                        Some(server_id),
                        SessionStatus::Error,
                        Some(error_message),
                    );
                    return Ok(generation);
                }
            };

            let mut session = state.lock().unwrap();
            let generation = session.connect(identity, client, sid_cookie, supports_pause_resume);
            emit_session_changed(
                &app,
                generation,
                session
                    .get_state()
                    .server
                    .as_ref()
                    .map(|server| server.id.clone()),
                session.get_state().status,
                session.get_state().last_error.clone(),
            );
            Ok(generation)
        }
        Err(error) => {
            let error_message = error.to_string();
            let mut session = state.lock().unwrap();
            let generation = session.set_error(error_message.clone());
            emit_session_changed(
                &app,
                generation,
                Some(server_id),
                SessionStatus::Error,
                Some(error_message.clone()),
            );
            Err(error_message)
        }
    }
}

/// Connect to a server by ID, loading credentials from the Rust server repository.
/// This is the Phase 3 preferred flow - frontend passes only server_id, not raw credentials.
#[tauri::command]
pub async fn session_connect_by_id(
    session_state: State<'_, SessionStateHandle>,
    server_repo_state: State<'_, ServerRepoStateHandle>,
    app: tauri::AppHandle,
    server_id: String,
) -> Result<u64, String> {
    // Load server metadata and password from repo
    let meta = {
        let repo = server_repo_state.lock().unwrap();
        repo_get_server_meta(&repo, &server_id)
            .ok_or_else(|| format!("Server '{}' not found in repository", server_id))?
    };
    let password = {
        let repo = server_repo_state.lock().unwrap();
        repo_get_server_password(&app, &repo, &server_id)
            .ok_or_else(|| format!("Password is required for server '{}' but is not available. Please update server credentials.", server_id))?
    };

    let identity = ServerIdentity {
        id: meta.id.clone(),
        name: meta.name.clone(),
        url: meta.url.clone(),
        username: meta.username.clone(),
        password: password.clone(),
    };

    let generation = {
        let mut session = session_state.lock().unwrap();
        session.set_connecting(identity.clone())
    };

    emit_session_changed(
        &app,
        generation,
        Some(server_id.clone()),
        SessionStatus::Connecting,
        None,
    );

    let login_result = qbittorrent_login(&meta.url, &meta.username, &password.clone()).await;

    match login_result {
        Ok((client, sid_cookie)) => {
            let normalized_url = normalize_server_url(&meta.url, "https://");
            let supports_pause_resume = match load_startup_pause_resume_capability(
                &client,
                &normalized_url,
                &sid_cookie,
                &server_id,
            )
            .await
            {
                Ok(supports_pause_resume) => supports_pause_resume,
                Err(error_message) => {
                    let mut session = session_state.lock().unwrap();
                    let generation = session.set_error(error_message.clone());
                    emit_session_changed(
                        &app,
                        generation,
                        Some(server_id),
                        SessionStatus::Error,
                        Some(error_message),
                    );
                    return Ok(generation);
                }
            };

            let mut session = session_state.lock().unwrap();
            let generation = session.connect(identity, client, sid_cookie, supports_pause_resume);
            emit_session_changed(
                &app,
                generation,
                session
                    .get_state()
                    .server
                    .as_ref()
                    .map(|server| server.id.clone()),
                session.get_state().status,
                session.get_state().last_error.clone(),
            );
            Ok(generation)
        }
        Err(error) => {
            let error_message = error.to_string();
            let mut session = session_state.lock().unwrap();
            let generation = session.set_error(error_message.clone());
            emit_session_changed(
                &app,
                generation,
                Some(server_id),
                SessionStatus::Error,
                Some(error_message.clone()),
            );
            Err(error_message)
        }
    }
}

/// Atomic switch to a saved server by ID.
/// Loads credentials from the repo, authenticates, and probes before committing.
/// - On success: commits the new session, persists active server, saves repo, emits connected event.
/// - On failure: returns error WITHOUT mutating the current session or persisted active server.
#[tauri::command]
pub async fn session_switch_server_by_id(
    session_state: State<'_, SessionStateHandle>,
    server_repo_state: State<'_, ServerRepoStateHandle>,
    app: tauri::AppHandle,
    server_id: String,
) -> Result<u64, String> {
    // Step 1: Load candidate server metadata and password from repo (without touching session)
    let meta = {
        let repo = server_repo_state.lock().unwrap();
        repo_get_server_meta(&repo, &server_id)
            .ok_or_else(|| format!("Server '{}' not found in repository", server_id))?
    };
    let password = {
        let repo = server_repo_state.lock().unwrap();
        repo_get_server_password(&app, &repo, &server_id).ok_or_else(|| {
            format!(
                "Password is required for server '{}' but is not available. Please update server credentials.",
                server_id
            )
        })?
    };

    let identity = ServerIdentity {
        id: meta.id.clone(),
        name: meta.name.clone(),
        url: meta.url.clone(),
        username: meta.username.clone(),
        password: password.clone(),
    };

    // Step 2: Authenticate and probe the candidate server (NO session mutation)
    let login_result = qbittorrent_login(&meta.url, &meta.username, &password).await;

    let (client, sid_cookie, supports_pause_resume) = match login_result {
        Ok((client, sid_cookie)) => {
            let normalized_url = normalize_server_url(&meta.url, "https://");
            match load_startup_pause_resume_capability(
                &client,
                &normalized_url,
                &sid_cookie,
                &server_id,
            )
            .await
            {
                Ok(supports_pause_resume) => (client, sid_cookie, supports_pause_resume),
                Err(error_message) => {
                    return Err(error_message);
                }
            }
        }
        Err(error) => {
            return Err(error.to_string());
        }
    };

    // Step 3: Candidate is verified — persist active server FIRST.
    // If this fails, session is untouched (command returns error without session mutation).
    {
        let mut repo = server_repo_state.lock().unwrap();
        repo_select_server_and_persist(&app, &mut repo, &server_id)?;
    }

    // Step 4: Repo is saved — now commit the session.
    let generation = {
        let mut session = session_state.lock().unwrap();
        session.connect(identity, client, sid_cookie, supports_pause_resume)
    };

    // Step 5: Emit the standard connected session change event
    emit_session_changed(
        &app,
        generation,
        Some(server_id),
        SessionStatus::Connected,
        None,
    );

    Ok(generation)
}

#[tauri::command]
pub fn session_disconnect(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
) -> Result<u64, String> {
    let mut session = state.lock().unwrap();
    // Capture server_id before disconnect() clears state.server.
    // This ensures the emitted session-changed event carries the correct server_id
    // so the sync lifecycle listener can reliably stop the sync manager on teardown.
    let server_id = session
        .get_state()
        .server
        .as_ref()
        .map(|server| server.id.clone());
    let generation = session.disconnect();
    emit_session_changed(
        &app,
        generation,
        server_id,
        session.get_state().status,
        session.get_state().last_error.clone(),
    );
    Ok(generation)
}

#[tauri::command]
pub async fn session_reconnect(
    session_state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
) -> Result<u64, String> {
    // Step 1: transition to Connecting and extract credentials.
    // CRITICAL: release the Mutex lock before any .await to avoid deadlock.
    let identity = {
        let mut session = session_state.lock().unwrap();
        let generation = session.reconnect().map_err(|e| e.to_string())?;
        emit_session_changed(
            &app,
            generation,
            session.get_state().server.as_ref().map(|s| s.id.clone()),
            SessionStatus::Connecting,
            None,
        );
        session
            .get_server_identity()
            .expect("server_identity must be set if reconnect() succeeded")
            .clone()
    };
    // Mutex is released here — safe to .await

    // Step 2: perform network login (same as session_connect_by_id)
    let login_result =
        qbittorrent_login(&identity.url, &identity.username, &identity.password).await;

    match login_result {
        Ok((client, sid_cookie)) => {
            let normalized_url = normalize_server_url(&identity.url, "https://");
            let supports_pause_resume = match load_startup_pause_resume_capability(
                &client,
                &normalized_url,
                &sid_cookie,
                &identity.id,
            )
            .await
            {
                Ok(supports_pause_resume) => supports_pause_resume,
                Err(msg) => {
                    let mut session = session_state.lock().unwrap();
                    let generation = session.set_error(msg.clone());
                    emit_session_changed(
                        &app,
                        generation,
                        session.get_state().server.as_ref().map(|s| s.id.clone()),
                        SessionStatus::Error,
                        Some(msg.clone()),
                    );
                    return Err(msg);
                }
            };
            let mut session = session_state.lock().unwrap();
            let generation = session.connect(identity, client, sid_cookie, supports_pause_resume);
            emit_session_changed(
                &app,
                generation,
                session.get_state().server.as_ref().map(|s| s.id.clone()),
                session.get_state().status,
                session.get_state().last_error.clone(),
            );
            Ok(generation)
        }
        Err(e) => {
            let msg = e.to_string();
            let mut session = session_state.lock().unwrap();
            let generation = session.set_error(msg.clone());
            emit_session_changed(
                &app,
                generation,
                session.get_state().server.as_ref().map(|s| s.id.clone()),
                SessionStatus::Error,
                Some(msg.clone()),
            );
            Err(msg)
        }
    }
}

/// Probe the active session to verify auth is still valid.
/// If the probe returns 403 or a network error, transitions the session to Error
/// and emits session-changed. Returns true if healthy, false if degraded.
/// No-ops and returns false if session is not currently Connected.
#[tauri::command]
pub async fn session_health_check(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    // Extract what we need while holding the lock, then release before the async probe.
    // CRITICAL: never hold a Mutex across an .await.
    let probe_params = {
        let session = state.lock().unwrap();
        let st = session.get_state();
        if st.status != SessionStatus::Connected {
            return Ok(false);
        }
        let client = session.get_http_client().ok_or("No HTTP client")?.clone();
        let url = st
            .server
            .as_ref()
            .map(|s| normalize_server_url(&s.url, "https://"))
            .ok_or("No server URL")?;
        let cookie = session
            .get_session_cookie()
            .ok_or("No session cookie")?
            .clone();
        (client, url, cookie)
    };
    // Mutex is released here — safe to .await

    let (client, url, cookie) = probe_params;
    match qb_probe(&client, &url, &cookie, "/api/v2/app/version").await {
        Ok(probe) if probe.status_code == 200 => Ok(true),
        Ok(probe) if probe.status_code == 403 => {
            let msg = format!(
                "Session health check failed: protected request {} returned HTTP 403 Forbidden; the session cookie or authenticated request headers were rejected",
                STARTUP_PROBE_PATH
            );
            let mut session = state.lock().unwrap();
            let generation = session.set_error(msg.clone());
            emit_session_changed(
                &app,
                generation,
                session.get_state().server.as_ref().map(|s| s.id.clone()),
                SessionStatus::Error,
                Some(msg),
            );
            Ok(false)
        }
        Ok(probe) => {
            log::warn!(
                "Health probe returned unexpected status: {}",
                probe.status_code
            );
            Ok(true)
        }
        Err(e) => {
            let msg = format!("Health probe failed: {}", e);
            let mut session = state.lock().unwrap();
            let generation = session.set_error(msg.clone());
            emit_session_changed(
                &app,
                generation,
                session.get_state().server.as_ref().map(|s| s.id.clone()),
                SessionStatus::Error,
                Some(msg),
            );
            Ok(false)
        }
    }
}

#[tauri::command]
pub fn session_switch_server(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    server_id: String,
    server_name: String,
    server_url: String,
    server_username: String,
    server_password: String,
) -> Result<u64, String> {
    let mut session = state.lock().unwrap();
    let identity = ServerIdentity {
        id: server_id,
        name: server_name,
        url: server_url,
        username: server_username,
        password: server_password,
    };
    let generation = session.switch_server(identity);
    emit_session_changed(
        &app,
        generation,
        session
            .get_state()
            .server
            .as_ref()
            .map(|server| server.id.clone()),
        session.get_state().status,
        session.get_state().last_error.clone(),
    );
    Ok(generation)
}

#[tauri::command]
pub fn session_set_error(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    error: String,
) -> Result<u64, String> {
    let mut session = state.lock().unwrap();
    let generation = session.set_error(error);
    emit_session_changed(
        &app,
        generation,
        session
            .get_state()
            .server
            .as_ref()
            .map(|server| server.id.clone()),
        session.get_state().status,
        session.get_state().last_error.clone(),
    );
    Ok(generation)
}

#[tauri::command]
pub fn session_clear_error(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
) -> Result<u64, String> {
    let mut session = state.lock().unwrap();
    let generation = session.clear_error();
    emit_session_changed(
        &app,
        generation,
        session
            .get_state()
            .server
            .as_ref()
            .map(|server| server.id.clone()),
        session.get_state().status,
        session.get_state().last_error.clone(),
    );
    Ok(generation)
}

#[tauri::command]
pub fn session_teardown(state: State<'_, SessionStateHandle>) -> Result<u64, String> {
    let mut session = state.lock().unwrap();
    Ok(session.teardown())
}

#[tauri::command]
pub fn session_set_connecting(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    server_id: String,
    server_name: String,
    server_url: String,
    server_username: String,
    server_password: String,
) -> Result<u64, String> {
    let mut session = state.lock().unwrap();
    let generation = session.set_connecting(ServerIdentity {
        id: server_id,
        name: server_name,
        url: server_url,
        username: server_username,
        password: server_password,
    });

    emit_session_changed(
        &app,
        generation,
        session
            .get_state()
            .server
            .as_ref()
            .map(|server| server.id.clone()),
        session.get_state().status,
        session.get_state().last_error.clone(),
    );

    Ok(generation)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSnapshot {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub server_name: Option<String>,
    pub server_url: Option<String>,
    pub status: SessionStatus,
    pub last_error: Option<String>,
}

impl From<&SessionState> for SessionSnapshot {
    fn from(state: &SessionState) -> Self {
        Self {
            session_generation: state.session_generation,
            server_id: state.server.as_ref().map(|server| server.id.clone()),
            server_name: state.server.as_ref().map(|server| server.name.clone()),
            server_url: state.server.as_ref().map(|server| server.url.clone()),
            status: state.status,
            last_error: state.last_error.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SessionChangedEvent {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub status: SessionStatus,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ActiveServerChangedEvent {
    pub session_generation: u64,
    pub old_server_id: Option<String>,
    pub new_server_id: Option<String>,
    pub new_server_name: Option<String>,
    pub new_server_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ResourceInvalidatedEvent {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub resource: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct OperationFailedEvent {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub operation: String,
    pub error: String,
}

#[allow(dead_code)]
pub fn emit_session_changed(
    app: &tauri::AppHandle,
    generation: u64,
    server_id: Option<String>,
    status: SessionStatus,
    last_error: Option<String>,
) {
    let payload = SessionChangedEvent {
        session_generation: generation,
        server_id,
        status,
        last_error,
    };
    let _ = app.emit("session-changed", payload);
}

#[allow(dead_code)]
pub fn emit_active_server_changed(
    app: &tauri::AppHandle,
    generation: u64,
    old_id: Option<String>,
    new_id: Option<String>,
    new_name: Option<String>,
    new_url: Option<String>,
) {
    let payload = ActiveServerChangedEvent {
        session_generation: generation,
        old_server_id: old_id,
        new_server_id: new_id,
        new_server_name: new_name,
        new_server_url: new_url,
    };
    let _ = app.emit("active-server-changed", payload);
}

#[allow(dead_code)]
pub fn emit_resource_invalidated(
    app: &tauri::AppHandle,
    generation: u64,
    server_id: Option<String>,
    resource: String,
) {
    let payload = ResourceInvalidatedEvent {
        session_generation: generation,
        server_id,
        resource,
    };
    let _ = app.emit("resource-invalidated", payload);
}

#[allow(dead_code)]
pub fn emit_operation_failed(
    app: &tauri::AppHandle,
    generation: u64,
    server_id: Option<String>,
    operation: String,
    error: String,
) {
    let payload = OperationFailedEvent {
        session_generation: generation,
        server_id,
        operation,
        error,
    };
    let _ = app.emit("operation-failed", payload);
}

#[tauri::command]
pub fn get_session_snapshot(state: State<'_, SessionStateHandle>) -> SessionSnapshot {
    let session = state.lock().unwrap();
    SessionSnapshot::from(session.get_state())
}

#[tauri::command]
pub fn bootstrap_session(state: State<'_, SessionStateHandle>) -> Result<SessionSnapshot, String> {
    let session = state.lock().unwrap();
    Ok(SessionSnapshot::from(session.get_state()))
}

#[tauri::command]
pub fn get_bootstrap_contract() -> BootstrapContract {
    BootstrapContract {
        events: vec![
            EventContract {
                name: "session-changed".to_string(),
                payload_type: "SessionChangedEvent".to_string(),
                description: "Emitted when session state changes (connect, disconnect, error)"
                    .to_string(),
            },
            EventContract {
                name: "active-server-changed".to_string(),
                payload_type: "ActiveServerChangedEvent".to_string(),
                description: "Emitted when the active server changes".to_string(),
            },
            EventContract {
                name: "resource-invalidated".to_string(),
                payload_type: "ResourceInvalidatedEvent".to_string(),
                description:
                    "Emitted when a resource (torrents, categories, etc.) should be invalidated"
                        .to_string(),
            },
            EventContract {
                name: "operation-failed".to_string(),
                payload_type: "OperationFailedEvent".to_string(),
                description: "Emitted when an operation fails".to_string(),
            },
            EventContract {
                name: "settings-saved".to_string(),
                payload_type: "null".to_string(),
                description: "DEPRECATED: Use resource-invalidated with 'preferences' resource"
                    .to_string(),
            },
        ],
        commands: vec![
            CommandContract {
                name: "get_session_snapshot".to_string(),
                description: "Returns current session state snapshot for late-opening windows"
                    .to_string(),
                response_type: "SessionSnapshot".to_string(),
            },
            CommandContract {
                name: "bootstrap_session".to_string(),
                description: "Alias for get_session_snapshot for semantic clarity".to_string(),
                response_type: "SessionSnapshot".to_string(),
            },
        ],
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventContract {
    pub name: String,
    pub payload_type: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContract {
    pub name: String,
    pub description: String,
    pub response_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapContract {
    pub events: Vec<EventContract>,
    pub commands: Vec<CommandContract>,
}
