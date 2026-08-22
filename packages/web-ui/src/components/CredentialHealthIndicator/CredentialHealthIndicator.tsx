import React from 'react';
import { cn, Icon } from '@taurent/shared';
import type { CredentialHealthIndicatorProps } from './types';
import { useTaurentTranslation } from '@taurent/shared/i18n';

const STATUS_CONFIG: Record<string, { icon: string; labelKey: `credentials.${string}`; toneClass: string } | null> = {
  stored: null,
  not_requested: null,
  unknown: null,
  missing: { icon: 'alert', labelKey: 'credentials.missing', toneClass: 'text-warning' },
  unavailable: { icon: 'x-circle', labelKey: 'credentials.unavailable', toneClass: 'text-error' },
  session_only: { icon: 'clock', labelKey: 'credentials.sessionOnly', toneClass: 'text-info' },
};

export const CredentialHealthIndicator = React.memo<CredentialHealthIndicatorProps>(
  ({ credentialStatus, className }) => {
    const { t } = useTaurentTranslation('auth');
    const config = STATUS_CONFIG[credentialStatus];
    if (!config) return null;

    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Icon name={config.icon as 'alert' | 'x-circle' | 'clock'} className={cn('h-4 w-4 shrink-0', config.toneClass)} />
        <span className={cn('text-xs', config.toneClass)}>{t(config.labelKey)}</span>
      </div>
    );
  },
);

CredentialHealthIndicator.displayName = 'CredentialHealthIndicator';
