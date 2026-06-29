import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useTorrentSelectionStore } from '@/stores';
import { useQBClient } from '../../connection';
import { openSettingsWindow } from '../../windows/settings/settingsWindow';
import { openAddTorrentWindow } from '../../windows/dialogs/addTorrentWindow';
import { openStatisticsWindow } from '../../windows/statistics/statisticsWindow';

interface UseDesktopCommandsReturn {
  addTorrent: () => void;
  openSettings: () => void;
  openAbout: () => void;
  openStatistics: () => void;
  openSearch: () => void;
  openRSS: () => void;
  exitApp: () => void;
  canRemove: boolean;
  canPause: boolean;
  canResume: boolean;
  canQueueUp: boolean;
  canQueueDown: boolean;
  isConnected: boolean;
}

export function useDesktopCommands(): UseDesktopCommandsReturn {
  const navigate = useNavigate();
  const { isConnected } = useQBClient();
  const selectedHashes = useTorrentSelectionStore((state) => state.selectedHashes);

  const hasSelection = selectedHashes.size > 0;
  const hasService = isConnected;

  const canRemove = hasService && hasSelection;
  const canPause = hasService && hasSelection;
  const canResume = hasService && hasSelection;
  const canQueueUp = hasService && hasSelection;
  const canQueueDown = hasService && hasSelection;

  const addTorrent = useCallback(() => {
    void openAddTorrentWindow();
  }, []);

  const openSettings = useCallback(() => {
    void openSettingsWindow();
  }, []);

  const openAbout = useCallback(() => {
    void openSettingsWindow('desktop-about');
  }, []);

  const openStatistics = useCallback(() => {
    void openStatisticsWindow();
  }, []);

  const openSearch = useCallback(() => {
    navigate('/search');
  }, [navigate]);

  const openRSS = useCallback(() => {
    navigate('/rss');
  }, [navigate]);

  const exitApp = useCallback(() => {
    void BridgeAdapter.exitApp();
  }, []);

  return {
    addTorrent,
    openSettings,
    openAbout,
    openStatistics,
    openSearch,
    openRSS,
    exitApp,
    canRemove,
    canPause,
    canResume,
    canQueueUp,
    canQueueDown,
    isConnected,
  };
}
