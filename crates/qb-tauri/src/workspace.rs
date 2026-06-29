//! Tauri command handlers + sync-manager wiring for the Rust workspace view.
//!
//! This module sits between the pure-Rust derivation engine in
//! `qb_core::workspace::WorkspaceViewEngine` and the Tauri runtime. It owns
//! the `WorkspaceViewState` (one instance per sync entry) and exposes:
//!
//! - `set_workspace_view` / `get_workspace_view` Tauri commands.
//! - `maybe_emit_workspace_view` helper called by `LiveSyncManager::poll_once`
//!   to drive the `workspace-view-changed` event after every successful poll
//!   that produced a real change (`accumulator.has_changes() == true`).
//!
//! # Lock contract (critical)
//!
//! All code paths in this module that need both the shared snapshot and the
//! engine MUST follow the clone-then-release pattern:
//!
//! 1. Acquire `workspace_state.snapshot`.
//! 2. Clone the snapshot (`MaindataSnapshot::clone` is `O(n)` over rows but
//!    avoids holding the mutex through the derivation pass).
//! 3. Drop the snapshot lock.
//! 4. Acquire `workspace_state.engine`.
//! 5. Call `compute_and_diff(&snapshot)` (or `compute` for the inline-response
//!    path) and emit/store the result.
//!
//! Holding the snapshot mutex across `compute_and_diff` would block the
//! `get_maindata_snapshot` command for the entire derivation pass, which can
//! be 15,000+ iterations at the 5,000-torrent scale the engine is designed
//! for. The contract is enforced in code by structuring each path as a
//! block-scoped snapshot clone.

use std::sync::{Arc, Mutex as StdMutex};

use qb_core::sync::MaindataSnapshot;
use qb_core::workspace::{WorkspaceView, WorkspaceViewEngine, WorkspaceViewRequest};
use tauri::{AppHandle, Emitter, State};

use crate::session::SessionStateHandle;
use crate::sync::SyncManagerRegistry;

/// Per-server state for the Rust workspace view engine.
///
/// Owns the engine and a clone of the `Arc<StdMutex<MaindataSnapshot>>` that
/// `LiveSyncManager` also writes to. Both Arcs point to the **same** underlying
/// mutex, so the workspace view sees every successful poll without extra
/// plumbing.
pub struct WorkspaceViewState {
    /// Engine instance. Wrapped in `StdMutex` because every code path that
    /// touches it is synchronous (Tauri commands are dispatched on the
    /// Tokio runtime but the work itself is CPU-bound and fast — wrapping
    /// in `StdMutex` matches the rest of the sync layer's mutex discipline
    /// and avoids cross-runtime Send gymnastics).
    pub engine: StdMutex<WorkspaceViewEngine>,
    /// Shared snapshot mutex. Cloned into here from the same `Arc` that the
    /// `LiveSyncManager` writes to, so writes from the sync loop are visible
    /// to the command read path.
    pub snapshot: Arc<StdMutex<MaindataSnapshot>>,
}

impl WorkspaceViewState {
    /// Build a new state backed by the given snapshot Arc.
    pub fn new(snapshot: Arc<StdMutex<MaindataSnapshot>>) -> Self {
        Self {
            // The starting request is `default_for("initial")` — replaced
            // by `set_workspace_view` on the first renderer request.
            engine: StdMutex::new(WorkspaceViewEngine::new(WorkspaceViewRequest::default_for(
                "initial",
            ))),
            snapshot,
        }
    }
}

/// Look up the active session's `WorkspaceViewState` via the sync manager
/// registry.
///
/// Mirrors the pattern used by `get_maindata_snapshot`: derive `server_id`
/// from the active session, then index into `SyncManagerRegistry`. Returns
/// `Err("...")` when no session is connected or no sync manager is
/// registered for the active server.
fn lookup_workspace_state(
    session_handle: &SessionStateHandle,
    registry: &SyncManagerRegistry,
) -> Result<Arc<WorkspaceViewState>, String> {
    let server_id = {
        let session = session_handle.lock().map_err(|e| e.to_string())?;
        let state = session.get_state();
        if state.status != qb_core::SessionStatus::Connected {
            return Err("session not connected".to_string());
        }
        state
            .server
            .as_ref()
            .map(|s| s.id.clone())
            .ok_or_else(|| "no active server".to_string())?
    };

    let reg = registry.lock().map_err(|e| e.to_string())?;
    let entry = reg
        .get(&server_id)
        .ok_or_else(|| "no sync manager for active server".to_string())?;
    Ok(entry.workspace_state.clone())
}

