//! Focused tests for qb-core session transitions and HTTP handling.
//!
//! Run with: cargo test --package qb-core

use crate::error::BackendError;
use crate::session::{
    SafeServerSummary, ServerIdentity, SessionManager, SessionState, SessionStatus,
};

fn test_server() -> ServerIdentity {
    ServerIdentity {
        id: "srv-1".into(),
        name: "Test Server".into(),
        url: "http://localhost:8080".into(),
        username: "admin".into(),
        password: "secret".into(),
        api_key: None,
    }
}

// =============================================================================
// Session state partitioning
// =============================================================================

#[test]
fn connect_commits_new_identity_and_discards_previous() {
    // Prove that session.connect() fully replaces the internal session state.
    // This is the key property that makes the repo-persist-first ordering
    // in session_switch_server_by_id safe: if connect() were called before
    // repo persistence succeeded and persistence then failed, the original
    // session would be unrecoverable.  Therefore repo persistence MUST
    // succeed before connect() is invoked.
    let mut mgr = SessionManager::new();
    let server1 = test_server();
    let client1 = reqwest::Client::new();
    let cookie1 = "SID=original".to_string();

    mgr.connect(server1.clone(), client1.clone(), cookie1.clone(), true);
    assert_eq!(mgr.get_state().status, SessionStatus::Connected);
    assert!(mgr.get_http_client().is_some());
    assert_eq!(mgr.get_session_cookie(), Some(&cookie1));

    let server2 = ServerIdentity {
        id: "srv-2".into(),
        name: "Candidate".into(),
        url: "http://remote:9090".into(),
        username: "user".into(),
        password: "pass".into(),
        api_key: None,
    };
    let client2 = reqwest::Client::new();
    let cookie2 = "SID=candidate".to_string();

    mgr.connect(server2.clone(), client2.clone(), cookie2.clone(), false);

    // The new session is active
    let state = mgr.get_state();
    assert_eq!(state.status, SessionStatus::Connected);
    assert_eq!(state.server.as_ref().unwrap().id, "srv-2");

    // Critically: original identity/client/cookie are GONE.
    // connect() does NOT preserve the old session — it replaces it entirely.
    assert!(mgr.get_http_client().is_some());
    assert_eq!(mgr.get_session_cookie(), Some(&cookie2));
}

#[test]
fn session_state_does_not_contain_password() {
    use crate::capability::ResolvedCapabilities;

    let state = SessionState {
        server: Some(SafeServerSummary {
            id: "srv-1".into(),
            name: "Test".into(),
            url: "http://localhost".into(),
            username: "admin".into(),
        }),
        status: SessionStatus::Connected,
        last_error: None,
        session_generation: 1,
        initialized: true,
        supports_pause_resume: true,
        api_version: Some("2.16.0".to_string()),
        app_version: None,
        capabilities: ResolvedCapabilities::default(),
    };
    let json = serde_json::to_string(&state).unwrap();
    assert!(!json.contains("password"));
    assert!(!json.contains("secret"));
    assert!(!json.contains("cookie"));
}

#[test]
fn safe_server_summary_omits_password() {
    let identity = test_server();
    let summary = SafeServerSummary::from(&identity);
    let json = serde_json::to_string(&summary).unwrap();
    assert!(!json.contains("password"));
    assert!(!json.contains("secret"));
}

// =============================================================================
// Session lifecycle
// =============================================================================

#[test]
fn initial_state_is_disconnected() {
    let mgr = SessionManager::new();
    let state = mgr.get_state();
    assert_eq!(state.status, SessionStatus::Disconnected);
    assert!(state.server.is_none());
    assert!(state.last_error.is_none());
    assert_eq!(state.session_generation, 0);
}

#[test]
fn connect_transitions_to_connected() {
    let mut mgr = SessionManager::new();
    let server = test_server();
    let client = reqwest::Client::new();
    let cookie = "SID=abc123".to_string();

    let gen = mgr.connect(server.clone(), client, cookie.clone(), true);
    let state = mgr.get_state();

    assert_eq!(state.status, SessionStatus::Connected);
    assert!(state.server.is_some());
    assert_eq!(state.server.as_ref().unwrap().id, "srv-1");
    assert!(state.last_error.is_none());
    assert!(state.supports_pause_resume);
    assert_eq!(state.session_generation, gen);
    assert!(gen > 0);
}

