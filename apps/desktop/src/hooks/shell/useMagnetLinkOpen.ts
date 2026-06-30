import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openAddTorrentWindow } from '@/windows/dialogs/addTorrentWindow';

/**
 * Desktop-only hook that drains pending magnet URLs from Rust on mount
 * and listens for live `magnet-link-open` events (from deep-link plugin
 * callbacks on all platforms), then opens the Add Torrent auxiliary window
 * with the magnet URL.
 *
 * Mount inside the authenticated shell (e.g. ProtectedLayout) so the session
 * is available when the aux window opens.
 */
export function useMagnetLinkOpen(): void {
  useEffect(() => {
    // Register the live event listener first to avoid missing events that arrive
    // between the drain call and listener registration.
    const unlisten = listen<string[]>('magnet-link-open', async (event) => {
      const urls = event.payload;
      if (urls.length > 0) {
        await openAddTorrentWindow({ url: urls[0] });
        try {
          await invoke('get_pending_magnet_links');
        } catch {
          // Non-fatal: the live event already delivered the URL to the Add Torrent window.
        }
      }
    });

    // Drain any magnet URLs that were queued before the renderer was ready (cold-start
    // or tray-restore where the event fired before this listener registered).
    async function drainPending(): Promise<void> {
      try {
        const urls: string[] = await invoke('get_pending_magnet_links');
        if (urls.length > 0) {
          await openAddTorrentWindow({ url: urls[0] });
        }
      } catch {
        // Swallow — non-fatal if the command is not yet registered or queue is empty
      }
    }

    void drainPending();

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);
}