export type ManageTagsBodyVariant = 'desktop' | 'mobile';

export interface ManageTagsBodyProps {
  variant?: ManageTagsBodyVariant;

  // Tag list
  tags: string[] | undefined;
  isLoading: boolean;
  refetch: () => void;

  // Actions
  onCreateTag: (tagName: string) => void;
  onDeleteTag: (tagName: string) => void;
  isCreating?: boolean;
  isDeleting?: boolean;

  // Server-side mutation error
  mutationError?: string | null;
}