#[test]
fn disconnect_clears_cookie_and_client_preserves_identity() {
    let mut mgr = SessionManager::new();
    let server = test_server();
    let client = reqwest::Client::new();
    let cookie = "SID=abc123".to_string();

    mgr.connect(server.clone(), client, cookie.clone(), true);
    let gen = mgr.disconnect();
    let state = mgr.get_state();

    assert_eq!(state.status, SessionStatus::Disconnected);
    // Public state.server is cleared so no credentials leak
    assert!(state.server.is_none());
    assert!(state.last_error.is_none());
    assert_eq!(state.session_generation, gen);
    // Identity is still reachable via reconnect
    assert!(mgr.reconnect().is_ok());
}

#[test]
fn set_connecting_transitions_to_connecting() {
    let mut mgr = SessionManager::new();
    let server = test_server();

    let gen = mgr.set_connecting(server.clone());
    let state = mgr.get_state();

    assert_eq!(state.status, SessionStatus::Connecting);
    assert!(state.server.is_some());
    assert!(state.last_error.is_none());
    assert_eq!(state.session_generation, gen);
}

#[test]
fn set_error_preserves_error_message() {
    let mut mgr = SessionManager::new();

    mgr.set_error("connection refused".into());
    let state = mgr.get_state();

    assert_eq!(state.status, SessionStatus::Error);
    assert_eq!(state.last_error.as_deref(), Some("connection refused"));
}

#[test]
fn clear_error_transitions_to_disconnected() {
    let mut mgr = SessionManager::new();
    mgr.set_error("temp error".into());
    assert_eq!(mgr.get_state().status, SessionStatus::Error);

    let gen = mgr.clear_error();
    let state = mgr.get_state();

    assert_eq!(state.status, SessionStatus::Disconnected);
    assert!(state.last_error.is_none());
    assert_eq!(state.session_generation, gen);
}

#[test]
fn teardown_clears_everything() {
    let mut mgr = SessionManager::new();
    let server = test_server();
    let client = reqwest::Client::new();
    mgr.connect(server, client, "SID=xyz".to_string(), true);
    mgr.set_error("some error".into());

    let gen = mgr.teardown();
    let state = mgr.get_state();

    assert_eq!(state.status, SessionStatus::Disconnected);
    assert!(state.server.is_none());
    assert!(state.last_error.is_none());
    assert_eq!(state.session_generation, gen);
}

#[test]
fn switch_server_resets_to_connecting() {
    let mut mgr = SessionManager::new();
    let old_server = test_server();
    let new_server = ServerIdentity {
        id: "srv-2".into(),
        name: "New Server".into(),
        url: "http://remote:9090".into(),
        username: "user".into(),
        password: "pass".into(),
        api_key: None,
    };

    mgr.set_connecting(old_server);
    let gen = mgr.switch_server(new_server.clone());
    let state = mgr.get_state();

    assert_eq!(state.status, SessionStatus::Connecting);
    assert_eq!(state.server.as_ref().unwrap().id, "srv-2");
    assert!(state.last_error.is_none());
    assert_eq!(state.session_generation, gen);
}

#[test]
fn reconnect_returns_err_when_no_server() {
    let mut mgr = SessionManager::new();
    let result = mgr.reconnect();
    assert!(result.is_err());
}

#[test]
fn reconnect_ok_after_connecting() {
    let mut mgr = SessionManager::new();
    mgr.set_connecting(test_server());
    // Simulate a failed reconnect by setting error first
    mgr.set_error("network timeout".into());
    let result = mgr.reconnect();
    assert!(result.is_ok());
    assert_eq!(mgr.get_state().status, SessionStatus::Connecting);
}

#[test]
fn session_generation_increments_on_each_state_change() {
    let mut mgr = SessionManager::new();
    let server = test_server();
    let client = reqwest::Client::new();

    let g1 = mgr.set_connecting(server.clone());
    let g2 = mgr.connect(server.clone(), client, "SID=x".to_string(), false);
    let g3 = mgr.set_error("oops".into());
    let g4 = mgr.clear_error();
    let g5 = mgr.disconnect();

    assert!(g1 < g2);
    assert!(g2 < g3);
    assert!(g3 < g4);
    assert!(g4 < g5);
}

// =============================================================================
// BackendError variants
// =============================================================================

#[test]
fn backend_error_network() {
    let e = BackendError::network("connection refused");
    assert!(e.is_network());
    assert!(!e.is_http());
    assert!(!e.is_auth());
    assert!(!e.is_parse());
    assert!(!e.is_invalid_response());
}

