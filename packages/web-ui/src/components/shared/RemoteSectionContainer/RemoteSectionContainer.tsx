import React from 'react';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { Button } from '../../primitives/Button';
import { RetryButton } from '../RetryButton';
import { SettingsCard } from '../../settings/SettingsCard';
import { StatusPanel } from '../StatusPanel';
import type { RemoteSectionContainerProps } from './types';

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
  const noServerDescription = hasSavedServers
    ? 'Select an active server in the main app to load remote preferences here.'
    : 'Add a qBittorrent server in the main app to unlock remote preferences here.';

  return (
    <div className="max-w-3xl space-y-3">
      {!hasActiveServer ? (
        <SettingsCard
          title="No active server"
          description={noServerDescription}
        >
          <div className="mt-3">
            <Button variant="outline" onClick={onOpenServerOverview}>
              Review saved servers
            </Button>
          </div>
        </SettingsCard>
      ) : isLoading ? (
        <StatusPanel
          title="Loading remote preferences"
          description={`Fetching settings from ${currentServerName ?? 'the active server'}…`}
        />
      ) : connectionError ? (
        <SettingsCard
          title="Connection failed"
          description="Could not reach the active server."
        >
          <div className="rounded-sm border border-error bg-error-20 px-3 py-3 text-sm text-error">
            {connectionError}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <RetryButton onClick={onRetry} label="Retry server connection" />
            <Button variant="ghost" onClick={onOpenServerOverview}>
              Review saved servers
            </Button>
          </div>
        </SettingsCard>
      ) : error ? (
        <SettingsCard
          title="Failed to load remote preferences"
          description="Could not fetch preferences from the server."
        >
          <div className="rounded-sm border border-error bg-error-20 px-3 py-3 text-sm text-error">
            {formatUserMessageForContext(error, 'settings-load')}
          </div>
          <div className="mt-4">
            <RetryButton onClick={onRetry} label="Retry remote load" />
          </div>
        </SettingsCard>
      ) : !preferences ? (
        <SettingsCard
          title="Remote preferences not ready"
          description="Waiting for the active server to finish connecting."
        >
          <div className="mt-3">
            <RetryButton onClick={onRetry} label="Retry remote load" />
          </div>
        </SettingsCard>
      ) : (
        <>
          {saveError ? (
            <SettingsCard
              title="Remote save failed"
              description="The last preference write to the server failed."
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
