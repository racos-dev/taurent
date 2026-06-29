export interface QueueSettingsPanelProps {
  variant?: 'desktop' | 'mobile';
  /** Raw preferences from qBittorrent server. */
  preferences: Record<string, unknown> | null;
  /**
   * Desktop: called when Save is clicked with all staged queue settings.
   * Mobile: called with preference key and new value for immediate updates.
   */
  onPreferenceChange?: (key: string, value: number) => void;
  /** Desktop-only: called when the save button is clicked. */
  onSave?: (prefs: {
    queueing_enabled: boolean;
    max_active_downloads: number;
    max_active_uploads: number;
    max_active_torrents: number;
    dont_count_slow_torrents: boolean;
  }) => void;
  /** Desktop-only: whether a save operation is in progress. */
  isSaving?: boolean;
}