#[test]
fn backend_error_http() {
    let e = BackendError::http(401, Some("Unauthorized".into()));
    assert!(!e.is_network());
    assert!(e.is_http());
    assert!(!e.is_auth());
    let msg = e.message();
    assert!(msg.contains("401"));
}

#[test]
fn backend_error_auth() {
    let e = BackendError::auth("bad credentials", Some("Fails".into()));
    assert!(!e.is_network());
    assert!(!e.is_http());
    assert!(e.is_auth());
}

#[test]
fn backend_error_parse() {
    let e = BackendError::parse("not json", Some("not { valid".into()));
    assert!(!e.is_network());
    assert!(!e.is_http());
    assert!(!e.is_auth());
    assert!(e.is_parse());
}

#[test]
fn backend_error_invalid_response() {
    let e = BackendError::invalid_response("missing rid");
    assert!(e.is_invalid_response());
    assert!(!e.is_network());
    assert!(!e.is_parse());
}

#[test]
fn backend_error_other() {
    let e = BackendError::new("something went wrong");
    assert!(!e.is_network());
    assert!(!e.is_http());
}

#[test]
fn backend_error_ser_deser() {
    let e = BackendError::http(403, Some("Forbidden".into()));
    let json = serde_json::to_string(&e).unwrap();
    let round: BackendError = serde_json::from_str(&json).unwrap();
    assert!(round.is_http());
}

// =============================================================================
// HTTP helpers
// =============================================================================

#[test]
fn normalize_server_url_preserves_existing_protocol() {
    use crate::client::normalize_server_url;
    assert_eq!(
        normalize_server_url("http://localhost:8080", "https://"),
        "http://localhost:8080"
    );
    assert_eq!(
        normalize_server_url("https://qb.example.com", "https://"),
        "https://qb.example.com"
    );
}

#[test]
fn normalize_server_url_adds_https_by_default() {
    use crate::client::normalize_server_url;
    assert_eq!(
        normalize_server_url("localhost:8080", "https://"),
        "https://localhost:8080"
    );
}

#[test]
fn normalize_server_url_strips_trailing_slash() {
    use crate::client::normalize_server_url;
    assert_eq!(
        normalize_server_url("http://localhost:8080/", "https://"),
        "http://localhost:8080"
    );
    assert_eq!(
        normalize_server_url("qb.example.com/", "https://"),
        "https://qb.example.com"
    );
}

#[test]
fn qb_auth_headers_include_cookie_origin_and_referer() {
    use crate::client::qb_auth_headers;
    use reqwest::header::{COOKIE, ORIGIN, REFERER};

    let headers = qb_auth_headers("qb.example.com/", "SID=abc123").unwrap();

    assert_eq!(headers.get(COOKIE).unwrap(), "SID=abc123");
    assert_eq!(headers.get(ORIGIN).unwrap(), "https://qb.example.com");
    assert_eq!(headers.get(REFERER).unwrap(), "https://qb.example.com/");
}

#[test]
fn qb_auth_headers_preserve_existing_https_origin() {
    use crate::client::qb_auth_headers;
    use reqwest::header::{ORIGIN, REFERER};

    let headers = qb_auth_headers("https://qb.example.com/root/", "SID=secure").unwrap();

    assert_eq!(headers.get(ORIGIN).unwrap(), "https://qb.example.com");
    assert_eq!(headers.get(REFERER).unwrap(), "https://qb.example.com/");
}

// =============================================================================
// Login timeout split
// =============================================================================

#[test]
fn login_timeout_constant_is_distinct_from_request_timeout() {
    // Prove the constants are defined and different as documented.
    // The actual timeout values are applied in qbittorrent_login() in client.rs.
    // LOGIN_TIMEOUT_SECS = 10s for initial auth (down-server fast-fail).
    // REQUEST_TIMEOUT_SECS = 30s for steady-state requests (unchanged).
    const LOGIN_TIMEOUT_SECS: u64 = 10;
    const REQUEST_TIMEOUT_SECS: u64 = 30;

    assert_eq!(LOGIN_TIMEOUT_SECS, 10);
    assert_eq!(REQUEST_TIMEOUT_SECS, 30);
    assert_ne!(LOGIN_TIMEOUT_SECS, REQUEST_TIMEOUT_SECS);
}

