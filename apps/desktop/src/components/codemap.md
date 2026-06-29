# apps/desktop/src/components/

## Responsibility

Reusable UI components for the desktop application. Provides torrent table, detail panel, context menus, toolbar, and base input components. This directory contains both specific desktop components and generic UI building blocks.

## Key Files

- **TorrentTable/** — Main torrent list table with virtualization, sorting, column management, and header context menu (`HeaderContextMenu.tsx`) using `useContextMenu` / `ContextMenuPanel` from `@taurent/web-ui`.
- **TorrentDetail/** — Desktop torrent detail overrides (files section with native file context menus)
- **DetailPanel/** — Properties panel showing selected torrent details (general, trackers, peers, files). Uses shared `useTorrentDetailController` from `@taurent/web-core/screens` and opens window-based dialogs for rename/relocate/speed-limit/delete.
- **ContextMenu/** — Reusable context menu primitives (ContextMenu, ContextMenuItem, ContextMenuGroup)
- **TorrentContextMenu.tsx** — Right-click menu for torrent actions. Uses `useTransferCommandList` for command state, `ContextMenu` from `@taurent/web-ui`, and opens window-based dialogs for rename/set-location/speed-limit/share-limits/category/tag operations.
- **Toolbar/MainToolbar.tsx** — Top toolbar with search input (using `Input` from `@taurent/web-ui`), torrent action buttons (add, delete, resume, pause, force start, queue operations), sidebar toggle, settings button, and view navigation tabs (Transfers, Search, RSS).
- **Toolbar/ToolbarButton.tsx** — Individual toolbar button with `Tooltip` from `@taurent/web-ui`, icon rendering via `getColor` from `@taurent/shared/theme/helpers`, and `ICON_SIZES.md` for consistent icon sizing.
- **DragDropOverlay.tsx** — Overlay for drag-and-drop torrent file import
- **RootErrorBoundary.tsx** — Top-level React error boundary
- **SettingsCloseOverlay/** — Unsaved-changes close confirmation overlay using `AlertCircle` and `ICON_SIZES` from `@taurent/shared`, `DialogActions` from `@taurent/web-ui`.
- **OverlayPrompt/** — Reusable blocking overlay modal with ARIA support
- **Settings/** — Desktop-specific settings forms and navigation config
- **index.ts** — Re-exports

## Design Patterns

- **Virtualization**: TorrentTable uses @tanstack/react-virtual for large lists (>20 items)
- **Column Registry**: All columns defined in stores/columnRegistry.ts; table component reads from registry
- **Resizable Columns**: Header cells support drag-to-resize via mouse events
- **Selection Model**: Uses hash-based selection (not index-based) for stability during sorting/refetch
- **Tab Panel**: DetailPanel uses tabs for different content sections
- **Context Menu Positioning**: Uses useLayoutEffect to keep menus within viewport bounds
- **Window-based Dialogs**: Rename, relocate, speed limit, and delete actions open separate Tauri windows instead of inline modals.

## Integration

- Imports types from `@taurent/shared` (Torrent, Category, etc.)
- Uses hooks from `../hooks/` (useTransferCommandList, useTorrentActions)
- Uses stores from `@taurent/shared/stores` and `@taurent/bridge/adapters/desktop`
- Uses BridgeAdapter from `@taurent/bridge/adapters/desktop` for desktop-only API calls
- Renders into `AppShell`, auxiliary layouts, and dialog-window layouts

## Subdirectories

### Settings/

Desktop-specific settings UI components. Contains navigation config, sidebar, and sections for desktop-only preferences (theme, window behavior) and server overview. See [Settings/codemap.md](./Settings/codemap.md) for details.

### SettingsCloseOverlay/

Overlay prompt displayed when closing the Settings window with unsaved changes. Provides Stay, Discard & Close, and Save & Close actions. Composes `OverlayPrompt` with `DialogActions`.

### OverlayPrompt/

Reusable blocking overlay with backdrop blur. Uses `role="alertdialog"` with ARIA labelling. Composed by `SettingsCloseOverlay` and `ConnectedServerUnavailableOverlay`.
