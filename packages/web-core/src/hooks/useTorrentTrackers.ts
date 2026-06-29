// Shared torrent trackers query hook — renderer-only, bridge-agnostic.
//
// Usage (desktop/mobile):
//   const { trackers } = useTorrentTrackers({
//     scope: { serverId, sessionGeneration, isConnected },
//     hash,
//     queryFn: () => BridgeAdapter.torrents.getTrackers(hash),
//   });

import { useQuery } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import { torrentTrackersKey } from '../query/keys';

export interface UseTorrentTrackersOptions<TTracker> {
  /** The current query scope (from useQBClient or equivalent) */
  scope: QueryScope;
  /** The torrent hash to fetch trackers for */
  hash: string | null;
  /**
   * Bridge-provided fetch function.
   * Receives the hash as argument; returns the raw tracker array.
   */
  queryFn: (hash: string) => Promise<TTracker[]>;
  enabled?: boolean;
  /** Override staleTime if needed (default 10s) */
  staleTime?: number;
  /** Override refetchInterval if needed (default 30s) */
  refetchInterval?: number | false | (() => number | false);
}

export interface UseTorrentTrackersResult<TTracker> {
  trackers: TTracker[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  isFetching: boolean;
  dataUpdatedAt: number;
}

/**
 * Shared torrent trackers query.
 * Query key includes serverId + sessionGeneration + hash so server-switch
 * and reconnect automatically produce a fresh fetch.
 */
export function useTorrentTrackers<TTracker>({
  scope,
  hash,
  queryFn,
  enabled = true,
  staleTime = 10000,
  refetchInterval = 30000,
}: UseTorrentTrackersOptions<TTracker>): UseTorrentTrackersResult<TTracker> {
  const { isConnected, serverId } = scope;

  const result = useQuery<TTracker[], Error>({
    queryKey: torrentTrackersKey(scope, hash ?? ''),
    queryFn: async () => {
      if (!hash) {
        throw new Error('Missing torrent hash for trackers query');
      }

      return queryFn(hash);
    },
    enabled: enabled && isConnected && serverId !== null && hash !== null,
    staleTime,
    refetchInterval: refetchInterval,
  });

  return {
    trackers: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: async () => result.refetch(),
    isFetching: result.isFetching,
    dataUpdatedAt: result.dataUpdatedAt,
  };
}