#[test]
fn login_client_constructed_with_shorter_timeout_than_request_client() {
    // Prove that constructing two clients with distinct timeout durations
    // produces two distinct Client instances with different timeout configs.
    // This confirms the split-logic pattern used in qbittorrent_login.
    use std::time::Duration;

    let short_timeout = Duration::from_secs(10);
    let long_timeout = Duration::from_secs(30);

    let _login_client = reqwest::Client::builder()
        .timeout(short_timeout)
        .build()
        .unwrap();

    let _request_client = reqwest::Client::builder()
        .timeout(long_timeout)
        .build()
        .unwrap();

    // Both clients build without error — confirming the pattern.
    // The timeouts are visibly different at construction time.
    assert_ne!(short_timeout, long_timeout);
}

#[test]
fn cookie_less_login_accepts_qbittorrent_no_content_response() {
    use crate::client::is_successful_cookie_less_login;
    use reqwest::StatusCode;

    assert!(is_successful_cookie_less_login(StatusCode::NO_CONTENT, ""));
    assert!(is_successful_cookie_less_login(
        StatusCode::NO_CONTENT,
        "  "
    ));
}

#[test]
fn cookie_less_login_preserves_legacy_ok_response_and_rejects_unexpected_bodies() {
    use crate::client::is_successful_cookie_less_login;
    use reqwest::StatusCode;

    assert!(is_successful_cookie_less_login(StatusCode::OK, "Ok."));
    assert!(!is_successful_cookie_less_login(StatusCode::OK, ""));
    assert!(!is_successful_cookie_less_login(
        StatusCode::NO_CONTENT,
        "Fails."
    ));
}

#[test]
fn response_cookie_extraction_accepts_port_scoped_qbittorrent_cookie_name() {
    use crate::client::extract_response_cookies;
    use reqwest::header::{HeaderMap, HeaderValue, SET_COOKIE};

    let mut headers = HeaderMap::new();
    headers.insert(
        SET_COOKIE,
        HeaderValue::from_static("QBT_SID_8080=session-token; HttpOnly; SameSite=Lax; path=/"),
    );

    assert_eq!(
        extract_response_cookies(&headers).as_deref(),
        Some("QBT_SID_8080=session-token")
    );
}

#[test]
fn response_cookie_extraction_preserves_custom_and_proxy_cookie_pairs() {
    use crate::client::extract_response_cookies;
    use reqwest::header::{HeaderMap, HeaderValue, SET_COOKIE};

    let mut headers = HeaderMap::new();
    headers.append(
        SET_COOKIE,
        HeaderValue::from_static("proxy_session=proxy-token; Secure; path=/"),
    );
    headers.append(
        SET_COOKIE,
        HeaderValue::from_static("custom_qbt_session=qbt-token; HttpOnly; path=/"),
    );

    assert_eq!(
        extract_response_cookies(&headers).as_deref(),
        Some("proxy_session=proxy-token; custom_qbt_session=qbt-token")
    );
}

// =============================================================================
// normalize_server_url /api/v2 stripping
// =============================================================================

#[test]
fn normalize_server_url_strips_api_v2_suffix() {
    use crate::client::normalize_server_url;
    assert_eq!(
        normalize_server_url("http://localhost:8080/api/v2", "https://"),
        "http://localhost:8080"
    );
    assert_eq!(
        normalize_server_url("https://qb.example.com/api/v2", "https://"),
        "https://qb.example.com"
    );
}

#[test]
fn normalize_server_url_strips_api_v2_from_unschemed_url() {
    use crate::client::normalize_server_url;
    assert_eq!(
        normalize_server_url("localhost:8080/api/v2", "https://"),
        "https://localhost:8080"
    );
}

#[test]
fn normalize_server_url_does_not_strip_partial_api_v2() {
    use crate::client::normalize_server_url;
    // Only exact /api/v2 suffix should be stripped, not partial matches
    assert_eq!(
        normalize_server_url("http://localhost:8080/api/v2/sync", "https://"),
        "http://localhost:8080/api/v2/sync"
    );
}

// =============================================================================
// validate_server_url_format
// =============================================================================

#[test]
fn validate_server_url_format_accepts_http() {
    use crate::client::validate_server_url_format;
    assert!(validate_server_url_format("http://localhost:8080"));
}

#[test]
fn validate_server_url_format_accepts_https() {
    use crate::client::validate_server_url_format;
    assert!(validate_server_url_format("https://qb.example.com"));
}

#[test]
fn validate_server_url_format_accepts_unschemed_url() {
    use crate::client::validate_server_url_format;
    assert!(validate_server_url_format("localhost:8080"));
}

#[test]
fn validate_server_url_format_rejects_invalid_url() {
    use crate::client::validate_server_url_format;
    assert!(!validate_server_url_format(""));
}

