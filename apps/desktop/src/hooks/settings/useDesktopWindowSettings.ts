import { useCallback, useEffect, useState } from 'react';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { storage } from '../../platform';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

const KEY_TO_FIELD: Record<string, keyof DesktopLocalSettings> = {
  close_to_tray: 'closeToTray',
  start_minimized: 'startMinimized',
  auto_start: 'autoStart',
  download_completion_notifications: 'downloadCompletionNotifications',
};

interface DesktopLocalSettings {
  closeToTray: boolean;
  startMinimized: boolean;
  autoStart: boolean;
  downloadCompletionNotifications: boolean;
}

interface UseDesktopWindowSettingsReturn {
  localSettings: DesktopLocalSettings;
  isLocalSettingsLoading: boolean;
  localSettingsError: string | null;
  loadLocalSettings: () => Promise<void>;
  handleSettingChange: (key: string, value: boolean) => Promise<void>;
}

const DEFAULT_LOCAL_SETTINGS: DesktopLocalSettings = {
  closeToTray: false,
  startMinimized: false,
  autoStart: false,
  downloadCompletionNotifications: true,
};

export function useDesktopWindowSettings(): UseDesktopWindowSettingsReturn {
  const [localSettings, setLocalSettings] = useState<DesktopLocalSettings>(DEFAULT_LOCAL_SETTINGS);
  const [isLocalSettingsLoading, setIsLocalSettingsLoading] = useState(true);
  const [localSettingsError, setLocalSettingsError] = useState<string | null>(null);

  const loadLocalSettings = useCallback(async () => {
    setIsLocalSettingsLoading(true);
    setLocalSettingsError(null);

    try {
      const closeToTray = await storage.getItem('close_to_tray');
      const startMinimized = await storage.getItem('start_minimized');
      const autoStart = await storage.getItem('auto_start');
      const autoStartStored = autoStart === 'true';
      // Sync: ensure OS autostart state matches the stored preference
      try {
        const currentlyEnabled = await isEnabled();
        if (autoStartStored !== currentlyEnabled) {
          if (autoStartStored) {
            await enable();
          } else {
            await disable();
          }
        }
      } catch {
        console.warn('Autostart sync failed (expected in dev mode).');
      }
      const downloadCompletionNotifications = await BridgeAdapter.getDownloadCompletionNotificationsEnabled();

      setLocalSettings({
        closeToTray: closeToTray === 'true',
        startMinimized: startMinimized === 'true',
        autoStart: autoStart === 'true',
        downloadCompletionNotifications,
      });
    } catch (error) {
      setLocalSettingsError(formatUserMessageForContext(error, 'app-settings'));
    } finally {
      setIsLocalSettingsLoading(false);
    }
  }, []);

  const handleSettingChange = useCallback(async (key: string, value: boolean) => {
    const field = KEY_TO_FIELD[key];
    if (!field) {
      console.warn(`Unknown local setting key: ${key}`);
      return;
    }

    try {
      if (key === 'download_completion_notifications') {
        await BridgeAdapter.setDownloadCompletionNotificationsEnabled(value);
      } else if (key === 'auto_start') {
        try {
          if (value) {
            await enable();
          } else {
            await disable();
          }
        } catch {
          // Silently ignore — autostart plugin may not be available in dev mode
        }
        await storage.setItem(key, String(value));
      } else {
        await storage.setItem(key, String(value));
      }

      setLocalSettingsError(null);
      setLocalSettings((prev) => ({ ...prev, [field]: value }));
    } catch (error) {
      setLocalSettingsError(formatUserMessageForContext(error, 'app-settings'));
    }
  }, []);

  useEffect(() => {
    void loadLocalSettings();
  }, [loadLocalSettings]);

  return {
    localSettings,
    isLocalSettingsLoading,
    localSettingsError,
    loadLocalSettings,
    handleSettingChange,
  };
}
