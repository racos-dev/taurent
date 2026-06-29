import React from 'react';
import type { InfoRowProps } from './types';

export const InfoRow = React.memo<InfoRowProps>(({ label, value }) => {
  return (
    <div className="rounded-sm border border-border bg-background px-2 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 break-words text-xs text-text-primary">{value}</div>
    </div>
  );
});

InfoRow.displayName = 'InfoRow';
