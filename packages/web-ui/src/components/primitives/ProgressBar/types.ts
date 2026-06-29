export type ProgressBarVariant = 'default' | 'success' | 'warning' | 'error';
export type ProgressBarSize = 'sm' | 'md' | 'lg';

export interface ProgressBarBaseProps {
  progress: number;
  variant?: ProgressBarVariant;
  size?: ProgressBarSize;
  showLabel?: boolean;
  labelFormat?: 'percentage' | 'fraction' | 'progress' | 'none';
  max?: number;
}

export interface ProgressBarWebProps extends ProgressBarBaseProps {
  className?: string;
  animated?: boolean;
}

export interface ProgressBarNativeProps extends ProgressBarBaseProps {
  className?: string;
  animated?: boolean;
}
