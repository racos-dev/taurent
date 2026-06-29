import React from 'react';
import { cn, Icon } from '@taurent/shared';
import type { ActionButtonProps, ActionChipProps, TorrentActionsBarProps } from './types';
import {
  useControlDensity,
  ACTION_BUTTON_CONTROL_SIZE_CLASSES,
  ACTION_CHIP_CONTROL_SIZE_CLASSES,
} from '../../../controlSizing';
import {
  filledVariantClasses,
  surfaceVariantClasses,
} from '../../primitives/buttonStyles';

export const ActionButton = React.memo<ActionButtonProps>(({
  icon,
  label,
  tone = 'secondary',
  onClick,
  disabled,
}) => {
  const classes =
    tone === 'primary'
      ? filledVariantClasses(
          'bg-primary',
          'text-text-on-primary',
          'enabled:hover:bg-primary/90',
          'enabled:active:opacity-90',
        )
      : tone === 'danger'
        ? surfaceVariantClasses({
            border: 'border-error/30',
            text: 'text-error',
            hoverBg: 'bg-error/10',
          })
        : surfaceVariantClasses({ hoverBg: 'bg-surface-interactive' });

  const density = useControlDensity();
  const sizeClasses = ACTION_BUTTON_CONTROL_SIZE_CLASSES[density];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(sizeClasses, classes)}
    >
      <Icon name={icon} className={cn(density === 'mobile' ? 'h-5 w-5' : 'h-4 w-4')} />
      {label}
    </button>
  );
});

ActionButton.displayName = 'ActionButton';

export const ActionChip = React.memo<ActionChipProps>(({
  icon,
  label,
  onClick,
  disabled = false,
  isActive = false,
}) => {
  const density = useControlDensity();
  const sizeClasses = ACTION_CHIP_CONTROL_SIZE_CLASSES[density];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(sizeClasses,
        isActive
          ? 'border-primary bg-primary/10 text-primary disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled'
          : surfaceVariantClasses({
              border: 'border-border',
              hoverBg: 'bg-surface-interactive',
            })
      )}
    >
      <Icon name={icon} className={cn(density === 'mobile' ? 'h-5 w-5' : 'h-4 w-4', isActive ? 'text-primary' : 'text-text-secondary')} />
      <span>{label}</span>
    </button>
  );
});

ActionChip.displayName = 'ActionChip';

export const TorrentActionsBar = React.memo<TorrentActionsBarProps>(({
  primaryActions,
  secondaryActions,
}) => {
  return (
    <section className="rounded-sm border border-border bg-surface p-1">
      {primaryActions}

      <div className="relative mt-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-surface to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2 pr-6">
            {secondaryActions}
          </div>
        </div>
      </div>
    </section>
  );
});

TorrentActionsBar.displayName = 'TorrentActionsBar';
