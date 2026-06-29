# packages/web-ui/src/screens/HomeScreen/

## Responsibility

Provides the platform-agnostic presentational body for the main torrent list screen. Renders the torrent list with search, sort, filter summary, multi-select with batch actions, loading skeletons, empty states, and a floating action button (FAB) for adding torrents. Pure UI: all data, selection state, and action handlers arrive via props.

## Design

- **`HomeScreenBody`** — top-level `React.memo` component (`HomeScreenProps`). ~910 lines.
- **`TorrentItem`** — exported memo component; renders a torrent card with name, status badge, progress bar, stats (ETA, DL/UL speed, ratio, leechers/seeds, downloaded/size), category/tag pills. Handles touch long-press (400ms delay via ref-based timer) and right-click context menu for selection mode entry. Also used standalone by `TorrentDetailScreen` for mobile headers.
- **Sub-components**: `IconButton`, `StatItem`, `SortMenu` (dropdown with sort field options), `SearchBar` (primitives/SearchBar wrapper), `FilterSummaryBar`, `EmptyState`, `SelectionBar`, `HomeScreenFab`, `TorrentItemSkeleton`.
- **Selection mode** — long-press or right-click enters selection mode; `SelectionBar` shows at bottom with primary (Resume/Pause/Delete) and secondary (Recheck/Announce/etc.) batch actions via `TorrentActionsBar`.
- **FAB** — expandable menu with "Torrent File" and "Magnet Link" options; hidden when selection bar is active.
- **`DEFAULT_SORT`** — exported constant: `{ field: 'added_on', order: 'desc' }`.
- **Types module** — `SortOption`, `FilterSummaryItem`, `BatchActionDescriptor`, `SpeedLimitModalState`, `HomeScreenProps`, `TorrentItemProps`, `StatItemProps`, `SortMenuProps`, `HomeScreenFabProps`.

## Flow

1. Controller provides `torrents` list, filter/sort state, selection state, server info.
2. User searches → `SearchBar` → `onSearchInputChange(value)` → controller filters.
3. User sorts → `SortMenu` → `onSortChange(field, order)` → controller reorders.
4. User taps torrent → `onOpenTorrentDetails(hash)` (or toggles selection if in selection mode).
5. Long-press/right-click → `onTorrentLongPress(hash)` → enters selection mode.
6. Selection actions → `primaryBatchActions` / `secondaryBatchActions` descriptors → controller fires mutations.
7. FAB → `onAddTorrent('file' | 'magnet')` → platform file picker or magnet input.
8. Modals (speed limit, delete, category, tags) driven by controller state flags.

## Integration

- **`@taurent/shared`** — `cn`, `formatBytes`, `formatEta`, `formatProgress`, `formatSpeed`, `Icon`, `parseTorrentTags`, `StatusBadge`, `toStatusBadgeStatus`, `SortField`, `AppIconName`, `Torrent`.
- **Local shared components** — `Pill`, `StateCard`, `ActionButton`, `ActionChip`, `TorrentActionsBar`, `NumberInputModal`, `DeleteTorrentDialog`, `CategorySelectionDialog`, `TagSelectionDialog`, `IconButton`, `SearchBar`.
- **Torrent status utils** — `getTorrentDisplayStatus`, `getStatusColorClass` from `@taurent/shared/utils/torrentStatus`.
- **Controller layer** — all batch action descriptors, dialog state, selection management, and navigation callbacks are injected.
- **Exported from `index.ts`**: `HomeScreenBody`, `TorrentItem`, and all types.
