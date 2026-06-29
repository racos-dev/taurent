import React from 'react';
import { cn } from '@taurent/shared';
import type { StatusPanelProps } from './types';

export const StatusPanel = React.memo<StatusPanelProps>(({ title, description, tone = 'default' }) => {
  return (
    <div
      className={cn(
        'rounded-sm border px-3 py-2',
        tone === 'error'
          ? 'border-error bg-error-20 text-error'
          : 'border-border bg-surface text-text-secondary'
      )}
    >
      <h3 className={cn('text-sm font-semibold', tone === 'error' ? 'text-error' : 'text-text-primary')}>
        {title}
      </h3>
      <p className={cn('mt-1 text-xs', tone === 'error' ? 'text-error' : 'text-text-secondary')}>
        {description}
      </p>
    </div>
  );
});

StatusPanel.displayName = 'StatusPanel';
