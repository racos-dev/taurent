use base64::Engine;
use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION, COOKIE, ORIGIN, REFERER},
    multipart::Form,
    Client, Method, RequestBuilder, Url,
};

use crate::error::{BackendError, BackendResult};

pub fn normalize_server_url(server_url: &str, default_scheme: &str) -> String {
    let mut result = if server_url.starts_with("http://") || server_url.starts_with("https://") {
        server_url.trim_end_matches('/').to_string()
    } else {
        format!("{}{}", default_scheme, server_url.trim_end_matches('/'))
    };
    // Strip /api/v2 suffix (only trailing occurrence)
    if result.ends_with("/api/v2") {
        result.truncate(result.len() - 7);
    }
    result
}

/// Validate that a server URL has a proper http or https scheme.
/// If the URL already has a scheme (contains `://`), it is parsed directly and
/// validated to be `http` or `https`. If no scheme is present, `http://` is
/// prepended before parsing.
pub fn validate_server_url_format(url: &str) -> bool {
    if url.contains("://") {
        match Url::parse(url) {
            Ok(parsed) => parsed.scheme() == "http" || parsed.scheme() == "https",
            Err(_) => false,
        }
    } else {
        let with_scheme = format!("http://{}", url);
        Url::parse(&with_scheme).is_ok()
    }
}

/// Build a qBittorrent login URL from a base server URL.
/// Normalizes the URL first (defaulting to https), then appends `/api/v2/auth/login`.
#[cfg(test)]
pub fn build_login_url(base_url: &str) -> String {
    let normalized = normalize_server_url(base_url, "https://");
    format!("{}/api/v2/auth/login", normalized)
}

/// Compare two server URLs for equality after normalizing both.
#[cfg(test)]
pub fn urls_are_equal(url1: &str, url2: &str) -> bool {
    normalize_server_url(url1, "https://") == normalize_server_url(url2, "https://")
}

/// Check if an error message string indicates a network-level failure.
/// Matches case-insensitively against common network error keywords.
pub fn is_network_error(error: &str) -> bool {
    crate::error::is_network_error_message(error)
}

fn qb_server_origin(base_url: &str) -> BackendResult<String> {
    let normalized = normalize_server_url(base_url, "https://");
    let parsed = Url::parse(&normalized)
        .map_err(|err| BackendError::new(format!("Invalid qBittorrent server URL: {}", err)))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| BackendError::new("qBittorrent server URL is missing a host"))?;

    let mut origin = format!("{}://{}", parsed.scheme(), host);
    if let Some(port) = parsed.port() {
        origin.push_str(&format!(":{}", port));
    }

    Ok(origin)
}

pub(crate) fn qb_auth_headers(base_url: &str, cookie: &str) -> BackendResult<HeaderMap> {
    let origin = qb_server_origin(base_url)?;
    let referer = format!("{}/", origin);
    let mut headers = HeaderMap::new();

    let cookie_value = HeaderValue::from_str(cookie)
        .map_err(|err| BackendError::new(format!("Invalid qBittorrent cookie header: {}", err)))?;
    let origin_value = HeaderValue::from_str(&origin)
        .map_err(|err| BackendError::new(format!("Invalid qBittorrent origin header: {}", err)))?;
    let referer_value = HeaderValue::from_str(&referer)
        .map_err(|err| BackendError::new(format!("Invalid qBittorrent referer header: {}", err)))?;

    headers.insert(COOKIE, cookie_value);
    headers.insert(ORIGIN, origin_value);
    headers.insert(REFERER, referer_value);

    Ok(headers)
}

fn qb_authenticated_request(
    client: &Client,
    method: Method,
    url: String,
    base_url: &str,
    cookie: &str,
) -> BackendResult<RequestBuilder> {
    Ok(client
        .request(method, url)
        .headers(qb_auth_headers(base_url, cookie)?))
}

/// Truncate a byte slice to a UTF-8-safe string snippet for error reporting.
fn body_snippet(bytes: &[u8]) -> Option<String> {
    const MAX: usize = 200;
    let trimmed = if bytes.len() > MAX {
        &bytes[..MAX]
    } else {
        bytes
    };
    String::from_utf8_lossy(trimmed).trim().to_string().into()
}

