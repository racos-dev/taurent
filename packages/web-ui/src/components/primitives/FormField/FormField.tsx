import React from 'react';
import type { FormFieldProps } from './types';
import { cn } from '@taurent/shared';

export const FormField = React.memo<FormFieldProps>(({
  label,
  description,
  error,
  children,
  className = '',
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-medium text-text-primary">{label}</label>
      )}
      {description && (
        <p className="text-xs text-text-secondary">{description}</p>
      )}
      {children}
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';
