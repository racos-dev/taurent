import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { DialogActions, Input } from '@taurent/web-ui';
import { useQBClient } from '../connection/QBClientProvider';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';
import { useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';

export function EditCategoryDialogScreen() {
  const { t } = useTaurentTranslation('desktop');
  const { t: tDialogs } = useTaurentTranslation('dialogs');
  const { t: tCommon } = useTaurentTranslation('common');
  const formatError = useLocalizedErrorFormatter();
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const name = searchParams.get('name') ?? '';
  const initialSavePath = searchParams.get('savePath') ?? '';

  const [savePath, setSavePath] = useState(initialSavePath);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getCurrentWindow().setTitle(t('windows.editCategoryNamed', { name }));
  }, [name, t]);

  // Sync when singleton window is reused for a different category
  useEffect(() => {
    setSavePath(initialSavePath);
    setError(null);
  }, [initialSavePath]);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [name]);

  const hasChanges = savePath.trim() !== initialSavePath;

  async function handleSubmit() {
    if (!hasChanges) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await BridgeAdapter.categories.editCategory(name, savePath.trim());
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: 'categories',
      });
      await dismissDialogWindow();
    } catch (err) {
      setError(err);
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-5 pb-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary">{tDialogs('desktop.categoryName')}</label>
          <Input
            type="text"
            value={name}
            disabled
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">{tDialogs('desktop.savePath')}</label>
          <Input
            ref={inputRef}
            type="text"
            value={savePath}
            onChange={(value) => {
              setSavePath(value);
              setError(null);
            }}
            placeholder={tDialogs('desktop.defaultSavePath')}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasChanges) void handleSubmit();
              if (e.key === 'Escape') handleCancel();
            }}
          />
        </div>
        {error !== null && (
          <p className="max-h-16 overflow-y-auto break-words whitespace-pre-wrap text-xs text-error">
            {formatError(error, 'settings-save')}
          </p>
        )}
      </div>

      <DialogActions
        actions={[
          { label: tCommon('actions.cancel'), onClick: handleCancel, disabled: isSubmitting },
          {
            label: isSubmitting ? tCommon('actions.saving') : tCommon('actions.save'),
            onClick: () => void handleSubmit(),
            variant: 'primary',
            disabled: isSubmitting || !hasChanges,
          },
        ]}
        stretch={false}
        className="mt-auto shrink-0 justify-end gap-3 pt-4"
      />
    </div>
  );
}