/// Authenticate against a qBittorrent server and return an HTTP client
/// suitable for steady-state requests plus a session cookie string.
///
/// # Authentication modes
///
/// - **API key** (`api_key = Some(_)`): builds a `reqwest::Client` whose
///   `default_headers` carry `Authorization: Bearer qbt_<key>`. No login
///   POST is performed and the returned cookie is the empty string.
///
/// - **Username + password** (`api_key = None`): POSTs the credentials to
///   `/api/v2/auth/login`. On 2xx, the `Set-Cookie: SID=...` header is
///   extracted and returned alongside a fresh `reqwest::Client`. On
///   non-2xx, retries with HTTP Basic auth against `/api/v2/app/version`
///   (used by some reverse-proxy setups). When the proxy issues an SID
///   cookie the client is plain and the cookie is returned; otherwise the
///   client carries an `Authorization: Basic …` default header.
///
/// # Scheme fallback
///
/// When `url.scheme()` is empty (i.e. no explicit `http://` or `https://`),
/// the function attempts HTTPS first and only falls back to HTTP if the
/// HTTPS attempt fails with a network-level error. The fallback logs a
/// warning when credentials are sent over plaintext HTTP.
pub async fn qbittorrent_login(
    url: &Url,
    api_key: Option<&str>,
    username: &str,
    password: &str,
) -> BackendResult<(Client, String)> {
    const LOGIN_TIMEOUT_SECS: u64 = 10;
    const REQUEST_TIMEOUT_SECS: u64 = 30;
    const REQUEST_TIMEOUT: std::time::Duration =
        std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS);
    const LOGIN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(LOGIN_TIMEOUT_SECS);

    // API key path: no login POST, just build a bearer-auth client.
    if let Some(key) = api_key.filter(|k| !k.is_empty()) {
        log::info!(
            "Using API key authentication for {}",
            redact_credentials_in_url(url)
        );
        let mut headers = HeaderMap::new();
        let auth_value = format!("Bearer qbt_{}", key);
        let header_value = HeaderValue::from_str(&auth_value)
            .map_err(|err| BackendError::new(format!("Invalid API key header value: {}", err)))?;
        headers.insert(AUTHORIZATION, header_value);
        let client = Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .default_headers(headers)
            .build()
            .map_err(|err| {
                BackendError::new(format!("Failed to create API-key HTTP client: {}", err))
            })?;
        return Ok((client, String::new()));
    }

    // Username/password path: try login with scheme fallback if needed.
    let (login_outcome, used_http_fallback) = if url.scheme().is_empty()
        || (!url.scheme().eq_ignore_ascii_case("http")
            && !url.scheme().eq_ignore_ascii_case("https"))
    {
        // Try https first
        let https_attempt = attempt_login(url, "https", username, password, LOGIN_TIMEOUT).await;
        match https_attempt {
            Ok(result) => (result, false),
            Err(err) if err.is_network_error() => {
                // Fall back to http
                log::warn!(
                    "HTTPS login failed for {}, falling back to HTTP (credentials will be sent in plaintext)",
                    redact_credentials_in_url(url)
                );
                let http_attempt =
                    attempt_login(url, "http", username, password, LOGIN_TIMEOUT).await?;
                (http_attempt, true)
            }
            Err(err) => return Err(err),
        }
    } else {
        let scheme = url.scheme();
        let result = attempt_login(url, scheme, username, password, LOGIN_TIMEOUT).await?;
        (result, scheme.eq_ignore_ascii_case("http"))
    };

    if used_http_fallback {
        log::warn!(
            "Authenticated session established over plaintext HTTP for {}",
            redact_credentials_in_url(url)
        );
    }

    // Build the steady-state authenticated client. If the login outcome
    // requires Authorization headers baked in (API key or Basic auth without
    // SID), propagate them via default_headers.
    let mut builder = Client::builder().timeout(REQUEST_TIMEOUT);
    if let Some(extra) = login_outcome.default_headers {
        builder = builder.default_headers(extra);
    }
    let client = builder.build().map_err(|err| {
        BackendError::new(format!(
            "Failed to create authenticated HTTP client: {}",
            err
        ))
    })?;

    Ok((client, login_outcome.cookie))
}

/// Outcome of a login attempt that may need Authorization headers
/// propagated to the steady-state client.
struct LoginOutcome {
    /// Session cookie string to attach to subsequent requests (may be empty).
    cookie: String,
    /// Optional default headers (e.g. `Authorization: Bearer …` or `Basic …`)
    /// to bake into the long-lived HTTP client.
    default_headers: Option<HeaderMap>,
}

