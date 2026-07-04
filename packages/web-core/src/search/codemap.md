# search

## Responsibility

Capability-gated search controller and screen model hooks. Provides the full search plugin lifecycle: executing searches, polling results, managing plugins (list, enable/disable, install, uninstall, update), and consuming typed bridge DTOs. Search payload normalization is now owned by Rust (`qb-core::dto`); this module consumes typed DTOs directly.

## Key Files

- `index.ts` — Barrel export
- `useSearchController.ts` — Main hook that manages search execution, result polling (2s interval), plugin CRUD, result ordering state, and typed bridge DTO consumption; accepts `SearchAdapters` interface
- `useSearchScreenModel.ts` — Composes `useSearchController` with the `onAddResult` callback for platform-specific add-torrent behavior; passes through result-ordering state
- `createSearchAdapters.ts` — Adapter factory that constructs `SearchAdapters` from a `QBClientBridge`; moves bridge bundle construction from app-level screens into shared web-core
- `sortSearchResults.ts` — Pure, non-mutating result ordering helper (`sortSearchResults`) plus `SearchSortKey`/`SearchSortDirection` types and defaults (seeders, descending); fully unit tested

## Design Patterns

- **Capability gating**: All operations require `isSupported === true`; `null` = unknown (not probed), `false` = not supported
- **Adapter pattern**: Accepts `SearchAdapters` with 10 injected functions (startSearch, stopSearch, getSearchStatus, getSearchResults, deleteSearch, getSearchPlugins, installSearchPlugin, uninstallSearchPlugin, enableSearchPlugin, updateSearchPlugins)
- **Adapter factory**: `createSearchAdapters` constructs `SearchAdapters` from a `QBClientBridge`, reducing route-level contract knowledge
- **Result polling**: When a search is active, polls `getSearchStatus` and `getSearchResults` every 2 seconds; stops on Idle/Stopped/Failed status
- **Error threshold**: Stops polling after 5 consecutive failures to prevent infinite error loops
- **Typed boundary consumption**: Search status/results/plugins arrive as typed bridge DTOs (`SearchStatus[]`, `SearchResults`, `SearchPlugin[]`); the controller keeps only narrow UI helpers such as status label mapping and plugin-category defaults
- **Platform-specific add result**: `onAddResult` is a required callback so desktop (aux window) and mobile (navigation) can wire their own add-torrent flow
- **Result ordering**: `sortKey`/`sortDirection` state (default seeders/descending) drives a memoized, non-mutating sort of the fetched results via `sortSearchResults`; the ordered array is what consumers read from `searchResults`

## Flow

1. User enters query and selects plugins/category
2. `startSearch()` calls adapter, receives search ID
3. Polling loop fetches status + results every 2s
4. Results are consumed from typed DTOs and accumulated in state
5. Plugin list is fetched via React Query with 30s stale time
6. Plugin actions (enable/disable/install/uninstall/update) invalidate plugin query on success

## Architecture notes

- The `SearchAdapters` surface is now fully typed for search operations: `startSearch -> Promise<{ id: number }>`, `getSearchStatus -> Promise<SearchStatus[]>`, `getSearchResults -> Promise<SearchResults>`, and `getSearchPlugins -> Promise<SearchPlugin[]>`.
- qBittorrent-origin search payload parsing now lives below the frontend boundary in Rust (`qb-core::dto`) and is returned through typed Tauri + bridge contracts. The controller no longer owns wire-shape extraction for search DTOs.
- UI compatibility work remains limited to `toStatusLabel()` for stable status labels and `withPluginCategoryDefault()` for `supportedCategories ?? []`.
- `createSearchAdapters` constructs `SearchAdapters` from a `QBClientBridge`, reducing route-level contract knowledge and moving bridge bundle construction into shared web-core.

## Integration

- Imports `QueryScope` from `query/scope`
- Imports types from `@taurent/shared`
- Used by desktop/mobile search UI; platform layer provides injected `SearchAdapters` at call site
- Gated by `capabilities/supportsSearch`
