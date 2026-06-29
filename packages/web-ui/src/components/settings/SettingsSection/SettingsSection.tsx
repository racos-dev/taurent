import React, { useState } from 'react';
import { cn, ICON_SIZES } from '@taurent/shared';
import type { SettingsSectionProps } from './types';
import { useControlDensity } from '../../../controlSizing';

export const SettingsSection = React.memo<SettingsSectionProps>(({
  title,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  icon,
  summary,
  children,
}) => {
  const density = useControlDensity();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-surface">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-full text-left transition-colors hover:bg-surface-interactive active:bg-surface-interactive',
          density === 'mobile' ? 'min-h-11 px-3 py-2' : 'px-2 py-2',
          isExpanded ? 'border-b border-border' : ''
        )}
      >
        <div className="flex items-center gap-2">
          {icon ? (
            <div
              className="flex items-center justify-center text-primary"
              style={{ width: ICON_SIZES.lg, height: ICON_SIZES.lg }}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-text-primary">{title}</div>
            {summary ? <div className="mt-1 text-xs text-text-secondary">{summary}</div> : null}
          </div>
          <div className="text-text-secondary">
            <svg
              width={ICON_SIZES.md}
              height={ICON_SIZES.md}
              className={cn('transition-transform', isExpanded ? 'rotate-180' : '')}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </button>
      {isExpanded ? <div className="space-y-1 p-2">{children}</div> : null}
    </section>
  );
});

SettingsSection.displayName = 'SettingsSection';
