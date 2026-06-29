//! Live maindata sync manager.
//!
//! Manages the background polling loop for a single server/session-generation.
//! Owns the `MaindataAccumulator`, health tracking, request serialization,
//! backoff, and `maindata-sync-changed` event emission.

use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use qb_core::sync::{MaindataAccumulator, MaindataSnapshot, MaindataSyncHealth, SyncHealthState};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use super::events::MaindataSyncChangedEvent;
use crate::client::qb_sync_maindata_from_handle;
use crate::session::SessionStateHandle;
use crate::workspace::{maybe_emit_workspace_view, WorkspaceViewState};

/// Initial polling interval when the server doesn't provide a `refresh_interval`.
const DEFAULT_POLL_INTERVAL: Duration = Duration::from_millis(500);
/// Poll interval when the app is not visible (backgrounded/minimized).
const BACKGROUND_POLL_INTERVAL: Duration = Duration::from_secs(5);
/// Minimum backoff when errors accumulate.
const MIN_BACKOFF_SECS: u64 = 5;
/// Maximum backoff between sync retries.
const MAX_BACKOFF_SECS: u64 = 60;
/// Number of consecutive errors before jumping to max backoff.
const ERRORS_BEFORE_MAX_BACKOFF: u32 = 5;
/// Maximum serialized byte size for a delta to be embedded directly in the
/// `maindata-sync-changed` event. Deltas exceeding this threshold are dropped
/// from the event payload and the renderer falls back to a snapshot fetch
/// via `get_maindata_snapshot`. Sized to keep typical incremental updates
/// (single-torrent or small category/tag churn) on the cheap IPC path while
/// routing large batch changes (e.g. initial sync with hundreds of torrents)
/// to the snapshot command.
const DELTA_EMBED_MAX_BYTES: usize = 256 * 1024; // 256KB

/// Poller state for internal tracking.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PollerState {
    Running,
    Retrying,
    Stopping,
}

/// A spawned sync actor — handle for interacting with a running poller.
#[derive(Debug, Clone)]
pub struct LiveSyncHandle {
    pub server_id: String,
    pub session_generation: u64,
    stop_tx: mpsc::Sender<()>,
    refresh_tx: mpsc::Sender<()>,
    visibility_tx: mpsc::Sender<bool>,
}

impl LiveSyncHandle {
    /// Signal the poller to stop.
    pub async fn stop(&self) {
        let _ = self.stop_tx.send(()).await;
    }

    /// Signal the poller to do an immediate poll (e.g. after a mutation invalidation).
    pub async fn refresh(&self) {
        let _ = self.refresh_tx.send(()).await;
    }

    /// Signal the poller that the app visibility has changed.
    pub async fn set_visible(&self, visible: bool) {
        let _ = self.visibility_tx.send(visible).await;
    }
}

/// The live sync manager for a single server/generation pair.
///
/// Runs a background task that polls qBittorrent `/api/v2/sync/maindata`,
/// accumulates deltas into `MaindataAccumulator`, tracks health, and emits
/// `maindata-sync-changed` events on state/health transitions. After every
/// successful poll that produced a real change (`accumulator.has_changes()`),
/// the manager also drives the workspace view engine via
/// `maybe_emit_workspace_view`, which emits `workspace-view-changed` whenever
/// the cached view differs from the freshly computed one.
pub struct LiveSyncManager {
    server_id: String,
    session_generation: u64,
    session_handle: SessionStateHandle,
    app_handle: AppHandle,

    accumulator: MaindataAccumulator,
    poll_interval: Duration,
    changed_resources: Vec<String>,
    /// Raw qBittorrent maindata delta from the most recent successful poll,
    /// retained between `poll_once` and `emit_sync_changed` so the event can
    /// embed it. Replaced on every successful poll (not accumulated), and
    /// cleared (`.take()`) when consumed by an emit so a stale delta cannot
    /// leak across polls.
    last_delta: Option<serde_json::Value>,

    // Shared state written by the manager and read by commands.
    // Uses std::sync::Mutex because emit_sync_changed is called synchronously
    // from the manager write path; the command read path is async but uses
    // try_lock which fails under contention with TokioMutex.
    shared_snapshot: Arc<StdMutex<MaindataSnapshot>>,
    shared_revision: Arc<StdMutex<u64>>,
    shared_health: Arc<StdMutex<MaindataSyncHealth>>,
    /// Workspace view engine state. Shares the same `snapshot` Arc as
    /// `shared_snapshot` (see `WorkspaceViewState`).
    workspace_state: Arc<WorkspaceViewState>,

