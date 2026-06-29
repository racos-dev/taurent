# torrents

## Responsibility

Higher-level torrent action composition, add-torrent functionality, and adapter factories. Aggregates all shared torrent mutations from `hooks/useTorrentMutations` into a single capability-gated interface. Also provides factories for creating platform-specific action adapters and add-torrent hooks.

## Key Files

- `index.ts` — Barrel export
- `useTorrentActions.ts` — Main hook composing all torrent operations (always-available + capability-gated actions); unsupported operations resolve to no-op/undefined rather than throwing
- `useTorrentActionController.ts` — Headless controller wrapping `useTorrentActions` with a derived `isActionPending` boolean aggregating all mutation pending states
- `useAddTorrent.ts` — Add torrent by URL or file paths; consumes injected `addTorrentFn` and scope
- `createAddTorrentHook.ts` — Factory: `createAddTorrentHook({ bridge, scopeProvider })` returns zero-argument `useAddTorrent` hook wired to bridge
- `createTorrentActionsAdapters.ts` — Factory: `createTorrentActionsAdapters(bridge)` returns adapter object wiring `BridgeAdapter.torrents.*` to `useTorrentActions` callbacks

## Design Patterns

- **Always-available actions**: pause, resume, delete, recheck, reannounce, forceStart
- **Capability-gated**: setDownloadLimit, setUploadLimit, setFilePriority, rename, relocate, increasePriority, decreasePriority, topPriority, bottomPriority, setAutoManagement, setShareLimits, setSequentialDownload, setFirstLastPiecePriority, setSuperSeeding, exportTorrent
- **Always-exposed if provided**: setCategory, addTags, removeTags (no explicit capability gate)
- **No-op fallback**: When a capability-gated function is not provided, hooks are still called with `async () => {}` fallback to maintain stable hook ordering
- **Automatic invalidation**: Mutations invalidate relevant queries (torrents list, properties, files, trackers) and trigger sync-maindata refetch
- **Factory adapters**: `createTorrentActionsAdapters` eliminates duplicate bridge wiring in desktop/mobile apps; `createAddTorrentHook` does the same for add torrent
- **Action controller**: `useTorrentActionController` adds `isActionPending` convenience flag over `useTorrentActions`

## Flow

1. App calls `createTorrentActionsAdapters(bridge)` to produce adapter options
2. `useTorrentActionController({ scope, ...adapters })` calls `useTorrentActions` with all adapter functions
3. `useTorrentActions` calls individual mutation hooks (e.g., `usePauseTorrents`) for each operation
4. Mutations invalidate scoped query keys on success
5. `useAddTorrent` wraps a single `addTorrentFn` mutation with `addByUrl`/`addByFiles` convenience methods

## Integration

- Imports from `hooks/` (usePauseTorrents, useResumeTorrents, useDeleteTorrents, etc.)
- Imports from `query/` (invalidateTorrents, invalidateTorrentProperties, invalidateTorrentFiles, invalidateTorrentTrackers)
- Used by desktop/mobile torrent list/detail UIs
- Accepts platform bridge mutation functions as parameters via adapter factories
