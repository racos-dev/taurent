# crates/qb-tauri/src/commands/

## Responsibility

Tauri command handlers organized by domain. Each submodule exposes `#[tauri::command]` functions that the renderer invokes via `invoke()`. Commands wrap `qb-core` HTTP functions with Tauri state access, structured logging, error mapping, and event emission.

## Files

| File | Domain | Commands |
|---|---|---|
| `mod.rs` | Module aggregator | Re-exports: `app`, `categories`, `preferences`, `servers`, `session`, `sync`, `tags`, `torrents`, `transfer`. |
| `session.rs` | Session lifecycle | Re-exports everything from `crate::session` (all session commands live in `session.rs` at the crate root). |
| `servers.rs` | Server CRUD + path resolution | `list_servers`, `get_active_server`, `add_server`, `update_server`, `remove_server`, `select_server`, `get_path_mappings`, `set_path_mappings`, `test_server_connection`, `test_saved_server_connection`. Desktop-only (feature-gated): `resolve_local_path`, `open_local_path`, `reveal_local_item`. Delegates to `server_repo` functions. All mutations call `save_repository()` after state changes. Path mappings stored separately in the same tauri-plugin-store file. `resolve_local_path` loads mappings from store and performs longest-prefix segment matching to resolve server paths to local paths. `open_local_path` / `reveal_local_item` wrap `tauri_plugin_opener` for native filesystem operations. |
| `sync.rs` | Live maindata sync commands | `get_maindata_snapshot` (returns accumulated snapshot with generation/server_id/revision/rid/health), `get_maindata_sync_status` (lightweight health-only check), `start_maindata_sync` (explicitly restart the sync actor), `stop_maindata_sync` (stop sync for a server). Delegates to `crate::sync::*` functions. |
| `torrents.rs` | Torrent operations | `probe_search`, `probe_rss`, `get_torrent_list` (with filter/category/tag/sort/hashes), `get_torrent_properties`, `get_torrent_trackers`, `get_torrent_files`, `add_torrent_options` (multipart + URL paths both delegate wire formatting to `qb_core::normalize::build_add_torrent_options`), `pause_torrents`/`resume_torrents` (v5-aware), `delete_torrents`, `recheck_torrents`, `reannounce_torrents`, `set_force_start`, `set_torrent_category`, `get_torrent_download_limit`/`get_torrent_upload_limit`, `set_torrent_download_limit`/`set_torrent_upload_limit`, `set_file_priority`, `set_torrent_name`, `set_torrent_location`, `increase_priority`/`decrease_priority`/`top_priority`/`bottom_priority`, `add_trackers`/`add_peers`/`edit_tracker`/`remove_trackers`, `rename_file`/`rename_folder`, `sync_torrent_peers` (delegates response parsing to `qb_core::parse_sync_torrent_peers`; returns typed delta `{ rid, full_update, peers?, peers_removed? }`; invalid `rid` or malformed peer data surfaces as command errors rather than flowing as raw JSON to the bridge adapter), `get_torrent_webseeds`, `sync_maindata` (with stale generation rejection), search commands (`start_search`, `stop_search`, `get_search_status`, `get_search_results`, `delete_search`, `get_search_plugins`, `install_search_plugin`, `uninstall_search_plugin`, `enable_search_plugin`, `update_search_plugins`), `set_auto_management`, `set_share_limits`, `set_sequential_download`/`set_first_last_piece_priority` (fetch-then-toggle pattern), `set_super_seeding`, `export_torrent` (fetches bytes + writes to filesystem). |
| `transfer.rs` | Global transfer | `get_transfer_info`, `get_speed_limits_mode`, `toggle_speed_limits_mode`, `get_download_limit`/`set_download_limit`, `get_upload_limit`/`set_upload_limit`, `get_global_download_limit`/`get_global_upload_limit` (mobile bridge aliases), `ban_peers`, `get_cookies`/`set_cookies`, `logout`. |
| `categories.rs` | Category management | `get_categories`, `create_category`, `edit_category`, `remove_categories`. Uses `qb_core::normalize::join_categories`/`split_categories` for newline-joined wire format. `get_categories` delegates response parsing to `qb_core::parse_categories` which returns a typed `Categories` map (`BTreeMap<String, CategoryDto>`); invalid upstream responses fail at the Rust boundary rather than being exposed as raw JSON. |
| `tags.rs` | Tag management | `get_tags`, `create_tags`, `delete_tags`, `add_torrent_tags`, `remove_torrent_tags`. Uses `qb_core::normalize::join_tags` for comma-joined wire format. `get_tags` delegates response parsing to `qb_core::parse_tags` which strictly validates all array entries as strings; non-string entries fail at the Rust boundary rather than being silently dropped. |
| `preferences.rs` | App preferences | `get_preferences`, `set_preferences`, `get_version`, `get_webapi_version`, `get_build_info`, `get_default_save_path`, `shutdown_server`. Capability resolution moved out of this file: server capabilities are now resolved during connect in `session.rs` (`load_resolved_capabilities` calling `QbResolver::resolve(webapi_version, app_version)` from the embedded TOML profile, producing boolean `ResolvedCapabilities`). |
| `app.rs` | App-level / RSS | `set_global_download_limit`/`set_global_upload_limit` (mobile), `get_rss_items`, `get_rss_rules`, `add_rss_feed`, `set_rss_feed_url`, `remove_rss_item`, `set_rss_rule`, `rename_rss_rule`, `remove_rss_rule`. |