/// `set_workspace_view` — Tauri command.
///
/// Replace the engine's active request, recompute against the current shared
/// snapshot, and return the freshly computed view. The view is recomputed
/// even when the engine considers it unchanged so the renderer's inline
/// response always reflects the latest state.
#[tauri::command]
pub async fn set_workspace_view(
    request: WorkspaceViewRequest,
    session_handle: State<'_, SessionStateHandle>,
    registry: State<'_, SyncManagerRegistry>,
) -> Result<WorkspaceView, String> {
    let workspace_state = lookup_workspace_state(&session_handle, &registry)?;

    // Lock contract (see module docs): clone the snapshot while holding the
    // shared mutex, drop the lock, then lock the engine to compute.
    let snapshot = {
        let snap = workspace_state
            .snapshot
            .lock()
            .map_err(|e| format!("snapshot lock poisoned: {}", e))?;
        snap.clone()
    };

    let mut engine = workspace_state
        .engine
        .lock()
        .map_err(|e| format!("engine lock poisoned: {}", e))?;
    engine.set_request(request.clone());
    if let Some(view) = engine.compute_and_diff(&snapshot) {
        return Ok(view);
    }

    // `compute_and_diff` returned `None`: the view is unchanged from the
    // cached last. Return the cached view so the renderer always gets the
    // current state. `last_view()` is populated after the first successful
    // compute, but guard against the race where a request arrives before the
    // sync manager has ever run (e.g. cold-start between connect and first
    // poll).
    engine.last_view().cloned().ok_or_else(|| {
        "no view computed yet — sync manager has not produced a snapshot".to_string()
    })
}

/// `get_workspace_view` — Tauri command.
///
/// Return the cached last computed view without recomputing.
#[tauri::command]
pub async fn get_workspace_view(
    session_handle: State<'_, SessionStateHandle>,
    registry: State<'_, SyncManagerRegistry>,
) -> Result<Option<WorkspaceView>, String> {
    let workspace_state = lookup_workspace_state(&session_handle, &registry)?;
    let engine = workspace_state
        .engine
        .lock()
        .map_err(|e| format!("engine lock poisoned: {}", e))?;
    Ok(engine.last_view().cloned())
}

