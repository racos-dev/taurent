import { useCallback, useEffect, useMemo, useState } from 'react';

import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
import type { AppUpdateInfo, AppUpdateProgress } from '@taurent/bridge/contracts';
import { Button, ProgressBar } from '@taurent/web-ui';

const RELEASE_URL = 'https://github.com/racos-dev/taurent/releases/latest';

type UpdateBannerState =
  | { status: 'hidden' }
  | { status: 'available'; update: AppUpdateInfo }
  | { status: 'installing'; update: AppUpdateInfo; downloaded: number; contentLength: number | null }
  | { status: 'installed'; update: AppUpdateInfo }
  | { status: 'error'; update: AppUpdateInfo; message: string };

let startupCheckCompleted = false;

function progressRatio(downloaded: number, contentLength: number | null): number {
  if (!contentLength || contentLength <= 0) return 0;
  return Math.min(downloaded / contentLength, 1);
}

function isWindowsRuntime(): boolean {
  return navigator.userAgent.includes('Windows');
}

export function AppUpdateBanner() {
  const [state, setState] = useState<UpdateBannerState>({ status: 'hidden' });

  useEffect(() => {
    if (startupCheckCompleted) return;
    startupCheckCompleted = true;

    void BridgeAdapter.checkForUpdate()
      .then((update) => {
        if (update) {
          setState({ status: 'available', update });
        }
      })
      .catch(() => {
        // Startup update checks stay quiet. Manual checks surface errors in About.
      });
  }, []);

  const handleInstall = useCallback(async (update: AppUpdateInfo) => {
    setState({ status: 'installing', update, downloaded: 0, contentLength: null });

    try {
      await BridgeAdapter.downloadAndInstallUpdate((event: AppUpdateProgress) => {
        if (event.event === 'Started') {
          setState({ status: 'installing', update, downloaded: 0, contentLength: event.contentLength });
          return;
        }
        if (event.event === 'Progress') {
          setState({
            status: 'installing',
            update,
            downloaded: event.downloaded,
            contentLength: event.contentLength,
          });
          return;
        }
        setState({ status: 'installing', update, downloaded: event.downloaded, contentLength: event.contentLength });
      });
      setState({ status: 'installed', update });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update install failed.';
      setState({ status: 'error', update, message });
    }
  }, []);

  const handleRelease = useCallback(() => {
    window.open(RELEASE_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const copy = useMemo(() => {
    if (state.status === 'hidden') return null;
    if (state.status === 'installed') {
      return {
        title: 'Update installed',
        body: 'Relaunch Taurent to finish updating.',
      };
    }
    if (state.status === 'installing') {
      return {
        title: `Installing Taurent v${state.update.version}`,
        body: state.contentLength ? 'Downloading update package.' : 'Downloading update package...',
      };
    }
    if (state.status === 'error') {
      return {
        title: 'Update failed',
        body: state.message,
      };
    }
    return {
      title: `Taurent v${state.update.version} is available`,
      body: isWindowsRuntime()
        ? 'Install when ready. On Windows, the app may close immediately during installation.'
        : 'Install when ready, or view the release notes first.',
    };
  }, [state]);

  if (state.status === 'hidden' || !copy) return null;

  const progress = state.status === 'installing'
    ? progressRatio(state.downloaded, state.contentLength)
    : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-sm border border-border bg-surface p-3 shadow-lg">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{copy.title}</h2>
          <p className="mt-1 text-xs text-text-secondary">{copy.body}</p>
        </div>

        {state.status === 'installing' ? (
          <ProgressBar progress={progress} size="sm" showLabel={state.contentLength !== null} />
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {state.status === 'available' || state.status === 'error' ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleRelease}>View release</Button>
              <Button variant="secondary" size="sm" onClick={() => setState({ status: 'hidden' })}>Later</Button>
              <Button variant="primary" size="sm" onClick={() => void handleInstall(state.update)}>Update</Button>
            </>
          ) : null}
          {state.status === 'installed' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setState({ status: 'hidden' })}>Later</Button>
              <Button variant="primary" size="sm" onClick={() => void BridgeAdapter.relaunchApp()}>Relaunch</Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