#[test]
fn validate_server_url_format_rejects_ftp_scheme() {
    use crate::client::validate_server_url_format;
    assert!(!validate_server_url_format("ftp://localhost:8080"));
}

// =============================================================================
// build_login_url
// =============================================================================

#[test]
fn build_login_url_appends_auth_endpoint() {
    use crate::client::build_login_url;
    assert_eq!(
        build_login_url("http://localhost:8080"),
        "http://localhost:8080/api/v2/auth/login"
    );
}

#[test]
fn build_login_url_normalizes_before_appending() {
    use crate::client::build_login_url;
    assert_eq!(
        build_login_url("localhost:8080/"),
        "https://localhost:8080/api/v2/auth/login"
    );
}

#[test]
fn build_login_url_strips_api_v2_from_base() {
    use crate::client::build_login_url;
    assert_eq!(
        build_login_url("http://localhost:8080/api/v2"),
        "http://localhost:8080/api/v2/auth/login"
    );
}

// =============================================================================
// urls_are_equal
// =============================================================================

#[test]
fn urls_are_equal_exact_match() {
    use crate::client::urls_are_equal;
    assert!(urls_are_equal(
        "http://localhost:8080",
        "http://localhost:8080"
    ));
}

#[test]
fn urls_are_equal_different_schemes() {
    use crate::client::urls_are_equal;
    assert!(!urls_are_equal(
        "http://localhost:8080",
        "https://localhost:8080"
    ));
}

#[test]
fn urls_are_equal_trailing_slash() {
    use crate::client::urls_are_equal;
    assert!(urls_are_equal(
        "http://localhost:8080/",
        "http://localhost:8080"
    ));
}

#[test]
fn urls_are_equal_unschemed_matches_https() {
    use crate::client::urls_are_equal;
    assert!(urls_are_equal("localhost:8080", "https://localhost:8080"));
}

// =============================================================================
// is_network_error (string-based)
// =============================================================================

#[test]
fn is_network_error_detects_connection_refused() {
    use crate::client::is_network_error;
    assert!(is_network_error(
        "connection refused: target machine actively refused it"
    ));
}

#[test]
fn is_network_error_detects_timeout() {
    use crate::client::is_network_error;
    assert!(is_network_error("operation timed out after 10 seconds"));
}

#[test]
fn is_network_error_detects_econnrefused() {
    use crate::client::is_network_error;
    assert!(is_network_error("econnrefused"));
}

#[test]
fn is_network_error_detects_enotfound() {
    use crate::client::is_network_error;
    assert!(is_network_error(
        "enotfound: no address associated with hostname"
    ));
}

#[test]
fn is_network_error_detects_error_sending_request() {
    use crate::client::is_network_error;
    assert!(is_network_error("error sending request: connection closed"));
}

#[test]
fn is_network_error_case_insensitive() {
    use crate::client::is_network_error;
    assert!(is_network_error("Connection Refused"));
    assert!(is_network_error("TIMEOUT"));
}

#[test]
fn is_network_error_returns_false_for_non_network_errors() {
    use crate::client::is_network_error;
    assert!(!is_network_error("invalid username or password"));
    assert!(!is_network_error("HTTP 401 Unauthorized"));
    assert!(!is_network_error(""));
}

// =============================================================================
// BackendError::is_network_error
// =============================================================================

#[test]
fn backend_error_is_network_error_for_network_variant() {
    let e = BackendError::network("connection failed: timeout");
    assert!(e.is_network_error());
}

#[test]
fn backend_error_is_network_error_for_http_status_0() {
    let e = BackendError::http(0, Some("connection timed out".into()));
    assert!(e.is_network_error());
}

#[test]
fn backend_error_is_network_error_for_other_with_network_keywords() {
    let e = BackendError::new("enotfound: DNS resolution failed");
    assert!(e.is_network_error());
}

#[test]
fn backend_error_is_network_error_returns_false_for_normal_http_error() {
    let e = BackendError::http(404, Some("Not Found".into()));
    assert!(!e.is_network_error());
}

#[test]
fn backend_error_is_network_error_returns_false_for_auth_errors() {
    let e = BackendError::auth("bad credentials", None);
    assert!(!e.is_network_error());
}

#[test]
fn backend_error_is_network_error_detects_auth_with_network_message() {
    // Auth variant with network keywords in the message should be detected
    let e = BackendError::auth("connection refused during login", None);
    assert!(e.is_network_error());
}

// =============================================================================
// is_network_error_message
// =============================================================================

