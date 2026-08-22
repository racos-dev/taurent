import React from 'react';
import { RetryButton, SettingToggle } from '@taurent/web-ui';
import { SkeletonBlock } from '@taurent/web-ui/components/shared/SkeletonBlock/SkeletonBlock';
import { useTaurentTranslation } from '@taurent/shared/i18n';

interface WindowBehaviorSettingsProps {
  closeToTray: boolean;
  startMinimized: boolean;
  autoStart: boolean;
  downloadCompletionNotifications: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onChange: (key: string, value: boolean) => void;
}

export const WindowBehaviorSettings = React.memo<WindowBehaviorSettingsProps>(({
  closeToTray,
  startMinimized,
  autoStart,
  downloadCompletionNotifications,
  isLoading,
  error,
  onRetry,
  onChange,
}) => {
  const { t } = useTaurentTranslation('settings');

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-sm border border-border bg-surface p-4" role="status" aria-label={t('desktopBehavior.loading')}>
        <SkeletonBlock height="2rem" background="bg-surface-interactive" />
        <SkeletonBlock height="2rem" background="bg-surface-interactive" />
        <SkeletonBlock height="2rem" background="bg-surface-interactive" />
        <SkeletonBlock height="2rem" background="bg-surface-interactive" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-sm border border-error bg-error-20 p-3">
          <p className="text-sm font-medium text-error">{t('desktopBehavior.unavailable')}</p>
          <RetryButton onClick={onRetry} className="mt-2" />
        </div>
      )}

      <div className="rounded-sm border border-border bg-surface px-2 py-2">
        <p className="mb-2 text-xs font-medium text-text-muted">{t('desktopBehavior.behavior')}</p>
        <div className="space-y-1">
          <SettingToggle
            label={t('desktopBehavior.closeToTray')}
            value={closeToTray}
            onChange={(value) => onChange('close_to_tray', value)}
          />
          <SettingToggle
            label={t('desktopBehavior.startToTray')}
            value={startMinimized}
            onChange={(value) => onChange('start_minimized', value)}
          />
        </div>
      </div>

      <div className="rounded-sm border border-border bg-surface px-2 py-2">
        <p className="mb-2 text-xs font-medium text-text-muted">{t('desktopBehavior.notifications')}</p>
        <SettingToggle
          label={t('desktopBehavior.completionNotifications')}
          value={downloadCompletionNotifications}
          onChange={(value) => onChange('download_completion_notifications', value)}
        />
      </div>

      <div className="rounded-sm border border-border bg-surface px-2 py-2">
        <p className="mb-2 text-xs font-medium text-text-muted">{t('desktopBehavior.startup')}</p>
        <SettingToggle
          label={t('desktopBehavior.autoStart')}
          value={autoStart}
          onChange={(value) => onChange('auto_start', value)}
        />
      </div>
    </div>
  );
});

WindowBehaviorSettings.displayName = 'WindowBehaviorSettings';