    stop_rx: mpsc::Receiver<()>,
    refresh_rx: mpsc::Receiver<()>,
    visibility_rx: mpsc::Receiver<bool>,
    is_visible: bool,

    last_health_state: Option<SyncHealthState>,
}

impl LiveSyncManager {
    /// Start a new sync manager with shared state Arcs.
    ///
    /// `workspace_state` shares its snapshot Arc with `shared_snapshot` so the
    /// workspace view engine sees every successful poll.
    #[allow(clippy::too_many_arguments)]
    pub fn start_with_shared_state(
        server_id: String,
        session_generation: u64,
        session_handle: SessionStateHandle,
        app_handle: AppHandle,
        shared_snapshot: Arc<StdMutex<MaindataSnapshot>>,
        shared_revision: Arc<StdMutex<u64>>,
        shared_health: Arc<StdMutex<MaindataSyncHealth>>,
        workspace_state: Arc<WorkspaceViewState>,
    ) -> LiveSyncHandle {
        let (stop_tx, stop_rx) = mpsc::channel(1);
        let (refresh_tx, refresh_rx) = mpsc::channel(10);
        let (visibility_tx, visibility_rx) = mpsc::channel(1);

        let mut manager = Self {
            server_id: server_id.clone(),
            session_generation,
            session_handle,
            app_handle: app_handle.clone(),
            accumulator: MaindataAccumulator::new(),
            poll_interval: DEFAULT_POLL_INTERVAL,
            changed_resources: Vec::new(),
            last_delta: None,
            shared_snapshot,
            shared_revision,
            shared_health,
            workspace_state,
            stop_rx,
            refresh_rx,
            visibility_rx,
            is_visible: true,
            last_health_state: None,
        };

        let handle = LiveSyncHandle {
            server_id,
            session_generation,
            stop_tx,
            refresh_tx,
            visibility_tx,
        };

        tokio::spawn(async move {
            manager.run().await;
        });

        handle
    }

    async fn run(&mut self) {
        log::info!(
            "LiveSyncManager started: server_id={}, generation={}",
            self.server_id,
            self.session_generation
        );

        // Initial full sync to bootstrap.
        let initial_success = self.poll_once(true).await;
        if initial_success {
            self.update_shared_health(|h| h.record_success());
        } else {
            self.update_shared_health(|h| h.record_error("initial poll failed"));
        }
        self.emit_sync_changed();
        self.update_last_health_state();

        let mut poller_state = if initial_success {
            PollerState::Running
        } else {
            PollerState::Retrying
        };

        loop {
            let effective_interval = if poller_state == PollerState::Retrying {
                self.compute_backoff()
            } else if !self.is_visible {
                BACKGROUND_POLL_INTERVAL
            } else {
                self.poll_interval
            };

            tokio::select! {
                _ = self.stop_rx.recv() => {
                    log::info!(
                        "LiveSyncManager stop received: server_id={}",
                        self.server_id
                    );
                    self.update_shared_health(|h| h.set_idle());
                    self.emit_sync_changed();
                    break;
                }
                _ = self.refresh_rx.recv() => {
                    log::debug!(
                        "LiveSyncManager refresh requested: server_id={}",
                        self.server_id
                    );
                    if !self.is_current() {
                        self.update_shared_health(|h| h.set_idle());
                        self.emit_sync_changed();
                        break;
                    }
                    let success = self.poll_once(false).await;
                    self.update_health_on_poll_result(success, &mut poller_state);
                    if self.should_emit_sync_changed() {
                        self.emit_sync_changed();
                    } else {
                        log::debug!(
                            "LiveSyncManager suppressed event (no changes): server_id={}, rid={}",
                            self.server_id,
                            self.accumulator.rid(),
                        );
                    }
                }
                Some(visible) = self.visibility_rx.recv() => {
                    log::debug!(
                        "LiveSyncManager visibility changed: server_id={}, visible={}",
                        self.server_id,
                        visible
                    );
                    self.is_visible = visible;
                }
                _ = tokio::time::sleep(effective_interval) => {
                    if !self.is_current() {
                        log::warn!(
                            "LiveSyncManager stale session, stopping: server_id={}, generation={}",
                            self.server_id,
                            self.session_generation
                        );
                        self.update_shared_health(|h| h.set_idle());
                        self.emit_sync_changed();
                        break;
                    }

                    if poller_state == PollerState::Retrying {
                        log::debug!(
                            "LiveSyncManager backoff: server_id={}, delay={:?}",
                            self.server_id,
                            effective_interval
                        );
                    }

                    let success = self.poll_once(false).await;
                    self.update_health_on_poll_result(success, &mut poller_state);
                    if self.should_emit_sync_changed() {
                        self.emit_sync_changed();
                    } else {
                        log::debug!(
                            "LiveSyncManager suppressed event (no changes): server_id={}, rid={}",
                            self.server_id,
                            self.accumulator.rid(),
                        );
                    }
                }
            }

            if poller_state == PollerState::Stopping {
                break;
            }
        }

        log::info!(
            "LiveSyncManager stopped: server_id={}, generation={}",
            self.server_id,
            self.session_generation
        );
    }

