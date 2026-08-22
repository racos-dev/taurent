import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { DialogActions, NumberInput } from '@taurent/web-ui';
import { useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';
import { useQBClient } from '../connection/QBClientProvider';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';

export function TorrentNumericDialogScreen() {
  const { t } = useTaurentTranslation('torrents');
  const { t: tCommon } = useTaurentTranslation('common');
  const formatError = useLocalizedErrorFormatter();
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const type = (searchParams.get('type') ?? 'download') as 'download' | 'upload';
  const initialValue = Number(searchParams.get('value') ?? '0');
  const hashesParam = searchParams.get('hashes') ?? '';
  const hashes = hashesParam ? hashesParam.split(',') : [];

  const [inputValue, setInputValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const title = t(type === 'download' ? 'details.screen.downloadLimit' : 'details.screen.uploadLimit');
    void getCurrentWindow().setTitle(title);
  }, [t, type]);

  useEffect(() => {
    setInputValue(initialValue);
    setError(null);
  }, [initialValue, type]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [initialValue, type]);

  const isSingle = hashes.length === 1;

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      if (type === 'download') {
        await BridgeAdapter.torrents.setDownloadLimit(hashes, inputValue);
      } else {
        await BridgeAdapter.torrents.setUploadLimit(hashes, inputValue);
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

  const title = t(type === 'download' ? 'details.screen.downloadLimit' : 'details.screen.uploadLimit');
  const description = isSingle ? undefined : t('dialogs.numeric.limited', { count: hashes.length });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 pb-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">{title}</label>
          {description && <p className="text-xs text-text-secondary">{description}</p>}
          <p className="text-xs text-text-secondary">{t('dialogs.numeric.zeroUnlimited')}</p>
        </div>
        <NumberInput
          ref={inputRef}
          min={0}
          value={inputValue}
          unitMode="bytes-per-second"
          unitDefault="kb"
          onValueChange={(value) => {
            setInputValue(value);
            setError(null);
          }}
          className="w-full"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
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
            label: isSubmitting ? t('dialogs.saving') : tCommon('actions.set'),
            onClick: () => void handleSubmit(),
            variant: 'primary',
            disabled: isSubmitting,
          },
        ]}
        stretch={false}
        className="mt-auto shrink-0 justify-end gap-3 pt-4"
      />
    </div>
  );
}
