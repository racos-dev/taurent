# apps/mobile/src-tauri/capabilities/

## Responsibility

Tauri v2 capability declarations — JSON files that define which permissions the mobile webview is allowed to use. Acts as the security boundary between the renderer and native platform APIs.

## Design

**`default.json`** defines the mobile app's capability set:

| Section | Content |
|---|---|
| `identifier` | `"default"` — the single capability set for the mobile app |
| `windows` | `["main"]` — only the main webview window |
| `permissions` | Whitelist of allowed Tauri plugin operations |

**Permission categories**:
| Category | Permissions |
|---|---|
| Core/Log | `core:default`, `log:default` |
| Store | `store:allow-load/get/set/delete/has/keys/save` |
| Dialog | `dialog:default`, `dialog:allow-open` for torrent file picking |
| HTTP | scoped `http:allow-fetch`, `http:allow-fetch-send`, and `http:allow-fetch-read-body` for `http://*:*` and `https://*:*` qBittorrent endpoints |

Plugins such as notification, fs, shell, deep-link, and secure-storage may be installed by the native builder, but the production renderer is not granted those capabilities unless a source call site needs them.

## Flow

At build time, Tauri reads `capabilities/default.json` and generates platform-specific permission manifests in `gen/`. At runtime, the webview's access to native APIs is enforced against these declarations.

Capabilities are additive — the mobile app uses a single `default` capability set. No platform-specific capability variants (iOS vs Android) are defined; platform-conditional behavior is handled in Rust via `#[cfg]`.

## Integration

- **Consumer**: Tauri build system (`tauri-build`) reads this during compilation
- **Generated output**: `gen/schemas/mobile-schema.json` and platform-specific permission manifests
- **Related**: Desktop has its own `apps/desktop/src-tauri/capabilities/default.json` with a different window list (`main`, `dialog-host`, `settings`, `add-torrent`, `statistics`) and additional permissions (clipboard-manager, opener, notifications, window-state, autostart)