/// Attempt a single username/password login against the given scheme.
///
/// On a non-2xx auth login, falls back to a Basic-auth probe of
/// `/api/v2/app/version` to support reverse-proxy deployments that
/// authenticate the connection itself.
async fn attempt_login(
    base: &Url,
    scheme: &str,
    username: &str,
    password: &str,
    login_timeout: std::time::Duration,
) -> BackendResult<LoginOutcome> {
    let mut resolved = base.clone();
    resolved
        .set_scheme(scheme)
        .map_err(|err| BackendError::new(format!("Invalid URL scheme: {:?}", err)))?;
    // Ensure path is at least root
    if resolved.path().is_empty() {
        resolved.set_path("/");
    }

    let login_url = format!("{}api/v2/auth/login", resolved);
    log::info!("Attempting login to: {}", login_url);

    let login_client = Client::builder()
        .timeout(login_timeout)
        .build()
        .map_err(|err| BackendError::new(format!("Failed to create login HTTP client: {}", err)))?;

    let response = login_client
        .post(&login_url)
        .form(&[("username", username), ("password", password)])
        .send()
        .await?;

    let status = response.status();

    if status.is_success() {
        // Extract SID cookie from Set-Cookie header before consuming body.
        let sid_cookie = response
            .headers()
            .get("set-cookie")
            .and_then(|value| value.to_str().ok())
            .and_then(|cookie| cookie.split(';').next().map(|value| value.to_string()));

        let bytes = response
            .bytes()
            .await
            .map_err(|err| BackendError::new(format!("Failed to read login response: {}", err)))?;

        let body_text = String::from_utf8_lossy(&bytes);
        log::info!("Login response status: {}, body: {}", status, body_text);

        match sid_cookie {
            Some(cookie) if cookie.starts_with("SID=") => {
                log::info!("Login successful, session cookie acquired");
                Ok(LoginOutcome {
                    cookie,
                    default_headers: None,
                })
            }
            _ => {
                if body_text.trim() != "Ok." {
                    return Err(BackendError::auth(
                        format!("unexpected response '{}'", body_text.trim()),
                        Some(body_text.trim().to_string()),
                    ));
                }
                // No SID cookie but 2xx + "Ok.": trust the login but use empty cookie.
                // The downstream client will need to add Authorization header separately.
                log::warn!(
                    "Login succeeded with no Set-Cookie SID for {}; downstream requests may need Authorization header",
                    login_url
                );
                Ok(LoginOutcome {
                    cookie: String::new(),
                    default_headers: None,
                })
            }
        }
    } else {
        // Non-2xx: try Basic-auth probe against app/version in case a reverse proxy
        // is in front of qBittorrent.
        log::warn!(
            "Login POST returned non-success status {} for {}; probing Basic auth",
            status,
            login_url
        );
        try_basic_auth_probe(&resolved, username, password, login_timeout).await
    }
}

/// Attempt a Basic-auth GET against `/api/v2/app/version` to recover from a
/// failed login POST — supports reverse-proxy auth setups.
async fn try_basic_auth_probe(
    resolved: &Url,
    username: &str,
    password: &str,
    login_timeout: std::time::Duration,
) -> BackendResult<LoginOutcome> {
    let version_url = format!("{}api/v2/app/version", resolved);
    let basic = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{}:{}", username, password).as_bytes())
    );
    let header_value = HeaderValue::from_str(&basic)
        .map_err(|err| BackendError::new(format!("Invalid Basic auth header: {}", err)))?;
    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, header_value);

    let client = Client::builder()
        .timeout(login_timeout)
        .default_headers(headers.clone())
        .build()
        .map_err(|err| {
            BackendError::new(format!("Failed to build Basic-auth probe client: {}", err))
        })?;

    let response = client.get(&version_url).send().await?;
    let status = response.status();

    if !status.is_success() {
        let bytes = response
            .bytes()
            .await
            .map_err(|err| BackendError::new(format!("Failed to read probe response: {}", err)))?;
        return Err(BackendError::http(status.as_u16(), body_snippet(&bytes)));
    }

    // 2xx: did the proxy also issue an SID cookie?
    let sid_cookie = response
        .headers()
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .and_then(|cookie| cookie.split(';').next().map(|value| value.to_string()))
        .filter(|c| c.starts_with("SID="));

    match sid_cookie {
        Some(cookie) => Ok(LoginOutcome {
            cookie,
            default_headers: None,
        }),
        None => Ok(LoginOutcome {
            // No cookie — downstream clients should attach Authorization header
            // to every request.
            cookie: String::new(),
            default_headers: Some(headers),
        }),
    }
}

