# crates/qb-tauri/src/

## Responsibility

Source files for the `qb-tauri` crate. Contains Tauri command handlers organized by domain, session management with event emission, server repository with secure storage, app builder helpers, a Tauri-aware HTTP client wrapper, and live sync managers.

## Files

| File | Responsibility |
|---|---|---|
| `lib.rs` | Crate root. Declares public modules: `app_builder`, `client`, `commands`, `server_repo`, `session`, `sync`. |
| `app_builder.rs` | Plugin initialization functions. `add_shared_plugins()` registers store, http, notification. `add_desktop_plugins()` adds clipboard, dialog, window-state (with deny-list for fixed-size windows), secure-storage, opener. `add_mobile_plugins()` adds fs, dialog, deep-link, shell, secure-storage. Constants: `DESKTOP_SERVER_STORE_FILE` (`.servers.dat`), `MOBILE_SERVER_STORE_FILE` (`.mobile-settings.dat`). `FIXED_SIZE_WINDOWS` list. |
| `client.rs` | Tauri-aware HTTP client layer. `SessionRequestContext` captures client, base_url, cookie, generation, server_id, supports_pause_resume. `capture_request_context()` / `capture_request_context_from_handle()` variants. `qb_get()`, `qb_post()`, `qb_post_multipart()`, `qb_probe()` wrap `qb-core` with structured logging. `qb_sync_maindata()` / `qb_sync_maindata_with_request()` implement stale-cookie recovery: on HTTP 403, re-authenticates using stored `ServerIdentity`, validates generation, retries with `rid=None`. `qb_sync_maindata_from_handle()` for background sync tasks. RSS wrappers: `qb_get_rss_items()`, `qb_get_rss_rules()`, `qb_add_rss_feed()`, `qb_set_rss_feed_url()`, `qb_remove_rss_item()`, `qb_set_rss_rule()`, `qb_rename_rss_rule()`, `qb_remove_rss_rule()`. `summarize_cookie()` redacts cookies in logs. `describe_backend_error()` provides human-readable error messages. |
| `session.rs` | Session lifecycle Tauri commands and event emission. `SessionStateHandle = Arc<Mutex<SessionManager>>`. Commands: `get_session_state`, `get_session_status`, `get_session_generation`, `session_connect` (raw credentials), `session_connect_by_id` (loads from repo), `session_switch_server_by_id` (atomic switch with repo persistence), `session_disconnect`, `session_reconnect`, `session_health_check` (probes `/api/v2/app/version`), `session_switch_server`, `session_set_error`, `session_clear_error`, `session_teardown`, `session_set_connecting`, `get_session_snapshot`, `bootstrap_session`, `get_bootstrap_contract`. `load_app_version()` probes `/api/v2/app/version` post-login and returns the raw app version (e.g. `"v5.0.1"`) — failure aborts connect. `load_resolved_capabilities()` probes `/api/v2/app/webapiVersion` and delegates to `QbResolver::resolve(webapi_version, app_version)`, which resolves webapi-version-keyed and app-version-keyed caps (including `supports_pause_resume` from `[app_versions]`) from the TOML. Event emission: `emit_session_changed()`, `emit_active_server_changed()`, `emit_resource_invalidated()`, `emit_operation_failed()`. Types: `SessionSnapshot`, `SessionChangedEvent`, `ActiveServerChangedEvent`, `ResourceInvalidatedEvent`, `OperationFailedEvent`, `BootstrapContract`. |
| `server_repo.rs` | Server repository with OS-secure credential storage. `ServerRepositoryState` holds `servers` map, `active_server_id`, `transient_passwords` (in-memory). Password storage: macOS uses `security_framework::passwords` (legacy keychain + protected fallback); other platforms use `tauri_plugin_secure_storage`. Operations: `init_repository()` (respects `E2E_STORE_DIR`), `add_server()` (UUID, normalize URL, store password), `update_server()` (partial update), `remove_server()`, `select_server_and_persist()`, `list_servers()`, `get_active_server()`, `get_server_password()` (keychain → transient), `compute_credential_status()`, `test_connection_raw()`, `test_saved_server()`. `save_repository()` persists metadata to `tauri-plugin-store`. |
| `error.rs` | `CommandError` enum: `Backend`, `SessionNotConnected`, `RequestFailed`, `JsonError`, `IoError`. Derives `thiserror::Error` + `Serialize`. `From<BackendError>` and `From<String>` conversions. |
| `commands/mod.rs` | Module aggregator. Re-exports: `app`, `categories`, `preferences`, `servers`, `session`, `sync`, `tags`, `torrents`, `transfer`. |
| `commands/app.rs` | App-level commands. `set_global_download_limit`/`set_global_upload_limit` (mobile), `get_rss_items`, `get_rss_rules`, `add_rss_feed`, `set_rss_feed_url`, `remove_rss_item`, `set_rss_rule`, `rename_rss_rule`, `remove_rss_rule`. |
| `commands/categories.rs` | Category management. `get_categories`, `create_category`, `edit_category`, `remove_categories`. Uses `join_categories`/`split_categories` for newline-joined wire format. `get_categories` delegates to `qb_core::parse_categories` for typed `Categories` map. |
| `commands/preferences.rs` | App preferences. `get_preferences`, `set_preferences`, `get_version`, `get_webapi_version`, `get_build_info`, `get_default_save_path`, `shutdown_server`. Capability discovery no longer lives in this file — server capabilities are resolved during connect in `session.rs` via `load_resolved_capabilities()` calling `QbResolver::resolve(webapi_version, app_version)` from the embedded TOML profile, producing boolean `ResolvedCapabilities`. |
| `commands/servers.rs` | Server CRUD + path resolution. `list_servers`, `get_active_server`, `add_server`, `update_server`, `remove_server`, `select_server`, `get_path_mappings`, `set_path_mappings`, `test_server_connection`, `test_saved_server_connection`. Desktop-only (feature-gated): `resolve_local_path`, `open_local_path`, `reveal_local_item`. `resolve_local_path` performs longest-prefix segment matching. |
| `commands/session.rs` | Re-exports everything from `crate::session` (all session commands live in `session.rs` at the crate root). |
| `commands/sync.rs` | Live maindata sync commands. `get_maindata_snapshot` (returns accumulated snapshot with generation/server_id/revision/rid/health), `get_maindata_sync_status` (lightweight health-only check), `start_maindata_sync` (explicitly restart), `stop_maindata_sync`. |
| `commands/tags.rs` | Tag management. `get_tags`, `create_tags`, `delete_tags`, `add_torrent_tags`, `remove_torrent_tags`. Uses `join_tags` for comma-joined wire format. `get_tags` delegates to `qb_core::parse_tags` with strict validation. |
| `commands/torrents.rs` | Torrent operations. `probe_search`, `probe_rss`, `get_torrent_list` (filter/category/tag/sort/hashes), `get_torrent_properties`, `get_torrent_trackers`, `get_torrent_files`, `add_torrent_options` (delegates to `qb_core::normalize::build_add_torrent_options`), `pause_torrents`/`resume_torrents` (v5-aware), `delete_torrents`, `recheck_torrents`, `reannounce_torrents`, `set_force_start`, `set_torrent_category`, `get_torrent_download_limit`/`get_torrent_upload_limit`, `set_torrent_download_limit`/`set_torrent_upload_limit`, `set_file_priority`, `set_torrent_name`, `set_torrent_location`, priority commands, tracker commands, file/folder rename, `sync_torrent_peers` (typed delta), `get_torrent_webseeds`, search commands, `set_auto_management`, `set_share_limits`, `set_sequential_download`/`set_first_last_piece_priority` (fetch-then-toggle), `set_super_seeding`, `export_torrent`. |
| `commands/transfer.rs` | Global transfer commands. `get_transfer_info`, `get_speed_limits_mode`, `toggle_speed_limits_mode`, `get_download_limit`/`set_download_limit`, `get_upload_limit`/`set_upload_limit`, `get_global_download_limit`/`get_global_upload_limit` (mobile aliases), `ban_peers`, `get_cookies`/`set_cookies`, `logout`. |
| `sync/mod.rs` | Module root. Re-exports all public types from sub-modules. |
| `sync/manager.rs` | `LiveSyncManager` — background Tokio actor (752 lines) polling `/api/v2/sync/maindata`. `LiveSyncHandle` (stop/refresh/set_visible). `MaindataSnapshotResponse` / `MaindataSnapshotEnvelope`. Poll loop: initial full poll, `select` over stop/refresh/visibility/sleep. `poll_once` → `accumulator.apply()` → `gate_delta_for_embed()` → `emit_sync_changed()`. `PollerState` enum. `compute_backoff` (5-60s exponential). `BACKGROUND_POLL_INTERVAL` (5s). `DELTA_EMBED_MAX_BYTES` (256KB). `should_emit_sync_changed` suppression. Unit tests for delta-embedding gate. |
| `sync/registry.rs` | `SyncManagerRegistry` — per-server `Arc<Mutex<HashMap<String, SyncEntry>>>`. `SyncEntry` with shared snapshot/revision/health Arcs. `create_sync_manager_registry`, `start_sync_for_session` (preserves old Arcs), `stop_sync_for_server`, `get_maindata_snapshot` (with diagnostic timing log). |
| `sync/lifecycle.rs` | `setup_sync_lifecycle` — event-driven wiring: observes `session-changed` to start/stop sync managers. |
| `sync/events.rs` | `MaindataSyncChangedEvent` — `server_id`, `session_generation`, `revision`, `rid`, `health`, `changed_resources` (Vec<String>), `delta` (Option<serde_json::Value>). `is_stale()` method. |

