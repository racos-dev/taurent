// useSelectedTorrentDetailSync - coordinator hook for detail pane tab refresh.
//
// When the desktop detail pane is open, the active detail tab should refresh at
// a reasonable cadence rather than on every single maindata RID advance. This
// hook watches maindataState.rid as the change signal and throttles trigger of
// the active tab's refetch using server_state.refresh_interval as a hint.
//
// Throttle logic:
//   - Uses maindataState.server_state.refresh_interval (clamped 1000–2000ms) as
//     the minimum gap between coordinator-triggered refetches when available.
//   - Falls back to a conservative default (1500ms) when the server hint is
//     absent or invalid — still realtime enough, avoids hammering on every rid.
//   - Only fires when: pane is open, tab is active, rid genuinely advanced,
//     and the minimum time gap has elapsed since the last coordinator refetch.
//   - Tabs outside coordinatorTabs still rely solely on their own polling.
//
// This is a desktop-specific wiring concern, but the hook lives in web-core/sync
// because the implementation is platform-agnostic — only the call site differs.
//
// Usage:
//   const handleRefetch = useCallback((tab: DetailTab) => { ... }, []);
//
//   useSelectedTorrentDetailSync({
//     paneOpen: isPaneOpen,
//     activeTab: shellTab,
//     maindataState,
//     onRefetch: handleRefetch,
//   });

import { useEffect, useRef } from 'react';
import type { MaindataState } from '@taurent/shared';
import type { DetailTab } from '../screens/torrent-detail/useTorrentDetailController';

const ACTIVE_TORRENT_STATES = new Set([
  'downloading', 'uploading', 'stalledDL', 'stalledUP',
  'checkingDL', 'checkingUP', 'queuedDL', 'queuedUP',
]);

export interface UseSelectedTorrentDetailSyncOptions {
  /** Whether the detail pane is currently open */
  paneOpen: boolean;
  /** The currently active detail tab */
  activeTab: DetailTab;
  /** The current maindataState from QBClientContext (used as the change signal) */
  maindataState: MaindataState | null;
  /**
   * Callback invoked with the active tab when maindata has advanced.
   * DetailPanel resolves the correct refetch function for the tab before calling.
   */
  onRefetch: (tab: DetailTab) => void;
  /**
   * Restrict coordinator-driven refetches to only the listed tabs.
   * Tabs outside this list rely solely on their own polling intervals.
   * Pass undefined (default) to coordinate all tabs (backwards-compatible).
   */
  coordinatorTabs?: DetailTab[];
  /**
   * The currently selected torrent hash, used to look up torrent state
   * from maindataState for adaptive throttle. When the torrent is active,
   * the coordinator throttles at 1000-2000ms; when inactive, at 3000-5000ms.
   */
  selectedTorrentHash?: string;
}

/**
 * Coordinator hook that drives detail tab refresh from the maindata poll cadence.
 *
 * Watches `maindataState.rid` — every time the rid advances, if the pane is open
 * and a tab is active, triggers the appropriate refetch via `onRefetch`.
 *
 * Tabs that are driven by this coordinator should have their own default polling
 * disabled (refetchInterval: false) so only this coordinator triggers refetches.
 */
export function useSelectedTorrentDetailSync({
  paneOpen,
  activeTab,
  maindataState,
  onRefetch,
  coordinatorTabs,
  selectedTorrentHash,
}: UseSelectedTorrentDetailSyncOptions) {
  // Track the previous rid to detect genuine advances
  const prevRidRef = useRef<number | undefined>(undefined);
  // Timestamp (Date.now()) of the last coordinator-triggered refetch.
  // Used to enforce the minimum gap between refetches.
  const lastRefetchTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!paneOpen || !activeTab || !maindataState) return;

    // Skip if active tab is not in the coordinator's scope
    if (coordinatorTabs !== undefined && !coordinatorTabs.includes(activeTab)) return;

    const currentRid = maindataState.rid;

    // Skip the very first render (prevRidRef is undefined)
    // On subsequent renders, only fire when rid has actually advanced
    if (prevRidRef.current !== undefined && currentRid !== prevRidRef.current) {
      // Determine if the selected torrent is active for adaptive throttle
      const selectedTorrent = selectedTorrentHash
        ? maindataState.torrents?.[selectedTorrentHash]
        : undefined;
      const isActive = selectedTorrent?.state != null && ACTIVE_TORRENT_STATES.has(selectedTorrent.state);

      // Throttle: enforce a minimum gap between coordinator refetches using
      // server_state.refresh_interval as a hint, clamped to a range that respects
      // the torrent's active/inactive state. Active torrents: 1000-2000ms range;
      // inactive torrents: 3000-5000ms range.
      const minInterval = isActive ? 1000 : 3000;
      const maxInterval = isActive ? 2000 : 5000;
      const defaultInterval = isActive ? 1500 : 4000;
      const serverInterval = maindataState.server_state?.refresh_interval;
      const throttleMs =
        serverInterval !== undefined && serverInterval > 0
          ? Math.min(Math.max(serverInterval, minInterval), maxInterval)
          : defaultInterval;

      const now = Date.now();
      if (now - lastRefetchTimeRef.current < throttleMs) return;

      lastRefetchTimeRef.current = now;
      onRefetch(activeTab);
    }

    prevRidRef.current = currentRid;
  }, [maindataState, paneOpen, activeTab, onRefetch, coordinatorTabs, selectedTorrentHash]);
}
