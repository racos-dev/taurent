import React, { useCallback, useMemo, useState } from 'react';

import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
import type { AppUpdateInfo, AppUpdateProgress } from '@taurent/bridge/contracts';
import { Button, ExternalLink, ProgressBar } from '@taurent/web-ui';
import { appBuildMetadata } from '../../buildMetadata';
import { useTaurentTranslation } from '@taurent/shared/i18n';

type UpdateSettingsState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; update: AppUpdateInfo }
  | { status: 'not-available' }
  | { status: 'error'; operation: 'check' | 'install' }
  | { status: 'installing'; update: AppUpdateInfo; downloaded: number; contentLength: number | null }
  | { status: 'installed'; update: AppUpdateInfo };

const RELEASE_URL = 'https://github.com/racos-dev/taurent/releases/latest';

function progressRatio(downloaded: number, contentLength: number | null): number {
  if (!contentLength || contentLength <= 0) return 0;
  return Math.min(downloaded / contentLength, 1);
}

export const DesktopAboutSettings = React.memo(() => {
  const { t } = useTaurentTranslation('settings');
  const [updateState, setUpdateState] = useState<UpdateSettingsState>({ status: 'idle' });

  const handleCheck = useCallback(async () => {
    setUpdateState({ status: 'checking' });
    try {
      const update = await BridgeAdapter.checkForUpdate();
      setUpdateState(update ? { status: 'available', update } : { status: 'not-available' });
    } catch {
      setUpdateState({ status: 'error', operation: 'check' });
    }
  }, []);

  const handleInstall = useCallback(async (update: AppUpdateInfo) => {
    setUpdateState({ status: 'installing', update, downloaded: 0, contentLength: null });
    try {
      await BridgeAdapter.downloadAndInstallUpdate((event: AppUpdateProgress) => {
        if (event.event === 'Started') {
          setUpdateState({ status: 'installing', update, downloaded: 0, contentLength: event.contentLength });
          return;
        }
        if (event.event === 'Progress') {
          setUpdateState({
            status: 'installing',
            update,
            downloaded: event.downloaded,
            contentLength: event.contentLength,
          });
          return;
        }
        setUpdateState({ status: 'installing', update, downloaded: event.downloaded, contentLength: event.contentLength });
      });
      setUpdateState({ status: 'installed', update });
    } catch {
      setUpdateState({ status: 'error', operation: 'install' });
    }
  }, []);

  const updateMessage = useMemo(() => {
    switch (updateState.status) {
      case 'checking':
        return t('aboutSettings.checking');
      case 'available':
        return t('aboutSettings.available', { version: updateState.update.version });
      case 'not-available':
        return t('aboutSettings.upToDate');
      case 'error':
        return t(updateState.operation === 'check' ? 'aboutSettings.checkFailed' : 'aboutSettings.installFailed');
      case 'installing':
        return t(updateState.contentLength ? 'aboutSettings.downloading' : 'aboutSettings.downloadingUnknown');
      case 'installed':
        return t('aboutSettings.installed');
      case 'idle':
      default:
        return t('aboutSettings.stableOnly');
    }
  }, [t, updateState]);

  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <div className="flex flex-col items-center text-center">
        <img
          src="/logo.svg"
          alt={t('aboutSettings.iconAlt')}
          className="mb-3 h-10 w-10 rounded-sm"
          draggable={false}
        />
        <h2 className="text-sm font-semibold text-text-primary">Taurent</h2>
        <p className="mt-1 text-xs text-text-secondary">{t('screen.version', { version: appBuildMetadata.version })}</p>
        {appBuildMetadata.diagnostics.length > 0 ? (
          <p className="mt-1 text-xs text-text-muted">{appBuildMetadata.diagnostics.join(' · ')}</p>
        ) : null}
        <p className="mt-2 text-xs text-text-muted">
          {t('aboutSettings.builtBy')}
        </p>
        <ExternalLink
          href="https://github.com/racos-dev/taurent"
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          {t('aboutSettings.viewGithub')}
        </ExternalLink>
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-col gap-3">
          <div className="text-center">
            <h3 className="text-xs font-semibold text-text-primary">{t('aboutSettings.updates')}</h3>
            <p className="mt-1 text-xs text-text-secondary">{updateMessage}</p>
            {updateState.status === 'installing' ? (
              <ProgressBar
                className="mt-3"
                progress={progressRatio(updateState.downloaded, updateState.contentLength)}
                size="sm"
                showLabel={updateState.contentLength !== null}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {updateState.status === 'available' ? (
              <>
                <ExternalLink
                  href={RELEASE_URL}
                  className="inline-flex h-9 items-center rounded-sm px-3 text-xs font-medium text-primary hover:underline"
                >
                  {t('aboutSettings.viewRelease')}
                </ExternalLink>
                <Button variant="primary" size="sm" onClick={() => void handleInstall(updateState.update)}>
                  {t('aboutSettings.update')}
                </Button>
              </>
            ) : null}
            {updateState.status === 'installed' ? (
              <Button variant="primary" size="sm" onClick={() => void BridgeAdapter.relaunchApp()}>
                {t('aboutSettings.relaunch')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={updateState.status === 'checking'}
                disabled={updateState.status === 'installing'}
                onClick={() => void handleCheck()}
              >
                {t('aboutSettings.check')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

DesktopAboutSettings.displayName = 'DesktopAboutSettings';
