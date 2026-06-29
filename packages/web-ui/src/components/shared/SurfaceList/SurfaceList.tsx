import React from 'react';
import type { SurfaceListProps } from './types';
import { cn } from '@taurent/shared';

export const SurfaceList = React.memo<SurfaceListProps>(({
  children,
  className = '',
}) => {
  return (
    <div className={cn('divide-y divide-border', className)}>
      {children}
    </div>
  );
});

SurfaceList.displayName = 'SurfaceList';
