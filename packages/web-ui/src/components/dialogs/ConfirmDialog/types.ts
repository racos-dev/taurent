export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  tone?: 'default' | 'danger';
  confirmLoadingLabel?: string;
  cancelLabel?: string;
}
