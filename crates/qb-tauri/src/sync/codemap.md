# crates/qb-tauri/src/sync/

## Responsibility

Tauri-side live sync manager. Runs one background Tokio actor per server/session-generation that polls qBittorrent's sync endpoint, accumulates deltas via `MaindataAccumulator`, tracks sync health, and emits `maindata-sync-changed` events with optional embedded deltas. The manager's lifetime is tied to the active session.

## Files

| File | Responsibility |
|---|---|---|
| `mod.rs` | Module root. Re-exports: `MaindataSyncChangedEvent` from `events`, `setup_sync_lifecycle` from `lifecycle`, `LiveSyncHandle`, `LiveSyncManager`, `MaindataSnapshotEnvelope`, `MaindataSnapshotResponse` from `manager`, `SyncManagerRegistry`, `create_sync_manager_registry`, `get_maindata_snapshot`, `start_sync_for_session`, `stop_sync_for_server` from `registry`. |
| `manager.rs` | `LiveSyncManager` — background Tokio actor polling `/api/v2/sync/maindata`. Owns `MaindataAccumulator`, health tracking, request serialization, backoff, and `maindata-sync-changed` event emission. `LiveSyncHandle` for driving the actor (stop, refresh, set_visible). `MaindataSnapshotResponse` / `MaindataSnapshotEnvelope` response types. Poll loop: initial full poll, then `select` over stop/refresh/visibility/sleep channels. `poll_once` calls `qb_sync_maindata_from_handle`, applies delta via `accumulator.apply()`, bumps revision, retains raw delta for embedding. `gate_delta_for_embed` size-checks delta against `DELTA_EMBED_MAX_BYTES` (256KB) threshold. `should_emit_sync_changed` suppresses events when no data or health transition occurred. `PollerState` enum: `Running`, `Retrying`, `Stopping`. `update_poll_interval` reads `server_state.refresh_interval`. `update_changed_resources` detects which resource categories changed. `compute_backoff` uses exponential backoff (5-60s, max after 5 errors). `BACKGROUND_POLL_INTERVAL` (5s) for non-visible apps. Unit tests for delta-embedding gate: small payload, large payload, threshold boundary, empty delta, slot clearing. |
| `registry.rs` | `SyncManagerRegistry` — per-server `Arc<Mutex<HashMap<String, SyncEntry>>>`. `SyncEntry` holds `LiveSyncHandle` plus shared `Arc<Mutex<MaindataSnapshot>>`, `Arc<Mutex<u64>>` (revision), `Arc<Mutex<MaindataSyncHealth>>` that the background manager writes to and commands read from. Functions: `create_sync_manager_registry`, `get_maindata_snapshot` (validates session/generation, returns `MaindataSnapshotResponse` with diagnostic timing log), `start_sync_for_session` (preserves old Arcs across restarts for last-known-good data), `stop_sync_for_server`. |
| `lifecycle.rs` | `setup_sync_lifecycle` — event-driven wiring: observes `session-changed` events to start/stop sync managers. |
| `events.rs` | `MaindataSyncChangedEvent` — payload struct emitted to the renderer on each maindata sync tick. Fields: `server_id`, `session_generation`, `revision`, `rid`, `health`, `changed_resources` (Vec<String>), `delta` (Option<serde_json::Value>). `is_stale()` method compares against current generation. `delta` is the raw qBittorrent maindata response (not typed projection), omitted when no data changed or payload exceeds size threshold. |

## Design

- **Actor model**: `LiveSyncManager` runs in a dedicated Tokio task, driven through `LiveSyncHandle` channels (stop, refresh, visibility). Shared state held in `Arc<Mutex<...>>` for cross-task access.
- **Delta embedding**: The manager retains the raw qBittorrent maindata delta from the most recent poll. On emit, `gate_delta_for_embed` checks serialized size against `DELTA_EMBED_MAX_BYTES` (256KB). Small deltas are embedded directly in the event for cheap IPC; large deltas are dropped and the renderer falls back to `get_maindata_snapshot`.
- **Slot clearing**: `last_delta` is always `.take()`-cleared after use (whether embedded or dropped) to prevent stale delta leakage across polls.
- **Health-aware emission**: `should_emit_sync_changed` suppresses events when neither data nor health state changed, reducing IPC noise.
- **Poll interval adaptation**: Reads `server_state.refresh_interval` from the maindata response (1-300s range). Falls back to `DEFAULT_POLL_INTERVAL` (500ms) when absent. Uses `BACKGROUND_POLL_INTERVAL` (5s) when the app is not visible.
- **Exponential backoff**: On consecutive errors, delay doubles from `MIN_BACKOFF_SECS` (5) up to `MAX_BACKOFF_SECS` (60). Jumps to max after `ERRORS_BEFORE_MAX_BACKOFF` (5) consecutive errors.
- **Shared state persistence across restarts**: `start_sync_for_session` preserves old `SyncEntry` Arcs so the new manager starts with last-known-good data instead of empty defaults.
- **Generation-based staleness**: Managers check `session_generation` on each poll; stale managers stop automatically.

## Flow

```
session-changed event
  → setup_sync_lifecycle listener
    → start_sync_for_session() / stop_sync_for_server()
      → LiveSyncManager::start_with_shared_state()
        → tokio::spawn → run() loop
          → poll_once() → qb_sync_maindata_from_handle()
          → accumulator.apply()
          → gate_delta_for_embed() → emit_sync_changed()
            → app.emit("maindata-sync-changed", event)
```

## Integration

- Imports sync types from `qb-core` (`MaindataAccumulator`, `MaindataSnapshot`, `MaindataSyncHealth`, `SyncHealthState`).
- Uses `crate::client::qb_sync_maindata_from_handle` for HTTP sync calls (with stale-cookie recovery).
- Uses `crate::session::SessionStateHandle` for session awareness and generation checks.
- Uses Tauri `AppHandle` + `Emitter` trait for event emission.
- `get_maindata_snapshot` is called by the `sync.rs` command module for on-demand snapshot reads.
