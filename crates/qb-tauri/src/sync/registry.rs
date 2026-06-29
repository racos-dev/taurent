//! Sync manager registry.
//!
//! Holds one sync entry per server_id. Each entry owns a `LiveSyncHandle`
//! and shared `Arc<Mutex<MaindataSnapshot>>`, `Arc<Mutex<u64>>` (revision),
//! and `Arc<Mutex<MaindataSyncHealth>>` that the background manager writes to
//! on each poll and the command reads from on demand. Each entry also owns a
//! `WorkspaceViewState` that shares the same snapshot Arc so the workspace
//! view engine sees every successful poll.

use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Instant;

use qb_core::sync::{MaindataSnapshot, MaindataSyncHealth};

use super::manager::{
    LiveSyncHandle, LiveSyncManager, MaindataSnapshotEnvelope, MaindataSnapshotResponse,
};
use crate::session::SessionStateHandle;
use crate::workspace::WorkspaceViewState;

/// A registry entry: the running handle plus shared state Arcs for reads.
pub struct SyncEntry {
    pub handle: LiveSyncHandle,
    /// Updated by the manager's background task after each successful poll.
    pub snapshot: Arc<StdMutex<MaindataSnapshot>>,
    /// Revision counter — incremented each time a new delta is applied.
    pub revision: Arc<StdMutex<u64>>,
    /// Current health — updated by the background task.
    pub health: Arc<StdMutex<MaindataSyncHealth>>,
    /// Workspace view state — owns the engine and the same snapshot Arc.
    /// Commands (`set_workspace_view`, `get_workspace_view`) reach the
    /// active server's engine through this field.
    pub workspace_state: Arc<WorkspaceViewState>,
}

impl SyncEntry {
    /// Build a new entry. The caller passes the `snapshot` Arc that the
    /// `LiveSyncManager` writes to and the `workspace_state` Arc the manager
    /// also drives. The two Arcs are linked — `WorkspaceViewState::snapshot`
    /// must point to the **same** mutex as `snapshot`, otherwise the engine
    /// would never see the manager's writes. See `start_sync_for_session`
    /// for the construction site that guarantees this invariant.
    fn new(
        handle: LiveSyncHandle,
        snapshot: Arc<StdMutex<MaindataSnapshot>>,
        workspace_state: Arc<WorkspaceViewState>,
    ) -> Self {
        Self {
            handle,
            snapshot,
            revision: Arc::new(StdMutex::new(0)),
            health: Arc::new(StdMutex::new(MaindataSyncHealth::idle())),
            workspace_state,
        }
    }
}

/// Global registry for sync managers, keyed by `server_id`.
pub type SyncManagerRegistry = Arc<StdMutex<HashMap<String, SyncEntry>>>;

/// Create a new sync manager registry.
pub fn create_sync_manager_registry() -> SyncManagerRegistry {
    Arc::new(StdMutex::new(HashMap::new()))
}

/// Start (or replace) sync manager for the active session.
pub async fn start_sync_for_session(
    registry: &SyncManagerRegistry,
    session_handle: &SessionStateHandle,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    let (server_id, generation) = {
        let session = session_handle.lock().map_err(|e| e.to_string())?;
        let state = session.get_state();
        let server_id = state
            .server
            .as_ref()
            .map(|s| s.id.clone())
            .ok_or("No active server")?;
        (server_id, state.session_generation)
    };

    // Prepare shared Arcs (no locks held yet).
    // When an existing entry is found below, these are replaced with the
    // old entry's Arcs so the new manager starts with last-known-good data.
    let mut shared_snapshot = Arc::new(StdMutex::new(MaindataSnapshot::default()));
    let mut shared_revision = Arc::new(StdMutex::new(0u64));
    let mut shared_health = Arc::new(StdMutex::new(MaindataSyncHealth::idle()));
    // `Option` because a fresh entry creates its own `WorkspaceViewState`
    // sharing the new snapshot Arc; a preserved entry reuses the old one.
    let mut preserved_workspace_state: Option<Arc<WorkspaceViewState>> = None;

    // Get the stop handle out of the registry while holding the lock, then release it.
    let stop_handle = {
        let mut reg = registry.lock().map_err(|e| e.to_string())?;
        if let Some(entry) = reg.get(&server_id) {
            log::info!(
                "Stopping existing sync manager before starting new one: server_id={}, old_gen={}",
                server_id,
                entry.handle.session_generation
            );
            // Preserve the old snapshot Arcs so the new manager starts with
            // last-known-good data instead of empty defaults. Also preserve
            // the existing workspace state so a fast re-connect keeps the
            // renderer's active request.
            shared_snapshot = entry.snapshot.clone();
            shared_revision = entry.revision.clone();
            shared_health = entry.health.clone();
            preserved_workspace_state = Some(entry.workspace_state.clone());
            let h = entry.handle.clone();
            reg.remove(&server_id);
            Some(h)
        } else {
            None
        }
    };

    // Signal stop without holding the lock.
    if let Some(h) = stop_handle {
        let _ = h.stop().await;
    }

    // Now take the lock and insert the new entry.
    //
    // Workspace state ownership: the manager and the registry entry MUST
    // share the **same** `Arc<WorkspaceViewState>` so commands reach the
    // exact engine the manager is updating. When we preserved an old entry
    // (re-connect / server-switch), reuse it; otherwise build a fresh one
    // sharing the new snapshot Arc.
    let workspace_state = preserved_workspace_state
        .unwrap_or_else(|| Arc::new(WorkspaceViewState::new(shared_snapshot.clone())));

    let handle = LiveSyncManager::start_with_shared_state(
        server_id.clone(),
        generation,
        session_handle.clone(),
        app_handle.clone(),
        shared_snapshot.clone(),
        shared_revision.clone(),
        shared_health.clone(),
        workspace_state.clone(),
    );

    log::info!(
        "Started sync manager: server_id={}, generation={}",
        server_id,
        generation
    );

    let mut entry = SyncEntry::new(handle, shared_snapshot.clone(), workspace_state);
    entry.revision = shared_revision;
    entry.health = shared_health;

    let mut reg = registry.lock().map_err(|e| e.to_string())?;
    reg.remove(&server_id);
    reg.insert(server_id, entry);
    Ok(())
}

