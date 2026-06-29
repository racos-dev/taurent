import React from 'react';
import { cn, ChevronRight, ICON_SIZES } from '@taurent/shared';
import type { SettingsRowProps } from './types';
import { useControlDensity } from '../../../controlSizing';

export const SettingsRow = React.memo<SettingsRowProps>(({ title, description, value, onPress, right, disabled, tone = 'default' }) => {
  const density = useControlDensity();
  const isInteractive = Boolean(onPress) && !disabled;
  const rowRhythm = density === 'mobile' ? 'min-h-11 px-3 py-2' : 'px-2 py-2';

  const content = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-medium', tone === 'danger' ? 'text-error' : 'text-text-primary')}>{title}</div>
        {description ? <div className="mt-1 text-xs text-text-secondary">{description}</div> : null}
      </div>
      {value !== undefined && <span className="max-w-[55%] shrink-0 truncate rounded-sm bg-surface px-2 py-1 text-xs font-medium text-text-secondary" title={typeof value === 'string' ? value : undefined}>{value}</span>}
      {right ? <span className="shrink-0">{right}</span> : null}
      {isInteractive ? (
        <ChevronRight size={ICON_SIZES.md} className="shrink-0 text-text-secondary" />
      ) : null}
    </div>
  );

  const classes = cn('w-full rounded-sm text-left transition-colors',
    rowRhythm,
    isInteractive
      ? tone === 'danger' ? 'hover:bg-error/5 active:bg-error/5 cursor-pointer' : 'hover:bg-surface-interactive active:bg-surface-interactive cursor-pointer'
      : '',
    disabled ? 'text-text-disabled cursor-not-allowed' : ''
  );

  if (!isInteractive) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <button type="button" onClick={onPress} disabled={disabled} className={classes}>
      {content}
    </button>
  );
});

SettingsRow.displayName = 'SettingsRow';
