// Shared torrent list query hook — renderer-only, bridge-agnostic.
//
// Usage (desktop):
//   const { torrents } = useTorrentList({
//     scope: { serverId, sessionGeneration, isConnected },
//     queryFn: () => BridgeAdapter.torrents.getList(),
//   });
//
// Usage (mobile):
//   const { torrents } = useTorrentList({
//     scope: { serverId, sessionGeneration, isConnected },
//     queryFn: () => BridgeAdapter.torrents.getList({ filter, category, tag }),
//   });

import { useQuery } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import { torrentsKey, type TorrentListKeyParams } from '../query/keys';

export interface UseTorrentListOptions<TTorrent> {
  /** The current query scope (from useQBClient or equivalent) */
  scope: QueryScope;
  /** Additional key params for filtered/sorted variants */
  params?: TorrentListKeyParams;
  /**
   * Bridge-provided fetch function.
   * Returns the raw torrent array.
   */
  queryFn: () => Promise<TTorrent[]>;
  enabled?: boolean;
  /** Override staleTime if needed (default 5s) */
  staleTime?: number;
  /** Override refetchInterval if needed */
  refetchInterval?: number | false;
}

export interface UseTorrentListResult<TTorrent> {
  torrents: TTorrent[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  isFetching: boolean;
  dataUpdatedAt: number;
}

/**
 * Shared torrent list query.
 * Query key includes serverId + sessionGeneration so server-switch
 * and reconnect automatically produce a fresh fetch.
 */
export function useTorrentList<TTorrent>({
  scope,
  params,
  queryFn,
  enabled = true,
  staleTime = 5000,
  refetchInterval = 5000,
}: UseTorrentListOptions<TTorrent>): UseTorrentListResult<TTorrent> {
  const { isConnected, serverId } = scope;

  const result = useQuery<TTorrent[], Error>({
    queryKey: torrentsKey(scope, params),
    queryFn,
    enabled: enabled && isConnected && serverId !== null,
    staleTime,
    refetchInterval: refetchInterval,
  });

  return {
    torrents: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: async () => result.refetch(),
    isFetching: result.isFetching,
    dataUpdatedAt: result.dataUpdatedAt,
  };
}
