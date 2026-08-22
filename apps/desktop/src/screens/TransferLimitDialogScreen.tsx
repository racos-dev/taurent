import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { DialogActions, NumberInput } from '@taurent/web-ui';
import { useQBClient } from '../connection/QBClientProvider';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';
import { RESOURCE } from '@taurent/web-core/query';
import { useLocalizedErrorFormatter, useTaurentTranslation } from '@taurent/shared/i18n';

type TransferLimitDialogDirection = 'download' | 'upload';
type TransferLimitDialogMode = 'single' | 'combined';

export function TransferLimitDialogScreen() {
  const { t } = useTaurentTranslation('desktop');
  const { t: tDialogs } = useTaurentTranslation('dialogs');
  const { t: tCommon } = useTaurentTranslation('common');
  const formatError = useLocalizedErrorFormatter();
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const mode = (searchParams.get('mode') ?? 'single') as TransferLimitDialogMode;
  const direction = (searchParams.get('direction') ?? 'download') as TransferLimitDialogDirection;
  // Value comes in as bytes per second from the single-direction opener.
  const initialValue = Number(searchParams.get('value') ?? '0');
  const isAltSpeed = searchParams.get('isAltSpeed') === '1';

  const [dlValue, setDlValue] = useState(initialValue);
  const [upValue, setUpValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const dlInputRef = useRef<HTMLInputElement>(null);
  const upInputRef = useRef<HTMLInputElement>(null);

  // Fetch live global limits when opening in combined mode
  useEffect(() => {
    if (mode !== 'combined') return;
    let cancelled = false;
    async function loadLimits() {
      try {
        const [dlLimit, upLimit] = await Promise.all([
          BridgeAdapter.transfer.getDownloadLimit(),
          BridgeAdapter.transfer.getUploadLimit(),
        ]);
        if (cancelled) return;
        setDlValue(dlLimit.limit);
        setUpValue(upLimit.limit);
      } catch {
        // Keep defaults (0 = unlimited) on error
      }
    }
    void loadLimits();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    const title =
      mode === 'combined'
        ? t('windows.globalSpeedLimits')
        : isAltSpeed
          ? direction === 'download' ? t('windows.altDownloadLimit') : t('windows.altUploadLimit')
          : direction === 'download' ? t('windows.downloadLimit') : t('windows.uploadLimit');
    void getCurrentWindow().setTitle(title);
  }, [mode, direction, isAltSpeed, t]);

  // Focus and select in single-direction mode; focus download in combined mode
  useEffect(() => {
    if (mode === 'single') {
      setTimeout(() => {
        inputRef.current?.focus();
        setTimeout(() => inputRef.current?.select(), 0);
      }, 0);
    } else {
      setTimeout(() => dlInputRef.current?.focus(), 0);
    }
  }, [mode, direction, isAltSpeed]);

  // Redirect single-direction to existing ref pattern
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'single') {
      setDlValue(initialValue);
      setError(null);
    }
  }, [initialValue, direction, isAltSpeed, mode]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === 'combined') {
        // Combined mode — submit both normal global limits via transfer API
        await Promise.all([
          BridgeAdapter.transfer.setDownloadLimit(dlValue),
          BridgeAdapter.transfer.setUploadLimit(upValue),
        ]);
      } else if (isAltSpeed) {
        // Alternative limits are stored in preferences
        const prefs = direction === 'download' ? { alt_dl_limit: dlValue } : { alt_up_limit: dlValue };
        await BridgeAdapter.application.setPreferences(prefs);
      } else {
        // Global limits use the transfer API
        if (direction === 'download') {
          await BridgeAdapter.transfer.setDownloadLimit(dlValue);
        } else {
          await BridgeAdapter.transfer.setUploadLimit(dlValue);
        }
      }

      // Invalidate transfer (for rate limit display) and preferences (for alt limit values)
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: RESOURCE.TRANSFER,
      });
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: RESOURCE.PREFERENCES,
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

  // Single-direction title (unchanged from before)
  const title = isAltSpeed
    ? direction === 'download' ? t('windows.altDownloadLimit') : t('windows.altUploadLimit')
    : direction === 'download' ? t('windows.downloadLimit') : t('windows.uploadLimit');

  if (mode === 'combined') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 pb-4">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <p className="text-xs text-text-secondary">{tDialogs('desktop.zeroUnlimited')}</p>

          {/* Download limit */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">{tDialogs('desktop.downloadLimit')}</label>
            <NumberInput
              ref={dlInputRef}
              min={0}
              value={dlValue}
              unitMode="bytes-per-second"
              unitDefault="kb"
              onValueChange={(value) => {
                setDlValue(value);
                setError(null);
              }}
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit();
                if (e.key === 'Escape') handleCancel();
              }}
            />
          </div>

          {/* Upload limit */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">{tDialogs('desktop.uploadLimit')}</label>
            <NumberInput
              ref={upInputRef}
              min={0}
              value={upValue}
              unitMode="bytes-per-second"
              unitDefault="kb"
              onValueChange={(value) => {
                setUpValue(value);
                setError(null);
              }}
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit();
                if (e.key === 'Escape') handleCancel();
              }}
            />
          </div>

          {error !== null && (
            <p className="max-h-16 overflow-y-auto break-words whitespace-pre-wrap text-xs text-error">
              {formatError(error, 'speed-limits')}
            </p>
          )}
        </div>

        <DialogActions
          actions={[
            { label: tCommon('actions.cancel'), onClick: handleCancel, disabled: isSubmitting },
            {
              label: isSubmitting ? tCommon('actions.saving') : tCommon('actions.set'),
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

  // Single-direction mode (existing status bar behavior)
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 pb-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">{title}</label>
          <p className="text-xs text-text-secondary">{tDialogs('desktop.zeroUnlimited')}</p>
        </div>
        <NumberInput
          ref={inputRef}
          min={0}
          value={dlValue}
          unitMode="bytes-per-second"
          unitDefault="kb"
          onValueChange={(value) => {
            setDlValue(value);
            setError(null);
          }}
          className="w-full"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        {error !== null && (
          <p className="max-h-16 overflow-y-auto break-words whitespace-pre-wrap text-xs text-error">
            {formatError(error, 'speed-limits')}
          </p>
        )}
      </div>

      <DialogActions
        actions={[
          { label: tCommon('actions.cancel'), onClick: handleCancel, disabled: isSubmitting },
          {
            label: isSubmitting ? tCommon('actions.saving') : tCommon('actions.set'),
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
