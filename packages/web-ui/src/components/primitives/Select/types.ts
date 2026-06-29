export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number = string> extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  label?: string;
  error?: string;
  options: SelectOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  dataTestid?: string;
  containerClassName?: string;
  required?: boolean;
  /** Which edge of the trigger to anchor the dropdown to. 'right' extends leftward. */
  alignment?: 'left' | 'right';
}