## Design

- **Mutex discipline**: Never hold the `SessionManager` mutex across `.await` points. Commands extract needed data, release the lock, then perform async work.
- **Generation-based stale detection**: Every command response includes `session_generation`. The frontend uses this to discard stale responses after reconnection.
- **Stale-cookie recovery**: `qb_sync_maindata_with_request()` handles HTTP 403 by silently re-authenticating and retrying. Uses generation check to avoid overwriting a newer session.
- **Credential status computation**: `compute_credential_status()` checks keychain first, then transient map, returning `Stored`, `SessionOnly`, or `Missing`.
- **URL normalization**: Applied consistently on login, storage, and request construction.
- **Delta embedding**: The sync manager size-checks raw qBittorrent deltas against a 256KB threshold before embedding in events. Large deltas force the renderer to fall back to `get_maindata_snapshot`.
- **Health-aware emission**: Sync events are suppressed when neither data nor health state changed, reducing IPC noise.

## Flow

Typical command execution:
```
Renderer invoke()
  → #[tauri::command] fn
    → capture_request_context() → lock session → extract client/url/cookie/generation → unlock
    → qb_get() / qb_post() → lock session (not held across await)
    → emit_resource_invalidated() if mutation
    → return ResponseDTO { session_generation, server_id, data }
```

