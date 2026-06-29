export interface InputDialogProps {
  title: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
}
