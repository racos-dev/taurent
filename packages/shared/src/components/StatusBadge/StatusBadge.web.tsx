import React from 'react';
import type { StatusBadgeWebProps, StatusType, StatusBadgeSize } from './types';
import { cn } from '@taurent/shared';

const statusConfig: Record<
  StatusType,
  { colorClass: string; bgClass: string; bgAlphaClass: string; borderClass: string; label: string }
> = {
  downloading: { colorClass: 'text-status-downloading', bgClass: 'bg-status-downloading', bgAlphaClass: 'bg-status-downloading-15', borderClass: 'border-status-downloading', label: 'Downloading' },
  seeding: { colorClass: 'text-status-seeding', bgClass: 'bg-status-seeding', bgAlphaClass: 'bg-status-seeding-15', borderClass: 'border-status-seeding', label: 'Seeding' },
  paused: { colorClass: 'text-status-paused', bgClass: 'bg-status-paused', bgAlphaClass: 'bg-status-paused-15', borderClass: 'border-status-paused', label: 'Paused' },
  completed: { colorClass: 'text-status-seeding', bgClass: 'bg-status-seeding', bgAlphaClass: 'bg-status-seeding-15', borderClass: 'border-status-seeding', label: 'Completed' },
  error: { colorClass: 'text-error', bgClass: 'bg-error', bgAlphaClass: 'bg-error-20', borderClass: 'border-error', label: 'Error' },
  uploading: { colorClass: 'text-status-seeding', bgClass: 'bg-status-seeding', bgAlphaClass: 'bg-status-seeding-15', borderClass: 'border-status-seeding', label: 'Uploading' },
  connected: { colorClass: 'text-success', bgClass: 'bg-success', bgAlphaClass: 'bg-success-20', borderClass: 'border-success', label: 'Connected' },
  disconnected: { colorClass: 'text-error', bgClass: 'bg-error', bgAlphaClass: 'bg-error-20', borderClass: 'border-error', label: 'Disconnected' },
  active: { colorClass: 'text-primary', bgClass: 'bg-primary', bgAlphaClass: 'bg-primary-10', borderClass: 'border-primary', label: 'Active' },
  inactive: { colorClass: 'text-status-inactive', bgClass: 'bg-status-inactive', bgAlphaClass: 'bg-status-inactive-15', borderClass: 'border-status-inactive', label: 'Inactive' },
  checking: { colorClass: 'text-status-checking', bgClass: 'bg-status-checking', bgAlphaClass: 'bg-status-checking-15', borderClass: 'border-status-checking', label: 'Checking' },
  moving: { colorClass: 'text-status-checking', bgClass: 'bg-status-checking', bgAlphaClass: 'bg-status-checking-15', borderClass: 'border-status-checking', label: 'Moving' },
  'tracker-working': { colorClass: 'text-success', bgClass: 'bg-success', bgAlphaClass: 'bg-success-20', borderClass: 'border-success', label: 'Working' },
  'tracker-error': { colorClass: 'text-error', bgClass: 'bg-error', bgAlphaClass: 'bg-error-20', borderClass: 'border-error', label: 'Error' },
  'tracker-disabled': { colorClass: 'text-text-secondary', bgClass: 'bg-surface-elevated', bgAlphaClass: 'bg-surface-elevated', borderClass: 'border-border', label: 'Disabled' },
  'tracker-pending': { colorClass: 'text-warning', bgClass: 'bg-warning', bgAlphaClass: 'bg-warning-20', borderClass: 'border-warning', label: 'Pending' },
  'tracker-updating': { colorClass: 'text-primary', bgClass: 'bg-primary', bgAlphaClass: 'bg-primary-10', borderClass: 'border-primary', label: 'Updating' },
};

const sizeStyles: Record<StatusBadgeSize, { padding: string; fontSize: string; dotSize: number }> = {
  small: { padding: 'px-1 py-1', fontSize: 'text-xs', dotSize: 6 },
  medium: { padding: 'px-2 py-1', fontSize: 'text-xs', dotSize: 8 },
};

export const StatusBadge: React.FC<StatusBadgeWebProps> = React.memo(({
  status,
  label: customLabel,
  showDot = false,
  size = 'medium',
  transparent = false,
  onClick,
  className = '',
}) => {
  const config = statusConfig[status];
  const { padding, fontSize, dotSize } = sizeStyles[size];
  const label = customLabel || config.label;

  const baseStyles = cn(
    'inline-flex items-center gap-2 rounded-sm font-medium',
    padding,
    fontSize,
    transparent ? `border ${config.borderClass || 'border-border'}` : config.bgAlphaClass,
    onClick ? 'cursor-pointer hover:opacity-80' : '',
    className,
  );

  const content = (
    <>
      {showDot && (
        <span
          className={`inline-block rounded-full ${config.bgClass}`}
          style={{ width: dotSize, height: dotSize }}
        />
      )}
      {label && (
        <span className={config.colorClass}>
          {label}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={baseStyles}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <span className={baseStyles}>{content}</span>;
});

StatusBadge.displayName = 'StatusBadge';

export const StatusDot: React.FC<{ status: StatusType; size?: number }> = React.memo(({
  status,
  size = 8,
}) => {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-block rounded-full ${config.bgClass}`}
      style={{ width: size, height: size }}
    />
  );
});

StatusDot.displayName = 'StatusDot';
