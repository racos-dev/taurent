# hooks

## Responsibility

Core shared React Query hooks for data fetching, mutations, and lightweight derived state. These hooks are bridge-agnostic and are consumed by screen controllers/models, feature controllers, and app-shell factories that supply the actual API calls. Some hooks read from accumulated maindata sync state (`MaindataStateScope`) rather than making separate HTTP requests.

## Key Files

- `index.ts` — Barrel export of all hooks and factories
- **Query hooks**: `useCategories.ts`, `useTags.ts`, `usePreferences.ts`, `useTorrentList.ts`, `useTorrentProperties.ts`, `useTorrentTrackers.ts`, `useTorrentFiles.ts`
- **Mutation hooks**: `useTorrentMutations.ts` (pause, resume, delete, recheck, reannounce, forceStart, setCategory, addTags, removeTags, addTrackers), `useCategoryMutations.ts`, `useTagMutations.ts`, `usePreferencesMutations.ts`, `useRssMutations.ts`
- **Notification hooks**: `useOperationNotifications.ts` (subscribes to bridge `OperationFailedEvent` and routes failures to a configurable notify callback)
- **Transfer and session hooks**: `useTransfer.ts` (transfer info, speed limits, ban peers), `useShutdown.ts`
- **Filter hooks**: `useFiltersFormState.ts` (shared filter form state for category/tag add/delete), `useFilterSummary.ts` (active filter summary derivation)
- **Maindata-derived hooks**: `useTorrents.ts` (reads from accumulated maindata sync state with client-side filter/sort), `useTrackerEntries.ts` (tracker rows from maindata), `useServerStatistics.ts` (server statistics from server_state)
- **Factory hooks**:
  - `createPlatformHooks.ts` — Creates categories, tags, preferences, and settings hooks from a single BridgeAdapter + scopeProvider
  - `createTorrentsHook.ts` — Creates `useTorrents` hook reading from maindata sync state via `MaindataStateScope`
  - `createTorrentDetailHooks.ts` — Creates `useTorrentProperties`/Trackers/Files/Peers/WebSeeds wired to BridgeAdapter with RID-based incremental peer sync and adaptive polling intervals
  - `createTrackerEntriesHook.ts` — Factory for tracker entries from maindata
  - `createServerStatisticsHook.ts` — Factory for server statistics from maindata server_state
  - Hydrated variants for preferences, categories, and tags that wait until session state is ready

## Design Patterns

- **Injected functions**: Hooks receive `queryFn`/`mutationFn` parameters instead of importing transport directly
- **Scope-based keys**: Query keys include `serverId` + `sessionGeneration` for cache isolation and reconnect-safe invalidation
- **Hydrated variants**: Some hooks expose `*Hydrated` guards so screens wait until session state is ready
- **Automatic invalidation**: Mutations invalidate the relevant scoped queries on success
- **Factory pattern**: Factory functions accept a BridgeAdapter and scopeProvider and return typed hook objects
- **Layer boundary**: Screen controllers/models compose these hooks into feature-specific view models; hooks stay small and reusable
- **Operation failure reporting**: `operationFailureReporter.ts` provides a pub/sub channel for background failures; `useOperationNotifications` subscribes and routes to toast/native notifications

## Flow

1. App shell calls `createPlatformHooks({ bridge, scopeProvider })` to produce zero-argument hooks
2. Screen controllers call individual hooks (e.g., `useCategories()`, `useTorrents()`) with scope from `useQBClient()`
3. Mutations call injected `mutationFn`, then invalidate relevant query keys on success
4. `useOperationNotifications` subscribes to both bridge events and `operationFailureReporter` for unified error routing

## Integration

- Imported by higher-level modules (`screens/`, `torrents/`, `rss/`, `search/`, `sync/`)
- Used directly by desktop/mobile apps via platform wrappers and screen controllers
- Depends on `query/keys` and `query/invalidation`
- Exports factory types: CategoriesAdapters, TagsAdapters, PlatformHooksBridge, CreatePlatformHooksOptions, UseTorrentsOptions, TorrentDetailBridge, etc.
