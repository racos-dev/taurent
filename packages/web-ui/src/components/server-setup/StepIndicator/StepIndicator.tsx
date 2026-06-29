import React from 'react';
import { cn, Icon } from '@taurent/shared';
import type { StepIndicatorProps } from './types';

export const StepIndicator = React.memo<StepIndicatorProps>(
  ({ steps, className }) => {
    return (
      <div className={cn('flex items-center', className)}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium',
                    step.active && 'bg-primary text-text-on-primary',
                    step.completed && 'bg-success text-text-on-success',
                    !step.active && !step.completed && 'bg-surface-elevated text-text-muted',
                  )}
                >
                  {step.completed ? (
                    <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs',
                    step.active && 'text-text-primary',
                    step.completed && 'text-text-primary',
                    !step.active && !step.completed && 'text-text-muted',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-1 mx-2 mb-4',
                    steps[index + 1]?.completed ? 'bg-success' : 'bg-border',
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  },
);

StepIndicator.displayName = 'StepIndicator';
