import React from 'react';
import type { MetadataRowProps } from './types';
import { cn } from '@taurent/shared';

export const MetadataRow = React.memo<MetadataRowProps>(({
  label,
  value,
  children,
  className = '',
}) => {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-1', className)}>
      <span className="shrink-0 text-xs font-medium text-text-muted min-w-[6rem]">{label}</span>
      {children ? (
        <div className="flex-1 text-right">{children}</div>
      ) : (
        <span className="flex-1 text-xs text-text-primary text-right break-words">{value}</span>
      )}
    </div>
  );
});

MetadataRow.displayName = 'MetadataRow';