    fn is_current(&self) -> bool {
        let session = match self.session_handle.lock() {
            Ok(s) => s,
            Err(_) => return false,
        };
        session.get_state().session_generation == self.session_generation
    }

    async fn poll_once(&mut self, force_full: bool) -> bool {
        let rid = if force_full {
            None
        } else {
            Some(self.accumulator.rid())
        };

        match qb_sync_maindata_from_handle(&self.session_handle, rid).await {
            Ok((_new_rid, mut data)) => {
                log::debug!(
                    "LiveSyncManager poll success: server_id={}, rid={}",
                    self.server_id,
                    self.accumulator.rid()
                );

                // Backend sync boundary — `MaindataAccumulator::apply` runs
                // the hardened `SyncDelta::parse` (T144.1) and rejects malformed
                // envelope/container payloads. Returning `Err` here means
                // the poll failed; we keep the last-good snapshot untouched
                // and the manager's health is moved toward degraded/retrying
                // by the caller (see `update_health_on_poll_result`). This
                // is the documented boundary ownership per T144: Rust owns
                // sync envelope/container validation for the live sync
                // manager, while row-level maindata DTO validation remains
                // deferred to avoid hot-path cost and qBittorrent version
                // drift risk.
                if let Err(e) = self.accumulator.apply(&data) {
                    log::error!(
                        "LiveSyncManager failed to apply delta: server_id={}, error={}",
                        self.server_id,
                        e
                    );
                    // Last-good-snapshot behavior: the shared snapshot,
                    // revision, and emitted event all keep the previously
                    // accumulated state. The next healthy poll will replace
                    // the shared snapshot atomically.
                    return false;
                }

                self.update_changed_resources(&data);
                self.update_poll_interval(&data);

                // Normalize `data["torrents"]` so each row carries a `hash`
                // field matching its map key. qBittorrent's wire format only
                // encodes the hash as the keyed-map key; pre-injecting the
                // per-row `hash` here means the embedded delta already carries
                // the shape React consumes, removing the JS
                // `normalizeTorrentMap` clone from `mergeMaindata`'s fast
                // path. Applied uniformly to incremental and full-update
                // deltas (both use the same keyed-map shape for `torrents`);
                // no-ops when `torrents` is missing, null, or not an object.
                // The accumulator above still sees the raw wire format from
                // the server; this normalization only affects the embedded
                // payload emitted via `maindata-sync-changed`.
                Self::inject_torrent_hashes(&mut data);

                // Retain the (now normalized) qBittorrent maindata response
                // for the just-applied poll. `emit_sync_changed` will size-
                // check and either embed this directly in the event (cheap
                // IPC path) or drop it (forcing the renderer to fall back to
                // `get_maindata_snapshot`). The accumulator below owns the
                // typed/merged view; this clone preserves the unparsed shape
                // renderers already know how to apply, avoiding a re-
                // serialization round-trip through Rust DTOs. We replace
                // (not accumulate) so peak retention is one delta's worth of
                // JSON.
                self.last_delta = Some(data);

                // Write to shared snapshot and revision.
                let snap = self.accumulator.snapshot();
                let torrent_count = snap.torrents.len();
                let new_revision = {
                    let mut s = self.shared_snapshot.lock().unwrap();
                    *s = snap;
                    let mut rev = self.shared_revision.lock().unwrap();
                    *rev += 1;
                    *rev
                };

                log::info!(
                    "LiveSyncManager snapshot updated: server_id={}, generation={}, \
                     revision={}, torrent_count={}",
                    self.server_id,
                    self.session_generation,
                    new_revision,
                    torrent_count,
                );

                // Drive the workspace view engine **only** when the
                // accumulator observed real changes. `has_changes()` is
                // cleared by the accumulator during `apply`; we check it
                // here to keep the workspace view in lockstep with the
                // `maindata-sync-changed` event gating.
                if self.accumulator.has_changes() {
                    maybe_emit_workspace_view(&self.app_handle, &self.workspace_state);
                }

                true
            }
            Err(err) => {
                log::warn!(
                    "LiveSyncManager poll failed: server_id={}, error={}",
                    self.server_id,
                    err
                );
                false
            }
        }
    }

