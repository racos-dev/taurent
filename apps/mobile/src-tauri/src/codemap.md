# apps/mobile/src-tauri/src/

## Responsibility

Mobile Tauri Rust source — the implementation behind the `mobile_lib` crate. Owns the `run()` bootstrap, command module declarations, and mobile-specific command wrappers.

This directory is intentionally minimal. Nearly all commands are imported directly from `qb_tauri::commands::*` in `lib.rs`. Only the 4 thin wrappers in `torrents.rs` are mobile-specific.

## Design

**File map**:

| File | Role |
|---|---|
| `main.rs` | Binary entry point: calls `mobile_lib::run()`. 3 lines. |
| `lib.rs` | Crate root (176 lines). Declares modules, imports shared commands from `qb_tauri`, composes plugins, registers managed state (session, server repo, sync manager registry), sets up sync lifecycle, and wires the `invoke_handler`. |
| `torrents.rs` | 4 mobile-specific command wrappers: `add_torrent`, `set_category`, `add_tags`, `remove_tags`. Converts mobile UI conventions (comma-separated tag strings, `AddTorrentOptions` struct) to canonical `qb-tauri` signatures. |

**Key patterns**:

- **Direct command import**: Unlike desktop which has its own `commands/` directory with re-export modules, mobile imports `qb_tauri::commands::*` directly in `lib.rs` and registers commands via fully-qualified paths (e.g., `qb_tauri::commands::servers::list_servers`). This keeps the mobile crate lighter.
- **Comma-separated tag adaptation**: `add_tags` and `remove_tags` accept `tags: String`, split on commas, trim whitespace, filter empties, and delegate to `tags::add_torrent_tags` / `tags::remove_torrent_tags`.
- **Single-instance (desktop dev only)**: `tauri_plugin_single_instance` is only compiled on non-mobile targets. On real mobile, OS-level app lifecycle handles single-instance semantics.

## Flow

```
main() → mobile_lib::run()
  ├─ compose plugins (add_shared_plugins + add_mobile_plugins)
  ├─ manage(session_state)
  ├─ setup():
  │   ├─ init_and_manage_repository(app, MOBILE_SERVER_STORE_FILE)
  │   ├─ create_sync_manager_registry() → manage
  │   ├─ setup_sync_lifecycle(app.handle())
  │   ├─ (debug) install log plugin
  │   └─ (desktop dev) register single-instance plugin
  ├─ invoke_handler(80+ commands, mostly from qb_tauri::*)
  └─ run()
```

Command delegation chain:
```
Renderer invoke("add_tags", { hashes, tags: "tag1, tag2" })
  → torrents::add_tags() — splits tag string → Vec<String>
    → qb_tauri::commands::tags::add_torrent_tags(state, app, hashes, tag_vec)
      → qb_tauri::client::qb_post() → qb-core HTTP → qBittorrent API
```

## Integration

- **Exposes**: `mobile_lib::run()` — called by `main.rs`
- **Imports from shared crates**: `qb_tauri::app_builder`, `qb_tauri::server_repo`, `qb_tauri::session`, `qb_tauri::commands::*`
- **Internal dependencies**: `lib.rs` → `torrents.rs`
