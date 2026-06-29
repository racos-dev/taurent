export interface InputBaseProps {
  id?: string;
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export interface InputWebProps extends InputBaseProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  type?: 'text' | 'password' | 'email' | 'number' | 'url' | 'search';
  size?: 'sm' | 'md';
  autoComplete?: string;
  icon?: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}

export interface InputNativeProps extends InputBaseProps {
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'url';
  secureTextEntry?: boolean;
  leftIcon?: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}
