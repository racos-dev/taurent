//! Canonical shared categories command group.

use qb_core::dto::Categories;
use qb_core::normalize::join_categories;
use qb_core::parse_categories;

use crate::client::{capture_request_context, qb_get, qb_post};
use crate::session::{emit_resource_invalidated, SessionStateHandle};
use serde::{Deserialize, Serialize};
use tauri::State;

// ============================================================================
// Shared DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoriesResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub categories: Categories,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub success: bool,
}

// ============================================================================
// Categories commands
// ============================================================================

#[tauri::command]
pub async fn get_categories(
    state: State<'_, SessionStateHandle>,
) -> Result<CategoriesResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let raw = qb_get(&state, "/api/v2/torrents/categories").await?;
    let categories = parse_categories(&raw).map_err(|e| e.to_string())?;

    Ok(CategoriesResponse {
        session_generation: gen,
        server_id,
        categories,
    })
}

#[tauri::command]
pub async fn create_category(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    category: String,
    save_path: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let _ = qb_post(
        &state,
        "/api/v2/torrents/createCategory",
        &[
            ("category", category.as_str()),
            ("savePath", save_path.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "categories".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn edit_category(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    category: String,
    save_path: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let _ = qb_post(
        &state,
        "/api/v2/torrents/editCategory",
        &[
            ("category", category.as_str()),
            ("savePath", save_path.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "categories".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn remove_categories(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    categories: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let categories_param = join_categories(&categories);
    let _ = qb_post(
        &state,
        "/api/v2/torrents/removeCategories",
        &[("categories", categories_param.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "categories".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}
