import { openDialogHostWindow } from './dialogHostWindow';

export const TORRENT_DELETE_DIALOG_WINDOW_CONFIG = {
  route: '/torrent-delete-dialog-window',
  title: 'Delete Torrent',
  width: 400,
  height: 200,
  minWidth: 400,
  minHeight: 200,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

export async function openTorrentDeleteDialogWindow(payload: {
  hashes: string[];
  count: number;
}): Promise<void> {
  const serializedPayload = {
    hashes: payload.hashes.join(','),
    count: String(payload.count),
  };
  await openDialogHostWindow('torrent-delete', TORRENT_DELETE_DIALOG_WINDOW_CONFIG, serializedPayload);
}
