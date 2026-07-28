import React from 'react';
import { RetryButton, SettingToggle } from '@taurent/web-ui';
import { SkeletonBlock } from '@taurent/web-ui/components/shared/SkeletonBlock/SkeletonBlock';

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
  if (isLoading) {
    return (
      <div className="space-y-3 rounded-sm border border-border bg-surface p-4" role="status" aria-label="Loading app settings">
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
          <p className="text-sm font-medium text-error">App settings unavailable</p>
          <p className="mt-1 text-xs text-text-secondary">{error}</p>
          <RetryButton onClick={onRetry} className="mt-2" />
        </div>
      )}

      <div className="rounded-sm border border-border bg-surface px-2 py-2">
        <p className="mb-2 text-xs font-medium text-text-muted">Behavior</p>
        <div className="space-y-1">
          <SettingToggle
            label="Close to system tray"
            value={closeToTray}
            onChange={(value) => onChange('close_to_tray', value)}
          />
          <SettingToggle
            label="Start to tray"
            value={startMinimized}
            onChange={(value) => onChange('start_minimized', value)}
          />
        </div>
      </div>

      <div className="rounded-sm border border-border bg-surface px-2 py-2">
        <p className="mb-2 text-xs font-medium text-text-muted">Notifications</p>
        <SettingToggle
          label="Download completion notifications"
          value={downloadCompletionNotifications}
          onChange={(value) => onChange('download_completion_notifications', value)}
        />
      </div>

      <div className="rounded-sm border border-border bg-surface px-2 py-2">
        <p className="mb-2 text-xs font-medium text-text-muted">Startup</p>
        <SettingToggle
          label="Auto-start on boot"
          value={autoStart}
          onChange={(value) => onChange('auto_start', value)}
        />
      </div>
    </div>
  );
});

WindowBehaviorSettings.displayName = 'WindowBehaviorSettings';
