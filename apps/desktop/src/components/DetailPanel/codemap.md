# apps/desktop/src/components/DetailPanel/

## Responsibility

The properties/detail panel that appears below the torrent table when a torrent is selected. Displays tabbed detail views (General, Trackers, Peers, HTTP Sources, Content) for the selected torrent with resize support and desktop-specific dialog integration.

## Design

- **Shell store ownership**: Panel height, active tab, and visibility are managed by `useShellStore`. The panel reads `panelTorrentHash` from `useTorrentSelectionStore` to know which torrent to display.
- **Tab-based data fetching**: Each tab uses a dedicated hook (`useTorrentProperties`, `useTorrentTrackers`, etc.) with `enabled` tied to the active tab — data is only fetched when the tab is visible.
- **Window-based dialogs**: Rename, relocate, speed limit, and delete actions open separate Tauri windows via `openTorrentTextDialogWindow`, `openTorrentNumericDialogWindow`, `openTorrentDeleteDialogWindow` instead of inline modals.
- **Peers tab coordinator**: `PeersTabCoordinator` subscribes to maindata changes and triggers peer refetch only when the Peers tab is active, avoiding unnecessary API calls.
- **Resizable**: Top-edge drag handle allows vertical resize with clamped min/max heights (150–800px).

## Flow

1. User clicks a torrent row → `HomeScreen` sets `panelTorrentHash` and `propertiesPaneVisible`.
2. `DetailPanel` reads the hash, subscribes to live torrent data via `useLiveTorrentByHash`.
3. Tab bar controls which data hook is enabled; data loads on-demand.
4. Action handlers (rename, delete, etc.) open dedicated dialog windows.
5. Close button or blank-space click clears selection and hides the panel.

## Integration

- Reads from `useShellStore` (height, tab, visibility) and `useTorrentSelectionStore` (panelTorrentHash).
- Uses `useTorrentActions` for desktop-specific action mapping.
- Uses `useTorrentDetailController` from `@taurent/web-core/screens` for shared controller logic.
- Renders shared section components from `@taurent/web-ui` (Overview, Trackers, Peers, HTTP Sources).
- Renders `DesktopTorrentDetailsFilesSection` for the Content tab (desktop-specific file context menu).
- Opens dialog windows via `../windows/dialogs/` helpers.
