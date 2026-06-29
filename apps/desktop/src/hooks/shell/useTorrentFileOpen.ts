import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openAddTorrentWindow } from '@/windows/dialogs/addTorrentWindow';

/**
 * Desktop-only hook that drains pending torrent file paths from Rust on mount
 * and listens for live `torrent-file-open` events (from second-instance opens or
 * RunEvent::Opened on macOS), then opens the Add Torrent auxiliary window with
 * the file paths.
 *
 * Mount inside the authenticated shell (e.g. ProtectedLayout) so the session
 * is available when the aux window opens.
 */
export function useTorrentFileOpen(): void {
  useEffect(() => {
    // Register the live event listener first to avoid missing events that arrive
    // between the drain call and listener registration.
    const unlisten = listen<string[]>('torrent-file-open', async (event) => {
      const paths = event.payload;
      if (paths.length > 0) {
        await openAddTorrentWindow({ files: JSON.stringify(paths) });
        try {
          await invoke('get_pending_torrent_files');
        } catch {
          // Non-fatal: the live event already delivered the paths to the Add Torrent window.
        }
      }
    });

    // Drain any files that were queued before the renderer was ready (cold-start
    // or single-instance callback that fired before this listener registered).
    async function drainPending(): Promise<void> {
      try {
        const paths: string[] = await invoke('get_pending_torrent_files');
        if (paths.length > 0) {
          await openAddTorrentWindow({ files: JSON.stringify(paths) });
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
