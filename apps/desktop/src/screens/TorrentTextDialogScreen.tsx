import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { DialogActions, Input } from '@taurent/web-ui';
import { useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';
import { useQBClient } from '../connection/QBClientProvider';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';

export function TorrentTextDialogScreen() {
  const { t } = useTaurentTranslation('torrents');
  const { t: tCommon } = useTaurentTranslation('common');
  const formatError = useLocalizedErrorFormatter();
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const type = (searchParams.get('type') ?? 'rename') as 'rename' | 'setLocation';
  const initialValue = searchParams.get('value') ?? '';
  const hashesParam = searchParams.get('hashes') ?? '';
  const hashes = hashesParam ? hashesParam.split(',') : [];

  const [inputValue, setInputValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const title = t(type === 'rename' ? 'details.screen.renameTitle' : 'dialogs.text.setLocation');
    void getCurrentWindow().setTitle(title);
  }, [t, type]);

  useEffect(() => {
    setInputValue(initialValue);
    setError(null);
  }, [initialValue, type]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [initialValue, type]);

  const isSingle = hashes.length === 1;
  const canSubmit = inputValue.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (type === 'rename') {
        await BridgeAdapter.torrents.setName(hashes[0], inputValue.trim());
      } else {
        await BridgeAdapter.torrents.setLocation(hashes, inputValue.trim());
      }
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

  const title = t(type === 'rename' ? 'details.screen.renameTitle' : 'dialogs.text.setLocation');
  const description = type === 'rename'
    ? (isSingle ? undefined : t('dialogs.text.renamed', { count: hashes.length }))
    : (isSingle ? undefined : t('dialogs.text.moved', { count: hashes.length }));
  const submitLabel = t(type === 'rename' ? 'details.screen.rename' : 'details.screen.move');
  const placeholder = type === 'rename'
    ? t('dialogs.text.newName')
    // i18n-audit-ignore: filesystem path example is intentionally verbatim
    : '/path/to/new/location';

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 pb-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">{title}</label>
          {description && <p className="text-xs text-text-secondary">{description}</p>}
        </div>
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(value) => {
            setInputValue(value);
            setError(null);
          }}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) void handleSubmit();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        {error && (
          <p className="max-h-16 overflow-y-auto break-words whitespace-pre-wrap text-xs text-error">
            {error}
          </p>
        )}
      </div>

      <DialogActions
        actions={[
          { label: tCommon('actions.cancel'), onClick: handleCancel, disabled: isSubmitting },
          {
            label: isSubmitting ? t('dialogs.saving') : submitLabel,
            onClick: () => void handleSubmit(),
            variant: 'primary',
            disabled: isSubmitting || !canSubmit,
          },
        ]}
        stretch={false}
        className="mt-auto shrink-0 justify-end gap-3 pt-4"
      />
    </div>
  );
}
