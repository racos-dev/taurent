import React from 'react';
import { cn, Check, Minus, ICON_SIZES } from '@taurent/shared';
import type { CheckboxProps } from './types';
import { useControlDensity, CHECKBOX_CONTROL_WRAPPER_CLASSES } from '../../../controlSizing';

export const Checkbox = React.memo<CheckboxProps>(({ checked, onChange, disabled, dataTestid, indeterminate }) => {
  const density = useControlDensity();
  const wrapperClasses = CHECKBOX_CONTROL_WRAPPER_CLASSES[density];
  return (
    <span className={cn('inline-flex', wrapperClasses)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked ? 'true' : 'false'}
        onClick={() => onChange?.(!checked)}
        disabled={disabled}
        data-testid={dataTestid}
        className={cn(
          'w-4 h-4 rounded-sm border flex items-center justify-center transition-colors',
          'border-elevated',
          indeterminate || checked ? 'bg-primary border-primary' : 'bg-background hover:border-border-focus',
          disabled ? 'text-text-disabled cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        {indeterminate ? (
          <Minus size={ICON_SIZES.sm} className="text-text-on-primary" />
        ) : checked ? (
          <Check size={ICON_SIZES.sm} className="text-text-on-primary" />
        ) : null}
      </button>
    </span>
  );
});

Checkbox.displayName = 'Checkbox';
