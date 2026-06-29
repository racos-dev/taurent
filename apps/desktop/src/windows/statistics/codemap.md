# apps/desktop/src/windows/statistics/

## Responsibility

Manages the singleton statistics window — a compact non-resizable window that displays qBittorrent transfer statistics (session totals, all-time data). Follows the same singleton window pattern as the settings window.

## Design

- **Singleton window**: Only one statistics window exists at a time. `openStatisticsWindow()` reuses the existing window if already open, focusing it.
- **Compact dimensions**: Fixed at 480×520, non-resizable — intentionally small and focused on a single data display.
- **Auto-refresh**: The statistics data is fetched from the backend on window open and may auto-refresh. The window layout listens for refresh events.
- **Session-loss close**: Closes automatically when the server connection is lost.

## Files

- **statisticsWindow.ts** — singleton statistics window manager. `openStatisticsWindow()` creates (or focuses) a 480×520 non-resizable window. No deep-link or cross-window sync needed since statistics are read-only.
- **index.ts** — barrel re-export of `openStatisticsWindow`.

## Flow

1. User clicks "Statistics" from MenuBar (Tools menu) or keyboard shortcut → `openStatisticsWindow()` is called.
2. If the statistics window doesn't exist, a new Tauri window is created at 480×520, non-resizable, with the statistics route.
3. If it already exists, the window is focused and brought to front.
4. `StatisticsLayout` mounts inside the window, restores any saved geometry, and renders the statistics screen.
5. The statistics screen fetches transfer data from the backend and renders it.
6. When the window is closed (by user or session loss), the singleton reference is cleared.

## Integration

- `@tauri-apps/api/window` — `WebviewWindow` for window lifecycle.
- `src/windows/layout/StatisticsLayout` — the layout component rendered inside the statistics window.
- `src/screens` — the statistics screen component rendered within `StatisticsLayout`.
- Used by: `hooks/shell/useDesktopCommands` (`openStatistics` calls `openStatisticsWindow`), `MenuBar` Tools menu.
