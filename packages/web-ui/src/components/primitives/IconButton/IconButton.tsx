import React from 'react';
import { cn } from '@taurent/shared';
import type { IconButtonProps, IconButtonTone, IconButtonVariant } from './types';
import { Spinner } from '../../shared/Spinner';
import {
  HEADER_ICON_BUTTON_SIZE_CLASSES,
  useControlDensity,
} from '../../../controlSizing';

const variantStyles: Record<IconButtonVariant, string> = {
  surface:
    'bg-surface text-text-secondary enabled:[@media(hover:hover)]:hover:bg-surface-interactive enabled:[@media(hover:hover)]:hover:text-primary enabled:active:bg-surface-interactive disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
  ghost:
    'bg-transparent text-text-secondary enabled:[@media(hover:hover)]:hover:bg-surface-interactive enabled:[@media(hover:hover)]:hover:text-primary enabled:active:bg-surface-interactive disabled:text-text-disabled',
  outline:
    'border border-border bg-surface text-text-secondary enabled:[@media(hover:hover)]:hover:border-border-focus enabled:[@media(hover:hover)]:hover:text-primary enabled:active:bg-surface-interactive disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
};

const toneStyles: Record<IconButtonTone, string> = {
  default: '',
  primary:
    'text-primary enabled:[@media(hover:hover)]:hover:bg-primary/10 enabled:[@media(hover:hover)]:hover:text-primary enabled:active:bg-primary/10',
  danger:
    'text-text-secondary enabled:[@media(hover:hover)]:hover:bg-error/10 enabled:[@media(hover:hover)]:hover:text-error enabled:active:bg-error/10',
};

const activeStyles: Record<IconButtonTone, string> = {
  default: 'bg-primary/10 text-primary',
  primary: 'bg-primary/10 text-primary',
  danger: 'bg-error/10 text-error',
};

export const IconButton = React.memo<IconButtonProps>(({
  title,
  'aria-label': ariaLabel,
  children,
  className,
  disabled = false,
  isActive = false,
  loading = false,
  tone = 'default',
  variant = 'surface',
  type = 'button',
  onClick,
  ...props
}) => {
  const density = useControlDensity();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    onClick?.(event);
  };

  return (
    <button
      type={type}
      title={title}
      aria-label={ariaLabel ?? title}
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-focus',
        HEADER_ICON_BUTTON_SIZE_CLASSES[density],
        variantStyles[variant],
        isActive ? activeStyles[tone] : toneStyles[tone],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner variant="ring" size="md" /> : children}
    </button>
  );
});

IconButton.displayName = 'IconButton';
