# packages/bridge/src/desktop/

## Responsibility

Desktop-only helpers that depend on Tauri desktop plugins (`@tauri-apps/plugin-notification`). These are isolated from runtime-agnostic bridge surfaces to prevent accidental import by shared or mobile code.

## Files

- **notification.ts** — Native desktop notification helper. Wraps `@tauri-apps/plugin-notification` to check/request permission and send OS-level notifications.
- **codemap.md** — This file.

## Design

- **Plugin isolation**: This is the only directory (besides `transport/tauriTransport.ts`) that imports `@tauri-apps/*` dependencies. It is intentionally separate from the shared adapter layer.
- **Permission management**: `ensureNativeNotificationPermission()` checks if notification permission is granted; if not, requests it. Returns a `PermissionState` (`'granted' | 'denied' | 'default'`).
- **Fire-and-forget pattern**: `notifyNative()` attempts to send a notification, returning `false` silently if permission is denied. Callers don't need to handle permission flows.
- **NativeNotificationPayload**: Typed payload with `title` and `body` strings, imported from `../transport/tauriTransport` for type consistency with the Tauri event system.

## Flow

```
Desktop app code (download completion handler, etc.)
  → notifyNative({ title, body })
  → ensureNativeNotificationPermission()
    → isPermissionGranted()  [Tauri plugin]
    → requestPermission()    [if not granted]
  → sendNotification({ title, body })  [Tauri plugin]
  → OS notification displayed
```

## Integration

- **Consumer**: Desktop app code that needs to display OS notifications (e.g., download completion notifications).
- **Transport dependency**: Imports `NativeNotificationPayload` type from `../transport/tauriTransport` for type consistency.
- **Platform boundary**: This directory must never be imported by `packages/web-core`, `packages/web-ui`, or any shared/mobile code. Desktop bridge code is exported through `@taurent/bridge/adapters/desktop`; this directory exposes only desktop-specific helpers such as native notifications.
- **Notification toggle**: Desktop adapter exposes `getDownloadCompletionNotificationsEnabled()` / `setDownloadCompletionNotificationsEnabled()` on the bridge. App-level code uses these settings to decide whether to call `notifyNative()`.