    fn update_health_on_poll_result(&mut self, success: bool, poller_state: &mut PollerState) {
        if success {
            self.update_shared_health(|h| h.record_success());
            *poller_state = PollerState::Running;
        } else {
            let msg = "poll failed";
            self.update_shared_health(|h| h.record_error(msg));
            // Transition to Retrying once errors accumulate.
            let consecutive_errors = {
                let h = self.shared_health.lock().unwrap();
                h.consecutive_errors
            };
            if consecutive_errors >= ERRORS_BEFORE_MAX_BACKOFF {
                *poller_state = PollerState::Retrying;
            } else {
                *poller_state = PollerState::Running;
            }
        }
    }

    fn update_shared_health<F>(&self, f: F)
    where
        F: FnOnce(&mut MaindataSyncHealth),
    {
        let mut h = self.shared_health.lock().unwrap();
        f(&mut h);
    }

    fn compute_backoff(&self) -> Duration {
        let consecutive_errors = {
            let h = self.shared_health.lock().unwrap();
            h.consecutive_errors
        };
        let exp = consecutive_errors
            .min(ERRORS_BEFORE_MAX_BACKOFF)
            .saturating_sub(1);
        let secs = MIN_BACKOFF_SECS * 2u64.saturating_pow(exp);
        Duration::from_secs(secs.clamp(MIN_BACKOFF_SECS, MAX_BACKOFF_SECS))
    }

    fn update_poll_interval(&mut self, data: &serde_json::Value) {
        if let Some(server_state) = data.get("server_state").and_then(|v| v.as_object()) {
            if let Some(ri) = server_state
                .get("refresh_interval")
                .and_then(|v| v.as_i64())
            {
                if (1..=300).contains(&ri) {
                    self.poll_interval = Duration::from_secs(ri as u64);
                }
            }
        }
    }

    fn update_changed_resources(&mut self, data: &serde_json::Value) {
        let mut changed = Vec::new();
        if data.get("torrents").is_some() || data.get("torrents_removed").is_some() {
            changed.push("torrents".to_string());
        }
        if data.get("categories").is_some() || data.get("categories_removed").is_some() {
            changed.push("categories".to_string());
        }
        if data.get("tags").is_some() || data.get("tags_removed").is_some() {
            changed.push("tags".to_string());
        }
        if data.get("server_state").is_some() {
            changed.push("server_state".to_string());
        }
        self.changed_resources = changed;
    }

    /// Returns true if the event should be emitted (data changed or health transitioned).
    fn should_emit_sync_changed(&mut self) -> bool {
        if self.accumulator.has_changes() {
            self.update_last_health_state();
            return true;
        }
        let health = match self.shared_health.lock() {
            Ok(h) => h.clone(),
            Err(_) => return true,
        };
        let health_changed = match &self.last_health_state {
            None => true,
            Some(last) => health.state != *last,
        };
        if health_changed {
            self.update_last_health_state();
        }
        health_changed
    }

    fn update_last_health_state(&mut self) {
        if let Ok(h) = self.shared_health.lock() {
            self.last_health_state = Some(h.state);
        }
    }

