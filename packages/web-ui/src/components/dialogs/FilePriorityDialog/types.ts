export interface FilePriorityDialogProps {
  fileName: string;
  currentPriority: number;
  onSubmit: (priority: number) => void;
  onCancel: () => void;
  isPending: boolean;
}
