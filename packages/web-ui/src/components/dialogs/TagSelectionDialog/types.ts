export interface TagSelectionDialogProps {
  availableTags: string[];
  isPending: boolean;
  onCancel: () => void;
  onAddTags: (tags: string[]) => void;
  onRemoveTags: (tags: string[]) => void;
  assignedTags?: Set<string>;
  error?: string | Error | null;
}