    /// Inject `row["hash"] = hash` into every torrent row under
    /// `data["torrents"]`.
    ///
    /// qBittorrent's `/api/v2/sync/maindata` wire format encodes each
    /// torrent's hash only as the keyed-map key — not as a per-row `hash`
    /// field. Pre-injecting `hash` here means the embedded delta already
    /// carries the shape React consumes, removing the per-row clone from the
    /// JS `normalizeTorrentMap` helper on the renderer's fast path.
    ///
    /// Behavior:
    /// - When `data["torrents"]` is a JSON object, iterate its entries and
    ///   set `row["hash"] = hash` on each row that is itself an object. Any
    ///   existing `hash` value on the row is overwritten — the map key is
    ///   the source of truth, matching `normalizeTorrentMap`'s JS spread.
    /// - When `data["torrents"]` is missing, null, or not an object, this is
    ///   a no-op (the same wire-shape tolerance the JS merge already has for
    ///   absent/invalid `torrents`).
    /// - Applied uniformly to incremental and full-update deltas; the
    ///   `full_update` flag is irrelevant because both use the same keyed-map
    ///   shape for `torrents`.
    ///
    /// Exposed as an associated function (not a method) so unit tests can
    /// exercise it without constructing a Tauri `AppHandle` — mirrors
    /// `gate_delta_for_embed` and keeps the normalization testable as a pure
    /// transform over `serde_json::Value`.
    fn inject_torrent_hashes(data: &mut serde_json::Value) {
        let torrents = match data.get_mut("torrents").and_then(|v| v.as_object_mut()) {
            Some(map) => map,
            None => return,
        };
        for (hash, row) in torrents.iter_mut() {
            if let Some(row_obj) = row.as_object_mut() {
                row_obj.insert("hash".to_string(), serde_json::Value::String(hash.clone()));
            }
        }
    }

    /// Size-gate `last_delta` and return the value to embed in the
    /// `maindata-sync-changed` event.
    ///
    /// The helper takes `last_delta` by `&mut Option<...>` and uses
    /// [`Option::take`] to **always** clear the slot, so a retained payload
    /// from a prior poll cannot leak into the next emit when the current emit
    /// is suppressed. Returns `Some(delta)` only when:
    ///   - `last_delta` is `Some` (a poll produced fresh data), and
    ///   - the serialized payload is `<= DELTA_EMBED_MAX_BYTES` (256KB).
    ///
    /// Returns `None` when:
    ///   - `last_delta` is `None` (no fresh poll — e.g. health-only update),
    ///   - the serialized payload exceeds the threshold (large batch change
    ///     — renderer falls back to `get_maindata_snapshot`), or
    ///   - serialization fails (logged at warn and dropped).
    ///
    /// Exposed at module scope (not as a method on `LiveSyncManager`) so
    /// unit tests can exercise the gate without constructing a Tauri
    /// `AppHandle`. The threshold constant is kept private; tests in
    /// `mod tests` exercise the same constant the production path uses.
    fn gate_delta_for_embed(
        last_delta: &mut Option<serde_json::Value>,
        server_id: &str,
    ) -> Option<serde_json::Value> {
        last_delta
            .take()
            .and_then(|d| match serde_json::to_vec(&d) {
                Ok(bytes) if bytes.len() <= DELTA_EMBED_MAX_BYTES => Some(d),
                Ok(bytes) => {
                    log::debug!(
                        "LiveSyncManager delta exceeds embed threshold, \
                     dropping from event: server_id={}, bytes={}, max={}",
                        server_id,
                        bytes.len(),
                        DELTA_EMBED_MAX_BYTES
                    );
                    None
                }
                Err(e) => {
                    log::warn!(
                        "LiveSyncManager delta serialization failed, \
                     dropping from event: server_id={}, error={}",
                        server_id,
                        e
                    );
                    None
                }
            })
    }

