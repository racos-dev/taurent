# apps/desktop/src/hooks/torrents/

## Responsibility

Provides desktop-specific torrent mutation hooks, transfer command assembly, live torrent selectors, and torrent detail hooks. All torrent interaction flows through this directory — from live data subscriptions to user-initiated actions.

## Design

- **Mutation adapter**: `useTorrentActions` wraps web-core's `useTorrentActions` with `BridgeAdapter` and renames methods to desktop semantics (`delete` → `remove`, `rename` → `setName`, `relocate` → `setLocation`, `topPriority` → `moveToTop`, `bottomPriority` → `moveToBottom`).
- **Command model**: `useTransferCommandList` builds a serializable `TransferCommand[]` from current selection state and available actions, consumed by menus, toolbars, shortcuts, and context menus.
- **Selector optimization**: `useLiveTorrentList` uses a narrow maindata selector (only the torrents map), derives the array via `useMemo`, and includes an optional identity churn probe for perf auditing.
- **Detail delegation**: `useTorrentDetails` delegates to `@taurent/web-core`'s `createTorrentDetailHooks` for properties, trackers, files, peers, and web seeds.

## Files

- **useTorrentActions.ts** — wraps `@taurent/web-core`'s `useTorrentActions` with `BridgeAdapter`, applies desktop-specific type narrowing (all operations always available when connected), renames methods for desktop conventions.
- **useTransferCommandList.ts** — builds `TransferCommand[]` from current selection state and torrent actions. Includes clipboard commands (copy hash, name, magnet URI), open-folder with path mapping, and category/tag dialog openers. Commands include `enabled` state for conditional UI rendering.
- **useLiveTorrentList.ts** — subscribes to the torrents map slice via `useMaindataSelector`, derives `Torrent[]` array via `useMemo`. Includes optional identity churn probe (comparing reference identities across renders) gated by `isPerfAuditEnabled()`.
- **useLiveTorrentByHash.ts** — per-hash live torrent lookup via the same narrow maindata selector. Returns `Torrent | undefined`.
- **useLiveTorrentsByHash.ts** — multi-hash live torrent lookup. Returns `(Torrent | undefined)[]` in the same order as input hashes.
- **useTorrentDetails.ts** — delegates to `@taurent/web-core`'s `createTorrentDetailHooks` factory, producing `useProperties`, `useTrackers`, `useFiles`, `usePeers`, and `useWebSeeds` hooks wired with `BridgeAdapter`.

## Flow

1. Torrent data flows from `maindata` store → `useMaindataSelector` (narrow slice) → `useLiveTorrentList` (derived array) → UI components.
2. User actions flow from UI → `useTorrentActions` (mutations) → `BridgeAdapter` RPC → Rust backend → maindata update → selector → UI re-render.
3. `useTransferCommandList` reads current selection from `useTorrentSelection` store and available actions from `useTorrentActions`, producing commands with `enabled` booleans and `perform` callbacks.
4. `useTorrentDetails` creates detail hooks that fetch per-torrent detail data (properties, trackers, files, peers, web seeds) on demand via `BridgeAdapter`.

## Integration

- `@taurent/bridge/adapters/desktop` — `BridgeAdapter` for all torrent RPCs.
- `@taurent/web-core` — `useTorrentActions`, `createTorrentDetailHooks` factories.
- `@taurent/shared/stores` — `useTorrentSelection` for selection state, `useMaindataSelector` for maindata subscriptions.
- `src/contexts` — `useQBClient` for server scope in detail hooks.
- `@taurent/shared` — `TransferCommand` type definition.
