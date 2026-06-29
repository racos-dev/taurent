// Shared torrent mutation hooks — renderer-only, bridge-agnostic.
//
// These hooks own the React Query mutation lifecycle and invalidation logic.
// They accept injected mutation functions so callers provide the bridge adapter
// at the call site.
//
// Usage (desktop/mobile):
//   const { pauseTorrents } = usePauseTorrents({
//     scope: { serverId, sessionGeneration, isConnected },
//     mutationFn: (hashes) => BridgeAdapter.torrents.pause(hashes),
//   });
//
// Shared mutations are exported here so desktop and mobile can compose them
// into their local useTorrentActions() wrappers without duplicating logic.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import {
  invalidateTorrents,
  invalidateTorrentTrackers,
} from '../query/invalidation';

/**
 * Options for torrent mutation hooks.
 *
 * The injected `mutationFn` always receives normalized values. Hook callers may
 * still pass broader user-facing inputs like `string | string[]`.
 */
export interface UseTorrentMutationOptions<TNormalized> {
  scope: QueryScope;
  mutationFn: (variables: TNormalized) => Promise<unknown>;
  onSuccess?: () => void;
}

/**
 * Hook for pausing torrents.
 * Accepts `string | string[]` for desktop-facing API compatibility.
 */
export function usePauseTorrents({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<string[]>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string | string[]>({
    mutationFn: (hashes: string | string[]) => {
      const hashArray = Array.isArray(hashes) ? hashes : [hashes];
      return mutationFn(hashArray);
    },
    onSuccess: (_data, variables) => {
      invalidateTorrents(queryClient, scope);
      // Invalidate trackers so the detail pane refreshes promptly after pause.
      const hashArray = Array.isArray(variables) ? variables : [variables];
      for (const hash of hashArray) {
        invalidateTorrentTrackers(queryClient, scope, hash);
      }
      onSuccess?.();
    },
  });
}

/**
 * Hook for resuming torrents.
 * Accepts `string | string[]` for desktop-facing API compatibility.
 */
export function useResumeTorrents({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<string[]>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string | string[]>({
    mutationFn: (hashes: string | string[]) => {
      const hashArray = Array.isArray(hashes) ? hashes : [hashes];
      return mutationFn(hashArray);
    },
    onSuccess: (_data, variables) => {
      invalidateTorrents(queryClient, scope);
      // Invalidate trackers so the detail pane refreshes promptly after resume.
      const hashArray = Array.isArray(variables) ? variables : [variables];
      for (const hash of hashArray) {
        invalidateTorrentTrackers(queryClient, scope, hash);
      }
      onSuccess?.();
    },
  });
}

export interface DeleteTorrentsVariables {
  hashes: string | string[];
  deleteFiles: boolean;
}

/**
 * Hook for deleting torrents.
 * Accepts `{ hashes: string | string[], deleteFiles: boolean }`.
 */
export function useDeleteTorrents({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<{ hashes: string[]; deleteFiles: boolean }>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, DeleteTorrentsVariables>({
    mutationFn: (variables: DeleteTorrentsVariables) => {
      const hashArray = Array.isArray(variables.hashes) ? variables.hashes : [variables.hashes];
      return mutationFn({ hashes: hashArray, deleteFiles: variables.deleteFiles });
    },
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
      onSuccess?.();
    },
  });
}

/**
 * Hook for rechecking torrents.
 * Accepts `string | string[]` for desktop-facing API compatibility.
 */
export function useRecheckTorrents({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<string[]>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string | string[]>({
    mutationFn: (hashes: string | string[]) => {
      const hashArray = Array.isArray(hashes) ? hashes : [hashes];
      return mutationFn(hashArray);
    },
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
      onSuccess?.();
    },
  });
}

/**
 * Hook for reannouncing torrents.
 * Accepts `string | string[]` for desktop-facing API compatibility.
 * Invalidates both torrents list and trackers per hash.
 */
export function useReannounceTorrents({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<string[]>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string | string[]>({
    mutationFn: (hashes: string | string[]) => {
      const hashArray = Array.isArray(hashes) ? hashes : [hashes];
      return mutationFn(hashArray);
    },
    onSuccess: (_data, variables) => {
      invalidateTorrents(queryClient, scope);
      // Invalidate trackers for all affected hashes
      const hashArray = Array.isArray(variables) ? variables : [variables];
      for (const hash of hashArray) {
        invalidateTorrentTrackers(queryClient, scope, hash);
      }
      onSuccess?.();
    },
  });
}

export interface SetForceStartVariables {
  hashes: string | string[];
  value: boolean;
}

/**
 * Hook for setting force start on torrents.
 * Accepts `{ hashes: string | string[], value: boolean }`.
 */
export function useSetForceStart({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<{ hashes: string[]; value: boolean }>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, SetForceStartVariables>({
    mutationFn: (variables: SetForceStartVariables) => {
      const hashArray = Array.isArray(variables.hashes) ? variables.hashes : [variables.hashes];
      return mutationFn({ hashes: hashArray, value: variables.value });
    },
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
      onSuccess?.();
    },
  });
}

export interface SetTorrentCategoryVariables {
  hashes: string | string[];
  category: string;
}

/**
 * Hook for setting torrent category.
 * Accepts `{ hashes: string | string[], category: string }`.
 */
export function useSetTorrentCategory({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<{ hashes: string[]; category: string }>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, SetTorrentCategoryVariables>({
    mutationFn: (variables: SetTorrentCategoryVariables) => {
      const hashArray = Array.isArray(variables.hashes) ? variables.hashes : [variables.hashes];
      return mutationFn({ hashes: hashArray, category: variables.category });
    },
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
      onSuccess?.();
    },
  });
}

export interface AddTorrentTagsVariables {
  hashes: string | string[];
  tags: string[];
}

/**
 * Hook for adding tags to torrents.
 * Accepts `{ hashes: string | string[], tags: string[] }`.
 */
export function useAddTorrentTags({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<{ hashes: string[]; tags: string[] }>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, AddTorrentTagsVariables>({
    mutationFn: (variables: AddTorrentTagsVariables) => {
      const hashArray = Array.isArray(variables.hashes) ? variables.hashes : [variables.hashes];
      return mutationFn({ hashes: hashArray, tags: variables.tags });
    },
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
      onSuccess?.();
    },
  });
}

export interface RemoveTorrentTagsVariables {
  hashes: string | string[];
  tags: string[];
}

/**
 * Hook for removing tags from torrents.
 * Accepts `{ hashes: string | string[], tags: string[] }`.
 */
export function useRemoveTorrentTags({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<{ hashes: string[]; tags: string[] }>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, RemoveTorrentTagsVariables>({
    mutationFn: (variables: RemoveTorrentTagsVariables) => {
      const hashArray = Array.isArray(variables.hashes) ? variables.hashes : [variables.hashes];
      return mutationFn({ hashes: hashArray, tags: variables.tags });
    },
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
      onSuccess?.();
    },
  });
}

export interface AddTrackersVariables {
  hash: string;
  urls: string;
}

/**
 * Hook for adding trackers to a torrent.
 * Accepts `{ hash: string, urls: string }`.
 */
export function useAddTrackers({
  scope,
  mutationFn,
  onSuccess,
}: UseTorrentMutationOptions<AddTrackersVariables>) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, AddTrackersVariables>({
    mutationFn: (variables: AddTrackersVariables) => {
      return mutationFn(variables);
    },
    onSuccess: (_data, variables) => {
      invalidateTorrentTrackers(queryClient, scope, variables.hash);
      onSuccess?.();
    },
  });
}
