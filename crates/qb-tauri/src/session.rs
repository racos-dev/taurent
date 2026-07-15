use std::sync::Arc;
use std::sync::Mutex;

use qb_core::{
    capability::{QbResolver, ResolvedCapabilities},
    client::{normalize_server_url, qb_probe, qbittorrent_login},
    ServerIdentity, SessionManager, SessionState, SessionStatus,
};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use url::Url;

use crate::client::response_text;
use crate::server_repo::{
    get_server_credentials as repo_get_server_credentials, get_server_meta as repo_get_server_meta,
    persist_authenticated_server as repo_persist_authenticated_server, ServerRepoStateHandle,
};

const STARTUP_PROBE_PATH: &str = "/api/v2/app/version";
const WEBAPI_VERSION_PATH: &str = "/api/v2/app/webapiVersion";

/// Parse a stored server URL into a `Url` for login.
///
/// The stored URL may be scheme-less (e.g. `localhost:8080`); the login
/// function expects a `Url` and prefers to make the scheme decision itself
/// when the URL lacks one. To preserve scheme-less URL semantics, we parse
/// with `https://` only when no scheme is present. The login function will
/// fall back to HTTP for genuinely scheme-less URLs that fail TLS.
fn parse_login_url(raw: &str) -> Result<(Url, bool), String> {
    let scheme_was_missing = !raw.contains("://");
    let normalized = normalize_server_url(raw, "https://");
    Url::parse(&normalized)
        .map(|url| (url, scheme_was_missing))
        .map_err(|err| format!("Invalid server URL '{}': {}", raw, err))
}
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

/// Fetch the qBittorrent *app* version string from the first protected request
/// after login.
///
/// Returns the raw app version (e.g. `"v5.0.1"`) on success. This is a hard
/// post-login validation: any failure (network error, non-2xx, empty body)
/// aborts the connect with the supplied error message. The raw string is then
/// passed to `QbResolver::resolve` so app-version-keyed capabilities (including
/// `supports_pause_resume`) can be resolved from the TOML's `[app_versions]`
/// section.
async fn load_app_version(
    client: &reqwest::Client,
    base_url: &str,
    sid_cookie: &str,
    server_id: &str,
) -> Result<String, String> {
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

    let version = response_text(&probe.data).unwrap_or_default();
    log::info!(
        "Startup protected request succeeded: server_id={}, path={}, version={}",
        server_id,
        STARTUP_PROBE_PATH,
        version
    );
    Ok(version)
}

