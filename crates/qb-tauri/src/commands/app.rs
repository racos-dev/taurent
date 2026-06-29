//! Canonical shared app command group.
//!
//! Contains app-level commands that are truly app-scoped and don't fit into
//! other categories: global download/upload limits and RSS items/rules.

use crate::client::{qb_get_rss_items, qb_get_rss_rules};
use crate::session::{emit_resource_invalidated, SessionStateHandle};
use qb_core::{RssItemDto, RssRuleDto};
use serde::{Deserialize, Serialize};
use tauri::State;

// Re-export OperationResponse from torrents for convenience
pub use crate::commands::torrents::OperationResponse;

// ============================================================================
// RSS response envelopes (T142.2)
// ============================================================================
//
// `get_rss_items` / `get_rss_rules` return typed envelopes containing the
// parsed `items` / `rules` arrays plus real session context
// (`session_generation`, `server_id`). This mirrors the envelope pattern
// used by other parsed-DTO Tauri commands (e.g. `TorrentPropertiesResponse`,
// `TorrentTrackersResponse`) and removes the legacy `unknown` + synthetic
// envelope workaround in `@taurent/bridge`.

/// Response envelope for `get_rss_items`. `items` is the flat list of
/// `RssItemDto` rows produced by `qb-core::parse_rss_items`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssItemsResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub items: Vec<RssItemDto>,
}

/// Response envelope for `get_rss_rules`. `rules` is the flat list of
/// `RssRuleDto` rows produced by `qb-core::parse_rss_rules`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssRulesResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub rules: Vec<RssRuleDto>,
}

// ============================================================================
// Global limit commands (mobile-only - set per-torrent limits are in torrents)
// ============================================================================

#[tauri::command]
pub async fn set_global_download_limit(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    limit: i64,
) -> Result<OperationResponse, String> {
    let request = crate::client::capture_request_context(&state)?;

    let path = "/api/v2/torrents/setDownloadLimit";
    let limit_str = limit.to_string();
    let _ =
        crate::client::qb_post(&state, path, &[("hashes", "all"), ("limit", &limit_str)]).await?;

    emit_resource_invalidated(
        &app,
        request.session_generation,
        request.server_id.clone(),
        "preferences".to_string(),
    );

    Ok(OperationResponse {
        session_generation: request.session_generation,
        server_id: request.server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_global_upload_limit(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    limit: i64,
) -> Result<OperationResponse, String> {
    let request = crate::client::capture_request_context(&state)?;

    let path = "/api/v2/torrents/setUploadLimit";
    let limit_str = limit.to_string();
    let _ =
        crate::client::qb_post(&state, path, &[("hashes", "all"), ("limit", &limit_str)]).await?;

    emit_resource_invalidated(
        &app,
        request.session_generation,
        request.server_id.clone(),
        "preferences".to_string(),
    );

    Ok(OperationResponse {
        session_generation: request.session_generation,
        server_id: request.server_id,
        success: true,
    })
}

// ============================================================================
// RSS commands
// ============================================================================

#[tauri::command]
pub async fn get_rss_items(
    state: State<'_, SessionStateHandle>,
) -> Result<RssItemsResponse, String> {
    let request = crate::client::capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let items = qb_get_rss_items(&state).await?;

    Ok(RssItemsResponse {
        session_generation: gen,
        server_id,
        items,
    })
}

#[tauri::command]
pub async fn get_rss_rules(
    state: State<'_, SessionStateHandle>,
) -> Result<RssRulesResponse, String> {
    let request = crate::client::capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let rules = qb_get_rss_rules(&state).await?;

    Ok(RssRulesResponse {
        session_generation: gen,
        server_id,
        rules,
    })
}

#[tauri::command]
pub async fn add_rss_feed(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    path: String,
    url: String,
) -> Result<OperationResponse, String> {
    let request = crate::client::capture_request_context(&state)?;

    let _ = crate::client::qb_add_rss_feed(&state, &url, &path).await?;

    emit_resource_invalidated(
        &app,
        request.session_generation,
        request.server_id.clone(),
        "rss".to_string(),
    );

    Ok(OperationResponse {
        session_generation: request.session_generation,
        server_id: request.server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_rss_feed_url(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    path: String,
    url: String,
) -> Result<OperationResponse, String> {
    let request = crate::client::capture_request_context(&state)?;

    let _ = crate::client::qb_set_rss_feed_url(&state, &path, &url).await?;

    emit_resource_invalidated(
        &app,
        request.session_generation,
        request.server_id.clone(),
        "rss".to_string(),
    );

    Ok(OperationResponse {
        session_generation: request.session_generation,
        server_id: request.server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn remove_rss_item(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    path: String,
) -> Result<OperationResponse, String> {
    let request = crate::client::capture_request_context(&state)?;

    let _ = crate::client::qb_remove_rss_item(&state, &path).await?;

    emit_resource_invalidated(
        &app,
        request.session_generation,
        request.server_id.clone(),
        "rss".to_string(),
    );

    Ok(OperationResponse {
        session_generation: request.session_generation,
        server_id: request.server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_rss_rule(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    rule_name: String,
    rule_def: String,
) -> Result<OperationResponse, String> {
    let request = crate::client::capture_request_context(&state)?;

    let _ = crate::client::qb_set_rss_rule(&state, &rule_name, &rule_def).await?;

    emit_resource_invalidated(
        &app,
        request.session_generation,
        request.server_id.clone(),
        "rss".to_string(),
    );

    Ok(OperationResponse {
        session_generation: request.session_generation,
        server_id: request.server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn rename_rss_rule(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    rule_name: String,
    new_rule_name: String,
) -> Result<OperationResponse, String> {
    let request = crate::client::capture_request_context(&state)?;

    let _ = crate::client::qb_rename_rss_rule(&state, &rule_name, &new_rule_name).await?;

    emit_resource_invalidated(
        &app,
        request.session_generation,
        request.server_id.clone(),
        "rss".to_string(),
    );

    Ok(OperationResponse {
        session_generation: request.session_generation,
        server_id: request.server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn remove_rss_rule(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    rule_name: String,
) -> Result<OperationResponse, String> {
    let request = crate::client::capture_request_context(&state)?;

    let _ = crate::client::qb_remove_rss_rule(&state, &rule_name).await?;

    emit_resource_invalidated(
        &app,
        request.session_generation,
        request.server_id.clone(),
        "rss".to_string(),
    );

    Ok(OperationResponse {
        session_generation: request.session_generation,
        server_id: request.server_id,
        success: true,
    })
}