Session connect flow:
```
session_connect_by_id()
  → lock repo → get_server_meta + get_server_password → unlock
  → lock session → set_connecting() → unlock
  → emit session-changed (Connecting)
  → qbittorrent_login() [async, no lock held]
  → load_app_version() [async probe of /api/v2/app/version]
  → load_resolved_capabilities() [async probe of /api/v2/app/webapiVersion + QbResolver::resolve]
  → lock session → connect() → unlock
  → emit session-changed (Connected)
```

Sync lifecycle flow:
```
session-changed (Connected)
  → setup_sync_lifecycle listener
    → start_sync_for_session()
      → LiveSyncManager::start_with_shared_state()
        → tokio::spawn → run() loop
          → poll_once() → qb_sync_maindata_from_handle()
          → accumulator.apply()
          → gate_delta_for_embed() → emit_sync_changed()
            → app.emit("maindata-sync-changed", event)
```

## Integration

- Commands are registered in app `main.rs` via `tauri::Builder::invoke_handler(tauri::generate_handler![...])`.
- `SessionStateHandle` and `ServerRepoStateHandle` are registered via `.manage()` on the builder.
- All `#[tauri::command]` functions return `Result<T, String>` for Tauri's error serialization.
- Events emitted via `app.emit("event-name", payload)` are received by the renderer's `listen()` handlers.
- `SyncManagerRegistry` is created once during app setup and shared across the sync lifecycle.
