import React from 'react';
import { RefreshCw } from '@taurent/shared';
import type { SpinnerProps } from './types';
import { cn } from '@taurent/shared';

const ringSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-12 w-12',
};

const iconSizes = {
  sm: 12,
  md: 16,
  lg: 20,
};

export const Spinner = React.memo<SpinnerProps>(({
  variant = 'ring',
  size = 'md',
  className = '',
}) => {
  if (variant === 'icon') {
    return (
      <RefreshCw
        size={iconSizes[size]}
        className={cn('animate-spin text-current', className)}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        ringSizes[size],
        className,
      )}
      aria-hidden="true"
    />
  );
});

Spinner.displayName = 'Spinner';