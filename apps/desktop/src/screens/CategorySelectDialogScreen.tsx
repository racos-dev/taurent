import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { DialogActions } from '@taurent/web-ui';
import { extractHttpReason } from '@taurent/shared/utils/error';
import { useQBClient } from '../connection/QBClientProvider';
import { useCategories } from '../hooks/platform/useCategories';
import { useLiveTorrentByHash } from '../hooks/torrents/useLiveTorrentByHash';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';
import { useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';

export function CategorySelectDialogScreen() {
  const { t } = useTaurentTranslation('desktop');
  const { t: tDialogs } = useTaurentTranslation('dialogs');
  const { t: tCommon } = useTaurentTranslation('common');
  const formatError = useLocalizedErrorFormatter();
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const hashesParam = searchParams.get('hashes') ?? '';
  const hashes = hashesParam ? hashesParam.split(',') : [];

  const { categories } = useCategories();

  // Single-torrent lookup for category display
  const singleTorrent = useLiveTorrentByHash(hashes.length === 1 ? hashes[0] : null);

  const categoryNames = categories ? Object.keys(categories) : [];

  const [error, setError] = useState<unknown | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void getCurrentWindow().setTitle(t('windows.category'));
  }, [t]);

  async function handleSelect(category: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      await BridgeAdapter.torrents.setCategory(hashes, category);
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: 'torrents',
      });
      await dismissDialogWindow();
    } catch (err) {
      console.error('Failed to set category:', extractHttpReason(err));
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset() {
    setError(null);
    setIsSubmitting(true);
    try {
      await BridgeAdapter.torrents.setCategory(hashes, '');
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: 'torrents',
      });
      await dismissDialogWindow();
    } catch (err) {
      console.error('Failed to reset category:', extractHttpReason(err));
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  // Determine current category for single selection
  const currentCategory = singleTorrent?.category ?? '';

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-medium text-text-secondary">
          {tDialogs('desktop.selectCategory', { count: hashes.length })}
        </p>
      </div>

      {error !== null && (
        <div className="px-3 py-2 bg-error-20 border-b border-error text-xs text-error">
          {formatError(error, 'torrent-action')}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-left text-xs text-text-primary hover:bg-surface-interactive transition-colors disabled:text-text-disabled"
        >
          <span className={currentCategory === '' ? 'font-semibold text-primary' : ''}>
            {tDialogs('desktop.resetCategory')}
          </span>
        </button>

        {categoryNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => void handleSelect(name)}
            disabled={isSubmitting}
            className="w-full px-3 py-2 text-left text-xs text-text-primary hover:bg-surface-interactive transition-colors disabled:text-text-disabled"
          >
            <span className={currentCategory === name ? 'font-semibold text-primary' : ''}>
              {name || tDialogs('desktop.unnamedCategory')}
            </span>
          </button>
        ))}

        {categoryNames.length === 0 && (
          <div className="px-3 py-4 text-xs text-text-muted text-center">
            {tDialogs('desktop.noCategories')}
          </div>
        )}
      </div>

      <DialogActions
        actions={[{ label: tCommon('actions.cancel'), onClick: handleCancel }]}
        className="border-t border-border px-3 py-2"
        actionClassName="w-full"
      />
    </div>
  );
}
