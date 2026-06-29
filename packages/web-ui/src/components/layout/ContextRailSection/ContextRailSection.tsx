import React from 'react';
import type { ContextRailSectionProps } from './types';
import { cn } from '@taurent/shared';

export const ContextRailSection = React.memo<ContextRailSectionProps>(({
  title,
  description,
  children,
  className = '',
}) => {
  return (
    <div className={cn('px-3 py-4', className)}>
      {(title || description) && (
        <div className="mb-3">
          {title && <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h3>}
          {description && <p className="mt-1 text-xs text-text-secondary">{description}</p>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
});

ContextRailSection.displayName = 'ContextRailSection';