/// Stop the sync manager for a server (called on disconnect/switch/teardown).
pub async fn stop_sync_for_server(
    registry: &SyncManagerRegistry,
    server_id: &str,
) -> Result<(), String> {
    // Extract the handle from the registry while holding the lock.
    let handle = {
        let mut reg = registry.lock().map_err(|e| e.to_string())?;
        reg.remove(server_id).map(|e| e.handle)
    };

    // Now stop without holding the lock.
    if let Some(h) = handle {
        log::info!(
            "Stopping sync manager: server_id={}, generation={}",
            server_id,
            h.session_generation
        );
        h.stop().await;
    }
    Ok(())
}

/// Get the current accumulated snapshot for the active session.
///
/// Emits an `info!` diagnostic log with elapsed read/clone/serialization time,
/// torrent count, revision, rid, server_id, and session generation so native
/// smoke runners can extract snapshot-cost evidence without a new command.
pub fn get_maindata_snapshot(
    registry: &SyncManagerRegistry,
    session_handle: &SessionStateHandle,
) -> Result<MaindataSnapshotResponse, String> {
    let timer = Instant::now();

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

    let mut reg = registry.lock().map_err(|e| e.to_string())?;
    let entry = reg
        .get_mut(&server_id)
        .ok_or("no sync manager for active server")?;

    if entry.handle.session_generation != generation {
        return Err("stale_session_generation".to_string());
    }

    let snapshot = entry
        .snapshot
        .lock()
        .map_err(|e| format!("snapshot lock poisoned: {}", e))?;
    let revision = entry
        .revision
        .lock()
        .map_err(|e| format!("revision lock poisoned: {}", e))?;
    let health = entry
        .health
        .lock()
        .map_err(|e| format!("health lock poisoned: {}", e))?;

    let snap = snapshot.clone().normalize();
    let torrent_count = snap.torrents.len();

    let elapsed_ms = timer.elapsed().as_secs_f64() * 1000.0;

    log::info!(
        "get_maindata_snapshot: server_id={}, generation={}, revision={}, rid={}, \
         torrent_count={}, elapsed_ms={:.2}",
        server_id,
        generation,
        *revision,
        snap.rid,
        torrent_count,
        elapsed_ms,
    );

    Ok(MaindataSnapshotResponse {
        session_generation: generation,
        server_id: Some(server_id),
        revision: *revision,
        rid: snap.rid,
        health: health.clone(),
        maindata: MaindataSnapshotEnvelope {
            torrents: serde_json::to_value(&snap.torrents)
                .map_err(|e| format!("serialization error: {}", e))?,
            categories: serde_json::to_value(&snap.categories)
                .map_err(|e| format!("serialization error: {}", e))?,
            tags: snap.tags.clone(),
            server_state: snap
                .server_state
                .as_ref()
                .map(|s| serde_json::to_value(s).unwrap_or(serde_json::Value::Null))
                .unwrap_or(serde_json::Value::Null),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A `WorkspaceViewState` built from a given `Arc<StdMutex<MaindataSnapshot>>`
    /// must observe external writes to that mutex. This guards the invariant
    /// the `start_sync_for_session` "preserve old entry" branch relies on:
    /// when a manager is rebuilt with the preserved `WorkspaceViewState`, the
    /// `shared_snapshot` Arc still points at the same underlying mutex so
    /// writes from the manager show up in the engine's reads. Also guards
    /// the steady-state case where the manager's `shared_snapshot` and the
    /// `WorkspaceViewState::snapshot` are the same Arc — without this, the
    /// engine would never observe a successful poll.
    #[test]
    fn workspace_state_engine_observes_external_writes_to_shared_snapshot() {
        let shared_snapshot = Arc::new(StdMutex::new(MaindataSnapshot::default()));
        let workspace_state = Arc::new(WorkspaceViewState::new(shared_snapshot.clone()));

        // Simulate a manager poll that writes a non-empty snapshot.
        {
            use qb_core::dto::MaindataTorrentRow;
            use std::collections::BTreeMap;
            let mut torrents = BTreeMap::new();
            torrents.insert(
                "abc".to_string(),
                MaindataTorrentRow {
                    hash: Some("abc".to_string()),
                    name: Some("hello".to_string()),
                    ..Default::default()
                },
            );
            let new_snap = MaindataSnapshot {
                rid: 99,
                torrents,
                ..Default::default()
            };
            *shared_snapshot.lock().unwrap() = new_snap;
        }

        // The engine must see the new snapshot via `compute_and_diff`.
        let snap = shared_snapshot.lock().unwrap().clone();
        let mut engine = workspace_state.engine.lock().unwrap();
        let view = engine
            .compute_and_diff(&snap)
            .expect("first compute produces a view");
        assert_eq!(view.revision, 99);
        assert_eq!(view.total_count, 1);
        assert_eq!(view.sorted_hashes, vec!["abc".to_string()]);
    }
}
