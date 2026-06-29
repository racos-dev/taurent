// Shared torrent properties query hook — renderer-only, bridge-agnostic.
//
// Usage (desktop/mobile):
//   const { properties } = useTorrentProperties({
//     scope: { serverId, sessionGeneration, isConnected },
//     hash,
//     queryFn: () => BridgeAdapter.torrents.getProperties(hash),
//   });

import { useQuery } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import { torrentPropertiesKey } from '../query/keys';

export interface UseTorrentPropertiesOptions<TTorrentProperties> {
  /** The current query scope (from useQBClient or equivalent) */
  scope: QueryScope;
  /** The torrent hash to fetch properties for */
  hash: string | null;
  /**
   * Bridge-provided fetch function.
   * Receives the hash as argument; returns the raw properties object.
   */
  queryFn: (hash: string) => Promise<TTorrentProperties>;
  enabled?: boolean;
  /** Override staleTime if needed (default 5s) */
  staleTime?: number;
  /** Override refetchInterval if needed */
  refetchInterval?: number | false | ((query: { state: { status: string } }) => number | false);
  /** Number of retry attempts before showing error (default 3). Set to 1 for polled endpoints. */
  retry?: number;
}

export interface UseTorrentPropertiesResult<TTorrentProperties> {
  properties: TTorrentProperties | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  isFetching: boolean;
  dataUpdatedAt: number;
}

/**
 * Shared torrent properties query.
 * Query key includes serverId + sessionGeneration + hash so server-switch
 * and reconnect automatically produce a fresh fetch.
 */
export function useTorrentProperties<TTorrentProperties>({
  scope,
  hash,
  queryFn,
  enabled = true,
  staleTime = 5000,
  refetchInterval = 5000,
  retry = 3,
}: UseTorrentPropertiesOptions<TTorrentProperties>): UseTorrentPropertiesResult<TTorrentProperties> {
  const { isConnected, serverId } = scope;

  const result = useQuery<TTorrentProperties, Error>({
    queryKey: torrentPropertiesKey(scope, hash ?? ''),
    queryFn: async () => {
      if (!hash) {
        throw new Error('Missing torrent hash for properties query');
      }

      return queryFn(hash);
    },
    enabled: enabled && isConnected && serverId !== null && hash !== null,
    staleTime,
    refetchInterval: refetchInterval,
    retry,
  });

  return {
    properties: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: async () => result.refetch(),
    isFetching: result.isFetching,
    dataUpdatedAt: result.dataUpdatedAt,
  };
}
