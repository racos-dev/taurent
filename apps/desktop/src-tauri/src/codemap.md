# apps/desktop/src-tauri/src/

## Responsibility

Desktop Tauri Rust source — the implementation behind the `app_lib` crate. Owns the `run()` bootstrap, all managed state types, window/tray lifecycle, download completion notifications, native macOS menu, and command module declarations.

This directory is the app-specific layer. Shared logic (session, server repo, transport) lives in `qb-core`/`qb-tauri` and is imported here. Only desktop-platform-specific code lives in these files.

## Design

**File map**:

| File | Role |
|---|---|
| `main.rs` | Binary entry point: calls `app_lib::run()`. Sets `windows_subsystem = "windows"` on release. |
| `lib.rs` | Crate root (1010 lines). Defines all managed state types, the `run()` bootstrap, window lifecycle functions (`build_main_window`, `ensure_main_window`, `show_main_window`, `suspend_main_window_to_tray`), tray state, pending-action queues, single-instance handling, close-to-tray logic, macOS activation policy, and E2E native diagnostics. Re-exports from `commands/`, `download_completion_notifications`, and `tray`. |
| `tray.rs` | System tray owner (511 lines). Creates tray icon and dynamic context menu with items: Show/Hide, Add Torrent, Alternative Speed, Set Global Speed Limits, Quit. `TrayStateHandle` stores `show_hide_item` and `alt_speed_item` handles for in-place menu updates. Singleton windows (add-torrent, dialog-host) are reused when visible. |
| `download_completion_notifications.rs` | Native desktop notification monitor (615 lines). Polls maindata in a background task, detects newly-completed torrents, and fires native OS notifications via `tauri-plugin-notification`. Tracks completion state per-hash to avoid duplicate notifications. Togglable via `get/set_download_completion_notifications_enabled` commands. |
| `commands/` | Command module declarations (7 files). See `commands/codemap.md`. |

**Key patterns**:

- **Atomic state for tray/window coordination**: `TrayState` uses `AtomicBool` fields so flags can be set/reset without mutable access to managed state. Critical for close-to-tray where the `CloseRequested` handler and exit handler run concurrently.
- **Pending-action queues**: Torrent file paths, native UI actions, and view actions are queued when the renderer isn't listening (cold-start, window-closed). The renderer drains queues via `get_pending_*` commands once listeners are ready.
- **Geometry-aware window creation**: `build_main_window()` reads `.window-state.json` before creating the window, resolves the source monitor's scale factor from physical coordinates, and passes logical coordinates to the builder — so the window appears in-place with no post-creation move.
- **macOS activation policy**: Uses `set_activation_policy(Regular/Accessory)` instead of `set_dock_visibility()` to avoid the dock tile flashing a generic executable icon during tray transitions.
- **Single-instance torrent handling**: Validates `.torrent` extension (case-insensitive), resolves relative paths against the launching instance's cwd, deduplicates via `PendingTorrentFiles::seen` set.

## Flow

See the parent `apps/desktop/src-tauri/codemap.md` for the full bootstrap flow diagram. The `lib.rs::run()` function is the single orchestration point.

Key lifecycle transitions:
1. `build_main_window()` — reads saved geometry, resolves monitor scale factor, creates window at correct position
2. `suspend_main_window_to_tray()` — saves state → hides dock → destroys aux windows → enters tray → closes main with guard
3. `show_main_window()` — restores dock → ensures window (rebuilds if destroyed) → notifies renderer

## Integration

- **Exposes**: `app_lib::run()` — called by `main.rs`
- **Imports from shared crates**: `qb_tauri::app_builder`, `qb_tauri::server_repo`, `qb_tauri::session`, `qb_tauri::commands::*`
- **Internal dependencies**: `commands/` → `tray.rs` → `download_completion_notifications.rs` → `lib.rs`
