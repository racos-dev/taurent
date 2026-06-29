# apps/desktop/src-tauri/capabilities/

## Responsibility

Tauri v2 capability declarations — JSON files that define which permissions the desktop webview is allowed to use. Acts as the security boundary between the renderer and native platform APIs.

## Design

**`default.json`** defines the desktop app's capability set:

| Section | Content |
|---|---|
| `identifier` | `"default"` — the single capability set for the desktop app |
| `windows` | `["main", "dialog-host", "settings", "add-torrent", "statistics"]` — all webview windows including aux/dialog windows |
| `permissions` | Whitelist of allowed Tauri plugin operations |

**Permission categories**:
| Category | Permissions |
|---|---|
| Core | `core:default`, window management (minimize, maximize, unminimize, hide, show, close, destroy, start-dragging, set-size, set-position, center, set-focus), webview creation |
| Store | `store:allow-load/get/set/delete/has/keys/save` |
| Clipboard | `clipboard-manager:allow-write-text`, `clipboard-manager:allow-read-text` |
| Window State | `window-state:default` |
| Notification | `notification:default`, `notification:allow-is-permission-granted`, `notification:allow-request-permission`, `notification:allow-notify` |
| Dialog | `dialog:allow-open`, `dialog:allow-save` |
| Opener | `opener:default`, `opener:allow-open-path` (glob `**`), `opener:allow-reveal-item-in-dir` |
| Secure Storage | `secure-storage:allow-get-item/set-item/remove-item` |
| Autostart | `autostart:allow-enable/disable/is-enabled` |

Key differences from mobile capabilities: desktop has additional windows (`dialog-host`, `settings`, `add-torrent`, `statistics`), clipboard-manager, opener, notification, window-state, secure-storage, and autostart permissions. Mobile's renderer capability set is intentionally narrower and currently grants store, dialog-open, and scoped HTTP permissions.

## Flow

At build time, Tauri reads `capabilities/default.json` and generates platform-specific permission manifests in `gen/schemas/desktop-schema.json`. At runtime, the webview's access to native APIs is enforced against these declarations.

## Integration

- **Consumer**: Tauri build system (`tauri-build`) reads this during compilation
- **Generated output**: `../gen/schemas/desktop-schema.json`
- **Related**: Mobile has its own `apps/mobile/src-tauri/capabilities/default.json` with a mobile-specific permission set
