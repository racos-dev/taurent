import React from 'react';
import type { ButtonSize, ButtonWebProps, ButtonVariant } from './types';
import { cn } from '@taurent/shared';
import { Spinner } from '../../shared/Spinner';
import {
  useControlDensity,
  BUTTON_CONTROL_SIZE_CLASSES,
} from '../../../controlSizing';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'px-3 rounded-sm bg-primary text-text-on-primary enabled:hover:opacity-90 enabled:active:opacity-90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
  secondary:
    'px-3 rounded-sm bg-surface text-text-primary border border-border enabled:hover:border-border-focus enabled:active:bg-surface-interactive disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
  danger:
    'px-3 rounded-sm bg-error text-text-on-danger enabled:hover:opacity-90 enabled:active:opacity-90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
  ghost:
    'px-3 rounded-sm bg-transparent text-text-primary enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive disabled:text-text-disabled',
  success:
    'px-3 rounded-sm bg-success text-text-on-success enabled:hover:opacity-90 enabled:active:opacity-90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
  warning:
    'px-3 rounded-sm bg-warning text-text-on-warning enabled:hover:opacity-90 enabled:active:opacity-90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
  info:
    'px-3 rounded-sm bg-info text-text-on-info enabled:hover:opacity-90 enabled:active:opacity-90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
  neutral:
    'px-3 rounded-sm bg-surface text-text-primary border-2 border-border enabled:active:bg-surface-interactive disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
  outline:
    'px-3 rounded-sm bg-background border border-border text-text-primary enabled:hover:border-border-focus enabled:active:bg-surface-interactive disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 py-1 text-xs',
  small: 'h-9 py-1 text-xs',
  md: 'h-9 text-sm',
  medium: 'h-9 text-sm',
  lg: 'h-9 py-1 text-sm',
  large: 'h-9 py-1 text-sm',
};

export const Button = React.memo<ButtonWebProps>(
  ({
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    leftIcon,
    rightIcon,
    onClick,
    type = 'button',
    className = '',
    children,
    ...props
  }) => {
    const baseStyles = 'font-medium transition-colors disabled:cursor-not-allowed focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none flex items-center justify-center gap-2';

    const density = useControlDensity();
    const densitySizeOverride = BUTTON_CONTROL_SIZE_CLASSES[density][size];

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;
      onClick?.(event);
    };

    return (
      <button
        type={type}
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          densitySizeOverride,
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner variant="ring" size="md" />
        ) : (
          <>
            {leftIcon && <span>{leftIcon}</span>}
            {children}
            {rightIcon && <span>{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.variant === nextProps.variant &&
      prevProps.size === nextProps.size &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.loading === nextProps.loading &&
      prevProps.leftIcon === nextProps.leftIcon &&
      prevProps.rightIcon === nextProps.rightIcon &&
      prevProps.className === nextProps.className &&
      prevProps.children === nextProps.children &&
      prevProps.onClick === nextProps.onClick &&
      prevProps.title === nextProps.title
    );
  }
);

Button.displayName = 'Button';
