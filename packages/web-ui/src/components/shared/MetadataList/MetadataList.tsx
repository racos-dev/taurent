import React from 'react';
import type { MetadataListProps } from './types';
import { cn } from '@taurent/shared';

export const MetadataList = React.memo<MetadataListProps>(({
  children,
  className = '',
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {children}
    </div>
  );
});

MetadataList.displayName = 'MetadataList';
