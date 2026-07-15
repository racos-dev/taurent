use qb_core::{
    client as qb_client, client::normalize_server_url, parse_rss_items, parse_rss_rules,
    BackendError, RssItemDto, RssRuleDto, SessionStatus,
};
use tauri::State;

use crate::session::SessionStateHandle;

#[derive(Clone)]
pub struct SessionRequestContext {
    pub client: reqwest::Client,
    pub base_url: String,
    pub session_cookie: String,
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub supports_pause_resume: bool,
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

fn describe_backend_error(path: &str, err: &BackendError) -> String {
    match err {
        BackendError::Http {
            status: 403,
            body_snippet,
        } => format!(
            "Protected request {} was rejected with HTTP 403 Forbidden after login; qBittorrent refused the session cookie or auth headers{}",
            path,
            body_snippet
                .as_deref()
                .map(|snippet| format!(" (body: {:?})", snippet))
                .unwrap_or_default()
        ),
        BackendError::Http {
            status,
            body_snippet,
        } => format!(
            "Request {} failed with HTTP {}{}",
            path,
            status,
            body_snippet
                .as_deref()
                .map(|snippet| format!(" (body: {:?})", snippet))
                .unwrap_or_default()
        ),
        _ => format!("Request {} failed: {}", path, err),
    }
}

pub(crate) fn response_text(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        serde_json::Value::Number(number) => Some(number.to_string()),
        serde_json::Value::Bool(flag) => Some(flag.to_string()),
        other => {
            let rendered = other.to_string();
            let trimmed = rendered.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::response_text;

    #[test]
    fn response_text_preserves_plain_text_numbers() {
        assert_eq!(
            response_text(&serde_json::json!(2.8)),
            Some("2.8".to_string())
        );
    }

    #[test]
    fn response_text_trims_strings() {
        assert_eq!(
            response_text(&serde_json::json!("  v4.6.1.0  ")),
            Some("v4.6.1.0".to_string())
        );
    }
}

fn log_request_failure(
    method: &str,
    request: &SessionRequestContext,
    path: &str,
    final_url: &str,
    err: &BackendError,
) {
    log::error!(
        "QB {} failed: server_id={}, generation={}, url={}, path={}, cookie={}, error={}",
        method,
        request.server_id.as_deref().unwrap_or("<none>"),
        request.session_generation,
        final_url,
        path,
        summarize_cookie(&request.session_cookie),
        describe_backend_error(path, err)
    );
}

pub fn capture_request_context(
    state: &State<'_, SessionStateHandle>,
) -> Result<SessionRequestContext, String> {
    let session = state.lock().map_err(|err| err.to_string())?;

    if session.get_state().status != SessionStatus::Connected {
        return Err("Not connected to server".to_string());
    }

    let server = session
        .get_state()
        .server
        .as_ref()
        .ok_or_else(|| "No server configured".to_string())?;

    let raw_base_url = server.url.clone();
    let server_id: Option<String> = Some(server.id.clone());
    let normalized_base_url = normalize_server_url(&raw_base_url, "https://");

    let session_cookie = session
        .get_session_cookie()
        .cloned()
        .ok_or_else(|| "No session cookie - login may have failed".to_string())?;

    // Use trace in debug builds (filtered out by default), info in release
    #[cfg(debug_assertions)]
    log::trace!(
        "Request context: server_id={}, generation={}, raw_url={}, normalized_url={}, cookie={}",
        server_id.as_deref().unwrap_or("<none>"),
        session.get_state().session_generation,
        raw_base_url,
        normalized_base_url,
        summarize_cookie(&session_cookie)
    );
    #[cfg(not(debug_assertions))]
    log::info!(
        "Request context: server_id={}, generation={}, raw_url={}, normalized_url={}, cookie={}",
        server_id.as_deref().unwrap_or("<none>"),
        session.get_state().session_generation,
        raw_base_url,
        normalized_base_url,
        summarize_cookie(&session_cookie)
    );

    let client = session
        .get_http_client()
        .cloned()
        .ok_or_else(|| "HTTP client not available".to_string())?;

    Ok(SessionRequestContext {
        client,
        base_url: normalized_base_url,
        session_cookie,
        session_generation: session.get_state().session_generation,
        server_id,
        supports_pause_resume: session.get_state().supports_pause_resume,
    })
}

/// Capture request context using a direct `SessionStateHandle` reference.
/// Unlike `capture_request_context`, this does not require a Tauri `State`
/// wrapper, making it suitable for use in background tasks that receive the
/// handle through other means (e.g., shared state passed to spawned tasks).
pub fn capture_request_context_from_handle(
    state: &SessionStateHandle,
) -> Result<SessionRequestContext, String> {
    let session = state.lock().map_err(|err| err.to_string())?;

    if session.get_state().status != SessionStatus::Connected {
        return Err("Not connected to server".to_string());
    }

    let server = session
        .get_state()
        .server
        .as_ref()
        .ok_or_else(|| "No server configured".to_string())?;

    let raw_base_url = server.url.clone();
    let server_id: Option<String> = Some(server.id.clone());
    let normalized_base_url = normalize_server_url(&raw_base_url, "https://");

    let session_cookie = session
        .get_session_cookie()
        .cloned()
        .ok_or_else(|| "No session cookie - login may have failed".to_string())?;

    #[cfg(debug_assertions)]
    log::trace!(
        "Request context (from handle): server_id={}, generation={}, raw_url={}, normalized_url={}",
        server_id.as_deref().unwrap_or("<none>"),
        session.get_state().session_generation,
        raw_base_url,
        normalized_base_url,
    );
    #[cfg(not(debug_assertions))]
    log::info!(
        "Request context (from handle): server_id={}, generation={}, raw_url={}, normalized_url={}",
        server_id.as_deref().unwrap_or("<none>"),
        session.get_state().session_generation,
        raw_base_url,
        normalized_base_url,
    );

    let client = session
        .get_http_client()
        .cloned()
        .ok_or_else(|| "HTTP client not available".to_string())?;

    Ok(SessionRequestContext {
        client,
        base_url: normalized_base_url,
        session_cookie,
        session_generation: session.get_state().session_generation,
        server_id,
        supports_pause_resume: session.get_state().supports_pause_resume,
    })
}

pub async fn qb_get(
    state: &State<'_, SessionStateHandle>,
    path: &str,
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    let final_url = format!("{}{}", request.base_url.trim_end_matches('/'), path);
    log::info!(
        "QB GET: server_id={}, generation={}, url={}, path={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        request.session_generation,
        request.base_url,
        path
    );

    qb_client::qb_get(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        path,
    )
    .await
    .map_err(|err| {
        log_request_failure("GET", &request, path, &final_url, &err);
        describe_backend_error(path, &err)
    })
}

pub async fn qb_post(
    state: &State<'_, SessionStateHandle>,
    path: &str,
    params: &[(&str, &str)],
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    let final_url = format!("{}{}", request.base_url.trim_end_matches('/'), path);
    log::info!(
        "QB POST: server_id={}, generation={}, url={}, path={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        request.session_generation,
        request.base_url,
        path
    );

    qb_client::qb_post_form(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        path,
        params,
    )
    .await
    .map_err(|err| {
        log_request_failure("POST", &request, path, &final_url, &err);
        describe_backend_error(path, &err)
    })
}

pub async fn qb_post_multipart(
    state: &State<'_, SessionStateHandle>,
    path: &str,
    form: reqwest::multipart::Form,
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    let final_url = format!("{}{}", request.base_url.trim_end_matches('/'), path);
    log::info!(
        "QB POST multipart: server_id={}, generation={}, url={}, path={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        request.session_generation,
        request.base_url,
        path
    );

    qb_client::qb_post_multipart(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        path,
        form,
    )
    .await
    .map_err(|err| {
        log_request_failure("POST multipart", &request, path, &final_url, &err);
        describe_backend_error(path, &err)
    })
}

/// Fetch sync maindata from the qBittorrent sync endpoint.
/// Core sync maindata HTTP logic, accepting an already-captured request context.
///
/// Handles the HTTP call and the HTTP-403 stale-cookie recovery path.
/// The caller is responsible for providing a valid, connected session context.
///
/// **Boundary ownership (T144):** this function returns the raw `serde_json::Value`
/// payload. Envelope/container validation is deliberately *not* applied here so
/// the live sync manager and the renderer fallback `sync_maindata` command can
/// see the same upstream data. The hardened validator (`SyncDelta::parse` in
/// `qb-core::sync::accumulator`) runs downstream in `MaindataAccumulator::apply`
/// for the live sync path, which is the strict backend boundary. The fallback
/// Tauri command remains permissive (returns raw JSON to the renderer) because
/// the renderer fallback poller's `mergeMaindata` is intentionally tolerant of
/// weird shapes; see T144.2 / T144.3 for the boundary decision rationale.
///
pub async fn qb_sync_maindata_with_request(
    request: &SessionRequestContext,
    state: &SessionStateHandle,
    rid: Option<u64>,
) -> Result<(u64, serde_json::Value), String> {
    let path = "/api/v2/sync/maindata";

    let final_url = format!("{}{}", request.base_url.trim_end_matches('/'), path);

    #[cfg(debug_assertions)]
    log::trace!(
        "QB SYNC MAIN DATA (with request): server_id={}, generation={}, url={}, rid={:?}",
        request.server_id.as_deref().unwrap_or("<none>"),
        request.session_generation,
        request.base_url,
        rid
    );
    #[cfg(not(debug_assertions))]
    log::debug!(
        "QB SYNC MAIN DATA (with request): server_id={}, generation={}, url={}, rid={:?}",
        request.server_id.as_deref().unwrap_or("<none>"),
        request.session_generation,
        request.base_url,
        rid
    );

    match qb_client::qb_sync_maindata(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        rid,
    )
    .await
    {
        Ok(result) => Ok(result),
        Err(err) if err.is_http_403() => {
            // HTTP 403 on maindata poll indicates the server restarted and the
            // session cookie is stale. Silently re-authenticate using the stored
            // server identity (password available in Rust backend) to get a fresh
            // SID, then retry once with rid=None to establish a clean poll stream.
            log::warn!(
                "sync maindata received HTTP 403 — triggering silent session refresh for server_id={}, generation={}",
                request.server_id.as_deref().unwrap_or("<none>"),
                request.session_generation
            );

            // Extract identity while holding the lock, then release before async login.
            let identity = {
                let session = state.lock().map_err(|e| e.to_string())?;
                session
                    .get_server_identity()
                    .ok_or_else(|| "No server identity available for refresh".to_string())?
                    .clone()
            };
            // Mutex is released — safe to async
            let allow_http_fallback = !identity.url.contains("://");
            let refresh_url = url::Url::parse(&normalize_server_url(&identity.url, "https://"))
                .map_err(|e| format!("Invalid refresh URL: {}", e))?;
            let (new_client, new_cookie, _) = qb_client::qbittorrent_login(
                &refresh_url,
                allow_http_fallback,
                identity.api_key.as_deref(),
                &identity.username,
                &identity.password,
            )
            .await
            .map_err(|e| format!("refresh login failed: {}", e))?;

            // Re-check the active session before applying the refreshed credentials.
            // If the server changed or the generation advanced while we were doing
            // async re-login, discard the refresh result and return a stale signal
            // rather than overwriting a newer session.
            let (applied, current_generation) = {
                let mut session = state.lock().map_err(|e| e.to_string())?;
                let (dominated, current_generation) = {
                    let current = session.get_state();
                    (
                        current.status == SessionStatus::Connected
                            && current.server.as_ref().is_some_and(|s| s.id == identity.id)
                            && current.session_generation == request.session_generation,
                        current.session_generation,
                    )
                };

                if dominated {
                    session.refresh_session(new_client.clone(), new_cookie.clone());
                }

                (dominated, current_generation)
            };

            if !applied {
                log::warn!(
                    "Silent session refresh abandoned — active session changed during re-login (server_id={}, captured_generation={}, current_generation={})",
                    identity.id,
                    request.session_generation,
                    current_generation
                );
                return Err("stale_session_generation".to_string());
            }

            log::info!(
                "Silent session refresh succeeded for server_id={}",
                identity.id
            );

            // Retry with rid=None to get a full snapshot on the fresh session.
            // Use the newly obtained client (new_client), not the pre-refresh
            // request.client, so the retry carries the fresh SID.
            let cookie_for_retry = new_cookie.clone();
            match qb_client::qb_sync_maindata(
                &new_client,
                &request.base_url,
                &cookie_for_retry,
                None,
            )
            .await
            {
                Ok(result) => Ok(result),
                Err(retry_err) => {
                    log::error!(
                        "sync maindata retry after refresh also failed: server_id={}, error={}",
                        request.server_id.as_deref().unwrap_or("<none>"),
                        retry_err
                    );
                    log_request_failure(
                        "SYNC MAIN DATA (retry after refresh)",
                        request,
                        path,
                        &final_url,
                        &retry_err,
                    );
                    Err(describe_backend_error(path, &retry_err))
                }
            }
        }
        Err(err) => {
            log_request_failure("SYNC MAIN DATA", request, path, &final_url, &err);
            Err(describe_backend_error(path, &err))
        }
    }
}

/// Fetch sync maindata from the qBittorrent sync endpoint.
/// Uses the session cookie and returns (new_rid, data).
/// On HTTP 403 (stale session cookie after server restart), automatically
/// re-authenticates and retries once with `rid=None` to recover a clean poll stream.
#[allow(unused_variables)]
pub async fn qb_sync_maindata(
    state: &State<'_, SessionStateHandle>,
    path: &str,
    rid: Option<u64>,
) -> Result<(u64, serde_json::Value), String> {
    let request = capture_request_context(state)?;
    qb_sync_maindata_with_request(&request, state, rid).await
}

/// Fetch RSS items from the qBittorrent RSS endpoint.
/// Fetch sync maindata using a direct `SessionStateHandle` reference.
///
/// Wraps `capture_request_context_from_handle` and `qb_sync_maindata_with_request`.
/// Intended for background tasks that receive the session handle directly rather
/// than through a Tauri `State`, while still reusing the full stale-cookie refresh
/// behavior.
pub async fn qb_sync_maindata_from_handle(
    state: &SessionStateHandle,
    rid: Option<u64>,
) -> Result<(u64, serde_json::Value), String> {
    let request = capture_request_context_from_handle(state)?;
    qb_sync_maindata_with_request(&request, state, rid).await
}

/// Fetch RSS items from the qBittorrent RSS endpoint.
///
/// Returns the raw qBittorrent response parsed through `qb-core::parse_rss_items`
/// into a flat `Vec<RssItemDto>`. Supports the keyed tree, array, and legacy
/// `{ feeds, folders }` shapes — see `qb_core::dto::parse_rss_items` for the
/// full compatibility matrix. Parser failures are surfaced as `Err(String)`
/// so the calling Tauri command can return them to the renderer instead of
/// shipping raw, malformed JSON.
pub async fn qb_get_rss_items(
    state: &State<'_, SessionStateHandle>,
) -> Result<Vec<RssItemDto>, String> {
    let request = capture_request_context(state)?;

    log::info!(
        "QB GET RSS ITEMS: server_id={}, url={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        request.base_url
    );

    let raw =
        qb_client::qb_get_rss_items(&request.client, &request.base_url, &request.session_cookie)
            .await
            .map_err(|err| {
                log::error!(
                    "QB GET RSS ITEMS failed: server_id={}, error={}",
                    request.server_id.as_deref().unwrap_or("<none>"),
                    err
                );
                err.to_string()
            })?;

    parse_rss_items(&raw).map_err(|err| {
        log::error!(
            "QB GET RSS ITEMS parse failed: server_id={}, error={}",
            request.server_id.as_deref().unwrap_or("<none>"),
            err
        );
        err.to_string()
    })
}

/// Fetch RSS rules from the qBittorrent RSS rules endpoint.
///
/// Returns the raw qBittorrent response parsed through `qb-core::parse_rss_rules`
/// into a flat `Vec<RssRuleDto>`. Supports keyed-by-rule-name and wrapped
/// `{ "rules": [...] }` shapes — see `qb_core::dto::parse_rss_rules` for the
/// full compatibility matrix. Parser failures are surfaced as `Err(String)`
/// so the calling Tauri command can return them to the renderer instead of
/// shipping raw, malformed JSON.
pub async fn qb_get_rss_rules(
    state: &State<'_, SessionStateHandle>,
) -> Result<Vec<RssRuleDto>, String> {
    let request = capture_request_context(state)?;

    log::info!(
        "QB GET RSS RULES: server_id={}, url={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        request.base_url
    );

    let raw =
        qb_client::qb_get_rss_rules(&request.client, &request.base_url, &request.session_cookie)
            .await
            .map_err(|err| {
                log::error!(
                    "QB GET RSS RULES failed: server_id={}, error={}",
                    request.server_id.as_deref().unwrap_or("<none>"),
                    err
                );
                err.to_string()
            })?;

    parse_rss_rules(&raw).map_err(|err| {
        log::error!(
            "QB GET RSS RULES parse failed: server_id={}, error={}",
            request.server_id.as_deref().unwrap_or("<none>"),
            err
        );
        err.to_string()
    })
}

/// Add an RSS feed.
pub async fn qb_add_rss_feed(
    state: &State<'_, SessionStateHandle>,
    url: &str,
    path: &str,
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    log::info!(
        "QB ADD RSS FEED: server_id={}, url={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        url
    );

    qb_client::qb_add_rss_feed(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        url,
        path,
    )
    .await
    .map_err(|err| {
        log::error!(
            "QB ADD RSS FEED failed: server_id={}, error={}",
            request.server_id.as_deref().unwrap_or("<none>"),
            err
        );
        err.to_string()
    })
}

/// Change the URL of an existing RSS feed.
pub async fn qb_set_rss_feed_url(
    state: &State<'_, SessionStateHandle>,
    path: &str,
    url: &str,
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    log::info!(
        "QB SET RSS FEED URL: server_id={}, path={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        path
    );

    qb_client::qb_set_rss_feed_url(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        path,
        url,
    )
    .await
    .map_err(|err| {
        log::error!(
            "QB SET RSS FEED URL failed: server_id={}, error={}",
            request.server_id.as_deref().unwrap_or("<none>"),
            err
        );
        err.to_string()
    })
}

/// Remove an RSS item (feed or folder) identified by path.
pub async fn qb_remove_rss_item(
    state: &State<'_, SessionStateHandle>,
    path: &str,
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    log::info!(
        "QB REMOVE RSS ITEM: server_id={}, path={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        path
    );

    qb_client::qb_remove_rss_item(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        path,
    )
    .await
    .map_err(|err| {
        log::error!(
            "QB REMOVE RSS ITEM failed: server_id={}, error={}",
            request.server_id.as_deref().unwrap_or("<none>"),
            err
        );
        err.to_string()
    })
}

/// Create or update an RSS auto-download rule. `rule_def` must be a JSON string.
pub async fn qb_set_rss_rule(
    state: &State<'_, SessionStateHandle>,
    rule_name: &str,
    rule_def: &str,
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    log::info!(
        "QB SET RSS RULE: server_id={}, rule_name={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        rule_name
    );

    qb_client::qb_set_rss_rule(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        rule_name,
        rule_def,
    )
    .await
    .map_err(|err| {
        log::error!(
            "QB SET RSS RULE failed: server_id={}, error={}",
            request.server_id.as_deref().unwrap_or("<none>"),
            err
        );
        err.to_string()
    })
}

/// Rename an RSS auto-download rule.
pub async fn qb_rename_rss_rule(
    state: &State<'_, SessionStateHandle>,
    rule_name: &str,
    new_rule_name: &str,
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    log::info!(
        "QB RENAME RSS RULE: server_id={}, rule_name={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        rule_name
    );

    qb_client::qb_rename_rss_rule(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        rule_name,
        new_rule_name,
    )
    .await
    .map_err(|err| {
        log::error!(
            "QB RENAME RSS RULE failed: server_id={}, error={}",
            request.server_id.as_deref().unwrap_or("<none>"),
            err
        );
        err.to_string()
    })
}

/// Remove an RSS auto-download rule.
pub async fn qb_remove_rss_rule(
    state: &State<'_, SessionStateHandle>,
    rule_name: &str,
) -> Result<serde_json::Value, String> {
    let request = capture_request_context(state)?;

    log::info!(
        "QB REMOVE RSS RULE: server_id={}, rule_name={}",
        request.server_id.as_deref().unwrap_or("<none>"),
        rule_name
    );

    qb_client::qb_remove_rss_rule(
        &request.client,
        &request.base_url,
        &request.session_cookie,
        rule_name,
    )
    .await
    .map_err(|err| {
        log::error!(
            "QB REMOVE RSS RULE failed: server_id={}, error={}",
            request.server_id.as_deref().unwrap_or("<none>"),
            err
        );
        err.to_string()
    })
}
