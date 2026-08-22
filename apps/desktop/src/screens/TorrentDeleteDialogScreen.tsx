import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { Checkbox, DialogActions } from '@taurent/web-ui';
import { useQBClient } from '../connection/QBClientProvider';
import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';
import { useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';

export function TorrentDeleteDialogScreen() {
  const { t } = useTaurentTranslation('desktop');
  const { t: tTorrent } = useTaurentTranslation('torrents');
  const { t: tCommon } = useTaurentTranslation('common');
  const formatError = useLocalizedErrorFormatter();
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const hashesParam = searchParams.get('hashes') ?? '';
  const hashes = hashesParam ? hashesParam.split(',') : [];
  const count = Number(searchParams.get('count') ?? '1');

  const [deleteFiles, setDeleteFiles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when the set of torrents changes (e.g. dialog reused for a different selection)
  useEffect(() => {
    setDeleteFiles(false);
    setError(null);
  }, [hashesParam]);

  useEffect(() => {
    void getCurrentWindow().setTitle(t('windows.deleteTorrent'));
  }, [t]);

  async function handleDelete() {
    setIsSubmitting(true);
    setError(null);
    try {
      await BridgeAdapter.torrents.delete(hashes, deleteFiles);
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: 'torrents',
      });
      await dismissDialogWindow();
    } catch (err) {
      setError(formatError(err, 'torrent-action'));
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  return (
    <div className="flex flex-col gap-4 p-5 pb-4 h-full">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-error/10 text-error">
          <AlertCircle size={ICON_SIZES.md} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-primary">
            {tTorrent('dialogs.delete.confirm', { count })}
          </p>
          <p className="text-xs text-text-secondary">
            {deleteFiles
              ? tTorrent('dialogs.delete.filesDeleted')
              : tTorrent('dialogs.delete.filesKept')}
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
        <Checkbox
          checked={deleteFiles}
          onChange={setDeleteFiles}
        />
        {tTorrent('dialogs.delete.alsoDeleteFiles')}
      </label>

      {error && (
        <p className="max-h-16 overflow-y-auto break-words whitespace-pre-wrap text-xs text-error">
          {error}
        </p>
      )}

      <DialogActions
        actions={[
          { label: tCommon('actions.cancel'), onClick: handleCancel, disabled: isSubmitting },
          {
            label: isSubmitting ? tTorrent('actions.deleting') : tCommon('actions.delete'),
            onClick: () => void handleDelete(),
            variant: 'danger',
            disabled: isSubmitting,
          },
        ]}
        stretch={false}
        className="mt-auto justify-end gap-3 pt-4"
      />
    </div>
  );
}
