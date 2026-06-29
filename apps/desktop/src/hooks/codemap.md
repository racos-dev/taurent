# apps/desktop/src/hooks/

## Responsibility

Desktop hooks glue the renderer to web-core and the bridge. They are split by domain instead of a flat list:

- `platform/` — categories, tags, preference hooks, and drag-and-drop
- `settings/` — settings-facing re-exports of platform hooks/types plus desktop-local settings
- `shell/` — menu, shortcut, window-launch, native menu sync, and shell persistence orchestration
- `torrents/` — torrent mutations, details, transfer command assembly, and live selectors

Top-level hooks such as `useTrackerEntries` and `useWindowState` remain as small cross-cutting helpers.

## Public entry points

- `index.ts` is the desktop hook barrel, re-exporting from all subdirectories and top-level helpers.
- `platform/platform.ts` is the single `createPlatformHooks({ bridge, scopeProvider })` instantiation producing all category, tag, and preference hooks.
- `torrents/useTorrentActions.ts` is the main desktop mutation adapter, wrapping web-core's `useTorrentActions` with `BridgeAdapter` and renaming methods to desktop semantics.
- `torrents/useTransferCommandList.ts` builds the `TransferCommand[]` model consumed by menus, toolbars, shortcuts, and context menus.
- `shell/useDesktopCommands.ts` and `shell/useKeyboardShortcuts.ts` wire app-level actions and global keyboard shortcuts.
- `shell/useNativeMenuSync.ts` listens to native menu events from Rust, dispatches to handlers, and auto-syncs menu enabled/disabled state to the OS menu bar via `BridgeAdapter.syncMenuState()`.
- `torrents/useLiveTorrentList.ts` subscribes to the torrents map slice via `useMaindataSelector`, derives via `useMemo` to avoid full Zustand array subscriptions on unrelated maindata ticks; includes optional identity-churn probe gated by `isPerfAuditEnabled()`.
- `torrents/useLiveTorrentByHash.ts`, `torrents/useLiveTorrentsByHash.ts` — per-hash live selectors derived from the same slice.
- `shell/useShellPersistence.ts` — Tauri Store-based persistence for shellStore state (sidebar, properties pane, column config).
- `shell/useTorrentFileOpen.ts` — drains pending torrent files from Rust on mount and listens for live torrent-file-open events.
- `platform/useDragAndDrop.ts` — Tauri window drag/drop event hook using `getCurrentWebview().onDragDropEvent`.

## Design patterns

- **Factory re-exports**: platform/settings hooks mostly re-export shared factory output.
- **Scope propagation**: `useQBClient()` provides `{ serverId, sessionGeneration, isConnected }` to all query/mutation hooks.
- **Desktop-only mutation normalization**: torrent actions map shared operation names to desktop semantics (`delete` → `remove`, `rename` → `setName`, `relocate` → `setLocation`, `topPriority` → `moveToTop`, `bottomPriority` → `moveToBottom`).
- **Command composition**: `TransferCommand` stays serializable and is consumed by menus, toolbars, shortcuts, and context menus.
- **Persistence split**: window/shell state uses Tauri plugins; selection and UI state stay in local stores.

## Read order

1. `index.ts`
2. `platform/platform.ts`
3. `torrents/useTorrentActions.ts`
4. `torrents/useTransferCommandList.ts`
5. `shell/useDesktopCommands.ts`
6. `shell/useKeyboardShortcuts.ts`
7. `shell/useNativeMenuSync.ts`
8. `shell/useShellPersistence.ts`

## Integration

- `@taurent/bridge/adapters/desktop` for RPCs and `BridgeAdapter` methods (`exitApp`, `syncMenuState`).
- `@taurent/web-core` for domain factories/controllers (`createPlatformHooks`, `createTorrentDetailHooks`, `useTorrentActions`).
- `@taurent/shared/stores` for global torrent selection and shared store state.
- `src/windows/*` for auxiliary window launchers (`openAddTorrentWindow`, `openSettingsWindow`, etc.).
- `@tauri-apps/plugin-store` and `@tauri-apps/plugin-autostart` for desktop-local persistence.
