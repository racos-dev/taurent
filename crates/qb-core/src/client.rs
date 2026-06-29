use reqwest::{
    header::{HeaderMap, HeaderValue, COOKIE, ORIGIN, REFERER},
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

pub async fn qbittorrent_login(
    server_url: &str,
    username: &str,
    password: &str,
) -> BackendResult<(Client, String)> {
    const LOGIN_TIMEOUT_SECS: u64 = 10;
    const REQUEST_TIMEOUT_SECS: u64 = 30;
    const REQUEST_TIMEOUT: std::time::Duration =
        std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS);
    const LOGIN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(LOGIN_TIMEOUT_SECS);

    let base_url = normalize_server_url(server_url, "https://");
    let login_url = format!("{}/api/v2/auth/login", base_url);

    log::info!("Attempting login to: {}", login_url);

    // Short-timeout client for initial authentication only.
    let login_client = Client::builder()
        .timeout(LOGIN_TIMEOUT)
        .build()
        .map_err(|err| BackendError::new(format!("Failed to create login HTTP client: {}", err)))?;

    let response = login_client
        .post(&login_url)
        .form(&[("username", username), ("password", password)])
        .send()
        .await?;

    let sid_cookie = response
        .headers()
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .and_then(|cookie| cookie.split(';').next().map(|value| value.to_string()))
        .ok_or_else(|| BackendError::auth("login response missing Set-Cookie header", None))?;

    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| BackendError::new(format!("Failed to read login response: {}", err)))?;

    let snippet = body_snippet(&bytes);

    if !status.is_success() {
        return Err(BackendError::http(status.as_u16(), snippet));
    }

    let body_text = String::from_utf8_lossy(&bytes);

    log::info!("Login response status: {}, body: {}", status, body_text);

    if body_text.trim() != "Ok." {
        return Err(BackendError::auth(
            format!("unexpected response '{}'", body_text.trim()),
            Some(body_text.trim().to_string()),
        ));
    }

    log::info!("Login successful, session cookie acquired");

    // Authenticated client uses the longer request timeout for steady-state requests.
    let client = Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|err| {
            BackendError::new(format!(
                "Failed to create authenticated HTTP client: {}",
                err
            ))
        })?;

    Ok((client, sid_cookie))
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
