import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { emit } from '@tauri-apps/api/event';
import { Window, getCurrentWindow } from '@tauri-apps/api/window';
import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { DialogActions } from '@taurent/web-ui';
import { useQBClient, useServerManager } from '../connection';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';

export function ServerDeleteDialogScreen() {
  const [searchParams] = useSearchParams();
  const serverId = searchParams.get('serverId') ?? '';
  const serverName = searchParams.get('serverName') ?? '';
  const { servers, removeServer } = useServerManager();
  const { serverId: activeServerId, disconnect } = useQBClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getCurrentWindow().setTitle('Delete Server');
  }, []);

  useEffect(() => {
    setError(null);
  }, [serverId]);

  async function handleDelete() {
    if (!serverId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const wasActive = serverId === activeServerId;
      const remainingServers = servers.filter((server) => server.id !== serverId);

      await removeServer(serverId);

      if (wasActive) {
        await disconnect();
      }

      await emit('server-list-changed', {});

      if (remainingServers.length === 0) {
        const settingsWindow = await Window.getByLabel('settings');
        await settingsWindow?.hide();
      }

      await dismissDialogWindow();
    } catch (err) {
      setError(formatUserMessageForContext(err, 'settings-save'));
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  return (
    <div className="flex h-full flex-col gap-4 p-5 pb-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-error/10 text-error">
          <AlertCircle size={ICON_SIZES.md} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-primary">
            Delete {serverName ? `"${serverName}"` : 'this server'}?
          </p>
          <p className="text-xs text-text-secondary">
            This removes the saved server profile and cannot be undone.
          </p>
        </div>
      </div>

      {error && (
        <p className="max-h-16 overflow-y-auto whitespace-pre-wrap break-words text-xs text-error">
          {error}
        </p>
      )}

      <DialogActions
        actions={[
          { label: 'Cancel', onClick: handleCancel, disabled: isSubmitting },
          {
            label: isSubmitting ? 'Deleting...' : 'Delete',
            onClick: () => void handleDelete(),
            variant: 'danger',
            disabled: isSubmitting || !serverId,
          },
        ]}
        stretch={false}
        className="mt-auto justify-end gap-3 pt-4"
      />
    </div>
  );
}
