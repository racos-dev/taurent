export interface TransferSettingsPanelProps {
  /** Raw preferences from qBittorrent server. */
  preferences: Record<string, unknown> | null;
  /**
   * Mobile: called when user taps a limit row to edit.
   * Receives the preference key ('dl_limit' | 'alt_dl_limit' | 'up_limit' | 'alt_up_limit')
   * and current raw value in bytes per second. Parent manages modal and handles the actual update.
   * Desktop: unused.
   */
  onEditLimit?: (prefKey: string, currentValueBytes: number) => void;
  /** Toggle alternative speed limits mode. */
  onToggleAltSpeedLimits: () => void;
  /** Desktop-only: called when Save is clicked with staged limits. */
  onSave?: (prefs: { dl_limit: number; up_limit: number }) => void;
  /** Desktop-only: whether a save operation is in progress. */
  isSaving?: boolean;
}
