// Shared category mutation hooks — renderer-only, bridge-agnostic.
//
// These hooks own the React Query mutation lifecycle and invalidation logic.
// They accept injected mutation functions so callers provide the bridge adapter
// at the call site.
//
// Usage (desktop):
//   const { createCategory } = useCreateCategory({
//     scope: { serverId, sessionGeneration, isConnected },
//     mutationFn: ({ categoryName, savePath }) =>
//       BridgeAdapter.categories.createCategory(categoryName, savePath || ''),
//   });

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import {
  invalidateCategories,
  invalidateCategoriesAndTorrents,
} from '@taurent/web-core/query';

/**
 * Options for category mutation hooks.
 */
export interface UseCategoryMutationOptions<TVariables> {
  scope: QueryScope;
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onSuccess?: () => void;
}

export interface CreateCategoryVariables {
  categoryName: string;
  savePath?: string;
}

/**
 * Hook for creating a category.
 * Invalidates categories list on success.
 */
export function useCreateCategory({
  scope,
  mutationFn,
  onSuccess,
}: UseCategoryMutationOptions<CreateCategoryVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateCategories(queryClient, scope);
      onSuccess?.();
    },
  });
}

export interface EditCategoryVariables {
  categoryName: string;
  savePath: string;
}

/**
 * Hook for editing a category.
 * Invalidates categories list on success.
 */
export function useEditCategory({
  scope,
  mutationFn,
  onSuccess,
}: UseCategoryMutationOptions<EditCategoryVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateCategories(queryClient, scope);
      onSuccess?.();
    },
  });
}

/**
 * Hook for removing categories.
 * Invalidates both categories and torrents on success
 * (torrents that had the removed category need refresh).
 */
export function useRemoveCategories({
  scope,
  mutationFn,
  onSuccess,
}: UseCategoryMutationOptions<string[]>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidateCategoriesAndTorrents(queryClient, scope);
      onSuccess?.();
    },
  });
}


