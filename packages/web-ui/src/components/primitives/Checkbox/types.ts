export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  dataTestid?: string;
  indeterminate?: boolean;
}
