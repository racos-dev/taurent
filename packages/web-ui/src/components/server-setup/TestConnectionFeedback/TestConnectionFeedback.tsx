import React from 'react';
import { cn, Icon } from '@taurent/shared';
import { Spinner } from '@taurent/web-ui';
import type { TestConnectionFeedbackProps } from './types';

export const TestConnectionFeedback = React.memo<TestConnectionFeedbackProps>(
  ({ state, errorMessage, suggestion, className }) => {
    if (state === 'idle') {
      return null;
    }

    if (state === 'testing') {
      return (
        <div className={cn('flex items-center gap-2 rounded-sm bg-surface p-3 transition-all duration-200', className)}>
          <Spinner variant="ring" size="md" />
          <span className="text-sm text-text-secondary">Testing connection...</span>
        </div>
      );
    }

    if (state === 'success') {
      return (
        <div className={cn('flex items-center gap-2 rounded-sm bg-success/10 p-3 transition-all duration-200', className)}>
          <Icon name="check" className="h-4 w-4 shrink-0 text-success" />
          <span className="text-sm text-success">Connection successful!</span>
        </div>
      );
    }

    // error state
    return (
      <div className={cn('flex items-start gap-2 rounded-sm bg-error/10 p-3 transition-all duration-200', className)}>
        <Icon name="x" className="h-4 w-4 shrink-0 text-error mt-1" />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-error">{errorMessage ?? 'Connection failed'}</span>
          {suggestion && (
            <span className="text-xs text-text-muted">{suggestion}</span>
          )}
        </div>
      </div>
    );
  },
);

TestConnectionFeedback.displayName = 'TestConnectionFeedback';
