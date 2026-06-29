import React from 'react';
import type { ReactNode } from 'react';
import type { CommandBarProps } from './types';
import { cn } from '@taurent/shared';

export const CommandBar = React.memo<CommandBarProps>(({
  children,
  className = '',
}) => {
  return (
    <div className={cn('flex items-center gap-4 px-4 py-2 border-b border-border bg-surface', className)}>
      {children}
    </div>
  );
});

CommandBar.displayName = 'CommandBar';

export const CommandBarGroup = React.memo<CommandBarGroupProps>(({
  children,
  className = '',
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {children}
    </div>
  );
});

CommandBarGroup.displayName = 'CommandBarGroup';

export interface CommandBarGroupProps {
  children: ReactNode;
  className?: string;
}
