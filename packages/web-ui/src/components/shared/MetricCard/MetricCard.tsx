import React from 'react';
import type { MetricCardProps } from './types';
import { cn } from '@taurent/shared';

const toneStyles = {
  neutral: 'border-border',
  success: 'border-success/30',
  warning: 'border-warning/30',
  error: 'border-error/30',
};

const accentStyles = {
  neutral: 'bg-surface',
  success: 'bg-success/5',
  warning: 'bg-warning/5',
  error: 'bg-error/5',
};

export const MetricCard = React.memo<MetricCardProps>(({
  label,
  value,
  subValue,
  tone = 'neutral',
  className = '',
}) => {
  return (
    <div className={cn('rounded-sm border bg-surface px-3 py-2', toneStyles[tone], className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</div>
      <div className={cn('mt-1 text-sm font-semibold text-text-primary', accentStyles[tone] === accentStyles.neutral ? '' : 'text-text-primary')}>
        {value}
      </div>
      {subValue && <div className="mt-1 text-xs text-text-secondary">{subValue}</div>}
    </div>
  );
});

MetricCard.displayName = 'MetricCard';
