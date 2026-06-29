# apps/desktop/src/hooks/settings/

## Responsibility

Exposes preferences hooks (re-exported from platform) and manages desktop-local settings that are not part of the qBittorrent preferences API — window behavior (`closeToTray`, `startMinimized`), auto-start, and download-completion notifications.

## Design

- **Preference re-exports**: `useSettings.ts` re-exports `usePreferences`, `useUpdatePreference`, `useSetPreferences`, `useSetGlobalDownloadLimit`, `useSetGlobalUploadLimit`, and `useToggleSpeedLimitsMode` from the single `createPlatformHooks` factory.
- **Tauri plugin store**: `useDesktopWindowSettings.ts` uses `@tauri-apps/plugin-store` for local persistence of `close_to_tray`, `start_minimized`, and `auto_start`.
- **Autostart integration**: `auto_start` is synced bidirectionally with `@tauri-apps/plugin-autostart` (enable/disable on write, read on initialization).
- **Bridge adapter**: `download_completion_notifications` is managed through `BridgeAdapter` rather than `plugin-store`, since it maps to a backend setting.

## Files

- **useSettings.ts** — re-exports preference hooks from `../platform/platform.ts`: `usePreferences`, `useUpdatePreference`, `useSetPreferences`, `useSetGlobalDownloadLimit`, `useSetGlobalUploadLimit`, `useToggleSpeedLimitsMode`.
- **useDesktopWindowSettings.ts** — manages desktop-local settings via Tauri `plugin-store` for `close_to_tray`, `start_minimized`, `auto_start`, and via `BridgeAdapter` for `download_completion_notifications`. Syncs `auto_start` with `@tauri-apps/plugin-autostart`.

## Flow

1. `useSettings` just re-exports from the platform factory — preferences go through the same RPC path as all other platform hooks.
2. `useDesktopWindowSettings` loads persisted values from `plugin-store` on mount, subscribes to changes, and writes back on mutation.
3. The `auto_start` toggle calls `autostart.enable()` / `autostart.disable()` via the Tauri plugin in addition to persisting to the store.
4. `download_completion_notifications` reads/writes through `BridgeAdapter` methods.

## Integration

- `@taurent/bridge/adapters/desktop` — `BridgeAdapter` for notification preferences.
- `@tauri-apps/plugin-store` — local key-value persistence.
- `@tauri-apps/plugin-autostart` — OS-level auto-start registration.
- `../platform/platform.ts` — single source for all preferences hooks.
