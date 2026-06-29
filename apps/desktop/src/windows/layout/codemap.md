# apps/desktop/src/windows/layout/

## Responsibility

Provides layout wrappers for all desktop window types (main, auxiliary, dialog, settings, statistics). Each layout handles window geometry restoration, navigate event routing, resource invalidation handling, and session-loss cleanup. Together they form the window lifecycle layer that bridges Tauri window events to React rendering.

## Design

- **Geometry restoration**: `AuxWindowLayout` and `MainWindowLayout` restore window position and size via `useWindowState`, keyed by window label (or no label for the main window, which gets full restore).
- **Navigate event routing**: Most layouts listen for Tauri navigate events with payloads, routing them to the appropriate route/screen.
- **Resource invalidation**: `AuxWindowLayout` listens for `resource-invalidated` events (e.g., when settings change on another window) and refetches or updates accordingly.
- **Session-loss auto-close**: All layouts close their window when the session is lost (server disconnect / logout), preventing stale UI.
- **Singleton reuse**: `DialogWindowLayout` supports prebake/hide patterns — the dialog host window is created once, hidden instead of destroyed, and reused for subsequent dialogs.

## Files

- **AuxWindowLayout.tsx** — layout for auxiliary windows (settings, statistics, RSS, search). Restores geometry via `useWindowState(key)`, listens for navigate events with payloads, listens for `resource-invalidated` events for cross-window sync, closes on session loss.
- **DialogWindowLayout.tsx** — minimal layout for non-resizable dialog windows. Supports prebake/hide for instant open (window created once, hidden when dismissed). Reads navigate events to render the registered dialog Screen from `DESKTOP_DIALOGS` registry. Singleton reuse — one Tauri window serves all dialog types.
- **MainWindowLayout.tsx** — layout for the main application window. Restores full geometry via `useWindowState()` (no label = main window). The most feature-complete layout, wrapping the entire `AppShell`.
- **SettingsLayout.tsx** — route shell for the settings window. Restores geometry, listens for section deep-link events, handles resource invalidation.
- **StatisticsLayout.tsx** — route shell for the statistics window. Restores geometry, listens for refresh events.
- **index.ts** — barrel re-export of all layouts.

## Flow

1. A window is opened (by `openSettingsWindow`, `openDialogHostWindow`, etc.) → Tauri creates the window → React mounts the corresponding layout.
2. Layout restores saved geometry (position, size) from store via `useWindowState`.
3. Layout listens for navigate events from Tauri — when another part of the app sends a navigate event to this window, the layout routes it.
4. Layout listens for `resource-invalidated` events — when data changes in another window, this layout refreshes relevant queries.
5. Layout listens for session loss — when the server disconnects, the window closes itself.
6. For dialogs: on dismiss, the window hides (not closes) and schedules idle-close after a timeout.

## Integration

- `hooks/useWindowState` — restores and persists window geometry.
- `@tauri-apps/api/window` — `getCurrentWebview()`, window event listeners.
- `contexts` — `useQBClient` for session state (triggers close on session loss).
- `windows/dialogs/registry` — `DESKTOP_DIALOGS` used by `DialogWindowLayout` to map dialog kinds to Screen components.
- `windows/dialogs/dialogHostWindow` — `dismissDialogWindow` called on dialog dismiss.
