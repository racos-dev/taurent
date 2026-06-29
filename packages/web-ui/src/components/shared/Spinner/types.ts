export type SpinnerSize = 'sm' | 'md' | 'lg';

export type SpinnerVariant = 'ring' | 'icon';

export interface SpinnerProps {
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  className?: string;
}