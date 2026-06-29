import { openDialogHostWindow } from './dialogHostWindow';

export const TORRENT_TEXT_DIALOG_WINDOW_CONFIG = {
  route: '/torrent-text-dialog-window',
  title: 'Torrent Dialog',
  width: 400,
  height: 220,
  minWidth: 400,
  minHeight: 220,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

type TorrentTextDialogType = 'rename' | 'setLocation';

export async function openTorrentTextDialogWindow(payload: {
  type: TorrentTextDialogType;
  value: string;
  hashes: string[];
}): Promise<void> {
  const serializedPayload = {
    type: payload.type,
    value: payload.value,
    hashes: payload.hashes.join(','),
  };
  await openDialogHostWindow('torrent-text', TORRENT_TEXT_DIALOG_WINDOW_CONFIG, serializedPayload);
}
