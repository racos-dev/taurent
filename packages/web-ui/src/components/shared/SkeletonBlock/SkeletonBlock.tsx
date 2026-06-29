import React from 'react';
import type { SkeletonBlockProps } from './types';
import { cn } from '@taurent/shared';

export const SkeletonBlock = React.memo<SkeletonBlockProps>(({
  width,
  height,
  radius = 'md',
  background = 'bg-surface',
  className = '',
}) => {
  const radiusStyles = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-md',
    full: 'rounded-full',
  };

  return (
    <div
      className={cn('animate-pulse', background, radiusStyles[radius], className)}
      style={{ width: width ?? '100%', height: height ?? '1rem' }}
      aria-hidden="true"
    />
  );
});

SkeletonBlock.displayName = 'SkeletonBlock';
