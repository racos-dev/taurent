// Shared transfer hooks — renderer-only, bridge-agnostic.
//
// These hooks own the React Query query/mutation lifecycle and invalidation
// logic. They accept injected query/mutation functions so callers provide the
// bridge adapter at the call site.
//
// Usage (desktop/mobile):
//   const { transferInfo } = useTransferInfo({
//     scope: { serverId, sessionGeneration, isConnected },
//     queryFn: () => BridgeAdapter.transfer.getInfo().then(r => r.info),
//   });
//
//   const { toggleSpeedLimitsMode } = useToggleSpeedLimitsMode({
//     scope: { serverId, sessionGeneration, isConnected },
//     mutationFn: () => BridgeAdapter.transfer.toggleSpeedLimitsMode(),
//   });

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import { DEFAULT_STALE_TIME } from '../query/scope';
import { transferInfoKey } from '../query/keys';
import { invalidateTransferInfo, invalidateTorrentPeers } from '../query/invalidation';

// ---------------------------------------------------------------------------
// Transfer info
// ---------------------------------------------------------------------------

/**
 * Options for the transfer info query.
 */
export interface UseTransferInfoOptions<TTransferInfo> {
  scope: QueryScope;
  queryFn: () => Promise<TTransferInfo>;
  staleTime?: number;
}

/**
 * Result shape for the transfer info query.
 */
export interface UseTransferInfoResult<TTransferInfo> {
  transferInfo: TTransferInfo | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching transfer info (speeds, limits, connection status, etc.).
 */
export function useTransferInfo<TTransferInfo>({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: UseTransferInfoOptions<TTransferInfo>): UseTransferInfoResult<TTransferInfo> {
  const { isConnected, serverId } = scope;

  const result = useQuery<TTransferInfo, Error>({
    queryKey: transferInfoKey(scope),
    queryFn,
    enabled: isConnected && serverId !== null,
    staleTime,
  });

  return {
    transferInfo: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

// ---------------------------------------------------------------------------
// Speed limits mode
// ---------------------------------------------------------------------------

/**
 * Options for the speed limits mode query.
 */
export interface UseSpeedLimitsModeOptions {
  scope: QueryScope;
  queryFn: () => Promise<boolean>;
  staleTime?: number;
}

/**
 * Result shape for the speed limits mode query.
 */
export interface UseSpeedLimitsModeResult {
  useAltSpeedLimits: boolean | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching whether alternative speed limits are active.
 */
export function useSpeedLimitsMode({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: UseSpeedLimitsModeOptions): UseSpeedLimitsModeResult {
  const { isConnected, serverId } = scope;

  const result = useQuery<boolean, Error>({
    queryKey: transferInfoKey(scope, 'speed-limits-mode'),
    queryFn,
    enabled: isConnected && serverId !== null,
    staleTime,
  });

  return {
    useAltSpeedLimits: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Options for speed limits mode mutation hooks.
 */
export interface UseSpeedLimitsModeMutationOptions {
  scope: QueryScope;
  mutationFn: () => Promise<unknown>;
  onSuccess?: () => void;
  onMutate?: () => unknown;
  onError?: (err: Error, variables: void, context: unknown) => void;
}

/**
 * Hook for toggling the alternative speed limits mode on/off.
 */
export function useToggleSpeedLimitsMode({
  scope,
  mutationFn,
  onSuccess,
  onMutate,
  onError,
}: UseSpeedLimitsModeMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate,
    onError,
    onSuccess: () => {
      invalidateTransferInfo(queryClient, scope);
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// Download limit
// ---------------------------------------------------------------------------

/**
 * Options for the global download limit query.
 */
export interface UseGlobalDownloadLimitOptions {
  scope: QueryScope;
  queryFn: () => Promise<number>;
  staleTime?: number;
}

/**
 * Result shape for the global download limit query.
 */
export interface UseGlobalDownloadLimitResult {
  downloadLimit: number | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching the global download limit.
 */
export function useGlobalDownloadLimit({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: UseGlobalDownloadLimitOptions): UseGlobalDownloadLimitResult {
  const { isConnected, serverId } = scope;

  const result = useQuery<number, Error>({
    queryKey: transferInfoKey(scope, 'download-limit'),
    queryFn,
    enabled: isConnected && serverId !== null,
    staleTime,
  });

  return {
    downloadLimit: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Options for download limit mutation hooks via the transfer API.
 */
export interface UseSetTransferDownloadLimitOptions {
  scope: QueryScope;
  mutationFn: (limit: number) => Promise<unknown>;
  onSuccess?: () => void;
}

/**
 * Hook for setting the global download limit via the transfer API.
 * Accepts `limit: number` (bytes/s).
 */
export function useSetTransferDownloadLimit({
  scope,
  mutationFn,
  onSuccess,
}: UseSetTransferDownloadLimitOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateTransferInfo(queryClient, scope);
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// Upload limit
// ---------------------------------------------------------------------------

/**
 * Options for the global upload limit query.
 */
export interface UseGlobalUploadLimitOptions {
  scope: QueryScope;
  queryFn: () => Promise<number>;
  staleTime?: number;
}

/**
 * Result shape for the global upload limit query.
 */
export interface UseGlobalUploadLimitResult {
  uploadLimit: number | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching the global upload limit.
 */
export function useGlobalUploadLimit({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: UseGlobalUploadLimitOptions): UseGlobalUploadLimitResult {
  const { isConnected, serverId } = scope;

  const result = useQuery<number, Error>({
    queryKey: transferInfoKey(scope, 'upload-limit'),
    queryFn,
    enabled: isConnected && serverId !== null,
    staleTime,
  });

  return {
    uploadLimit: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Options for upload limit mutation hooks via the transfer API.
 */
export interface UseSetTransferUploadLimitOptions {
  scope: QueryScope;
  mutationFn: (limit: number) => Promise<unknown>;
  onSuccess?: () => void;
}

/**
 * Hook for setting the global upload limit via the transfer API.
 * Accepts `limit: number` (bytes/s).
 */
export function useSetTransferUploadLimit({
  scope,
  mutationFn,
  onSuccess,
}: UseSetTransferUploadLimitOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateTransferInfo(queryClient, scope);
      onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// Ban peers
// ---------------------------------------------------------------------------

/**
 * Options for banning peers.
 */
export interface UseBanPeersOptions {
  scope: QueryScope;
  mutationFn: (peers: string[]) => Promise<unknown>;
  onSuccess?: () => void;
}

/**
 * Hook for banning peers by IP address.
 * Accepts `peers: string[]` (array of IP addresses).
 */
export function useBanPeers({
  scope,
  mutationFn,
  onSuccess,
}: UseBanPeersOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateTransferInfo(queryClient, scope);
      onSuccess?.();
    },
  });
}

/**
 * Ban-peers mutation wrapper that also invalidates the torrent's peers query.
 * Use this when banning peers from within a torrent detail context where the
 * peers list is actively being polled.
 *
 * @param hash - The torrent hash whose peers should be invalidated after ban.
 */
export function useBanPeersWithPeerInvalidation({
  scope,
  mutationFn,
  hash,
  onSuccess,
}: UseBanPeersOptions & { hash: string }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateTransferInfo(queryClient, scope);
      if (hash) {
        invalidateTorrentPeers(queryClient, scope, hash);
      }
      onSuccess?.();
    },
  });
}