/// Redact credentials-bearing portions of a URL for logging.
fn redact_credentials_in_url(url: &Url) -> String {
    if url.password().is_some() || url.username() != "" {
        let mut clone = url.clone();
        let _ = clone.set_password(None);
        let _ = clone.set_username("");
        clone.to_string()
    } else {
        url.to_string()
    }
}

pub async fn qb_get(
    client: &Client,
    base_url: &str,
    cookie: &str,
    path: &str,
) -> BackendResult<serde_json::Value> {
    let url = format!("{}{}", normalize_server_url(base_url, "https://"), path);
    let response = qb_authenticated_request(client, Method::GET, url, base_url, cookie)?
        .send()
        .await?;

    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| BackendError::new(format!("Failed to read response: {}", err)))?;

    if !status.is_success() {
        return Err(BackendError::http(status.as_u16(), body_snippet(&bytes)));
    }

    parse_response_bytes(bytes.to_vec())
}

pub async fn qb_post_form(
    client: &Client,
    base_url: &str,
    cookie: &str,
    path: &str,
    params: &[(&str, &str)],
) -> BackendResult<serde_json::Value> {
    let url = format!("{}{}", normalize_server_url(base_url, "https://"), path);
    let response = qb_authenticated_request(client, Method::POST, url, base_url, cookie)?
        .form(params)
        .send()
        .await?;

    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| BackendError::new(format!("Failed to read response: {}", err)))?;

    if !status.is_success() {
        return Err(BackendError::http(status.as_u16(), body_snippet(&bytes)));
    }

    parse_response_bytes(bytes.to_vec())
}

pub async fn qb_post_multipart(
    client: &Client,
    base_url: &str,
    cookie: &str,
    path: &str,
    form: Form,
) -> BackendResult<serde_json::Value> {
    let url = format!("{}{}", normalize_server_url(base_url, "https://"), path);
    let response = qb_authenticated_request(client, Method::POST, url, base_url, cookie)?
        .multipart(form)
        .send()
        .await?;

    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| BackendError::new(format!("Failed to read response: {}", err)))?;

    if !status.is_success() {
        return Err(BackendError::http(status.as_u16(), body_snippet(&bytes)));
    }

    parse_response_bytes(bytes.to_vec())
}

fn parse_response_bytes(bytes: Vec<u8>) -> BackendResult<serde_json::Value> {
    if bytes.is_empty() {
        return Ok(serde_json::Value::Null);
    }

    match serde_json::from_slice(&bytes) {
        Ok(value) => Ok(value),
        Err(_) => Ok(serde_json::Value::String(
            String::from_utf8_lossy(&bytes).trim().to_string(),
        )),
    }
}

/// Probe result containing HTTP status code and response data.
/// Used for capability detection to distinguish 404/405 from other errors.
pub struct ProbeResponse {
    pub status_code: u16,
    pub data: serde_json::Value,
}

/// Send a GET request and return the status code along with response data.
/// Does NOT error on non-2xx responses - callers inspect status_code to determine outcome.
pub async fn qb_probe(
    client: &Client,
    base_url: &str,
    cookie: &str,
    path: &str,
) -> BackendResult<ProbeResponse> {
    let url = format!("{}{}", normalize_server_url(base_url, "https://"), path);
    let response = qb_authenticated_request(client, Method::GET, url, base_url, cookie)?
        .send()
        .await?;

    let status_code = response.status().as_u16();

    let bytes = response
        .bytes()
        .await
        .map_err(|err| BackendError::new(format!("Failed to read response: {}", err)))?;

    let data = if bytes.is_empty() {
        serde_json::Value::Null
    } else {
        match serde_json::from_slice(&bytes) {
            Ok(value) => value,
            Err(_) => serde_json::Value::String(String::from_utf8_lossy(&bytes).trim().to_string()),
        }
    };

    Ok(ProbeResponse { status_code, data })
}

