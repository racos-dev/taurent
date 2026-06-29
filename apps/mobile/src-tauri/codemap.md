# apps/mobile/src-tauri/

## Responsibility

Mobile Tauri sidecar — the native Rust shell for the Taurent mobile app (iOS and Android). Owns plugin composition, managed state registration, command wiring, and mobile-specific command wrappers (tag strings, add-torrent options).

This crate is intentionally thin. Most business logic lives in shared `qb-core` and `qb-tauri`. App-specific code is limited to mobile-only integrations (capabilities/permissions) and thin command wrappers that adapt mobile UI conventions (comma-separated tags, `AddTorrentOptions` struct).

## Design

**Crate identity**: `mobile_lib` (lib name), `taurent-mobile` (package name). Entry point `main.rs` calls `mobile_lib::run()`.

**Plugin stack** (composed via `qb_tauri::app_builder`):
| Plugin | Role |
|---|---|
| `add_shared_plugins` | store, http, notification |
| `add_mobile_plugins` | fs, dialog, deep-link, shell |
| `tauri-plugin-single-instance` | Single-instance enforcement. Desktop dev only (not on real mobile). |
| `tauri-plugin-log` | Debug-only webview log forwarding. |

**Managed state** (registered in `lib.rs::run()`):
| State | Type | Role |
|---|---|---|
| `SessionStateHandle` | `Arc<Mutex<SessionManager>>` | Shared session (from `qb-tauri`) |
| `ServerRepositoryState` | `Mutex<ServerRepositoryState>` | Persisted server store (from `qb-tauri`) |
| `SyncManagerRegistry` | `...` | Sync manager lifecycle registry (from `qb-tauri`) |

**Command registration** occurs in `lib.rs::invoke_handler![]`. Shared commands are registered from `qb_tauri` (session, servers, torrents including advanced torrent actions, transfer, sync, preferences, categories, tags, app) plus 4 mobile-specific commands from `torrents.rs`: `add_torrent` (accepts `AddTorrentOptions`), `set_category`, `add_tags` (comma-separated string), `remove_tags` (comma-separated string).

**Mobile-specific patterns**:
- **Tag strings**: Mobile UI sends tags as comma-separated strings (e.g., `"tag1, tag2, tag3"`). The wrappers in `torrents.rs` split on `,`, trim, filter empties, and delegate to canonical `qb_tauri::commands::tags` which accept `Vec<String>`.
- **Capabilities**: Defined in `capabilities/default.json`. Renderer permissions are intentionally narrow: core/log, store load/get/set/delete/has/keys/save, dialog open, and http fetch/send/read-body for configured qBittorrent endpoints. Installed plugins that have no production renderer call sites are not granted renderer permissions. See `capabilities/codemap.md`.

## Flow

```
main() → mobile_lib::run()
  ├─ compose plugins (add_shared_plugins + add_mobile_plugins)
  ├─ register managed state (session, server repo, sync registry)
  ├─ setup():
  │   ├─ init server repository → manage(server_repo)
  │   ├─ create sync manager registry → manage
  │   ├─ setup sync manager lifecycle on app handle
  │   ├─ install log plugin (debug only, webview target)
  │   └─ register single-instance plugin (desktop dev only)
  ├─ register ~100 invoke_handler commands
  └─ run()
```

Command execution pattern is identical to desktop: renderer calls `invoke("command_name", args)` → Tauri dispatches to `#[tauri::command]` → command reads `State<SessionStateHandle>` → delegates to `qb-tauri`/`qb-core`.

## Integration

- **Depends on**: `qb-core` (provides `split_tags` for comma-separated tag parsing), `qb-tauri` (with `features = ["mobile"]`), Tauri v2.10, `tauri-plugin-*` crates, `serde_json`
- **Consumed by**: Tauri runtime — no other crate imports this
- **Events emitted to renderer**: `session-changed`, `resource-invalidated` (both via qb-tauri)
- **Store file**: mobile-specific server store path via `MOBILE_SERVER_STORE_FILE` constant from `qb_tauri::app_builder`
- **Generated**: `gen/` contains Tauri-generated Android/iOS project files and schema
