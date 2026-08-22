/**
 * MobileConnectionBanner — shows a blocking modal when the connected server
 * becomes unavailable. Offers a "Switch Server" action that disconnects and
 * navigates to /servers. Auto-dismisses when the connection recovers.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogActions } from '@taurent/web-ui';
import { useConnectionHealth } from '@taurent/web-core/sync';
import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { createLogger } from '@taurent/shared/utils/logger';

import { useQBClient } from '../connection';
import { useTaurentTranslation } from '@taurent/shared/i18n';

const logger = createLogger({ component: 'MobileConnectionBanner' });

export function MobileConnectionBanner() {
  const { t } = useTaurentTranslation('auth');
  const navigate = useNavigate();
  const { disconnect } = useQBClient();
  const { state, serverIdentity } = useConnectionHealth({
    useQBClient,
    fallbackIdentity: t('server.current'),
  });

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleSwitchServer = useCallback(async () => {
    logger.info('Switch Server: awaiting disconnect before navigation');
    setIsDisconnecting(true);
    try {
      await disconnect();
    } catch (err) {
      logger.error('disconnect() failed', err);
      setIsDisconnecting(false);
      return;
    }
    setIsDisconnecting(false);
    navigate('/servers');
  }, [disconnect, navigate]);

  const identity = serverIdentity ?? t('server.current');

  if (state === 'connected_unavailable') {
    return (
      <Dialog
        isOpen
        onClose={() => {
          // Intentionally a no-op: the unavailable modal is blocking —
          // users must switch server or wait for the connection to recover.
        }}
        maxWidth="sm"
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="mobile-server-unavailable-title"
          aria-describedby="mobile-server-unavailable-message"
          className="overflow-hidden rounded-sm border border-border bg-surface"
        >
          <div className="flex items-start gap-2 border-b border-border px-3 py-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-warning/10 text-warning">
              <AlertCircle size={ICON_SIZES.md} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="mobile-server-unavailable-title"
                className="text-sm font-medium text-text-primary"
              >
                {t('server.unavailable')}
              </h2>
              <p
                id="mobile-server-unavailable-message"
                className="mt-1 text-xs text-text-secondary"
              >
                {t('server.unavailableMessage', { name: identity })}
              </p>
            </div>
          </div>
          <DialogActions
            actions={[
              {
                label: t('server.switch'),
                onClick: () => {
                  void handleSwitchServer();
                },
                variant: 'primary',
                loading: isDisconnecting,
              },
            ]}
            className="px-3 py-2"
          />
        </div>
      </Dialog>
    );
  }

  return null;
}
