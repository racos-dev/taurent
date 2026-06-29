//! `maindata-sync` Tauri commands.
//!
//! Exposes `get_maindata_snapshot` and `get_maindata_sync_status` to the
//! renderer, plus lifecycle helpers wired to session events.

use tauri::{AppHandle, State};

use crate::session::SessionStateHandle;
use crate::sync::{
    get_maindata_snapshot as do_get_snapshot, start_sync_for_session, stop_sync_for_server,
    SyncManagerRegistry,
};

/// Return the current accumulated maindata snapshot for the active session.
/// The response includes session_generation, server_id, revision, rid, health,
/// and the full accumulated maindata (torrents, categories, tags, server_state).
#[tauri::command]
pub async fn get_maindata_snapshot(
    session_handle: State<'_, SessionStateHandle>,
    registry: State<'_, SyncManagerRegistry>,
) -> Result<crate::sync::MaindataSnapshotResponse, String> {
    do_get_snapshot(&registry, &session_handle)
}

/// Return the current sync health without the full snapshot payload.
/// Useful for lightweight status checks.
#[tauri::command]
pub async fn get_maindata_sync_status(
    session_handle: State<'_, SessionStateHandle>,
    registry: State<'_, SyncManagerRegistry>,
) -> Result<qb_core::sync::MaindataSyncHealth, String> {
    let session = session_handle.lock().map_err(|e| e.to_string())?;
    let state = session.get_state();

    if state.status != qb_core::SessionStatus::Connected {
        return Err("session not connected".to_string());
    }

    let server_id = state
        .server
        .as_ref()
        .map(|s| s.id.clone())
        .ok_or("no active server")?;
    let generation = state.session_generation;
    drop(session);

    let reg = registry.lock().map_err(|e| e.to_string())?;
    let entry = reg
        .get(&server_id)
        .ok_or("no sync manager for active server")?;

    if entry.handle.session_generation != generation {
        return Err("stale_session_generation".to_string());
    }

    let health = entry
        .health
        .try_lock()
        .map_err(|e| format!("health lock poisoned: {}", e))?;
    Ok(health.clone())
}

/// Start the live sync manager for the current session.
/// Called automatically by session lifecycle hooks; exposed as a command for
/// cases where the renderer needs to explicitly restart the sync actor.
#[tauri::command]
pub async fn start_maindata_sync(
    session_handle: State<'_, SessionStateHandle>,
    registry: State<'_, SyncManagerRegistry>,
    app: AppHandle,
) -> Result<(), String> {
    start_sync_for_session(&registry, &session_handle, &app).await
}

/// Stop the live sync manager for a server.
/// Called automatically on disconnect/server switch/teardown.
#[tauri::command]
pub async fn stop_maindata_sync(
    registry: State<'_, SyncManagerRegistry>,
    server_id: String,
) -> Result<(), String> {
    stop_sync_for_server(&registry, &server_id).await
}
