export interface ComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
  isPending?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
}
