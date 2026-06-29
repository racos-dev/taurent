import React from 'react';
import type { ProgressBarWebProps, ProgressBarVariant, ProgressBarSize } from './types';
import { formatProgress } from '@taurent/shared/utils/formatters';

const variantStyles: Record<ProgressBarVariant, { bg: string; fill: string }> = {
  default: { bg: 'bg-surface', fill: 'bg-primary' },
  success: { bg: 'bg-surface', fill: 'bg-success' },
  warning: { bg: 'bg-surface', fill: 'bg-warning' },
  error: { bg: 'bg-surface', fill: 'bg-error' },
};

const sizeStyles: Record<ProgressBarSize, { height: string; labelSize: string }> = {
  sm: { height: 'h-1', labelSize: 'text-xs' },
  md: { height: 'h-2', labelSize: 'text-sm' },
  lg: { height: 'h-3', labelSize: 'text-sm' },
};

export const ProgressBar: React.FC<ProgressBarWebProps> = React.memo(({
  progress,
  variant = 'default',
  size = 'md',
  showLabel = false,
  labelFormat = 'percentage',
  max = 1,
  className = '',
  animated = true,
}) => {
  const clampedProgress = Math.max(0, Math.min(progress / max, 1));
  const percentage = Math.round(clampedProgress * 100);
  const formattedProgress = formatProgress(clampedProgress, 0);

  const { bg, fill } = variantStyles[variant];
  const { height, labelSize } = sizeStyles[size];

  const getLabel = () => {
    switch (labelFormat) {
      case 'percentage':
        return `${percentage}%`;
      case 'fraction':
        return `${Math.round(progress)}/${max}`;
      case 'progress':
        return formattedProgress;
      case 'none':
        return '';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 ${bg} rounded-full overflow-hidden ${height}`}>
        <div
          className={`h-full ${fill} rounded-full ${animated ? 'transition-all duration-300 ease-out' : ''}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <span className={`${labelSize} text-text-secondary min-w-[2rem] text-right`}>
          {getLabel()}
        </span>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';
