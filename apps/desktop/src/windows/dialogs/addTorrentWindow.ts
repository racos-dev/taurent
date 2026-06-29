import { createWindowLifecycle, openAuxWindow } from '../auxWindowManager';

const ADD_TORRENT_WINDOW_LABEL = 'add-torrent';

const lc = createWindowLifecycle({
  label: ADD_TORRENT_WINDOW_LABEL,
  route: '/add-torrent-window',
  title: 'Add Torrent',
  width: 700,
  height: 680,
  minWidth: 700,
  minHeight: 680,
  resizable: false,
  decorations: true,
  centerOverOpener: true,
  idleTtlMs: 0, // No idle-close — user opens/closes explicitly
});

const ADD_TORRENT_WINDOW_CONFIG = lc.windowConfig;

export async function openAddTorrentWindow(payload?: Record<string, string>): Promise<void> {
  await openAuxWindow(ADD_TORRENT_WINDOW_CONFIG, payload ? { payload } : undefined);
}
