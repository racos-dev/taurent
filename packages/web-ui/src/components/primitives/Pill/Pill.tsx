import React from 'react';
import { cn } from '@taurent/shared';
import type { PillProps, PillTone } from './types';

const toneStyles: Record<PillTone, string> = {
  default: 'bg-surface text-text-secondary',
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-error/10 text-error',
};

export const Pill = React.memo<PillProps>(({
  children,
  tone = 'default',
  icon,
  className,
}) => {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium',
      toneStyles[tone],
      className
    )}>
      {icon}
      {children}
    </span>
  );
});

Pill.displayName = 'Pill';
