# apps/desktop/src-tauri/src/commands/

## Responsibility

Desktop-specific Tauri commands. Most commands are thin re-exports from `qb_tauri::commands::*`; only desktop-platform-specific logic lives here.

## Design

**Module map**:

| File | Role | Own logic vs re-export |
|---|---|---|
| `mod.rs` | Public module declarations for all 7 sub-modules. | Declaration only. |
| `categories.rs` | Category CRUD commands. | Re-export from `qb_tauri::commands::categories`. |
| `menu.rs` | `sync_menu_state` (pushes current session/server info and tray state to native menu and tray menu), `exit_app` (triggers `request_app_quit`). Builds and manages macOS native app menu with torrent/view/tools/help submenus, stores `MenuItem` and `CheckMenuItem` handles for runtime enable/disable and checked-state updates. Routes UI-open actions to main window or enqueues for cold-start drain. | Desktop-specific. |
| `preferences.rs` | qBittorrent preferences get/set, version, build info, shutdown. | Re-export from `qb_tauri::commands::preferences`. |
| `servers.rs` | Server management commands + path mappings (`get_path_mappings`, `set_path_mappings`, `resolve_local_path`, `open_local_path`, `reveal_local_item`). | Path-mapping resolution and filesystem open/reveal are Rust-owned and feature-gated in `qb_tauri`. Other commands re-export from `qb_tauri::commands::servers`. |
| `tags.rs` | Tag CRUD and torrent-tag association commands. | Re-export from `qb_tauri::commands::tags`. |
| `torrents.rs` | Torrent list, properties, trackers, files, add, pause, resume, delete, recheck, priorities, limits, name/location, search, RSS, maindata sync, peers, webseeds, export. | Most re-export from `qb_tauri::commands::torrents`. Probe (search/RSS) commands are desktop-specific wrappers. |
| `transfer.rs` | Transfer info, speed limits, ban peers, cookies, logout. | Re-export from `qb_tauri::commands::transfer`. |

**Key distinction**: Desktop-specific commands are those that need the desktop `AppHandle` for tray integration (`sync_menu_state`), window management (`exit_app`), or filesystem access (`get/set_path_mappings`). Everything else delegates to `qb-tauri` which operates on `SessionStateHandle` regardless of platform.

## Flow

The `invoke_handler![]` macro in `lib.rs` registers all commands. Renderer calls `invoke("command_name", args)` → Tauri dispatches to the `#[tauri::command]` function. Desktop-specific commands:
- `sync_menu_state` → applies MenuState to native menu handles (enable/disable torrent items, update view toggles) and syncs tray state via `update_tray_state`
- `exit_app` → sets `explicit_quit_requested` flag → calls `app_handle.exit(0)`
- `get/set_path_mappings` → reads/writes path mappings from the server repository
- `resolve_local_path` → loads path mappings, resolves server paths to local paths via longest-prefix segment matching
- `open_local_path` / `reveal_local_item` → wraps `tauri_plugin_opener` for native filesystem open/reveal operations; `reveal_local_item` includes Linux DBus fallback

## Integration

- **Registered in**: `apps/desktop/src-tauri/src/lib.rs` via `use commands::{categories, menu, preferences, servers, tags, torrents, transfer};` and the `invoke_handler![]` macro
- **Depends on**: `qb_tauri::commands::*`, `qb_tauri::session::SessionStateHandle`
- **All commands receive**: `State<'_, SessionStateHandle>` (and optionally `AppHandle`) via Tauri managed state injection
