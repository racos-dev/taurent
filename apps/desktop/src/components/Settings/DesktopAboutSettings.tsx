import React, { useCallback, useMemo, useState } from 'react';

import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
import type { AppUpdateInfo, AppUpdateProgress } from '@taurent/bridge/contracts';
import { Button, ProgressBar } from '@taurent/web-ui';
import { appBuildMetadata } from '../../buildMetadata';

type UpdateSettingsState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; update: AppUpdateInfo }
  | { status: 'not-available' }
  | { status: 'error'; message: string }
  | { status: 'installing'; update: AppUpdateInfo; downloaded: number; contentLength: number | null }
  | { status: 'installed'; update: AppUpdateInfo };

const RELEASE_URL = 'https://github.com/racos-dev/taurent/releases/latest';

function progressRatio(downloaded: number, contentLength: number | null): number {
  if (!contentLength || contentLength <= 0) return 0;
  return Math.min(downloaded / contentLength, 1);
}

export const DesktopAboutSettings = React.memo(() => {
  const [updateState, setUpdateState] = useState<UpdateSettingsState>({ status: 'idle' });

  const handleCheck = useCallback(async () => {
    setUpdateState({ status: 'checking' });
    try {
      const update = await BridgeAdapter.checkForUpdate();
      setUpdateState(update ? { status: 'available', update } : { status: 'not-available' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to check for updates.';
      setUpdateState({ status: 'error', message });
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to install update.';
      setUpdateState({ status: 'error', message });
    }
  }, []);

  const updateMessage = useMemo(() => {
    switch (updateState.status) {
      case 'checking':
        return 'Checking for updates...';
      case 'available':
        return `Taurent v${updateState.update.version} is available.`;
      case 'not-available':
        return 'Taurent is up to date.';
      case 'error':
        return updateState.message;
      case 'installing':
        return updateState.contentLength ? 'Downloading update package.' : 'Downloading update package...';
      case 'installed':
        return 'Update installed. Relaunch Taurent to finish.';
      case 'idle':
      default:
        return 'Stable GitHub releases only.';
    }
  }, [updateState]);

  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <div className="flex flex-col items-center text-center">
        <img
          src="/logo.svg"
          alt="Taurent app icon"
          className="mb-3 h-10 w-10 rounded-sm"
          draggable={false}
        />
        <h2 className="text-sm font-semibold text-text-primary">Taurent</h2>
        <p className="mt-1 text-xs text-text-secondary">Version {appBuildMetadata.version}</p>
        {appBuildMetadata.diagnostics.length > 0 ? (
          <p className="mt-1 text-xs text-text-muted">{appBuildMetadata.diagnostics.join(' · ')}</p>
        ) : null}
        <p className="mt-2 text-xs text-text-muted">
          Built by racos.dev
        </p>
        <a
          href="https://github.com/racos-dev/taurent"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          View on GitHub
        </a>
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-col gap-3">
          <div className="text-center">
            <h3 className="text-xs font-semibold text-text-primary">Updates</h3>
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
                <a
                  href={RELEASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-sm px-3 text-xs font-medium text-primary hover:underline"
                >
                  View release
                </a>
                <Button variant="primary" size="sm" onClick={() => void handleInstall(updateState.update)}>
                  Update
                </Button>
              </>
            ) : null}
            {updateState.status === 'installed' ? (
              <Button variant="primary" size="sm" onClick={() => void BridgeAdapter.relaunchApp()}>
                Relaunch
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={updateState.status === 'checking'}
                disabled={updateState.status === 'installing'}
                onClick={() => void handleCheck()}
              >
                Check for updates
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

DesktopAboutSettings.displayName = 'DesktopAboutSettings';
