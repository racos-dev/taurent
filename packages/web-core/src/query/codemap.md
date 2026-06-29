# query

## Responsibility

Core React Query infrastructure: query key factories, query scope definitions, invalidation helpers, optimistic updates, and QueryClient configuration. Ensures consistent caching behavior across all hooks. `sync-maindata` is the primary data source for torrents, categories, and tags.

## Key Files

- `index.ts` — Barrel export
- `keys.ts` — Query key factories for all resources; exports `RESOURCE` constants and `TorrentListKeyParams`
- `scope.ts` — `QueryScope` interface (serverId, sessionGeneration, isConnected) and `HydratedQueryScope`; `DEFAULT_STALE_TIME` = 60s
- `invalidation.ts` — Invalidation helper functions for each resource type; mutations trigger sync-maindata refetch to avoid waiting for next poll interval
- `optimistic-updates.ts` — Optimistic update helpers for preferences, torrents, and transfer info
- `query-client.ts` — QueryClient configuration with error logging, retry strategy, and stale/gc times; integrates with `protectedRequestHealth` for connected-server outage detection

## Design Patterns

- **Scope-based keys**: All keys include serverId + sessionGeneration for proper isolation
- **Hierarchical invalidation**: Can invalidate broad categories (all torrents) or specific items (single torrent properties/peers/files)
- **Detail keys**: Torrent properties, trackers, files, peers use hash as detail identifier
- **sync-maindata as primary source**: Torrent list, categories, and tags are read from accumulated maindata state; mutations trigger immediate sync refetch
- **DEFAULT_STALE_TIME**: 60 seconds for categories/tags/preferences
- **Optimistic updates**: Preferences use `createPreferencesOptimisticUpdate` for instant UI feedback; torrents use `createTorrentOptimisticUpdate`
- **Query client integration**: `createQueryClient()` wires `QueryCache.onError` to `reportProtectedFailure` and `onSuccess` to `reportProtectedSuccess`

## Flow

1. Hooks call key factories (e.g., `categoriesKey(scope)`) to build scoped query keys
2. Mutations call invalidation helpers (e.g., `invalidateCategories(queryClient, scope)`) on success
3. Invalidation helpers invalidate both the resource-specific key AND the sync-maindata key for immediate re-poll
4. `resourceInvalidation.ts` (session/) translates `resource-invalidated` events into targeted invalidations
5. QueryClient configures retry (3 queries, 1 mutation), staleTime (30s default), gcTime (5min)

## Integration

- Imported by all hooks in `hooks/` directory
- Used by `session/resourceInvalidation.ts` for event-driven invalidation
- Depends on `@tanstack/react-query` for query management
- `query-client.ts` integrates with `sync/protectedRequestHealth` for outage detection
