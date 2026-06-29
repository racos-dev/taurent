// Shared tag mutation hooks — renderer-only, bridge-agnostic.
//
// These hooks own the React Query mutation lifecycle and invalidation logic.
// They accept injected mutation functions so callers provide the bridge adapter
// at the call site.
//
// Usage (desktop):
//   const { createTags } = useCreateTags({
//     scope: { serverId, sessionGeneration, isConnected },
//     mutationFn: (tags) => BridgeAdapter.tags.createTags(tags),
//   });

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import {
  invalidateTags,
  invalidateTagsAndTorrents,
} from '@taurent/web-core/query';

/**
 * Options for tag mutation hooks.
 */
export interface UseTagMutationOptions<TVariables> {
  scope: QueryScope;
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onSuccess?: () => void;
}

/**
 * Hook for creating tags.
 * Invalidates tags list on success.
 */
export function useCreateTags({
  scope,
  mutationFn,
  onSuccess,
}: UseTagMutationOptions<string[]>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateTags(queryClient, scope);
      onSuccess?.();
    },
  });
}

/**
 * Hook for deleting tags.
 * Invalidates both tags and torrents on success
 * (torrents that had the deleted tag need refresh).
 */
export function useDeleteTags({
  scope,
  mutationFn,
  onSuccess,
}: UseTagMutationOptions<string[]>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateTagsAndTorrents(queryClient, scope);
      onSuccess?.();
    },
  });
}


