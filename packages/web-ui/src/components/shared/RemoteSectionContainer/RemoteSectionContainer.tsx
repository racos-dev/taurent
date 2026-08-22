import React from 'react';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { Button } from '../../primitives/Button';
import { RetryButton } from '../RetryButton';
import { SettingsCard } from '../../settings/SettingsCard';
import { StatusPanel } from '../StatusPanel';
import type { RemoteSectionContainerProps } from './types';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export const RemoteSectionContainer = React.memo<RemoteSectionContainerProps>(({
  isLoading,
  error,
  connectionError,
  saveError,
  hasActiveServer,
  hasSavedServers,
  currentServerName,
  preferences,
  onRetry,
  onOpenServerOverview,
  children,
}) => {
  const { t } = useTaurentTranslation('settings');
  const noServerDescription = hasSavedServers
    ? t('remoteStatus.selectActiveServer')
    : t('remoteStatus.addServerFirst');

  return (
    <div className="max-w-3xl space-y-3">
      {!hasActiveServer ? (
        <SettingsCard
          title={t('remoteStatus.noActiveServer')}
          description={noServerDescription}
        >
          <div className="mt-3">
            <Button variant="outline" onClick={onOpenServerOverview}>
              {t('remoteStatus.reviewServers')}
            </Button>
          </div>
        </SettingsCard>
      ) : isLoading ? (
        <StatusPanel
          title={t('remoteStatus.loading')}
          description={t('remoteStatus.fetchingFrom', { name: currentServerName ?? t('remoteStatus.activeServer') })}
        />
      ) : connectionError ? (
        <SettingsCard
          title={t('remoteStatus.connectionFailed')}
          description={t('remoteStatus.couldNotReach')}
        >
          <div className="rounded-sm border border-error bg-error-20 px-3 py-3 text-sm text-error">
            {connectionError}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <RetryButton onClick={onRetry} label={t('remoteStatus.retryConnection')} />
            <Button variant="ghost" onClick={onOpenServerOverview}>
              {t('remoteStatus.reviewServers')}
            </Button>
          </div>
        </SettingsCard>
      ) : error ? (
        <SettingsCard
          title={t('remoteStatus.loadFailed')}
          description={t('remoteStatus.couldNotFetch')}
        >
          <div className="rounded-sm border border-error bg-error-20 px-3 py-3 text-sm text-error">
            {formatUserMessageForContext(error, 'settings-load')}
          </div>
          <div className="mt-4">
            <RetryButton onClick={onRetry} label={t('remoteStatus.retryLoad')} />
          </div>
        </SettingsCard>
      ) : !preferences ? (
        <SettingsCard
          title={t('remoteStatus.notReady')}
          description={t('remoteStatus.waiting')}
        >
          <div className="mt-3">
            <RetryButton onClick={onRetry} label={t('remoteStatus.retryLoad')} />
          </div>
        </SettingsCard>
      ) : (
        <>
          {saveError ? (
            <SettingsCard
              title={t('remoteStatus.saveFailed')}
              description={t('remoteStatus.writeFailed')}
            >
              <div className="rounded-sm border border-error bg-error-20 px-3 py-3 text-sm text-error">
                {formatUserMessageForContext(saveError, 'settings-save')}
              </div>
            </SettingsCard>
          ) : null}

          {children}
        </>
      )}
    </div>
  );
});

RemoteSectionContainer.displayName = 'RemoteSectionContainer';
