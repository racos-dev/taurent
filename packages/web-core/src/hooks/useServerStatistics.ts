// Shared server statistics hook — derives all-time and session-cached statistics
// from accumulated maindata sync state.
//
// Platform-agnostic: uses MaindataStateScope (maintained by
// useMaindataSyncBackend (Rust live sync)). Statistics fields are part of the
// server_state object returned by /api/v2/sync/maindata.

import type { SyncServerState } from '@taurent/shared/types/qbittorrent';
import type { MaindataStateScope } from '../sync/MaindataSyncProvider';

export interface ServerStatistics {
  alltimeDl: number;
  alltimeUl: number;
  averageTimeQueue: number;
  globalRatio: number;
  queuedIoJobs: number;
  readCacheHits: number;
  readCacheOverload: number | string | null;
  totalBuffersSize: number;
  totalPeerConnections: number;
  totalQueuedSize: number;
  totalWastedSession: number;
  writeCacheOverload: number | string | null;
}

export interface UseServerStatisticsResult {
  statistics: ServerStatistics | null;
  isLoading: boolean;
}

/**
 * Factory that creates a platform-specific useServerStatistics hook.
 * Takes a scope provider (useMaindataState) and returns a zero-argument-style hook.
 */
export function createServerStatisticsHook(
  scopeProvider: () => MaindataStateScope
) {
  return function useServerStatistics(): UseServerStatisticsResult {
    const { isConnected, isHydrated, maindataState } = scopeProvider();

    const serverState: SyncServerState | null = maindataState?.server_state ?? null;

    const statistics: ServerStatistics | null = serverState
      ? {
          alltimeDl: serverState.alltime_dl ?? 0,
          alltimeUl: serverState.alltime_ul ?? 0,
          averageTimeQueue: serverState.average_time_queue ?? 0,
          globalRatio: Number(serverState.global_ratio ?? 0),
          queuedIoJobs: serverState.queued_io_jobs ?? 0,
          readCacheHits: serverState.read_cache_hits ?? 0,
          readCacheOverload: serverState.read_cache_overload ?? null,
          totalBuffersSize: serverState.total_buffers_size ?? 0,
          totalPeerConnections: serverState.total_peer_connections ?? 0,
          totalQueuedSize: serverState.total_queued_size ?? 0,
          totalWastedSession: serverState.total_wasted_session ?? 0,
          writeCacheOverload: serverState.write_cache_overload ?? null,
        }
      : null;

    const isLoading = isConnected && isHydrated && maindataState === null;

    return {
      statistics,
      isLoading,
    };
  };
}
