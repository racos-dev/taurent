import React from 'react';
import { cn, Icon } from '@taurent/shared';
import type { CredentialWarningBannerProps } from './types';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export const CredentialWarningBanner = React.memo<CredentialWarningBannerProps>(
  ({ warning, credentialStatus, onDismiss, action, className }) => {
    const { t } = useTaurentTranslation('common');
    const { t: tAuth } = useTaurentTranslation('auth');
    const localizedWarning = credentialStatus === 'missing'
      ? tAuth('credentials.missingWarning')
      : credentialStatus === 'unavailable'
        ? tAuth('credentials.unavailableWarning')
        : credentialStatus === 'session_only'
          ? tAuth('credentials.sessionOnlyWarning')
          : warning;
    return (
      <div className={cn('flex items-start gap-2 rounded-sm bg-warning-20 border border-warning/40 px-3 py-2', className)}>
        <Icon name="alert" className="h-4 w-4 shrink-0 text-warning" />
        <p className="text-xs text-warning flex-1">{localizedWarning}</p>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {onDismiss ? (
            <button
              onClick={onDismiss}
              className="flex items-center justify-center h-5 w-5 rounded-sm text-warning hover:bg-warning-20 opacity-70 hover:opacity-100"
              aria-label={t('actions.dismiss')}
            >
              <Icon name="x" className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    );
  },
);

CredentialWarningBanner.displayName = 'CredentialWarningBanner';