/// Resolve the server's `webapiVersion` and the corresponding
/// `ResolvedCapabilities` from the embedded TOML profile.
///
/// `app_version` is the raw qBittorrent application version string (e.g.
/// `"v5.0.1"`) returned by the startup probe. It is forwarded to
/// `QbResolver::resolve` so app-version-keyed capabilities (including
/// `supports_pause_resume`, declared in the TOML's `[app_versions]` section)
/// can be resolved alongside webapi-version-keyed ones.
///
/// On any webapi-version fetch failure (network error, non-2xx, empty body)
/// the connect/reconnect flow fails rather than storing a fabricated low
/// capability profile for the session.
async fn load_resolved_capabilities(
    client: &reqwest::Client,
    base_url: &str,
    sid_cookie: &str,
    server_id: &str,
    app_version: &str,
) -> Result<(String, ResolvedCapabilities), String> {
    log::info!(
        "Resolving webapiVersion for server_id={} from path={}",
        server_id,
        WEBAPI_VERSION_PATH
    );

    match qb_probe(client, base_url, sid_cookie, WEBAPI_VERSION_PATH).await {
        Ok(probe) if probe.status_code == 200 => {
            let version = response_text(&probe.data).unwrap_or_default();
            if version.is_empty() {
                let message = format!(
                    "Login succeeded, but capability hydration failed: {} returned an empty webapiVersion",
                    WEBAPI_VERSION_PATH
                );
                log::warn!("{message}: server_id={server_id}");
                Err(message)
            } else {
                log::info!(
                    "Resolved capabilities for server_id={} from webapiVersion={}",
                    server_id,
                    version
                );
                let caps = QbResolver::resolve(&version, app_version);
                Ok((version, caps))
            }
        }
        Ok(probe) => {
            let body_summary = probe_body_summary(&probe.data);
            let message = match body_summary.as_deref() {
                Some(body) => format!(
                    "Login succeeded, but capability hydration failed: {} returned HTTP {} (body: {:?})",
                    WEBAPI_VERSION_PATH, probe.status_code, body
                ),
                None => format!(
                    "Login succeeded, but capability hydration failed: {} returned HTTP {}",
                    WEBAPI_VERSION_PATH, probe.status_code
                ),
            };
            log::warn!(
                "webapiVersion for server_id={} returned HTTP {}; failing capability hydration",
                server_id,
                probe.status_code
            );
            Err(message)
        }
        Err(error) => {
            let message = format!(
                "Login succeeded, but capability hydration failed: {} request failed: {}",
                WEBAPI_VERSION_PATH, error
            );
            log::warn!(
                "webapiVersion request for server_id={} failed ({}); failing capability hydration",
                server_id,
                error
            );
            Err(message)
        }
    }
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
    api_key: Option<String>,
) -> Result<u64, String> {
    let mut identity = ServerIdentity {
        id: server_id.clone(),
        name: server_name,
        url: server_url.clone(),
        username: server_username.clone(),
        password: server_password.clone(),
        api_key: api_key.clone(),
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

    let (parsed_url, allow_http_fallback) = parse_login_url(&server_url)?;
    let login_result = qbittorrent_login(
        &parsed_url,
        allow_http_fallback,
        api_key.as_deref(),
        &server_username,
        &server_password,
    )
    .await;

    match login_result {
        Ok((client, sid_cookie, authenticated_base_url)) => {
            identity.url = authenticated_base_url.clone();
            let app_version =
                match load_app_version(&client, &authenticated_base_url, &sid_cookie, &server_id)
                    .await
                {
                    Ok(app_version) => app_version,
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

            let (api_version, capabilities) = match load_resolved_capabilities(
                &client,
                &authenticated_base_url,
                &sid_cookie,
                &server_id,
                &app_version,
            )
            .await
            {
                Ok(result) => result,
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

            let supports_pause_resume = capabilities.supports_pause_resume;

            let mut session = state.lock().unwrap();
            let generation = session.connect(identity, client, sid_cookie, supports_pause_resume);
            session.set_resolved_capabilities(api_version, app_version.clone(), capabilities);
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
    // Load server metadata and credentials from repo
    let meta = {
        let repo = server_repo_state.lock().unwrap();
        repo_get_server_meta(&repo, &server_id)
            .ok_or_else(|| format!("Server '{}' not found in repository", server_id))?
    };
    let creds = {
        let repo = server_repo_state.lock().unwrap();
        repo_get_server_credentials(&app, &repo, &server_id).ok_or_else(|| {
            format!(
                "Credentials are required for server '{}' but are not available. Please update server credentials.",
                server_id
            )
        })?
    };
    // Merge username from metadata if credentials came from a legacy bare-password entry.
    let username = if creds.username.is_empty() {
        meta.username.clone()
    } else {
        creds.username.clone()
    };

    let mut identity = ServerIdentity {
        id: meta.id.clone(),
        name: meta.name.clone(),
        url: meta.url.clone(),
        username: username.clone(),
        password: creds.password.clone(),
        api_key: creds.api_key.clone(),
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

    let (parsed_url, allow_http_fallback) = parse_login_url(&meta.url)?;
    let login_result = qbittorrent_login(
        &parsed_url,
        allow_http_fallback,
        creds.api_key.as_deref(),
        &username,
        &creds.password,
    )
    .await;

    match login_result {
        Ok((client, sid_cookie, authenticated_base_url)) => {
            identity.url = authenticated_base_url.clone();
            let app_version =
                match load_app_version(&client, &authenticated_base_url, &sid_cookie, &server_id)
                    .await
                {
                    Ok(app_version) => app_version,
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

            let (api_version, capabilities) = match load_resolved_capabilities(
                &client,
                &authenticated_base_url,
                &sid_cookie,
                &server_id,
                &app_version,
            )
            .await
            {
                Ok(result) => result,
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

            let supports_pause_resume = capabilities.supports_pause_resume;

            if let Err(error_message) = {
                let mut repo = server_repo_state.lock().unwrap();
                repo_persist_authenticated_server(
                    &app,
                    &mut repo,
                    &server_id,
                    &authenticated_base_url,
                    false,
                )
            } {
                let mut session = session_state.lock().unwrap();
                let generation = session.set_error(error_message.clone());
                emit_session_changed(
                    &app,
                    generation,
                    Some(server_id),
                    SessionStatus::Error,
                    Some(error_message.clone()),
                );
                return Err(error_message);
            }

            let mut session = session_state.lock().unwrap();
            let generation = session.connect(identity, client, sid_cookie, supports_pause_resume);
            session.set_resolved_capabilities(api_version, app_version.clone(), capabilities);
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
    // Step 1: Load candidate server metadata and credentials from repo (without touching session)
    let meta = {
        let repo = server_repo_state.lock().unwrap();
        repo_get_server_meta(&repo, &server_id)
            .ok_or_else(|| format!("Server '{}' not found in repository", server_id))?
    };
    let creds = {
        let repo = server_repo_state.lock().unwrap();
        repo_get_server_credentials(&app, &repo, &server_id).ok_or_else(|| {
            format!(
                "Credentials are required for server '{}' but are not available. Please update server credentials.",
                server_id
            )
        })?
    };
    let username = if creds.username.is_empty() {
        meta.username.clone()
    } else {
        creds.username.clone()
    };

    let mut identity = ServerIdentity {
        id: meta.id.clone(),
        name: meta.name.clone(),
        url: meta.url.clone(),
        username: username.clone(),
        password: creds.password.clone(),
        api_key: creds.api_key.clone(),
    };

    // Step 2: Authenticate and probe the candidate server (NO session mutation)
    let (parsed_url, allow_http_fallback) = parse_login_url(&meta.url)?;
    let login_result = qbittorrent_login(
        &parsed_url,
        allow_http_fallback,
        creds.api_key.as_deref(),
        &username,
        &creds.password,
    )
    .await;

    let (client, sid_cookie, supports_pause_resume, api_version, capabilities, app_version) =
        match login_result {
            Ok((client, sid_cookie, authenticated_base_url)) => {
                identity.url = authenticated_base_url.clone();
                let app_version = match load_app_version(
                    &client,
                    &authenticated_base_url,
                    &sid_cookie,
                    &server_id,
                )
                .await
                {
                    Ok(app_version) => app_version,
                    Err(error_message) => {
                        return Err(error_message);
                    }
                };

                let (api_version, capabilities) = load_resolved_capabilities(
                    &client,
                    &authenticated_base_url,
                    &sid_cookie,
                    &server_id,
                    &app_version,
                )
                .await?;

                let supports_pause_resume = capabilities.supports_pause_resume;

                (
                    client,
                    sid_cookie,
                    supports_pause_resume,
                    api_version,
                    capabilities,
                    app_version,
                )
            }
            Err(error) => {
                return Err(error.to_string());
            }
        };

    // Step 3: Candidate is verified — persist its proven effective URL and active
    // selection together. If this fails, session and repository state are untouched.
    {
        let mut repo = server_repo_state.lock().unwrap();
        repo_persist_authenticated_server(&app, &mut repo, &server_id, &identity.url, true)?;
    }

    // Step 4: Repo is saved — now commit the session.
    let generation = {
        let mut session = session_state.lock().unwrap();
        let generation = session.connect(identity, client, sid_cookie, supports_pause_resume);
        session.set_resolved_capabilities(api_version, app_version, capabilities);
        generation
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
    let (parsed_url, allow_http_fallback) = parse_login_url(&identity.url)?;
    let login_result = qbittorrent_login(
        &parsed_url,
        allow_http_fallback,
        identity.api_key.as_deref(),
        &identity.username,
        &identity.password,
    )
    .await;

    match login_result {
        Ok((client, sid_cookie, authenticated_base_url)) => {
            let app_version =
                match load_app_version(&client, &authenticated_base_url, &sid_cookie, &identity.id)
                    .await
                {
                    Ok(app_version) => app_version,
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
            let (api_version, capabilities) = match load_resolved_capabilities(
                &client,
                &authenticated_base_url,
                &sid_cookie,
                &identity.id,
                &app_version,
            )
            .await
            {
                Ok(result) => result,
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
            let supports_pause_resume = capabilities.supports_pause_resume;
            let mut session = session_state.lock().unwrap();
            let generation = session.connect(identity, client, sid_cookie, supports_pause_resume);
            session.set_resolved_capabilities(api_version, app_version.clone(), capabilities);
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
    api_key: Option<String>,
) -> Result<u64, String> {
    let mut session = state.lock().unwrap();
    let identity = ServerIdentity {
        id: server_id,
        name: server_name,
        url: server_url,
        username: server_username,
        password: server_password,
        api_key,
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
    api_key: Option<String>,
) -> Result<u64, String> {
    let mut session = state.lock().unwrap();
    let generation = session.set_connecting(ServerIdentity {
        id: server_id,
        name: server_name,
        url: server_url,
        username: server_username,
        password: server_password,
        api_key,
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
    /// Server's `webapiVersion` string. `None` until a successful connect
    /// (or the "2.0" base profile after a webapiVersion fetch failure).
    pub api_version: Option<String>,
    /// Server's application version string (e.g. "v5.0.0"). `None` until
    /// a successful connect.
    pub app_version: Option<String>,
    /// Resolved boolean capabilities of the connected server. Always
    /// populated once a connection has been attempted; the default
    /// all-false value is what the renderer sees on a fresh process
    /// before any connect.
    pub capabilities: ResolvedCapabilities,
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
            api_version: state.api_version.clone(),
            app_version: state.app_version.clone(),
            capabilities: state.capabilities.clone(),
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
