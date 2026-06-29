import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { DialogActions } from '@taurent/web-ui';
import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { useQBClient } from '../connection/QBClientProvider';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';

export function ConfirmDialogScreen() {
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const name = searchParams.get('name') ?? '';
  const type = (searchParams.get('type') ?? 'category') as 'category' | 'tag';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const title = type === 'category' ? 'Delete Category' : 'Delete Tag';
    void getCurrentWindow().setTitle(title);
  }, [type]);

  // Reset error when item changes (singleton reuse)
  useEffect(() => {
    setError(null);
  }, [name]);

  async function handleDelete() {
    setIsSubmitting(true);
    setError(null);
    try {
      if (type === 'category') {
        await BridgeAdapter.categories.removeCategories([name]);
        await emit('resource-invalidated', {
          session_generation: sessionGeneration,
          server_id: serverId,
          resource: 'categories',
        });
      } else {
        await BridgeAdapter.tags.deleteTags([name]);
        await emit('resource-invalidated', {
          session_generation: sessionGeneration,
          server_id: serverId,
          resource: 'tags',
        });
      }
      await dismissDialogWindow();
    } catch (err) {
      setError(formatUserMessageForContext(err, 'torrent-action'));
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  const message =
    type === 'category'
      ? `Torrents in "${name}" will become uncategorized.`
      : `"${name}" will be removed from all torrents.`;

  return (
    <div className="flex flex-col gap-4 p-5 pb-4 h-full">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-error/10 text-error">
          <AlertCircle size={ICON_SIZES.md} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-primary">
            Delete &ldquo;{name}&rdquo;?
          </p>
          <p className="text-xs text-text-secondary">{message}</p>
        </div>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

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
