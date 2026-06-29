import React from 'react';
import { cn } from '@taurent/shared';
import { Button } from '../../primitives/Button';
import type { DialogActionsProps } from './types';

export const DialogActions = React.memo<DialogActionsProps>(
  ({
    actions,
    layout = 'row',
    size = 'sm',
    stretch = true,
    className,
    actionClassName,
  }) => {
    return (
      <div
        className={cn(
          layout === 'stack' ? 'flex flex-col gap-1' : 'flex gap-2',
          className,
        )}
      >
        {actions.map((action, index) => (
          <Button
            key={index}
            type={action.type ?? 'button'}
            variant={action.variant ?? 'secondary'}
            size={size}
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
            className={cn(stretch && 'flex-1', actionClassName, action.className)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    );
  },
);

DialogActions.displayName = 'DialogActions';