## Design

**Response envelope pattern**: Every command returns a struct containing:
- `session_generation: u64` — allows the frontend to discard stale responses.
- `server_id: Option<String>` — identifies which server the response is from.
- Domain-specific data (e.g. `torrents`, `info`, `tags`, `success`).

**Consistent mutation pattern** (torrents, categories, tags, etc.):
1. `capture_request_context()` → extract session state.
2. Build qBittorrent API path + parameters.
3. `qb_post()` / `qb_get()` → HTTP call.
4. `emit_resource_invalidated()` → notify renderer to refetch.
5. Return `OperationResponse { session_generation, server_id, success: true }`.

**qBittorrent v5+ compatibility**: `pause_torrents`/`resume_torrents` check `request.supports_pause_resume` to use `/pause`/`/resume` (v4) or `/stop`/`/start` (v5+).

**Toggle-before-set pattern**: `set_sequential_download` and `set_first_last_piece_priority` fetch current state first, filter to torrents that differ from the target, then call the toggle endpoint only for those. This avoids unnecessary toggles.

**Stale generation rejection**: `sync_maindata` accepts an optional `expected_generation` parameter. If the frontend's generation is older than the backend's current generation, the request is rejected with `"stale_session_generation"` — the frontend will pick up the new generation via the `session-changed` event.

**Probe commands**: `probe_search` and `probe_rss` use `qb_probe()` to detect endpoint availability without erroring on 404/405. Returns tri-state `supported: Option<bool>`.

**Typed DTO boundary**: `get_categories` delegates to `qb_core::parse_categories`, `get_tags` to `qb_core::parse_tags`, `sync_torrent_peers` to `qb_core::parse_sync_torrent_peers`. All structural validation happens at the Rust boundary.

## Flow

All commands follow this data flow:
```
Renderer invoke("command", {args})
  → Tauri dispatches to #[tauri::command] fn
    → State<SessionStateHandle> injected by Tauri
    → capture_request_context() locks session, extracts client/url/cookie/generation
    → qb_get() / qb_post() via crate::client wraps qb-core
    → Response struct with session_generation returned
    → (optional) emit_resource_invalidated() triggers renderer refetch
```

Server commands have an additional repo state injection:
```
Renderer invoke("add_server", {input})
  → State<ServerRepoStateHandle> injected
  → lock repo → add_server() → save_repository() → unlock
  → return SavedServerSummary
```

## Integration

- Commands are wired into the Tauri app via `tauri::generate_handler![...]` in each app's `main.rs`.
- Session commands (`session.rs`) re-export from `crate::session` — the actual implementations live at the crate root level.
- All commands return `Result<T, String>` for Tauri's built-in error serialization.
- Event emission (`emit_resource_invalidated`, `emit_session_changed`) uses `app.emit()` which sends events to all webview windows.
- The `OperationResponse` type is shared across multiple command modules (re-exported where needed).
