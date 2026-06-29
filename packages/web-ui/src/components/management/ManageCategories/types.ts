import type { Category } from '@taurent/shared/types/qbittorrent';

export type ManageCategoriesBodyVariant = 'desktop' | 'mobile';

export interface ManageCategoriesBodyProps {
  variant?: ManageCategoriesBodyVariant;

  // Category list
  categories: Record<string, Category> | undefined;
  isLoading: boolean;
  refetch: () => void;

  // Actions
  onCreateCategory: (categoryName: string, savePath?: string) => void;
  onEditCategory: (categoryName: string, savePath: string) => void;
  onRemoveCategory: (categoryName: string) => void;

  // Mutation states
  isCreating?: boolean;
  isEditing?: boolean;
  isRemoving?: boolean;

  // Server-side mutation error
  mutationError?: string | null;
}
