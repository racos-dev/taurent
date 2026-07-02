//! Canonical shared preferences command group.

use qb_core::capability::{resolve_capabilities, ResolvedCapabilities};

use crate::client::{capture_request_context, qb_get, qb_post, qb_probe};
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

// ============================================================================
// Capability discovery
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CapabilitiesResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub capabilities: ResolvedCapabilities,
}

/// Probe a path and return (status_code, data).
async fn probe_path(
    state: &State<'_, SessionStateHandle>,
    path: &str,
) -> Result<(u16, serde_json::Value), String> {
    let result = qb_probe(state, path).await?;
    Ok((result.status_code, result.data))
}

/// Resolve server capabilities using version strings from the API and probe results.
/// - App version from /api/v2/app/version
/// - API version from /api/v2/app/webapiVersion
/// - Probes /api/v2/search/plugins (search) and /api/v2/rss/items (RSS)
/// - Probes /api/v2/torrents/addWebSeeds without required params to detect
///   web seed mutation endpoint routing without changing server state.
/// Preserves tri-state semantics: probe failure + unknown version → Unknown (not Unsupported).
#[tauri::command]
pub async fn get_server_capabilities(
    state: State<'_, SessionStateHandle>,
) -> Result<CapabilitiesResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    // Fetch version info from the API — gracefully degrade to None on transient failure
    let app_version = match qb_get(&state, "/api/v2/app/version").await {
        Ok(resp) => resp.as_str().map(String::from),
        Err(_) => None,
    };

    let api_version = match qb_get(&state, "/api/v2/app/webapiVersion").await {
        Ok(resp) => resp.as_str().map(String::from),
        Err(_) => None,
    };

    // Probe search endpoint — None = probe failed (network error), Some(true/false) = probe succeeded
    let search_result = probe_path(&state, "/api/v2/search/plugins").await;
    let search_probe_ok: Option<bool> = search_result
        .as_ref()
        .map(|(s, _)| (200..300).contains(s))
        .ok();

    // Probe RSS endpoint
    let rss_result = probe_path(&state, "/api/v2/rss/items").await;
    let rss_probe_ok: Option<bool> = rss_result
        .as_ref()
        .map(|(s, _)| (200..300).contains(s))
        .ok();

    let webseed_result = probe_path(&state, "/api/v2/torrents/addWebSeeds").await;
    let webseed_management_probe_ok: Option<bool> =
        webseed_result
            .as_ref()
            .ok()
            .and_then(|(status, _)| match *status {
                401 | 403 => None,
                404 | 501 => Some(false),
                500..=599 => None,
                _ => Some(true),
            });

    let capabilities = resolve_capabilities(
        api_version.as_deref(),
        app_version.as_deref(),
        search_probe_ok,
        rss_probe_ok,
        webseed_management_probe_ok,
    );

    Ok(CapabilitiesResponse {
        session_generation: gen,
        server_id,
        capabilities,
    })
}
