import React from 'react';
import type { SurfaceListItemProps } from './types';
import { cn } from '@taurent/shared';

export const SurfaceListItem = React.memo<SurfaceListItemProps>(({
  selected = false,
  onClick,
  onPress,
  children,
  className = '',
}) => {
  const baseStyles = 'flex items-center gap-3 px-4 py-3 transition-colors';

  const interactive = onClick || onPress;
  const clickable = interactive
    ? 'cursor-pointer hover:bg-surface-interactive'
    : '';
  const selectedStyles = selected
    ? 'bg-primary/10'
    : '';

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={cn('w-full text-left', baseStyles, clickable, selectedStyles, className)}
      >
        {children}
      </button>
    );
  }

  if (onClick) {
    return (
      <div
        onClick={onClick}
        className={cn(baseStyles, clickable, selectedStyles, className)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClick();
          }
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cn(baseStyles, selectedStyles, className)}>
      {children}
    </div>
  );
});

SurfaceListItem.displayName = 'SurfaceListItem';