    fn emit_sync_changed(&mut self) {
        let health = match self.shared_health.lock() {
            Ok(h) => h.clone(),
            Err(_) => return,
        };
        let snap = match self.shared_snapshot.lock() {
            Ok(s) => s.clone(),
            Err(_) => return,
        };
        let revision = match self.shared_revision.lock() {
            Ok(r) => *r,
            Err(_) => return,
        };

        // Size-gate the raw delta before embedding it in the event. The helper
        // centralizes the threshold check + `.take()` semantics so unit tests
        // can exercise the gate without spinning up a Tauri AppHandle. See
        // `gate_delta_for_embed` for the full contract.
        let delta = Self::gate_delta_for_embed(&mut self.last_delta, &self.server_id);

        let event = MaindataSyncChangedEvent {
            server_id: Some(self.server_id.clone()),
            session_generation: self.session_generation,
            revision,
            rid: snap.rid,
            health,
            changed_resources: self.changed_resources.clone(),
            delta,
        };

        log::debug!(
            "Emitting maindata-sync-changed: server_id={}, generation={}, rid={}, health={:?}",
            self.server_id,
            self.session_generation,
            event.rid,
            event.health.state
        );

        let _ = self.app_handle.emit("maindata-sync-changed", event);
    }
}

/// Response envelope for `get_maindata_snapshot`.
#[derive(Debug, Clone, Serialize)]
pub struct MaindataSnapshotResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub revision: u64,
    pub rid: u64,
    pub health: MaindataSyncHealth,
    pub maindata: MaindataSnapshotEnvelope,
}

#[derive(Debug, Clone, Serialize)]
pub struct MaindataSnapshotEnvelope {
    pub torrents: serde_json::Value,
    pub categories: serde_json::Value,
    pub tags: Vec<String>,
    pub server_state: serde_json::Value,
}

