import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { Checkbox, DialogActions } from '@taurent/web-ui';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { useQBClient } from '../connection/QBClientProvider';
import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';

export function TorrentDeleteDialogScreen() {
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
    void getCurrentWindow().setTitle('Delete Torrent');
  }, []);

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
      setError(formatUserMessageForContext(err, 'torrent-action'));
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  const torrentLabel = count === 1 ? 'this torrent' : `${count} torrents`;

  return (
    <div className="flex flex-col gap-4 p-5 pb-4 h-full">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-error/10 text-error">
          <AlertCircle size={ICON_SIZES.md} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-primary">
            Delete {torrentLabel}?
          </p>
          <p className="text-xs text-text-secondary">
            {deleteFiles
              ? 'Torrents and their files will be permanently deleted.'
              : 'Torrents will be removed. Downloaded files will be kept.'}
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
        <Checkbox
          checked={deleteFiles}
          onChange={setDeleteFiles}
        />
        Also delete files
      </label>

      {error && (
        <p className="max-h-16 overflow-y-auto break-words whitespace-pre-wrap text-xs text-error">
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
            disabled: isSubmitting,
          },
        ]}
        stretch={false}
        className="mt-auto justify-end gap-3 pt-4"
      />
    </div>
  );
}
