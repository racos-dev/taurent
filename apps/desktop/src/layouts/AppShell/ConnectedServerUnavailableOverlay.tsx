import { useCallback, useState as useStatePrimitive } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQBClient } from '../../connection';
import { useConnectionHealth } from '@taurent/web-core/sync';
import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { createLogger } from '@taurent/shared/utils/logger';
import { DialogActions } from '@taurent/web-ui';

const logger = createLogger({ component: 'ConnectedServerUnavailableOverlay' });

/**
 * Full-window blocking overlay shown in the desktop AppShell when the app is
 * still connected to a server but either:
 *   - maindata polling has crossed the retrying threshold (T77.1), OR
 *   - protected non-maindata API requests have crossed the degraded threshold (T77.5)
 *
 * Auto-dismisses when health recovers. Exposes escape actions that navigate
 * to the public server list before disconnecting so AuthBoundary does not
 * bounce back through auto-connect.
 */
export function ConnectedServerUnavailableOverlay() {
  const navigate = useNavigate();
  const { disconnect } = useQBClient();
  const { state, serverIdentity: hookServerIdentity } = useConnectionHealth({
    useQBClient,
    fallbackIdentity: 'Current server',
  });

  const [isDisconnecting, setIsDisconnecting] = useStatePrimitive(false);

  const isUnavailable = state === 'connected_unavailable';

  const handleOpenServers = useCallback(async () => {
    logger.info('Open Servers: navigating to LoginScreen before disconnect');
    setIsDisconnecting(true);
    navigate('/login', { replace: true, state: { suppressConnectedRedirect: true } });
    try {
      await disconnect();
    } catch (err) {
      logger.error('disconnect() failed', err);
      setIsDisconnecting(false);
      return;
    }
    setIsDisconnecting(false);
  }, [disconnect, navigate, setIsDisconnecting]);

  if (!isUnavailable) return null;

  const serverIdentity = hookServerIdentity ?? 'Current server';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/60 backdrop-blur-sm p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="connected-server-unavailable-title"
        aria-describedby="connected-server-unavailable-message"
        className="w-full max-w-sm overflow-hidden rounded-sm border border-border bg-surface"
      >
        <div className="flex items-start gap-2 border-b border-border px-3 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-warning/10 text-warning">
            <AlertCircle size={ICON_SIZES.md} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="connected-server-unavailable-title"
              className="text-sm font-medium text-text-primary"
            >
              Current server unavailable
            </h2>
            <p
              id="connected-server-unavailable-message"
              className="mt-1 text-xs text-text-secondary"
            >
              <span className="font-medium text-text-primary">{serverIdentity}</span>{' '}
              is no longer responding. Taurent will keep retrying automatically, but the data on this screen may be out of date.
            </p>
          </div>
        </div>
        <DialogActions
          actions={[
            {
              label: 'Open Servers',
              onClick: () => {
                void handleOpenServers();
              },
              variant: 'primary',
              loading: isDisconnecting,
            },
          ]}
          className="px-3 py-2"
        />
      </div>
    </div>
  );
}