/// Compute and emit a fresh workspace view if the cached one changed.
///
/// Called by `LiveSyncManager::poll_once` immediately after the shared
/// snapshot is updated, **only** when `accumulator.has_changes()` is true.
/// Uses the same clone-then-release lock contract as `set_workspace_view`.
///
/// Errors are logged but not propagated: a single failed emission must not
/// poison the sync loop. The next successful poll will retry.
pub fn maybe_emit_workspace_view(
    app_handle: &AppHandle,
    workspace_state: &Arc<WorkspaceViewState>,
) {
    // Lock contract: clone-then-release.
    let snapshot = match workspace_state.snapshot.lock() {
        Ok(snap) => snap.clone(),
        Err(e) => {
            log::warn!(
                "workspace-view: snapshot lock poisoned, skipping emit: {}",
                e
            );
            return;
        }
    };

    let view = {
        let mut engine = match workspace_state.engine.lock() {
            Ok(engine) => engine,
            Err(e) => {
                log::warn!("workspace-view: engine lock poisoned, skipping emit: {}", e);
                return;
            }
        };
        engine.compute_and_diff(&snapshot)
    };

    let Some(view) = view else {
        // View unchanged — nothing to emit. This is the expected path on
        // every poll where the new snapshot happens to produce the same
        // view (e.g. server-side refresh tick with no observable change).
        return;
    };

    log::debug!(
        "Emitting workspace-view-changed: revision={}, filtered_count={}, sorted_hashes={}",
        view.revision,
        view.filtered_count,
        view.sorted_hashes.len(),
    );
    if let Err(e) = app_handle.emit("workspace-view-changed", view) {
        log::warn!("workspace-view: emit failed: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a small fixture snapshot with two torrents, one downloading and
    /// one stopped, so the engine can produce a non-trivial view.
    fn fixture_snapshot() -> MaindataSnapshot {
        use qb_core::dto::MaindataTorrentRow;
        use std::collections::BTreeMap;
        let mut torrents = BTreeMap::new();
        torrents.insert(
            "aaa".to_string(),
            MaindataTorrentRow {
                hash: Some("aaa".to_string()),
                name: Some("alpha".to_string()),
                state: Some("downloading".to_string()),
                dlspeed: Some(1024),
                upspeed: Some(0),
                ..Default::default()
            },
        );
        torrents.insert(
            "bbb".to_string(),
            MaindataTorrentRow {
                hash: Some("bbb".to_string()),
                name: Some("beta".to_string()),
                state: Some("stoppedUP".to_string()),
                dlspeed: Some(0),
                upspeed: Some(512),
                ..Default::default()
            },
        );
        MaindataSnapshot {
            rid: 7,
            torrents,
            ..Default::default()
        }
    }

    #[test]
    fn workspace_state_compute_and_cached_view_match() {
        // First compute: must return Some (initial view).
        let snapshot = fixture_snapshot();
        let state = Arc::new(WorkspaceViewState::new(Arc::new(StdMutex::new(
            snapshot.clone(),
        ))));

        let view = {
            let snap = {
                let s = state.snapshot.lock().unwrap();
                s.clone()
            };
            let mut engine = state.engine.lock().unwrap();
            engine.set_request(WorkspaceViewRequest::default_for("test-req"));
            engine
                .compute_and_diff(&snap)
                .expect("first compute must produce Some view")
        };
        assert_eq!(view.request_id, "test-req");
        assert_eq!(view.revision, 7);
        assert_eq!(view.total_count, 2);
        assert_eq!(view.filtered_count, 2);
        assert_eq!(view.total_dl_speed, 1024);
        assert_eq!(view.total_ul_speed, 512);
        // Default sort is `added_on desc`; both rows have `added_on = None`
        // so they sort by their insertion order (stable sort), aaa before bbb.
        assert_eq!(
            view.sorted_hashes,
            vec!["aaa".to_string(), "bbb".to_string()]
        );

        // Cached view via `last_view()` matches.
        let cached = state.engine.lock().unwrap().last_view().unwrap().clone();
        assert_eq!(cached, view);
    }

    #[test]
    fn workspace_state_second_compute_unchanged_returns_none() {
        // After the first compute, recomputing with the same snapshot and
        // request must return None (view unchanged).
        let snapshot = fixture_snapshot();
        let state = Arc::new(WorkspaceViewState::new(Arc::new(StdMutex::new(
            snapshot.clone(),
        ))));

        // Seed the cache.
        {
            let snap = state.snapshot.lock().unwrap().clone();
            let mut engine = state.engine.lock().unwrap();
            engine.set_request(WorkspaceViewRequest::default_for("r"));
            assert!(engine.compute_and_diff(&snap).is_some());
        }

        // Second compute against the same snapshot/request → None.
        {
            let snap = state.snapshot.lock().unwrap().clone();
            let mut engine = state.engine.lock().unwrap();
            assert!(
                engine.compute_and_diff(&snap).is_none(),
                "second identical compute must return None"
            );
        }
    }

    #[test]
    fn workspace_state_engine_lock_poisoned_surfaces_as_error_string() {
        // Poisoning the engine mutex must be caught by `lock().map_err(...)`
        // and surfaced as a `String` error rather than panicking — the
        // command return type is `Result<_, String>`.
        let snapshot = fixture_snapshot();
        let state = Arc::new(WorkspaceViewState::new(Arc::new(StdMutex::new(snapshot))));

        // Poison the engine mutex.
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = state.engine.lock().unwrap();
            panic!("poison engine");
        }));
        assert!(state.engine.lock().is_err());

        // Mimic the lock path the commands use.
        let err = state
            .engine
            .lock()
            .map_err(|e| format!("engine lock poisoned: {}", e))
            .err()
            .expect("poisoned lock must produce an error string");
        assert!(err.contains("engine lock poisoned"));
    }
}
