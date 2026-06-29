export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'success'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'outline';

export type ButtonSize = 'sm' | 'small' | 'md' | 'medium' | 'lg' | 'large';

export interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
}

export interface ButtonWebProps extends ButtonBaseProps {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  children?: React.ReactNode;
  title?: string;
}

export interface ButtonNativeProps extends ButtonBaseProps {
  onPress: () => void;
  label?: string;
}
