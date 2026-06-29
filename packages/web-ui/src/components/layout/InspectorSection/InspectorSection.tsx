import React from 'react';
import type { InspectorSectionProps } from './types';
import { cn } from '@taurent/shared';

export const InspectorSection = React.memo<InspectorSectionProps>(({
  title,
  children,
  className = '',
}) => {
  return (
    <div className={cn('p-4 border-b border-border last:border-b-0', className)}>
      {title && <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>}
      <div>{children}</div>
    </div>
  );
});

InspectorSection.displayName = 'InspectorSection';
