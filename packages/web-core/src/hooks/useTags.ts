// Shared tags query hook — renderer-only, bridge-agnostic.
//
// Usage (desktop):
//   const { tags } = useTags({
//     scope: { serverId, sessionGeneration, isConnected },
//     queryFn: () => BridgeAdapter.tags.getTags(),
//   });

import { useQuery } from '@tanstack/react-query';
import type { QueryScope, HydratedQueryScope } from '../query/scope';
import { tagsKey } from '../query/keys';
import { DEFAULT_STALE_TIME } from '../query/scope';

export interface UseTagsOptions {
  scope: QueryScope;
  /**
   * Bridge-provided fetch function.
   * Returns the raw string[] of tag names.
   */
  queryFn: () => Promise<string[]>;
  staleTime?: number;
}

export interface UseTagsResult {
  tags: string[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTags({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: UseTagsOptions): UseTagsResult {
  const { isConnected, serverId } = scope;

  const result = useQuery<string[], Error>({
    queryKey: tagsKey(scope),
    queryFn,
    enabled: isConnected && serverId !== null,
    staleTime,
  });

  return {
    tags: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useTagsHydrated({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: {
  scope: HydratedQueryScope;
  queryFn: () => Promise<string[]>;
  staleTime?: number;
}): UseTagsResult {
  const { isConnected, isHydrated, serverId } = scope;

  const result = useQuery<string[], Error>({
    queryKey: tagsKey(scope),
    queryFn,
    enabled: isConnected && isHydrated && serverId !== null,
    staleTime,
  });

  return {
    tags: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

// Tags hook factory — creates platform-specific tags hooks from bridge adapters.
//
// All heavy lifting (query lifecycle, mutation lifecycle, invalidation) lives in web-core hooks.
// Apps provide the platform bridge methods and a scope provider; this factory
// wires them together so hooks remain zero-argument.
//
// Usage:
//   import { createTagsHooks } from '@taurent/web-core/hooks';
//   import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
//   import { useQBClient } from '../connection';
//
//   const { useTags, useCreateTags, useDeleteTags, useAddTorrentTags, useRemoveTorrentTags } =
//     createTagsHooks({
//       adapters: {
//         getTags: () => BridgeAdapter.tags.getTags(),
//         createTags: (tags) => BridgeAdapter.tags.createTags(tags),
//         deleteTags: (tags) => BridgeAdapter.tags.deleteTags(tags),
//         addTorrentTags: (hashes, tags) => BridgeAdapter.tags.addTorrentTags(hashes, tags),
//         removeTorrentTags: (hashes, tags) => BridgeAdapter.tags.removeTorrentTags(hashes, tags),
//       },
//       scopeProvider: useQBClient,
//     });

import {
  useCreateTags as createTagsCore,
  useDeleteTags as deleteTagsCore,
} from './useTagMutations';
import {
  useAddTorrentTags as addTorrentTagsCore,
  useRemoveTorrentTags as removeTorrentTagsCore,
} from './useTorrentMutations';
import type { QBClientContextValue } from '../session';

export interface TagsAdapters {
  getTags: () => Promise<string[]>;
  createTags: (tags: string[]) => Promise<unknown>;
  deleteTags: (tags: string[]) => Promise<unknown>;
  addTorrentTags: (hashes: string[], tags: string[]) => Promise<unknown>;
  removeTorrentTags: (hashes: string[], tags: string[]) => Promise<unknown>;
}

export interface CreateTagsHooksOptions {
  adapters: TagsAdapters;
  /**
   * A function that returns the current QB client context value.
   * Typically `useQBClient` from the app's connection module.
   * Called inside each hook at render time to stay reactive to session changes.
   */
  scopeProvider: () => QBClientContextValue;
}

export function createTagsHooks({ adapters, scopeProvider }: CreateTagsHooksOptions) {
  function useTagsQueryHook() {
    const { isConnected, serverId, sessionGeneration } = scopeProvider();

    return useTags({
      scope: { serverId, sessionGeneration, isConnected },
      queryFn: async () => {
        return adapters.getTags();
      },
    });
  }

  function useCreateTags() {
    const { serverId, sessionGeneration, isConnected } = scopeProvider();

    return createTagsCore({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: (tags) => adapters.createTags(tags),
    });
  }

  function useDeleteTags() {
    const { serverId, sessionGeneration, isConnected } = scopeProvider();

    return deleteTagsCore({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: (tags) => adapters.deleteTags(tags),
    });
  }

  function useAddTorrentTags() {
    const { serverId, sessionGeneration, isConnected } = scopeProvider();

    return addTorrentTagsCore({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: ({ hashes, tags }) => {
        const hashArray = Array.isArray(hashes) ? hashes : [hashes];
        return adapters.addTorrentTags(hashArray, tags);
      },
    });
  }

  function useRemoveTorrentTags() {
    const { serverId, sessionGeneration, isConnected } = scopeProvider();

    return removeTorrentTagsCore({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: ({ hashes, tags }) => {
        const hashArray = Array.isArray(hashes) ? hashes : [hashes];
        return adapters.removeTorrentTags(hashArray, tags);
      },
    });
  }

  return {
    useTags: useTagsQueryHook,
    useCreateTags,
    useDeleteTags,
    useAddTorrentTags,
    useRemoveTorrentTags,
  };
}
