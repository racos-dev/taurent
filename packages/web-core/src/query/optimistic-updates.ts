import { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Torrent } from '@taurent/shared/types/qbittorrent';

/**
 * Helper for implementing optimistic updates with React Query
 */
export interface OptimisticUpdateConfig<TData, TVariables> {
  queryClient: QueryClient;
  queryKey: QueryKey;
  variables: TVariables;
  optimisticData: (oldData: TData | undefined, variables: TVariables) => TData;
  onError?: (error: Error, variables: TVariables, context: { previousData: TData | undefined }) => void;
  onSuccess?: (data: unknown, variables: TVariables) => void;
}

/**
 * Create optimistic update handlers for useMutation
 */
export function createOptimisticMutation<TData, TVariables>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updateFn: (oldData: TData, variables: TVariables) => TData
) {
  return {
    onMutate: async (variables: TVariables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<TData>(queryKey, (old) => {
          if (!old) {return old;}
          return updateFn(old, variables);
        });
      }

      return { previousData };
    },

    onError: (_err: Error, _variables: TVariables, context: { previousData: TData | undefined } | undefined) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Optimistic update for torrent list operations
 */
export function createTorrentOptimisticUpdate(
  queryClient: QueryClient,
  queryKey: QueryKey = ['torrents']
) {
  return {
    // Optimistic pause/resume
    pauseTorrent: (hashes: string | string[]) => {
      const hashArray = Array.isArray(hashes) ? hashes : [hashes];
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Torrent[]) => {
          return oldData.map((torrent) => {
            if (hashArray.includes(torrent.hash)) {
              return {
                ...torrent,
                state: torrent.state.includes('DL') ? 'pausedDL' : 'pausedUP',
              };
            }
            return torrent;
          });
        }
      );
    },

    // Optimistic resume
    resumeTorrent: (hashes: string | string[]) => {
      const hashArray = Array.isArray(hashes) ? hashes : [hashes];
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Torrent[]) => {
          return oldData.map((torrent) => {
            if (hashArray.includes(torrent.hash)) {
              return {
                ...torrent,
                state: torrent.progress < 1 ? 'downloading' : 'uploading',
              };
            }
            return torrent;
          });
        }
      );
    },

    // Optimistic delete
    deleteTorrent: (hashes: string | string[]) => {
      const hashArray = Array.isArray(hashes) ? hashes : [hashes];
      const hashSet = new Set(hashArray);
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Torrent[]) => {
          return oldData.filter((torrent) => !hashSet.has(torrent.hash));
        }
      );
    },

    // Optimistic category change
    setCategory: (hashes: string | string[], category: string) => {
      const hashArray = Array.isArray(hashes) ? hashes : [hashes];
      const hashSet = new Set(hashArray);
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Torrent[]) => {
          return oldData.map((torrent) => {
            if (hashSet.has(torrent.hash)) {
              return { ...torrent, category };
            }
            return torrent;
          });
        }
      );
    },
  };
}

/**
 * Optimistic update for transfer info
 */
export function createTransferOptimisticUpdate(
  queryClient: QueryClient,
  queryKey: QueryKey = ['transfer', 'info']
) {
  return {
    // Optimistic speed limit change
    setDownloadLimit: (limit: number) => {
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Record<string, unknown>) => {
          return { ...oldData, dl_rate_limit: limit };
        }
      );
    },

    // Optimistic upload limit change
    setUploadLimit: (limit: number) => {
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Record<string, unknown>) => {
          return { ...oldData, up_rate_limit: limit };
        }
      );
    },

    // Optimistic speed limits mode toggle
    toggleSpeedLimitsMode: () => {
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Record<string, unknown>) => {
          return { ...oldData, use_alt_speed_limits: !oldData.use_alt_speed_limits };
        }
      );
    },
  };
}

/**
 * Optimistic update for preferences
 */
export function createPreferencesOptimisticUpdate(
  queryClient: QueryClient,
  queryKey: QueryKey = ['preferences']
) {
  return {
    updatePreference: <K extends string>(key: K, value: unknown) => {
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Record<string, unknown>) => {
          return { ...oldData, [key]: value };
        }
      );
    },

    updatePreferences: (prefs: Record<string, unknown>) => {
      return createOptimisticMutation(
        queryClient,
        queryKey,
        (oldData: Record<string, unknown>) => {
          return { ...oldData, ...prefs };
        }
      );
    },
  };
}