/// Fetch sync maindata from the qBittorrent sync endpoint.
/// Returns `BackendError::Http` on non-2xx responses (including 304 Not Modified).
/// Returns `BackendError::InvalidResponse` when the response JSON is missing the 'rid' field.
pub async fn qb_sync_maindata(
    client: &Client,
    base_url: &str,
    cookie: &str,
    rid: Option<u64>,
) -> BackendResult<(u64, serde_json::Value)> {
    let mut url = format!(
        "{}/api/v2/sync/maindata",
        normalize_server_url(base_url, "https://")
    );
    if let Some(r) = rid {
        url.push_str(&format!("?rid={}", r));
    }

    let response = qb_authenticated_request(client, Method::GET, url, base_url, cookie)?
        .send()
        .await?;

    let status = response.status();
    if !status.is_success() {
        let bytes = response
            .bytes()
            .await
            .map_err(|err| BackendError::new(format!("Failed to read response: {}", err)))?;
        return Err(BackendError::http(status.as_u16(), body_snippet(&bytes)));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| BackendError::new(format!("Failed to read response: {}", err)))?;

    if bytes.is_empty() {
        return Err(BackendError::invalid_response(
            "empty response from sync maindata",
        ));
    }

    let data = serde_json::from_slice::<serde_json::Value>(&bytes)
        .map_err(|err| BackendError::parse(format!("JSON error: {}", err), body_snippet(&bytes)))?;

    let new_rid = data.get("rid").and_then(|v| v.as_u64()).ok_or_else(|| {
        BackendError::invalid_response("missing 'rid' field in sync maindata response")
    })?;

    Ok((new_rid, data))
}

/// Fetch RSS items from the qBittorrent RSS endpoint.
pub async fn qb_get_rss_items(
    client: &Client,
    base_url: &str,
    cookie: &str,
) -> BackendResult<serde_json::Value> {
    qb_get(client, base_url, cookie, "/api/v2/rss/items").await
}

/// Fetch RSS rules from the qBittorrent RSS rules endpoint.
pub async fn qb_get_rss_rules(
    client: &Client,
    base_url: &str,
    cookie: &str,
) -> BackendResult<serde_json::Value> {
    qb_get(client, base_url, cookie, "/api/v2/rss/rules").await
}

/// Add an RSS feed. `path` is the destination folder path (use empty string for root).
pub async fn qb_add_rss_feed(
    client: &Client,
    base_url: &str,
    cookie: &str,
    url: &str,
    path: &str,
) -> BackendResult<serde_json::Value> {
    qb_post_form(
        client,
        base_url,
        cookie,
        "/api/v2/rss/addFeed",
        &[("url", url), ("path", path)],
    )
    .await
}

/// Change the URL of an existing RSS feed identified by `path`.
pub async fn qb_set_rss_feed_url(
    client: &Client,
    base_url: &str,
    cookie: &str,
    path: &str,
    url: &str,
) -> BackendResult<serde_json::Value> {
    qb_post_form(
        client,
        base_url,
        cookie,
        "/api/v2/rss/setFeedURL",
        &[("path", path), ("url", url)],
    )
    .await
}

/// Remove an RSS item (feed or folder) identified by `path`.
pub async fn qb_remove_rss_item(
    client: &Client,
    base_url: &str,
    cookie: &str,
    path: &str,
) -> BackendResult<serde_json::Value> {
    qb_post_form(
        client,
        base_url,
        cookie,
        "/api/v2/rss/removeItem",
        &[("path", path)],
    )
    .await
}

/// Create or update an RSS auto-download rule. `rule_def` must be a JSON string.
pub async fn qb_set_rss_rule(
    client: &Client,
    base_url: &str,
    cookie: &str,
    rule_name: &str,
    rule_def: &str,
) -> BackendResult<serde_json::Value> {
    qb_post_form(
        client,
        base_url,
        cookie,
        "/api/v2/rss/setRule",
        &[("ruleName", rule_name), ("ruleDef", rule_def)],
    )
    .await
}

/// Rename an RSS auto-download rule.
pub async fn qb_rename_rss_rule(
    client: &Client,
    base_url: &str,
    cookie: &str,
    rule_name: &str,
    new_rule_name: &str,
) -> BackendResult<serde_json::Value> {
    qb_post_form(
        client,
        base_url,
        cookie,
        "/api/v2/rss/renameRule",
        &[("ruleName", rule_name), ("newRuleName", new_rule_name)],
    )
    .await
}

/// Remove an RSS auto-download rule.
pub async fn qb_remove_rss_rule(
    client: &Client,
    base_url: &str,
    cookie: &str,
    rule_name: &str,
) -> BackendResult<serde_json::Value> {
    qb_post_form(
        client,
        base_url,
        cookie,
        "/api/v2/rss/removeRule",
        &[("ruleName", rule_name)],
    )
    .await
}
