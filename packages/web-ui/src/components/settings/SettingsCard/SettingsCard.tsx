import React from 'react';
import { cn } from '@taurent/shared';
import type { SettingsCardProps } from './types';

export const SettingsCard = React.memo<SettingsCardProps>(({ title, description, children }) => {
  return (
    <section className="rounded-sm border border-border bg-surface p-2">
      <div className={cn('space-y-1', description ? 'mb-2' : 'mb-1')}>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description ? <p className="text-xs text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
});

SettingsCard.displayName = 'SettingsCard';
