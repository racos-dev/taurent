# packages/shared/src/stores/

## Responsibility

Shared, platform-agnostic Zustand stores exposing typed state and imperative action functions. Stores in this package intentionally avoid UI-only selection concerns — selection/stateful UI interactions live in platform-specific stores (e.g., desktop `torrentSelectionStore`).

Current stores:
- `torrentStore.ts` — canonical torrent domain state.
- `uiStore.ts` — UI state primitives shared across platforms.

## Key Files

- `torrentStore.ts` — `useTorrentStore` (Zustand hook):
  - **State**: `torrents: Torrent[]`, `categories: Category[]`, `tags: string[]`, `isLoading: boolean`, `error: Error | null`, `lastUpdated: number | null`, `filters: TorrentFilters`, `sortField: SortField`, `sortDirection: SortDirection`.
  - **Data actions**: `setTorrents`, `setCategories`, `setTags`, `setLoading`, `setError`, `setLastUpdated`, `refetch`.
  - **Filter actions**: `setStatusFilter`, `setCategoryFilter`, `setTagFilter`, `setTrackerFilter`, `setSearchFilter`, `clearFilters`.
  - **Sorting actions**: `setSortField`, `setSortDirection`, `toggleSortDirection`.
  - **Getter**: `getSortedTorrents()` — calls `deriveFilteredAndSortedTorrents` with current state, mapping `FilterStatus` to `TorrentFilterType` via `FILTER_STATUS_TO_FILTER_TYPE`.

- `uiStore.ts` — `useUIStore` (Zustand hook):
  - **State**: `sidebar: { isOpen, activeSection }`, `modals: ModalState` (addTorrent, settings, filters, serverManager, keyboardShortcuts, about), `searchQuery`, `isSearchFocused`, `statusMessage`.
  - **Sidebar actions**: `setSidebarOpen`, `toggleSidebar`, `setSidebarSection`.
  - **Modal actions**: `openModal`, `closeModal`, `toggleModal`, `closeAllModals`.
  - **Search actions**: `setSearchQuery`, `clearSearch`, `setSearchFocused`.
  - **Status actions**: `setStatusMessage`, `clearStatusMessage`.
  - **Derived**: `isAnyModalOpen()` — uses `get()` to synchronously check if any modal boolean is true.

- `index.ts` — Barrel export of hooks and types.

## Design

- **Zustand factory**: Both stores created via `create<T>((set, get) => ({ ...initialState, actions }))`.
- **Type-first API**: Each store defines a TypeScript interface including state fields and action signatures.
- **Action-based mutations**: All state changes performed via explicit action functions using immutable updates (object spread).
- **Temporal invalidation**: `torrentStore` exposes `lastUpdated` + `refetch()` — `refetch()` sets `lastUpdated = Date.now()` to trigger consumer-side network syncs.
- **No built-in selectors**: Filtering/sorting is handled by `getSortedTorrents()` (torrentStore) or composed by consumers.

## Flow

1. **Data ingestion**: `setTorrents(torrents)` replaces the torrents array and auto-updates `lastUpdated`.
2. **Filter control**: `setStatusFilter('downloading')` immutably updates `filters.status`.
3. **Sorted retrieval**: `getSortedTorrents()` applies `deriveFilteredAndSortedTorrents` with current filters and sort state.
4. **Refetch trigger**: `refetch()` sets `lastUpdated = Date.now()` — consumers observe this value to trigger API calls.

## Integration

- Consumers import hooks from `packages/shared/src/stores/index.ts`.
- `torrentStore` imports domain types from `../types/qbittorrent` and derivation functions from `../utils/deriveTorrentList` and `../utils/torrentFilter`.
- Platform boundaries: No platform-specific side-effects (Tauri, native bridges) inside these stores.