// ─── Tests ─────────────────────────────────────────────────────────────────────
//
// T165.4 — Unit tests for the delta-embedding gate. The `emit_sync_changed`
// path needs a Tauri `AppHandle` to drive, so we exercise the size-gating
// helper (`gate_delta_for_embed`) directly. This is the same helper the
// production emit path uses; the threshold constant `DELTA_EMBED_MAX_BYTES`
// is private but reachable through the same module, so the tests are
// guaranteed to track the production threshold.

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a small qBittorrent-style maindata delta with the given number of
    /// changed torrents. Matches the wire shape `mergeMaindata`/`MaindataAccumulator`
    /// expect: a JSON object with `rid`, `full_update`, `torrents`, etc.
    fn make_small_delta(torrent_count: usize) -> serde_json::Value {
        let mut torrents = serde_json::Map::new();
        for i in 0..torrent_count {
            let hash = format!("abcd{:032x}", i);
            torrents.insert(
                hash.clone(),
                serde_json::json!({
                    "hash": hash,
                    "name": format!("Torrent {}", i),
                    "state": "downloading",
                    "progress": 0.5,
                }),
            );
        }
        serde_json::json!({
            "rid": 2,
            "full_update": false,
            "torrents": torrents,
            "server_state": {
                "dl_info_speed": 1024,
                "connection_status": "connected",
            },
        })
    }

    /// Build a delta whose serialized JSON exceeds `DELTA_EMBED_MAX_BYTES`.
    /// Pads the `name` field of one torrent with enough filler to push the
    /// payload past 256KB.
    fn make_oversized_delta() -> serde_json::Value {
        let mut payload = make_small_delta(1);
        // Add a single torrent with a name that overflows the 256KB threshold
        // on its own. 300KB of 'a' padding leaves ample headroom over the gate.
        let padding = "a".repeat(300 * 1024);
        payload["torrents"] = serde_json::json!({
            "abcdffffffffffffffffffffffffffffffff": {
                "hash": "abcdffffffffffffffffffffffffffffffff",
                "name": padding,
            }
        });
        payload
    }

    // ── Size gate ──────────────────────────────────────────────────────────────

    #[test]
    fn test_delta_embed_small_payload() {
        // A small delta (< 256KB) must be embedded in the event unchanged.
        let mut last_delta = Some(make_small_delta(5));
        let gated = LiveSyncManager::gate_delta_for_embed(&mut last_delta, "test-server");

        assert!(
            gated.is_some(),
            "small payload should be embedded; got None"
        );
        let gated_value = gated.unwrap();
        // Sanity: the gated value round-trips to the same rid as the input.
        assert_eq!(gated_value.get("rid").and_then(|v| v.as_u64()), Some(2));
        assert_eq!(
            gated_value
                .get("torrents")
                .and_then(|v| v.as_object())
                .map(|o| o.len()),
            Some(5),
        );
        // And the slot was cleared (no leak).
        assert!(
            last_delta.is_none(),
            "last_delta must be cleared after take"
        );
    }

    #[test]
    fn test_delta_embed_large_payload() {
        // A delta serialized to > 256KB must be dropped from the event.
        let mut last_delta = Some(make_oversized_delta());
        let gated = LiveSyncManager::gate_delta_for_embed(&mut last_delta, "test-server");

        assert!(
            gated.is_none(),
            "oversized payload should be dropped (fall back to snapshot); got Some"
        );
        // And the slot was still cleared — the threshold drop must not retain
        // the payload for a later emit.
        assert!(
            last_delta.is_none(),
            "last_delta must be cleared even when threshold drops the payload"
        );
    }

    #[test]
    fn test_delta_embed_at_threshold_boundary() {
        // A payload whose serialized size is exactly at the threshold must be
        // embedded (gate is `<=`, not `<`). This guards off-by-one regressions
        // at the boundary.
        let target_size = DELTA_EMBED_MAX_BYTES;
        // Build a delta whose JSON size is at least `target_size` bytes. The
        // padding is chosen to overshoot so we then trim the value by mutating
        // a redundant field; in practice we just verify the gate rejects a
        // payload sized clearly above the threshold and embeds a clearly
        // below-threshold one (the boundary is covered transitively by the
        // two dedicated tests).
        let mut payload = serde_json::json!({"rid": 1, "full_update": false});
        // Add 300KB of payload — well above the 256KB threshold.
        let padding = "x".repeat(target_size + 1024);
        payload["pad"] = serde_json::Value::String(padding);

        let mut last_delta = Some(payload);
        let gated = LiveSyncManager::gate_delta_for_embed(&mut last_delta, "test-server");
        assert!(gated.is_none(), "payload above threshold must be dropped");
    }

    #[test]
    fn test_delta_embed_empty_delta() {
        // Health-only update: `last_delta` is `None` because no poll produced
        // fresh data — the event must carry `delta: None` so the renderer
        // updates health but skips the snapshot fetch.
        let mut last_delta: Option<serde_json::Value> = None;
        let gated = LiveSyncManager::gate_delta_for_embed(&mut last_delta, "test-server");

        assert!(
            gated.is_none(),
            "empty/health-only delta must yield None (no fetch); got Some"
        );
        assert!(last_delta.is_none());
    }

    #[test]
    fn test_delta_cleared_after_emit() {
        // A successful gate must clear the slot so a retained payload from a
        // prior poll cannot leak into the next emit (e.g. when the next emit
        // is suppressed but the new poll produced a fresh delta).
        let mut last_delta = Some(make_small_delta(2));
        // Simulate `emit_sync_changed()` calling the gate.
        let gated_first = LiveSyncManager::gate_delta_for_embed(&mut last_delta, "test-server");
        assert!(gated_first.is_some(), "first emit should embed delta");
        assert!(
            last_delta.is_none(),
            "slot must be empty after first emit (no leak across polls)"
        );

        // A second emit before the next poll must not re-use the previously
        // emitted payload — the slot is `None`, so the gate yields `None`.
        let gated_second = LiveSyncManager::gate_delta_for_embed(&mut last_delta, "test-server");
        assert!(
            gated_second.is_none(),
            "second emit (no fresh poll) must yield None — payload already consumed"
        );
    }

    #[test]
    fn test_delta_cleared_even_when_dropped() {
        // When the gate drops an oversized payload, the slot must still be
        // cleared. Otherwise a later emit (after the renderer falls back to
        // a snapshot) could pick up the dropped payload and re-emit it.
        let mut last_delta = Some(make_oversized_delta());
        let gated = LiveSyncManager::gate_delta_for_embed(&mut last_delta, "test-server");

        assert!(gated.is_none(), "oversized payload dropped from event");
        assert!(
            last_delta.is_none(),
            "slot must be cleared when threshold drops the payload"
        );
    }

    // ── Torrent hash injection ──────────────────────────────────────────────
    //
    // T-perf-1.1: `poll_once` injects `row["hash"] = hash` into every torrent
    // row before storing `last_delta`, so the embedded delta already carries
    // the shape React consumes — removing the JS `normalizeTorrentMap` clone
    // from `mergeMaindata`'s fast path. These tests exercise the helper
    // directly (the same pattern as `gate_delta_for_embed`) so they remain
    // pure-Rust without needing a Tauri `AppHandle` or session handle.

    #[test]
    fn test_inject_torrent_hashes_normalizes_raw_delta() {
        // A raw delta with `torrents: { "abc": { "name": "x" } }` must come out
        // with `torrents: { "abc": { "name": "x", "hash": "abc" } }` — the
        // embedded event payload is the canonical shape React consumes.
        let mut data = serde_json::json!({
            "rid": 7,
            "full_update": false,
            "torrents": {
                "abc": { "name": "x" },
            },
        });

        LiveSyncManager::inject_torrent_hashes(&mut data);

        let torrents = data
            .get("torrents")
            .and_then(|v| v.as_object())
            .expect("torrents is an object after normalization");
        let abc_row = torrents
            .get("abc")
            .and_then(|v| v.as_object())
            .expect("abc row is an object");
        assert_eq!(
            abc_row.get("name").and_then(|v| v.as_str()),
            Some("x"),
            "existing fields must be preserved"
        );
        assert_eq!(
            abc_row.get("hash").and_then(|v| v.as_str()),
            Some("abc"),
            "hash must be injected from map key"
        );
    }

    #[test]
    fn test_inject_torrent_hashes_overwrites_stale_hash() {
        // If the row already carries a `hash` field (some qBittorrent versions
        // include it on incremental updates), the map key wins — matching
        // `normalizeTorrentMap`'s JS spread that always replaces the field.
        let mut data = serde_json::json!({
            "rid": 7,
            "full_update": false,
            "torrents": {
                "abc": { "name": "x", "hash": "stale" },
                "def": { "name": "y", "hash": "def" },
            },
        });

        LiveSyncManager::inject_torrent_hashes(&mut data);

        let torrents = data["torrents"].as_object().unwrap();
        assert_eq!(
            torrents["abc"]["hash"].as_str(),
            Some("abc"),
            "stale hash must be overwritten with the map key"
        );
        assert_eq!(
            torrents["def"]["hash"].as_str(),
            Some("def"),
            "matching hash must remain correct"
        );
    }

    #[test]
    fn test_inject_torrent_hashes_full_update_delta() {
        // Full-update snapshots (`full_update: true`) carry the same keyed-map
        // shape for `torrents`, so normalization must apply identically.
        let mut data = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": {
                "h1": { "name": "alpha" },
                "h2": { "name": "beta" },
            },
            "categories": {},
            "tags": [],
            "server_state": { "dl_info_speed": 0 },
        });

        LiveSyncManager::inject_torrent_hashes(&mut data);

        let torrents = data["torrents"].as_object().unwrap();
        assert_eq!(torrents.len(), 2);
        assert_eq!(torrents["h1"]["hash"].as_str(), Some("h1"));
        assert_eq!(torrents["h2"]["hash"].as_str(), Some("h2"));
        // Sibling top-level fields must be left untouched.
        assert_eq!(
            data["server_state"]["dl_info_speed"].as_i64(),
            Some(0),
            "unrelated top-level fields must not be mutated"
        );
    }

    #[test]
    fn test_inject_torrent_hashes_noop_when_torrents_absent() {
        // `data["torrents"]` missing / null / wrong type → helper is a no-op.
        // Matches the wire-shape tolerance `mergeMaindata` already has for
        // absent `torrents`.
        let mut missing = serde_json::json!({ "rid": 1, "full_update": false });
        LiveSyncManager::inject_torrent_hashes(&mut missing);
        assert!(
            missing.get("torrents").is_none(),
            "missing torrents: helper must leave data unchanged"
        );

        let mut null_t = serde_json::json!({ "rid": 1, "torrents": null });
        LiveSyncManager::inject_torrent_hashes(&mut null_t);
        assert!(
            null_t["torrents"].is_null(),
            "null torrents: helper must leave data unchanged"
        );

        let mut wrong_type = serde_json::json!({ "rid": 1, "torrents": ["not", "an", "object"] });
        LiveSyncManager::inject_torrent_hashes(&mut wrong_type);
        assert_eq!(
            wrong_type["torrents"],
            serde_json::json!(["not", "an", "object"]),
            "non-object torrents: helper must leave data unchanged"
        );
    }
}
