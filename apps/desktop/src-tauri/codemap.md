# apps/desktop/src-tauri/

## Responsibility

Desktop Tauri sidecar — the native Rust shell for the Taurent desktop app. Owns plugin composition, managed state registration, command wiring, the system tray, native macOS app menu, download completion notifications, window lifecycle (geometry restore, tray suspend/resume, close-to-tray), single-instance torrent file handling, and pending-action queuing that survives main-window recreation.

This crate is intentionally thin. Most business logic lives in shared `qb-core` and `qb-tauri`. App-specific code here is limited to desktop-only UI integrations (tray, menu, notifications) and window management.

## Design

**Crate identity**: `app_lib` (lib name), `taurent` (package name). Entry point `main.rs` calls `app_lib::run()`.

**Plugin stack** (composed via `qb_tauri::app_builder`):
| Plugin | Role |
|---|---|
| `add_shared_plugins` | store, http, notification, window-state, secure-storage |
| `add_desktop_plugins` | clipboard-manager, dialog, window-state, secure-storage, opener |
| `tauri-plugin-shell` | shell/open commands for external links |
| `tauri-plugin-single-instance` | torrent file opens from second instance |
| `tauri-plugin-autostart` | macOS LaunchAgent (auto-start on login) |
| `tauri-plugin-log` | webview-origin log forwarding only (native logs stay on stdout) |

**Managed state** (registered in `lib.rs::run()`):
| State | Type | Role |
|---|---|---|
| `SessionStateHandle` | `Arc<Mutex<SessionManager>>` | Shared session (from `qb-tauri`) |
| `ServerRepositoryState` | `Mutex<ServerRepositoryState>` | Persisted server store (from `qb-tauri`) |
| `PendingTorrentFiles` | custom | Deduped queue of .torrent paths awaiting renderer drain |
| `PendingNativeUiActions` | custom | Queued native UI actions (settings, about, add-torrent, nav) that survive window close |
| `PendingViewActions` | custom | View toggle actions queued before JS listeners are ready |
| `ViewListenersReady` | `AtomicBool` | Readiness flag for JS view listeners |
| `TrayState` | `AtomicBool` × 3 | Tray visibility, intentional-close, explicit-quit flags |
| `MonitorState` | `Arc<AtomicBool>` | Download completion notification enable/disable |

**Command registration** occurs in `lib.rs::invoke_handler![]`. 90+ commands registered, most from `qb_tauri::session::*`, `qb_tauri::commands::*`, and local `commands/` modules. Desktop-specific commands include `menu::sync_menu_state` (syncs frontend menu/tray state), `menu::exit_app` (triggers `request_app_quit`), `servers::get_path_mappings`, `servers::set_path_mappings`, and the pending-queue drain/signal commands.

**Window lifecycle**: The main window uses `create: false` in `tauri.conf.json` and is built manually in `setup()` via `build_main_window()`, which reads saved geometry from `.window-state.json` and creates the window on the correct display at the correct size — avoiding cross-display flash on launch. Auxiliary window labels: `settings`, `statistics`, `add-torrent`, `dialog-host`.

**Close-to-tray**: `CloseRequested` handler checks the `close_to_tray` setting from `.settings.dat`. If enabled, prevents close and calls `suspend_main_window_to_tray()` — saves window state, hides dock icon (macOS), destroys aux windows, enters tray mode via `enter_tray_mode()`, then closes the main window with an intentional-close guard so the handler allows it.

## Flow

```
main() → app_lib::run()
  ├─ compose plugins (add_shared_plugins + add_desktop_plugins + extras)
  ├─ register managed state
  ├─ register 90+ invoke_handler commands
  ├─ setup():
  │   ├─ init server repository → manage(server_repo)
  │   ├─ start download completion notification monitor
  │   ├─ install log plugin (webview-only target)
  │   ├─ build_main_window() — geometry-aware creation
  │   ├─ register single-instance plugin (torrent file opens)
  │   ├─ register macOS RunEvent::Opened/Reopen handler
  │   ├─ queue cold-start .torrent CLI args
  │   ├─ setup_native_menu() + setup_menu_events()
  │   ├─ setup_tray() — tray icon + dynamic context menu
  │   └─ optionally hide to tray if start_minimized setting
  ├─ on_window_event (CloseRequested → close-to-tray logic)
  └─ run() → on_exit (ExitRequested → prevent implicit exit during tray suspend)
```

**Tray suspend/resume cycle**:
1. User closes main window → `CloseRequested` fires
2. If `close_to_tray` enabled: save window state, hide dock (macOS), destroy aux windows, `enter_tray_mode()` (emits `app-tray-state-changed` with `inTray: true`), close main window with intentional guard
3. User clicks tray "Show" → `show_main_window()`: restore dock, `ensure_main_window()` (rebuilds at saved geometry), `notify_tray_resume()` (emits `app-tray-state-changed` with `inTray: false`), sets tray visibility flag
4. Renderer listens to `app-tray-state-changed` events to react

## Integration

- **Depends on**: `qb-core`, `qb-tauri` (with `features = ["desktop"]`), Tauri v2.10, various `tauri-plugin-*` crates, `serde_json`, `urlencoding`, `tokio`
- **Consumed by**: Tauri runtime — no other crate imports this
- **Events emitted to renderer**: `app-tray-state-changed`, `torrent-file-open`, `session-changed` (via qb-tauri), `resource-invalidated` (via qb-tauri)
- **Store files**: `.settings.dat` (user prefs: close_to_tray, start_minimized), `.servers.dat` (server repo via qb-tauri), `.window-state.json` (window geometry via tauri-plugin-window-state)
