export interface CategorySelectionDialogProps {
  categories: string[];
  isPending: boolean;
  onCancel: () => void;
  onSelect: (category: string) => void;
  error?: string | Error | null;
}
