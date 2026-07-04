# packages/web-ui/src/screens/SearchScreen/

## Responsibility

Provides the platform-agnostic presentational body for the qBittorrent search plugin screen. Manages search query input, search execution/stop, plugin management (list, enable/disable, install, uninstall, update), and result display. Pure UI: all state and mutations are externally provided via props.

## Design

- **`SearchScreenBody`** — top-level `React.memo` component (`SearchScreenProps`). Handles capability gating (loading → unsupported → offline → ready), local query state synced with prop, and three visual zones: search input, plugin management (collapsible), and results list.
- **Sub-components**: `SearchResultRow` (memo, displays file name, size, seeders/leechers, site link, "Add" button), `SortControl` (memo, `Select` for sort field + button to toggle direction), and `PluginCard` (memo, toggles enable/disable, uninstall).
- **Normalized types** — `NormalizedSearchPlugin` and `NormalizedSearchResult` decouple from raw qBittorrent API shapes; normalization happens upstream. `SearchSortKey`/`SearchSortDirection` mirror the web-core ordering unions.
- **Result sorting** — optional `sortKey`/`sortDirection` + `onSortKeyChange`/`onSortDirectionChange` props render the `SortControl` above the results; when any is omitted the control is hidden (backward compatible).
- **Variant prop** — `variant?: 'desktop' | 'mobile'` adjusts spacing and layout (`isCompact` flag).
- **Capability gating** — early returns render `StateSurface` for loading/unsupported/offline states before the main UI.

## Flow

1. Controller checks search capability → passes `isSupported`, `isUnsupported`, `isCapabilityLoading`.
2. User types query → local `localQuery` state → synced back to `onQueryChange` on submit.
3. User submits → `onStartSearch(trimmed)` fires; search results stream in via `searchResults` prop.
4. User stops → `onStopSearch` callback.
5. Plugin management: toggle expand → loads `plugins` list → enable/disable fires `onEnablePlugin(name, enable)`, uninstall opens `ConfirmDialog` then fires `onUninstallPlugin(name)`, install opens `PluginInstallDialog` → `onInstallPlugin(sourceUrl)`, update all → `onUpdatePlugins()`.
6. Result "Add" → `onAddResult(result)` callback (optional, e.g. send to downloads).

## Integration

- **`@taurent/shared`** — `cn`, `formatBytes`, `Icon`.
- **Local shared components** — `StateSurface`, `SkeletonBlock`, `ConfirmDialog`, `PluginInstallDialog`, `Input`, `Select`.
- **Controller layer** — all mutation states (`isPluginActionPending`, `isSearching`, `isLoadingResults`, `isLoadingPlugins`) and action handlers come from the platform controller hook.
- **Exported from `index.ts`**: `SearchScreenBody`, `SearchScreenProps`, `NormalizedSearchPlugin`, `NormalizedSearchResult`, `SearchSortKey`, `SearchSortDirection`.
