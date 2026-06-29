import React from 'react';
import { cn } from '@taurent/shared';
import { Checkbox } from '../../primitives/Checkbox';
import type { SettingToggleProps } from './types';

export const SettingToggle = React.memo<SettingToggleProps>(({ label, description, value, onChange }) => {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-sm border border-border px-3 transition-colors hover:border-border-focus',
        description ? 'items-start py-3' : 'items-center py-2'
      )}
    >
      <div className={cn(description ? 'pt-1' : 'pt-0')}>
        <Checkbox checked={value} onChange={onChange} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {description ? <div className="mt-1 text-xs text-text-secondary">{description}</div> : null}
      </div>
    </div>
  );
});

SettingToggle.displayName = 'SettingToggle';
