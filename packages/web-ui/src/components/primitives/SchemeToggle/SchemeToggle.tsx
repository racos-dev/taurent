import React from 'react';
import { cn } from '@taurent/shared';
import type { SchemeToggleProps } from './types';

/**
 * Segmented control for selecting HTTP or HTTPS URL scheme.
 */
export const SchemeToggle = React.memo<SchemeToggleProps>(({
  scheme,
  onChange,
  disabled = false,
  className = '',
}) => {
  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-border bg-surface p-1',
        className,
      )}
      role="radiogroup"
      aria-label="URL scheme"
    >
      <button
        type="button"
        role="radio"
        aria-checked={scheme === 'http'}
        onClick={() => onChange('http')}
        disabled={disabled}
        className={cn(
          'rounded-sm px-3 py-1 text-xs font-medium transition-colors',
          scheme === 'http'
            ? 'bg-primary text-text-on-primary'
            : 'text-text-secondary hover:text-text-primary',
          disabled ? 'text-text-disabled cursor-not-allowed' : '',
        )}
      >
        HTTP
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={scheme === 'https'}
        onClick={() => onChange('https')}
        disabled={disabled}
        className={cn(
          'rounded-sm px-3 py-1 text-xs font-medium transition-colors',
          scheme === 'https'
            ? 'bg-primary text-text-on-primary'
            : 'text-text-secondary hover:text-text-primary',
          disabled ? 'text-text-disabled cursor-not-allowed' : '',
        )}
      >
        HTTPS
      </button>
    </div>
  );
});

SchemeToggle.displayName = 'SchemeToggle';
