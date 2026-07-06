//! Canonical shared preferences command group.

use crate::client::{capture_request_context, qb_get, qb_post};
use crate::session::{emit_resource_invalidated, SessionStateHandle};
use qb_core::{
    parse_build_info, parse_preferences, BuildInfoDto, PreferencesDto, PreferencesUpdateDto,
};
use serde::{Deserialize, Serialize};
use tauri::State;

// ============================================================================
// Shared DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreferencesResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub preferences: PreferencesDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebApiVersionResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub webapi_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildInfoResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub build_info: BuildInfoDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultSavePathResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub success: bool,
}

// ============================================================================
// Preferences commands
// ============================================================================

#[tauri::command]
pub async fn get_preferences(
    state: State<'_, SessionStateHandle>,
) -> Result<PreferencesResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let raw = qb_get(&state, "/api/v2/app/preferences")
        .await
        .map_err(|err| {
            log::error!("get_preferences failed: {}", err);
            err
        })?;

    let preferences = parse_preferences(&raw).map_err(|e| e.to_string())?;

    Ok(PreferencesResponse {
        session_generation: gen,
        server_id,
        preferences,
    })
}

#[tauri::command]
pub async fn set_preferences(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    prefs: serde_json::Value,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    // Validate the update payload through the typed DTO.
    let update: PreferencesUpdateDto = serde_json::value::from_value::<PreferencesUpdateDto>(prefs)
        .map_err(|e| format!("invalid preferences payload: {}", e))?;

    // Serialize back to JSON (None fields are skipped)
    let prefs_str = serde_json::to_string(&update)
        .map_err(|e| format!("failed to serialize preferences update: {}", e))?;

    let _ = qb_post(
        &state,
        "/api/v2/app/setPreferences",
        &[("json", prefs_str.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "preferences".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn get_version(state: State<'_, SessionStateHandle>) -> Result<VersionResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/app/version").await?;
    let version = response.as_str().unwrap_or("").to_string();

    Ok(VersionResponse {
        session_generation: gen,
        server_id,
        version,
    })
}

#[tauri::command]
pub async fn get_webapi_version(
    state: State<'_, SessionStateHandle>,
) -> Result<WebApiVersionResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/app/webapiVersion").await?;
    let webapi_version = response.as_str().unwrap_or("").to_string();

    Ok(WebApiVersionResponse {
        session_generation: gen,
        server_id,
        webapi_version,
    })
}

#[tauri::command]
pub async fn get_build_info(
    state: State<'_, SessionStateHandle>,
) -> Result<BuildInfoResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let raw = qb_get(&state, "/api/v2/app/buildInfo").await?;
    let build_info = parse_build_info(&raw).map_err(|e| e.to_string())?;

    Ok(BuildInfoResponse {
        session_generation: gen,
        server_id,
        build_info,
    })
}

#[tauri::command]
pub async fn get_default_save_path(
    state: State<'_, SessionStateHandle>,
) -> Result<DefaultSavePathResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/app/defaultSavePath").await?;
    let path = response.as_str().unwrap_or("").to_string();

    Ok(DefaultSavePathResponse {
        session_generation: gen,
        server_id,
        path,
    })
}

#[tauri::command]
pub async fn shutdown_server(
    state: State<'_, SessionStateHandle>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let _ = qb_post(&state, "/api/v2/app/shutdown", &[]).await?;

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}
