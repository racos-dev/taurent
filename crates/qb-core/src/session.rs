use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    #[default]
    Disconnected,
    Connecting,
    Connected,
    Error,
}

/// Identity of the server we are connected to.
/// Stored internally in Rust; NOT exposed to the Tauri host.
/// (Password lives here only for reconnection convenience; it must never leak.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerIdentity {
    pub id: String,
    pub name: String,
    pub url: String,
    pub username: String,
    pub password: String,
}

/// Public session state returned to Tauri host (renderer).
/// Contains ONLY safe, non-sensitive fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub server: Option<SafeServerSummary>,
    pub status: SessionStatus,
    pub last_error: Option<String>,
    pub session_generation: u64,
    pub initialized: bool,
    /// Whether the server supports pause/resume endpoints (qBittorrent < v5).
    /// qBittorrent v5+ removed these endpoints; use stop/start instead.
    pub supports_pause_resume: bool,
}

/// Password-free subset of `ServerIdentity`, safe to serialise for Tauri host.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeServerSummary {
    pub id: String,
    pub name: String,
    pub url: String,
    pub username: String,
}

impl From<&ServerIdentity> for SafeServerSummary {
    fn from(id: &ServerIdentity) -> Self {
        SafeServerSummary {
            id: id.id.clone(),
            name: id.name.clone(),
            url: id.url.clone(),
            username: id.username.clone(),
        }
    }
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            server: None,
            status: SessionStatus::Disconnected,
            last_error: None,
            session_generation: 0,
            initialized: true,
            supports_pause_resume: false,
        }
    }
}

impl SessionState {
    pub fn new() -> Self {
        Self::default()
    }

    fn increment_generation(&mut self) -> u64 {
        self.session_generation += 1;
        self.session_generation
    }
}

#[derive(Debug, Default)]
pub struct SessionManager {
    /// Full internal state including credentials and session cookie.
    /// These fields must NEVER be directly serialised into `SessionState`.
    state: SessionState,
    /// Internal credential carrier. Persisted across reconnects.
    server_identity: Option<ServerIdentity>,
    http_client: Option<Client>,
    session_cookie: Option<String>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            state: SessionState::new(),
            server_identity: None,
            http_client: None,
            session_cookie: None,
        }
    }

    pub fn get_state(&self) -> &SessionState {
        &self.state
    }

    pub fn get_http_client(&self) -> Option<&Client> {
        self.http_client.as_ref()
    }

    /// Returns the stored server identity (credentials) for reconnection.
    /// Only set after the first successful connect or set_connecting call.
    pub fn get_server_identity(&self) -> Option<&ServerIdentity> {
        self.server_identity.as_ref()
    }

    /// Returns a safe summary of the currently connected server, if any.
    pub fn get_connected_server(&self) -> Option<SafeServerSummary> {
        self.server_identity.as_ref().map(SafeServerSummary::from)
    }

    pub fn connect(
        &mut self,
        server: ServerIdentity,
        client: Client,
        session_cookie: String,
        supports_pause_resume: bool,
    ) -> u64 {
        self.server_identity = Some(server.clone());
        self.session_cookie = Some(session_cookie);
        self.state.server = Some(SafeServerSummary::from(&server));
        self.state.status = SessionStatus::Connected;
        self.state.last_error = None;
        self.state.supports_pause_resume = supports_pause_resume;
        self.http_client = Some(client);
        log::info!("Session connected to server: {}", server.id);
        self.increment_generation_internal()
    }

    pub fn set_connecting(&mut self, server: ServerIdentity) -> u64 {
        let server_id = server.id.clone();
        self.server_identity = Some(server.clone());
        self.session_cookie = None;
        self.http_client = None;
        self.state.server = Some(SafeServerSummary::from(&server));
        self.state.status = SessionStatus::Connecting;
        self.state.last_error = None;
        log::info!("Session connecting to server: {}", server_id);
        self.increment_generation_internal()
    }

    /// Disconnect and clear session (including cookie).
    /// Server identity is kept internally so `reconnect()` can use it.
    /// The public `state.server` field is cleared so no server info leaks.
    pub fn disconnect(&mut self) -> u64 {
        self.state.server = None;
        self.state.status = SessionStatus::Disconnected;
        self.state.last_error = None;
        self.session_cookie = None;
        self.http_client = None;
        log::info!("Session disconnected (identity preserved for reconnect)");
        self.increment_generation_internal()
    }

    /// Reconnect using the previously stored server identity and credentials.
    /// Returns `Err` if no server was previously set.
    pub fn reconnect(&mut self) -> Result<u64, &'static str> {
        let Some(server_identity) = self.server_identity.as_ref() else {
            return Err("Cannot reconnect: no server currently connected");
        };

        self.session_cookie = None;
        self.http_client = None;
        self.state.server = Some(SafeServerSummary::from(server_identity));
        self.state.status = SessionStatus::Connecting;
        self.state.last_error = None;
        log::info!("Session reconnecting to server: {}", server_identity.id);
        Ok(self.increment_generation_internal())
    }

    /// Returns the session cookie for authenticated requests.
    /// Callers must ensure the session is in `Connected` state before use.
    pub fn get_session_cookie(&self) -> Option<&String> {
        self.session_cookie.as_ref()
    }

    pub fn switch_server(&mut self, new_server: ServerIdentity) -> u64 {
        let old_server_id = self.server_identity.as_ref().map(|s| s.id.clone());
        self.server_identity = Some(new_server.clone());
        self.session_cookie = None;
        self.state.server = Some(SafeServerSummary::from(&new_server));
        self.state.status = SessionStatus::Connecting;
        self.state.last_error = None;
        self.http_client = None;
        log::info!(
            "Session switched from server {:?} to new server",
            old_server_id
        );
        self.increment_generation_internal()
    }

    pub fn set_error(&mut self, error: String) -> u64 {
        self.state.status = SessionStatus::Error;
        self.state.last_error = Some(error.clone());
        log::error!("Session error: {}", error);
        self.increment_generation_internal()
    }

    /// Full teardown: disconnect and also clear the stored server identity.
    /// Use when the session is being destroyed entirely.
    pub fn teardown(&mut self) -> u64 {
        log::info!("Session teardown initiated");
        self.state.server = None;
        self.state.status = SessionStatus::Disconnected;
        self.state.last_error = None;
        self.server_identity = None;
        self.session_cookie = None;
        self.http_client = None;
        self.increment_generation_internal()
    }

    /// Clear error and transition to Disconnected.
    /// Preserves server identity and cookie so the UI can attempt reconnect.
    pub fn clear_error(&mut self) -> u64 {
        self.state.status = SessionStatus::Disconnected;
        self.state.last_error = None;
        log::info!("Session error cleared");
        self.increment_generation_internal()
    }

    /// Refresh the session after a server restart by updating the HTTP client
    /// and session cookie without changing the generation.
    /// This allows the backend to silently recover from stale sessions without
    /// notifying the frontend (which will self-correct on the next maindata poll
    /// via the generation check in the sync_maindata command).
    pub fn refresh_session(&mut self, client: Client, session_cookie: String) {
        self.http_client = Some(client);
        self.session_cookie = Some(session_cookie);
        log::info!("Session refreshed (client and cookie updated, generation unchanged)");
    }

    fn increment_generation_internal(&mut self) -> u64 {
        self.state.increment_generation()
    }
}
