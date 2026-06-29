// Shared torrent files query hook — renderer-only, bridge-agnostic.
//
// Usage (desktop/mobile):
//   const { files } = useTorrentFiles({
//     scope: { serverId, sessionGeneration, isConnected },
//     hash,
//     queryFn: () => BridgeAdapter.torrents.getFiles(hash),
//   });

import { useQuery } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import { torrentFilesKey } from '../query/keys';

export interface UseTorrentFilesOptions<TTorrentFile> {
  /** The current query scope (from useQBClient or equivalent) */
  scope: QueryScope;
  /** The torrent hash to fetch files for */
  hash: string | null;
  /**
   * Bridge-provided fetch function.
   * Receives the hash as argument; returns the raw file array.
   */
  queryFn: (hash: string) => Promise<TTorrentFile[]>;
  enabled?: boolean;
  /** Override staleTime if needed (default 5s) */
  staleTime?: number;
  /** Override refetchInterval if needed (default 10s) */
  refetchInterval?: number | false | (() => number | false);
}

export interface UseTorrentFilesResult<TTorrentFile> {
  files: TTorrentFile[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  isFetching: boolean;
  dataUpdatedAt: number;
}

/**
 * Shared torrent files query.
 * Query key includes serverId + sessionGeneration + hash so server-switch
 * and reconnect automatically produce a fresh fetch.
 */
export function useTorrentFiles<TTorrentFile>({
  scope,
  hash,
  queryFn,
  enabled = true,
  staleTime = 5000,
  refetchInterval = 10000,
}: UseTorrentFilesOptions<TTorrentFile>): UseTorrentFilesResult<TTorrentFile> {
  const { isConnected, serverId } = scope;

  const result = useQuery<TTorrentFile[], Error>({
    queryKey: torrentFilesKey(scope, hash ?? ''),
    queryFn: async () => {
      if (!hash) {
        throw new Error('Missing torrent hash for files query');
      }

      return queryFn(hash);
    },
    enabled: enabled && isConnected && serverId !== null && hash !== null,
    staleTime,
    refetchInterval: refetchInterval,
  });

  return {
    files: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: async () => result.refetch(),
    isFetching: result.isFetching,
    dataUpdatedAt: result.dataUpdatedAt,
  };
}