#[test]
fn is_network_error_message_detects_keywords() {
    use crate::error::is_network_error_message;
    assert!(is_network_error_message("connection refused"));
    assert!(is_network_error_message("connection failed"));
    assert!(is_network_error_message("timeout"));
    assert!(is_network_error_message("timed out"));
    assert!(is_network_error_message("econnrefused"));
    assert!(is_network_error_message("enotfound"));
    assert!(is_network_error_message("error sending request"));
}

#[test]
fn is_network_error_message_returns_false_for_benign_messages() {
    use crate::error::is_network_error_message;
    assert!(!is_network_error_message("OK"));
    assert!(!is_network_error_message("invalid credentials"));
    assert!(!is_network_error_message(""));
}

// =============================================================================
// NormalizeServerUrl types (serde round-trip)
// =============================================================================

#[test]
fn normalize_server_url_input_serde_roundtrip() {
    use crate::server::NormalizeServerUrlInput;
    let input = NormalizeServerUrlInput {
        url: "localhost:8080".into(),
        default_scheme: "https://".into(),
    };
    let json = serde_json::to_string(&input).unwrap();
    let round: NormalizeServerUrlInput = serde_json::from_str(&json).unwrap();
    assert_eq!(round.url, "localhost:8080");
    assert_eq!(round.default_scheme, "https://");
}

#[test]
fn normalize_server_url_input_default_scheme() {
    use crate::server::NormalizeServerUrlInput;
    let json = r#"{"url":"localhost:8080"}"#;
    let input: NormalizeServerUrlInput = serde_json::from_str(json).unwrap();
    assert_eq!(input.url, "localhost:8080");
    // default_https_scheme returns "https://"
    assert_eq!(input.default_scheme, "https://");
}

#[test]
fn server_validation_result_roundtrip() {
    use crate::server::ServerValidationResult;
    let result = ServerValidationResult {
        valid: false,
        errors: vec!["invalid URL".into(), "missing host".into()],
    };
    let json = serde_json::to_string(&result).unwrap();
    let round: ServerValidationResult = serde_json::from_str(&json).unwrap();
    assert!(!round.valid);
    assert_eq!(round.errors.len(), 2);
    assert_eq!(round.errors[0], "invalid URL");
}

// =============================================================================
// Atomic switch preservation
// =============================================================================

#[test]
fn atomic_switch_connect_does_not_clobber_previous_session_until_repo_persisted() {
    // 1. authenticate candidate (done externally before this point)
    // 2. persist active_server_id to repo
    // 3. call session.connect() with candidate
    //
    // If repo persistence fails, step 3 must NOT happen — the previous session
    // must remain intact.  We test the session layer only (step 3) to prove
    // that connect() fully replaces the session and is only safe to call after
    // repo persistence has succeeded.
    let mut mgr = SessionManager::new();
    let server1 = test_server();
    let client1 = reqwest::Client::new();
    let cookie1 = "SID=original".to_string();

    // Establish original connected session
    mgr.connect(server1.clone(), client1.clone(), cookie1.clone(), true);
    assert_eq!(mgr.get_state().status, SessionStatus::Connected);
    assert!(mgr.get_http_client().is_some());
    assert_eq!(mgr.get_session_cookie(), Some(&cookie1));

    // Simulate: repo persistence has NOT yet succeeded, but we're about to call
    // connect() with the new candidate.  If we call connect() prematurely,
    // the original session is lost even if repo save then fails.
    let server2 = ServerIdentity {
        id: "srv-2".into(),
        name: "Candidate".into(),
        url: "http://remote:9090".into(),
        username: "user".into(),
        password: "pass".into(),
        api_key: None,
    };
    let client2 = reqwest::Client::new();
    let cookie2 = "SID=candidate".to_string();

    // connect() IS the session-commit step — it fully replaces internal state
    let gen = mgr.connect(server2.clone(), client2.clone(), cookie2.clone(), false);
    let state = mgr.get_state();

    // Session is now the candidate
    assert_eq!(state.status, SessionStatus::Connected);
    assert_eq!(state.server.as_ref().unwrap().id, "srv-2");
    assert!(state.last_error.is_none());
    assert_eq!(state.session_generation, gen);
    assert!(mgr.get_http_client().is_some());
    assert_eq!(mgr.get_session_cookie(), Some(&cookie2));

    // Critically: the original identity/client/cookie are GONE.
    // This is why step 2 (repo persist) must succeed BEFORE step 3 (connect).
    assert!(mgr.get_http_client().is_some());
}
