//! Canonical shared tags command group.

use qb_core::normalize::join_tags;
use qb_core::parse_tags;

use crate::client::{capture_request_context, qb_get, qb_post};
use crate::session::{emit_resource_invalidated, SessionStateHandle};
use serde::{Deserialize, Serialize};
use tauri::State;

// ============================================================================
// Shared DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagsResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub success: bool,
}

// ============================================================================
// Tags commands
// ============================================================================

#[tauri::command]
pub async fn get_tags(state: State<'_, SessionStateHandle>) -> Result<TagsResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/torrents/tags").await?;
    let tags = parse_tags(&response).map_err(|e| e.to_string())?;

    Ok(TagsResponse {
        session_generation: gen,
        server_id,
        tags,
    })
}

#[tauri::command]
pub async fn create_tags(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    tags: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let tags_param = join_tags(&tags);
    let _ = qb_post(
        &state,
        "/api/v2/torrents/createTags",
        &[("tags", tags_param.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "tags".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn delete_tags(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    tags: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let tags_param = join_tags(&tags);
    let _ = qb_post(
        &state,
        "/api/v2/torrents/deleteTags",
        &[("tags", tags_param.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "tags".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn add_torrent_tags(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    tags: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let hashes_param = hashes.join("|");
    let tags_param = join_tags(&tags);
    let _ = qb_post(
        &state,
        "/api/v2/torrents/addTags",
        &[
            ("hashes", hashes_param.as_str()),
            ("tags", tags_param.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "tags".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn remove_torrent_tags(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    tags: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let hashes_param = hashes.join("|");
    let tags_param = join_tags(&tags);
    let _ = qb_post(
        &state,
        "/api/v2/torrents/removeTags",
        &[
            ("hashes", hashes_param.as_str()),
            ("tags", tags_param.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "tags".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}
