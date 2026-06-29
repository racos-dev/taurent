//! Canonical shared transfer command group.

use crate::client::{capture_request_context, qb_get, qb_post};
use crate::session::{emit_resource_invalidated, SessionStateHandle};
use qb_core::{parse_transfer_info, TransferInfoDto};
use serde::{Deserialize, Serialize};
use tauri::State;

// ============================================================================
// Shared DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferInfoResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub info: TransferInfoDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedLimitsModeResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadLimitResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub limit: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadLimitResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub limit: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub success: bool,
}

// ============================================================================
// Transfer commands
// ============================================================================

#[tauri::command]
pub async fn get_transfer_info(
    state: State<'_, SessionStateHandle>,
) -> Result<TransferInfoResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let raw = qb_get(&state, "/api/v2/transfer/info").await?;
    let info = parse_transfer_info(&raw).map_err(|e| e.to_string())?;

    Ok(TransferInfoResponse {
        session_generation: gen,
        server_id,
        info,
    })
}

#[tauri::command]
pub async fn get_speed_limits_mode(
    state: State<'_, SessionStateHandle>,
) -> Result<SpeedLimitsModeResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/transfer/speedLimitsMode").await?;
    let mode = response.as_bool().unwrap_or(false);

    Ok(SpeedLimitsModeResponse {
        session_generation: gen,
        server_id,
        mode,
    })
}

#[tauri::command]
pub async fn toggle_speed_limits_mode(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let _ = qb_post(&state, "/api/v2/transfer/toggleSpeedLimitsMode", &[]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "transfer".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn get_download_limit(
    state: State<'_, SessionStateHandle>,
) -> Result<DownloadLimitResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/transfer/downloadLimit").await?;
    let limit = response.as_i64().unwrap_or(0);

    Ok(DownloadLimitResponse {
        session_generation: gen,
        server_id,
        limit,
    })
}

#[tauri::command]
pub async fn set_download_limit(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    limit: i64,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let _ = qb_post(
        &state,
        "/api/v2/transfer/setDownloadLimit",
        &[("limit", &limit.to_string())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "transfer".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn get_upload_limit(
    state: State<'_, SessionStateHandle>,
) -> Result<UploadLimitResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/transfer/uploadLimit").await?;
    let limit = response.as_i64().unwrap_or(0);

    Ok(UploadLimitResponse {
        session_generation: gen,
        server_id,
        limit,
    })
}

/// Get global download limit (mobile bridge compatibility — maps to /api/v2/transfer/downloadLimit).
#[tauri::command]
pub async fn get_global_download_limit(
    state: State<'_, SessionStateHandle>,
) -> Result<DownloadLimitResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/transfer/downloadLimit").await?;
    let limit = response.as_i64().unwrap_or(0);

    Ok(DownloadLimitResponse {
        session_generation: gen,
        server_id,
        limit,
    })
}

/// Get global upload limit (mobile bridge compatibility — maps to /api/v2/transfer/uploadLimit).
#[tauri::command]
pub async fn get_global_upload_limit(
    state: State<'_, SessionStateHandle>,
) -> Result<UploadLimitResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let response = qb_get(&state, "/api/v2/transfer/uploadLimit").await?;
    let limit = response.as_i64().unwrap_or(0);

    Ok(UploadLimitResponse {
        session_generation: gen,
        server_id,
        limit,
    })
}

#[tauri::command]
pub async fn set_upload_limit(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    limit: i64,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let _ = qb_post(
        &state,
        "/api/v2/transfer/setUploadLimit",
        &[("limit", &limit.to_string())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "transfer".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn ban_peers(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    peers: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let peers_param = peers.join("|");
    let _ = qb_post(
        &state,
        "/api/v2/transfer/banPeers",
        &[("peers", peers_param.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "transfer".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn get_cookies(
    state: State<'_, SessionStateHandle>,
) -> Result<serde_json::Value, String> {
    let _request = capture_request_context(&state)?;

    let path = "/api/v2/transfer/getCookies";
    qb_get(&state, path).await
}

#[tauri::command]
pub async fn set_cookies(
    state: State<'_, SessionStateHandle>,
    url: String,
    cookies: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/transfer/setCookies";
    let _ = qb_post(
        &state,
        path,
        &[("url", url.as_str()), ("cookies", cookies.as_str())],
    )
    .await?;

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn logout(state: State<'_, SessionStateHandle>) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/auth/logout";
    let _ = qb_post(&state, path, &[]).await?;

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}
