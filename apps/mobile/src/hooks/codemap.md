# apps/mobile/src/hooks/

## Responsibility

React hooks used by the mobile UI. These are thin platform-specific adapters that:

- Call the Tauri `BridgeAdapter` for I/O operations.
- Integrate with TanStack Query via web-core hook factories.
- Compose client connection context (`useQBClient`) into `QueryScope` for cache scoping.
- Manage local UI state (selection, filter, sort preferences).

## Key Files

- **index.ts** — Barrel re-export of all public hooks. Also instantiates `useTorrents`, `useMobileHomeController`, and `useAddTorrent` by calling web-core factories with mobile-specific bridge/scope wiring.
- **platform.ts** — Single factory call: `createPlatformHooks({ bridge: BridgeAdapter, scopeProvider: useQBClient })`. Exports all categories, tags, and settings hooks as named re-exports.
- **useCategories.ts** — Re-exports category hooks (`useCategories`, `useCreateCategory`, `useEditCategory`, `useRemoveCategories`, `useSetTorrentCategory`) from `platform.ts`.
- **useTags.ts** — Re-exports tag hooks (`useTags`, `useCreateTags`, `useDeleteTags`, `useAddTorrentTags`, `useRemoveTorrentTags`) from `platform.ts`.
- **useSettings.ts** — Re-exports preference/limit hooks (`usePreferences`, `useUpdatePreference`, `useSetPreferences`, `useSetGlobalDownloadLimit`, `useSetGlobalUploadLimit`, `useToggleSpeedLimitsMode`) from `platform.ts`. Also re-exports the `Preferences` type.
- **useTorrentDetails.ts** — Instantiates `createTorrentDetailHooks({ bridge: BridgeAdapter, scopeProvider: useQBClient })` from web-core. Exports `useTorrentProperties`, `useTorrentTrackers`, `useTorrentFiles`, `useTorrentPeers`, and `PeerRow` type.
- **useTorrentActions.ts** — Wraps `useTorrentActionController` from `@taurent/web-core/torrents` with mobile-specific adapter wiring via `createTorrentActionsAdapters(BridgeAdapter)`. Returns mutation objects for pause, resume, delete, recheck, reannounce, forceStart, speed limits, file priority, category, tags, rename, relocate, and priority operations. Includes mobile-friendly aliases (`delete` → `remove`, `forceStart` → `setForceStart`).
- **useTrackerEntries.ts** — Instantiates `createTrackerEntriesHook(useMaindataState)` from web-core.
- **useFilterState.ts** — URL-synced filter state. Reads `selectedFilter`, `selectedCategory`, `selectedTag`, `selectedTracker` from `useSearchParams()` and provides setter/clear/query-string helpers.
- **useSelection.ts** — Set-based multi-select state. Manages `selectedItems` (Set<string>), `selectionMode` toggle, and helpers (`toggleSelection`, `startSelection`, `clearSelection`, `toggleAllSelection`, `isSelected`, `isAllSelected`).
- **useSortPreference.ts** — Persisted sort field/order using the mobile `PlatformStorage` from `../platform`. Loads on mount, persists on change. Validates against `VALID_SORT_FIELDS`.
- **useSearchScreen.ts** — Mobile search screen model hook. Wires `useQBClient` + `BridgeAdapter.qBClient` into `createSearchAdapters` + `useSearchScreenModel`. Handles `onAddResult` navigation callback internally. Screens import this instead of `BridgeAdapter`.
- **useRssScreen.ts** — Mobile RSS screen model hook. Wires `useQBClient` + `BridgeAdapter.qBClient` into `createRssAdapterFns` + `useRssScreenModel`. Screens import this instead of `BridgeAdapter`.
- **useTorrentDetailMutations.ts** — Mobile torrent detail mutations hook. Wires `useQBClient` + `BridgeAdapter.torrents.addTrackers` + `BridgeAdapter.transfer.banPeers` into `useAddTrackers` and `useBanPeersWithPeerInvalidation`. Exposes `{ addTrackerMutation, banPeersMutation }` for `TorrentDetailScreen` so the screen doesn't import `BridgeAdapter`.
- **useRemoteShutdown.ts** — Mobile remote shutdown mutation hook. Wires `useQBClient` + `BridgeAdapter.application.shutdown()` into `useRemoteShutdown`. SettingsScreen imports this instead of `BridgeAdapter`.

## Design Patterns

- **Platform Factory**: `platform.ts` is the single call site for `createPlatformHooks`; categories, tags, and settings hooks flow through it. This avoids repeating bridge/scope wiring.
- **Delegation to web-core**: `useTorrents`, `useTorrentDetails`, `useTrackerEntries` are pure instantiations of web-core factories. All business logic lives in `@taurent/web-core`.
- **Local adapter**: `useTorrentActions` wraps web-core's `useTorrentActionController` with mobile-specific adapter wiring; it provides mobile-friendly action names.
- **React Query composition**: Read hooks delegate to web-core; write operations either reuse web-core mutations or create local `useMutation` with `onSuccess` invalidation.
- **QueryScope pattern**: Hooks derive `{ serverId, sessionGeneration, isConnected }` from `useQBClient()` for cache scoping.

## Flow

1. `platform.ts` calls `createPlatformHooks` once with `BridgeAdapter` and `useQBClient`, producing all categories/tags/settings hooks.
2. `useCategories.ts`, `useTags.ts`, `useSettings.ts` re-export from `platform.ts` — pure barrel modules.
3. `useTorrentDetails.ts` calls `createTorrentDetailHooks` with bridge and scope provider.
4. `useTorrentActions.ts` creates adapter objects via `createTorrentActionsAdapters(BridgeAdapter)`, then feeds them to `useTorrentActionController` with the current QueryScope.
5. `useFilterState.ts` reads URL search params and manages filter state locally; `useSelection.ts` manages Set-based selection; `useSortPreference.ts` persists sort config via `PlatformStorage`.
6. `index.ts` instantiates `useTorrents`, `useMobileHomeController`, and `useAddTorrent` and re-exports everything.

## Integration

- **@taurent/bridge/adapters/mobile-tauri** — `BridgeAdapter` for all Tauri command invocations.
- **@taurent/web-core/hooks** — `createPlatformHooks`, `createTorrentDetailHooks`, `createTrackerEntriesHook`, `createServerStatisticsHook`, `useFiltersFormState`, `useFilterSummary`.
- **@taurent/web-core/torrents** — `useTorrentActionController`, `createTorrentActionsAdapters`, `createAddTorrentHook`, `createTorrentsHook`.
- **@taurent/web-core/screens** — `createMobileHomeController`.
- **../connection/QBClientProvider** — `useQBClient`, `useMaindataState` for QueryScope derivation.
- **../platform** — `storage` (PlatformStorage) for `useSortPreference` persistence.
- **../screens** — `useSearchScreen`, `useRssScreen`, `useTorrentDetailMutations`, `useRemoteShutdownMutation` — consumed by mobile route screens.
- **@taurent/shared** — Types (`SortField`, `SortOrder`, `TorrentFilterType`), predicates (`isTorrentFilterType`).
