# sync

## Responsibility

Backend-owned live sync for qBittorrent's maindata endpoint and selected-torrent detail coordination. The Rust sync manager (`qb-core::sync`) owns polling cadence, backoff, overlap guard, RID tracking, and accumulated maindata state. The renderer consumes lightweight sync-changed events and full snapshots on demand. Implements a hot/cold context split: `MaindataSyncProvider` isolates backend sync state from stable session context; `useMaindataState`/`useMaindataSelector` are hot consumers reading from accumulated maindata state.

## Key Files

- `index.ts` — Barrel export
- `MaindataSyncProvider.tsx` — Context provider that isolates maindata sync state from session stability; provides both `useMaindataState()` (whole-context) and `useMaindataSelector` (external-store selector) APIs; uses `useMaindataSyncBackend` as the sole sync source
- `useMaindataSyncBackend.ts` — Backend-owned live sync hook; receives `maindata-sync-changed` events from the Rust sync manager, coalesces revision updates, fetches snapshots via `getMaindataSnapshot()`, drops stale-session snapshots/events using `session_generation` guards; includes delta application fast path for embedded qBittorrent deltas and slow path for full snapshot fetch
- `useSelectedTorrentDetailSync.ts` — Detail-pane coordination hook; throttles tab refetch using `server_state.refresh_interval` hint (clamped 1000–2000ms for active torrents, 3000–5000ms for inactive); supports `coordinatorTabs` restrict list
- `protectedRequestHealth.ts` — Connected-server outage health signal for non-maindata API requests; tracks consecutive network/timeout failures per scope; threshold: 2 failures → degraded

## Design Patterns

- **Backend-owned sync**: The Rust sync manager (`qb-core::sync`) handles polling cadence, backoff, overlap guard, and RID tracking. The renderer receives events and snapshots — it does not own the polling loop.
- **Event + snapshot hybrid**: `maindata-sync-changed` events carry either an embedded delta (fast path) or just metadata (slow path requiring `getMaindataSnapshot()` IPC call)
- **Session generation guards**: Both events and snapshots are validated against `sessionGeneration` and `serverId` to discard stale data from previous sessions
- **Revision coalescing**: Events with revision ≤ `lastRevisionRef` are discarded to prevent redundant processing
- **Hot/cold split**: Polling lives in `MaindataSyncProvider`; derived state consumption stays reactive without subscribing to the sync tick
- **useSyncExternalStore selector**: `useMaindataSelector` uses external-store pattern so consumers only re-render when their selected slice changes
- **Adaptive detail throttle**: `useSelectedTorrentDetailSync` uses torrent active/inactive state to select throttle range (1–2s active, 3–5s inactive)
- **Protected request health**: `protectedRequestHealth.ts` tracks consecutive network failures for protected resources; combined with maindata sync health in provider

## Validation boundary (T144)

The maindata sync boundary is split between Rust and TypeScript:

- **Backend live sync (production hot path)** — `qb-core::sync::SyncDelta::parse` is the canonical strict boundary. It runs inside `MaindataAccumulator::apply` (`crates/qb-tauri/src/sync/manager.rs::poll_once`). It rejects malformed envelope/container payloads and preserves the last good snapshot. Row-level torrent/category/server-state fields are still stored as raw `serde_json::Value` — full DTO validation of every row is intentionally deferred.
- **Backend `tolerant full_update`** — `SyncDelta::parse` accepts booleans, numbers `0`/`1`, and strings `"0"`/`"1"`/`"true"`/`"false"`/`"True"` for `full_update`. This matches the TypeScript `FullUpdateSchema` normalizer in `packages/shared/src/schemas/qbittorrent.ts`.
- **Bridge `SyncMainData` type** — `torrents` is intentionally typed as `Record<string, unknown>` (not `Torrent`) so the bridge does not accidentally narrow the wire shape for the row-level deferred-validation slice.

## Flow

1. `MaindataSyncProvider` mounts, receives `backendBridge` + scope
2. `useMaindataSyncBackend` starts Rust sync manager via `startMaindataSync()`
3. Subscribes to `maindata-sync-changed` events from the Rust sync manager
4. On event: validates session generation → updates health → applies embedded delta (fast path) or fetches full snapshot (slow path)
5. `normalizeBackendMaindata()` injects `torrent.hash` from the keyed map before React consumes the state
6. `useMaindataState()` consumers see accumulated state
7. `useMaindataSelector(selector)` consumers see only their selected slice
8. `useSelectedTorrentDetailSync` watches rid advances and triggers throttled refetches
9. `protectedRequestHealth` integrates with `MaindataSyncProvider` for combined outage signal

## Integration

- Imports `MaindataState`, `mergeMaindata`, `normalizeBackendMaindata` from `@taurent/shared`
- Imports bridge types (`MaindataSyncChangedEvent`, `MaindataSnapshotResponse`) from `@taurent/bridge/types`
- `MaindataSyncProvider` consumed by `createQBClientBootstrap` to compose the provider tree
- `protectedRequestHealth` integrates with `query/query-client.ts` via `reportProtectedFailure`/`reportProtectedSuccess`
- Used for real-time torrent list updates in desktop/mobile
- No renderer-side polling remains — Rust is the sole sync source
