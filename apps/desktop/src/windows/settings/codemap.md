# apps/desktop/src/windows/settings/

## Responsibility

Manages the singleton settings window — its lifecycle, geometry, deep-link support, and cross-window resource invalidation. Serves as the bridge between the settings UI (rendered in a separate Tauri window) and the rest of the application.

## Design

- **Singleton window**: Only one settings window exists at a time. `openSettingsWindow` reuses the existing window if already open, focusing it and optionally navigating to a specific section.
- **Deep-link support**: `openSettingsWindow(section?)` accepts an optional section parameter (e.g., `Connection`, `Downloads`, `Speed`) and navigates the settings window to that section via a Tauri event.
- **Cross-window sync**: When preferences are changed in the settings window, `emitResourceInvalidated` notifies other windows (main, auxiliary) to refresh their cached data.
- **Scroll-to-section bridge**: The settings window listens for Tauri events to scroll to a specific section, enabling programmatic navigation from other windows (e.g., "Open Connection Settings" from the connection error overlay).
- **Non-resizable**: The window is fixed at 1000×700, preventing layout issues with the settings form.

## Files

- **settingsWindow.ts** — singleton settings window manager. `openSettingsWindow(section?)` creates (or focuses) a 1000×700 non-resizable window. If a section is provided, emits a Tauri event to the settings window to scroll to that section. Calls `emitResourceInvalidated` on relevant preference changes for cross-window sync.
- **index.ts** — barrel re-export of `openSettingsWindow`.

## Flow

1. User clicks "Settings" from MenuBar, StatusBar, or connection error overlay → `openSettingsWindow()` or `openSettingsWindow(section)` is called.
2. If the settings window doesn't exist, a new Tauri window is created at 1000×700, non-resizable.
3. If it already exists, the window is focused and brought to front.
4. If a section was specified, a Tauri event is emitted to the settings window to scroll/navigate to that section.
5. The settings window renders `SettingsLayout` which routes to the settings screen component.
6. When preferences are modified, `emitResourceInvalidated` fires to notify other windows.
7. When the window is closed (by user or session loss), the singleton reference is cleared.

## Integration

- `@tauri-apps/api/window` — `WebviewWindow` for window lifecycle, `emitTo` for cross-window events.
- `@tauri-apps/api/event` — `emitResourceInvalidated` for cross-window cache invalidation.
- `src/windows/layout/SettingsLayout` — the layout component rendered inside the settings window.
- `src/components/Settings` — the settings form component rendered within `SettingsLayout`.
- Used by: `hooks/shell/useDesktopCommands` (`openSettings` calls `openSettingsWindow`), `ConnectedServerUnavailableOverlay`, any UI that offers "Open Settings" actions.
