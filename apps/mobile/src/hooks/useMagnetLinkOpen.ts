import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useNavigate } from 'react-router-dom';

/**
 * Mobile hook that drains pending magnet URLs from Rust on mount and listens for
 * live `magnet-link-open` events, then navigates to the Add Torrent screen with
 * the magnet URL pre-filled.
 */
export function useMagnetLinkOpen(): void {
  const navigate = useNavigate();

  useEffect(() => {
    // Register the live event listener first.
    const unlisten = listen<string[]>('magnet-link-open', async (event) => {
      const urls = event.payload;
      if (urls.length > 0) {
        navigate(`/add-torrent?mode=magnet&url=${encodeURIComponent(urls[0])}`);
        try {
          await invoke('get_pending_magnet_links');
        } catch {
          // Non-fatal
        }
      }
    });

    // Drain pending on mount.
    async function drainPending(): Promise<void> {
      try {
        const urls: string[] = await invoke('get_pending_magnet_links');
        if (urls.length > 0) {
          navigate(`/add-torrent?mode=magnet&url=${encodeURIComponent(urls[0])}`);
        }
      } catch {
        // Swallow
      }
    }

    void drainPending();

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [navigate]);
}