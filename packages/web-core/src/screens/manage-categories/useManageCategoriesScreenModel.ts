/**
 * Manage Categories Screen Model Hook
 *
 * Composes the categories query with create/edit/remove mutations
 * into a flat result object consumed by ManageCategoriesBody.
 *
 * Usage:
 *   const model = useManageCategoriesScreenModel({
 *     scope: { serverId, sessionGeneration, isConnected },
 *     adapters: {
 *       getCategories: () => BridgeAdapter.categories.getCategories(),
 *       createCategory: (name, savePath) =>
 *         BridgeAdapter.categories.createCategory(name, savePath),
 *       editCategory: (name, savePath) =>
 *         BridgeAdapter.categories.editCategory(name, savePath),
 *       removeCategories: (names) =>
 *         BridgeAdapter.categories.removeCategories(names),
 *     },
 *   });
 *
 *   <ManageCategoriesBody
 *     variant="desktop"
 *     categories={model.categories}
 *     isLoading={model.isLoading}
 *     refetch={model.refetch}
 *     onCreateCategory={model.onCreateCategory}
 *     onEditCategory={model.onEditCategory}
 *     onRemoveCategory={model.onRemoveCategory}
 *     isCreating={model.isCreating}
 *     isEditing={model.isEditing}
 *     isRemoving={model.isRemoving}
 *     mutationError={model.mutationError}
 *   />
 */

import type { QueryScope } from '../../query/scope';
import type { Category } from '@taurent/shared';
import { formatUserMessage } from '@taurent/shared/utils/error';
import { useCategories } from '../../hooks/useCategories';
import {
  useCreateCategory,
  useEditCategory,
  useRemoveCategories,
} from '../../hooks/useCategoryMutations';

export interface ManageCategoriesScreenModelOptions {
  scope: QueryScope;
  adapters: {
    getCategories: () => Promise<Record<string, Category>>;
    createCategory: (categoryName: string, savePath: string) => Promise<unknown>;
    editCategory: (categoryName: string, savePath: string) => Promise<unknown>;
    removeCategories: (categoryNames: string[]) => Promise<unknown>;
  };
}

export interface ManageCategoriesScreenModelResult {
  categories: Record<string, Category> | undefined;
  isLoading: boolean;
  refetch: () => void;
  onCreateCategory: (categoryName: string, savePath?: string) => void;
  onEditCategory: (categoryName: string, savePath: string) => void;
  onRemoveCategory: (categoryName: string) => void;
  isCreating: boolean;
  isEditing: boolean;
  isRemoving: boolean;
  mutationError: string | null;
}

export function useManageCategoriesScreenModel({
  scope,
  adapters,
}: ManageCategoriesScreenModelOptions): ManageCategoriesScreenModelResult {
  const { categories, isLoading, refetch } = useCategories({
    scope,
    queryFn: adapters.getCategories,
  });

  const createCategory = useCreateCategory({
    scope,
    mutationFn: ({ categoryName, savePath }) =>
      adapters.createCategory(categoryName, savePath ?? ''),
  });

  const editCategory = useEditCategory({
    scope,
    mutationFn: ({ categoryName, savePath }) =>
      adapters.editCategory(categoryName, savePath),
  });

  const removeCategories = useRemoveCategories({
    scope,
    mutationFn: (vars) => adapters.removeCategories(vars),
  });

  return {
    categories,
    isLoading,
    refetch,
    onCreateCategory: (categoryName, savePath) =>
      createCategory.mutate({ categoryName, savePath }),
    onEditCategory: (categoryName, savePath) =>
      editCategory.mutate({ categoryName, savePath }),
    onRemoveCategory: (categoryName) =>
      removeCategories.mutate([categoryName]),
    isCreating: createCategory.isPending,
    isEditing: editCategory.isPending,
    isRemoving: removeCategories.isPending,
    mutationError:
      (createCategory.error ? formatUserMessage(createCategory.error) : null) ||
      (editCategory.error ? formatUserMessage(editCategory.error) : null) ||
      (removeCategories.error ? formatUserMessage(removeCategories.error) : null) ||
      null,
  };
}