// Shared categories query hook — renderer-only, bridge-agnostic.
//
// Usage (desktop):
//   const { data } = useCategories({
//     scope: { serverId, sessionGeneration, isConnected },
//     queryFn: () => BridgeAdapter.categories.getCategories(),
//   });
//
// The hook owns the query lifecycle but does NOT own connection lifecycle.

import { useQuery } from '@tanstack/react-query';
import type { QueryScope, HydratedQueryScope } from '../query/scope';
import { categoriesKey } from '../query/keys';
import { DEFAULT_STALE_TIME } from '../query/scope';

export interface UseCategoriesOptions<TCategories extends Record<string, unknown>> {
  /** The current query scope (from useQBClient or equivalent) */
  scope: QueryScope;
  /**
   * Bridge-provided fetch function.
   * Receives no arguments; returns the raw categories record.
   */
  queryFn: () => Promise<TCategories>;
  /** Override staleTime if needed (default 60s) */
  staleTime?: number;
}

export interface UseCategoriesResult<TCategories extends Record<string, unknown>> {
  categories: TCategories | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Shared categories list query.
 * Query key includes serverId + sessionGeneration so server-switch
 * and reconnect automatically produce a fresh fetch.
 */
export function useCategories<TCategories extends Record<string, unknown>>({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: UseCategoriesOptions<TCategories>): UseCategoriesResult<TCategories> {
  const { isConnected, serverId } = scope;

  const result = useQuery<TCategories, Error>({
    queryKey: categoriesKey(scope),
    queryFn,
    enabled: isConnected && serverId !== null,
    staleTime,
  });

  return {
    categories: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Variant that blocks until the session is hydrated.
 * Use when the component must not render until scope is available.
 */
export function useCategoriesHydrated<TCategories extends Record<string, unknown>>({
  scope,
  queryFn,
  staleTime = DEFAULT_STALE_TIME,
}: {
  scope: HydratedQueryScope;
  queryFn: () => Promise<TCategories>;
  staleTime?: number;
}): UseCategoriesResult<TCategories> {
  const { isConnected, isHydrated, serverId } = scope;

  const result = useQuery<TCategories, Error>({
    queryKey: categoriesKey(scope),
    queryFn,
    enabled: isConnected && isHydrated && serverId !== null,
    staleTime,
  });

  return {
    categories: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

// Categories hook factory — creates platform-specific categories hooks from bridge adapters.
//
// All heavy lifting (query lifecycle, mutation lifecycle, invalidation) lives in web-core hooks.
// Apps provide the platform bridge methods and a scope provider; this factory
// wires them together so hooks remain zero-argument.
//
// Usage:
//   import { createCategoriesHooks } from '@taurent/web-core/hooks';
//   import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
//   import { useQBClient } from '../connection';
//
//   const { useCategories, useCreateCategory, useEditCategory, useRemoveCategories, useSetTorrentCategory } =
//     createCategoriesHooks({
//       adapters: {
//         getCategories: () => BridgeAdapter.categories.getCategories(),
//         createCategory: (name, savePath) => BridgeAdapter.categories.createCategory(name, savePath),
//         editCategory: (name, savePath) => BridgeAdapter.categories.editCategory(name, savePath),
//         removeCategories: (names) => BridgeAdapter.categories.removeCategories(names),
//         setTorrentCategory: (hashes, category) => BridgeAdapter.torrents.setCategory(hashes, category),
//       },
//       scopeProvider: useQBClient,
//     });

import {
  useCreateCategory as createCategoryCore,
  useEditCategory as editCategoryCore,
  useRemoveCategories as removeCategoriesCore,
} from './useCategoryMutations';
import { useSetTorrentCategory as setTorrentCategoryCore } from './useTorrentMutations';
import type { Category } from '@taurent/shared';
import type { QBClientContextValue } from '../session';

export interface CategoriesAdapters {
  getCategories: () => Promise<Record<string, Category>>;
  createCategory: (categoryName: string, savePath: string) => Promise<unknown>;
  editCategory: (categoryName: string, savePath: string) => Promise<unknown>;
  removeCategories: (categoryNames: string[]) => Promise<unknown>;
  setTorrentCategory: (hashes: string[], category: string) => Promise<unknown>;
}

export interface CreateCategoriesHooksOptions {
  adapters: CategoriesAdapters;
  /**
   * A function that returns the current QB client context value.
   * Typically `useQBClient` from the app's connection module.
   * Called inside each hook at render time to stay reactive to session changes.
   */
  scopeProvider: () => QBClientContextValue;
}

export function createCategoriesHooks({ adapters, scopeProvider }: CreateCategoriesHooksOptions) {
  function useCategoriesQueryHook() {
    const { isConnected, serverId, sessionGeneration } = scopeProvider();

    return useCategories<Record<string, Category>>({
      scope: { serverId, sessionGeneration, isConnected },
      queryFn: async () => {
        const response = await adapters.getCategories();
        return response as Record<string, Category>;
      },
    });
  }

  function useCreateCategory() {
    const { serverId, sessionGeneration, isConnected } = scopeProvider();

    return createCategoryCore({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: ({ categoryName, savePath }) =>
        adapters.createCategory(categoryName, savePath || ''),
    });
  }

  function useEditCategory() {
    const { serverId, sessionGeneration, isConnected } = scopeProvider();

    return editCategoryCore({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: ({ categoryName, savePath }) =>
        adapters.editCategory(categoryName, savePath),
    });
  }

  function useRemoveCategories() {
    const { serverId, sessionGeneration, isConnected } = scopeProvider();

    return removeCategoriesCore({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: (categoryNames) => adapters.removeCategories(categoryNames),
    });
  }

  function useSetTorrentCategory() {
    const { serverId, sessionGeneration, isConnected } = scopeProvider();

    return setTorrentCategoryCore({
      scope: { serverId, sessionGeneration, isConnected },
      mutationFn: ({ hashes, category }) => {
        const hashArray = Array.isArray(hashes) ? hashes : [hashes];
        return adapters.setTorrentCategory(hashArray, category);
      },
    });
  }

  return {
    useCategories: useCategoriesQueryHook,
    useCreateCategory,
    useEditCategory,
    useRemoveCategories,
    useSetTorrentCategory,
  };
}
