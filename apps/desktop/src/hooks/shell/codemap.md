# apps/desktop/src/hooks/shell/

## Responsibility

Orchestrates app-level shell behavior: desktop commands (window launching, app exit), global keyboard shortcuts, native menu synchronization, shell state persistence, and torrent file open handling. These hooks bridge the Rust backend's window/menu/shortcut events to the React renderer.

## Design

- **Command pattern**: `useDesktopCommands` exposes functions that launch auxiliary windows (`openAddTorrentWindow`, `openSettingsWindow`) or invoke bridge methods (`exitApp`).
- **Keyboard-to-command mapping**: `useKeyboardShortcuts` maps global `keydown` events to `TransferCommand` actions via `useTransferCommandList`.
- **Native menu bridge**: `useNativeMenuSync` listens to Rust-emitted menu events (e.g., `menu:settings`, `menu:action`, `menu:view`, `menu:tray-action`) and dispatches to handlers; it also runs a debounced sync of `NativeMenuState` back to Rust via `BridgeAdapter.syncMenuState()`.
- **Store-backed persistence**: `useShellPersistence` loads shellStore state from Tauri Store on mount and subscribes to changes for write-back.
- **Torrent file drain**: `useTorrentFileOpen` drains any pending torrent file paths queued by Rust on mount, then subscribes to live events.

## Files

- **useDesktopCommands.ts** — app-level action functions: `addTorrent` (via `openAddTorrentWindow`), `openSettings` (via `openSettingsWindow`), `openStatistics` (via `openStatisticsWindow`), `exitApp` (via `BridgeAdapter.exitApp`), and navigation helpers for Search/RSS routes.
- **useKeyboardShortcuts.ts** — global `keydown` listener mapping shortcuts to transfer commands: `Ctrl+Q` (exit), `Ctrl+O` (add torrent), `Ctrl+F` (search), `Ctrl+Enter`/`Ctrl+A`/`Ctrl+D` (select all/deselect), `Delete` (remove), `Alt+ArrowUp`/`Alt+ArrowDown` (queue reorder).
- **useNativeMenuSync.ts** — bridges native Rust menu events to renderer handlers. Listens for `menu:settings`, `menu:action`, `menu:view`, `menu:tray-action` events. Maintains `NativeMenuState` (which items are enabled/disabled) and syncs to Rust via `BridgeAdapter.syncMenuState()` with debouncing. Drains pending menu actions queued before the hook mounts.
- **useShellPersistence.ts** — Tauri Store persistence for `shellStore` state: sidebar width/visibility, properties pane state, column configuration. Loads on mount, subscribes to changes, writes back on mutation.
- **useTorrentFileOpen.ts** — drains pending torrent files from Rust on mount via bridge, listens for live `torrent-file-open` events, and opens the add-torrent window with the file path as payload.

## Flow

1. `useDesktopCommands` is called at the app shell level, providing stable command functions to menus, shortcuts, and context menus.
2. `useKeyboardShortcuts` registers a single `keydown` listener on `window`, maps key combos to commands from `useTransferCommandList`, and ignores events when modals/dialogs have focus.
3. `useNativeMenuSync` mounts once, drains any pending menu actions queued by Rust before React was ready, then subscribes to live events. Menu state syncs are debounced (typically 100ms) to batch rapid state changes.
4. `useShellPersistence` loads on mount, subscribes to shellStore changes via Zustand `subscribe`, and writes to Tauri Store on each change.
5. `useTorrentFileOpen` drains initial pending files synchronously on mount, then sets up a long-lived event listener.

## Integration

- `@taurent/bridge/adapters/desktop` — `BridgeAdapter` for `exitApp`, `syncMenuState`, pending torrent file drain.
- `@tauri-apps/plugin-store` — persistent key-value storage for shell state.
- `src/windows/dialogs/addTorrentWindow` — `openAddTorrentWindow` called by both desktop commands and torrent file open.
- `src/windows/settings/settingsWindow` — `openSettingsWindow` for settings command.
- `src/windows/statistics/statisticsWindow` — `openStatisticsWindow` for statistics command.
- `../torrents/useTransferCommandList` — provides `TransferCommand[]` for keyboard shortcut mapping.
