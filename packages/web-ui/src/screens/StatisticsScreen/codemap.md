# packages/web-ui/src/screens/StatisticsScreen/

## Responsibility

Provides the platform-agnostic presentational body for the server statistics screen. Displays three sections of server metrics — user statistics, cache statistics, and performance statistics — in a clean metadata list format. Handles disconnected/loading/unavailable states.

## Design

- **`StatisticsScreenBody`** — top-level `React.memo` component (`StatisticsScreenBodyProps`). ~99 lines.
- **`ServerStatistics` interface** — defines the data shape: alltimeDl/Ul, averageTimeQueue, globalRatio, queuedIoJobs, readCacheHits, readCacheOverload, totalBuffersSize, totalPeerConnections, totalQueuedSize, totalWastedSession, writeCacheOverload.
- **`formatPercentStat`** — local helper that formats percentage values with N/A fallback.
- **Early returns** — renders `StateCard` for not-connected, loading, and no-data states before the statistics sections.
- **Three stat sections**:
  - User statistics (all-time upload/download, share ratio, session waste, connected peers)
  - Cache statistics (read cache hits, total buffer size)
  - Performance statistics (write/read cache overload, queued I/O jobs, average queue time, total queued size)

## Flow

1. Controller provides `statistics` (derived from qBittorrent `server_state`), `isLoading`, `isConnected`.
2. Component renders appropriate state card or statistics sections.
3. No user interactions — read-only display.

## Integration

- **`@taurent/web-ui`** — `StateCard`, `MetadataList`, `MetadataRow`.
- **`@taurent/shared`** — `cn`, `formatBytes`, `formatRatio`.
- **Controller layer** — derives `ServerStatistics` from the raw maindata `server_state` object; passed as a single prop.
- **Settings screen** — linked via optional `onOpenStatistics` callback in settings.
- **Exported from `index.ts`**: `StatisticsScreenBody`, `StatisticsScreenBodyProps`, `ServerStatistics`.
