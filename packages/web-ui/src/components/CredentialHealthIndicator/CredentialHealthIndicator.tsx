import React from 'react';
import { cn, Icon } from '@taurent/shared';
import type { CredentialHealthIndicatorProps } from './types';

const STATUS_CONFIG: Record<string, { icon: string; label: string; toneClass: string } | null> = {
  stored: null,
  not_requested: null,
  unknown: null,
  missing: { icon: 'alert', label: 'No credentials', toneClass: 'text-warning' },
  unavailable: { icon: 'x-circle', label: 'Unavailable', toneClass: 'text-error' },
  session_only: { icon: 'clock', label: 'Session only', toneClass: 'text-info' },
};

export const CredentialHealthIndicator = React.memo<CredentialHealthIndicatorProps>(
  ({ credentialStatus, className }) => {
    const config = STATUS_CONFIG[credentialStatus];
    if (!config) return null;

    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Icon name={config.icon as 'alert' | 'x-circle' | 'clock'} className={cn('h-4 w-4 shrink-0', config.toneClass)} />
        <span className={cn('text-xs', config.toneClass)}>{config.label}</span>
      </div>
    );
  },
);

CredentialHealthIndicator.displayName = 'CredentialHealthIndicator';
