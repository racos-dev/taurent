import { openDialogHostWindow } from './dialogHostWindow';

export const TORRENT_NUMERIC_DIALOG_WINDOW_CONFIG = {
  route: '/torrent-numeric-dialog-window',
  title: 'Torrent Limit',
  width: 400,
  height: 220,
  minWidth: 400,
  minHeight: 220,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

type TorrentNumericDialogType = 'download' | 'upload';

export async function openTorrentNumericDialogWindow(payload: {
  type: TorrentNumericDialogType;
  value: number;
  hashes: string[];
}): Promise<void> {
  const serializedPayload = {
    type: payload.type,
    value: String(payload.value),
    hashes: payload.hashes.join(','),
  };
  await openDialogHostWindow('torrent-numeric', TORRENT_NUMERIC_DIALOG_WINDOW_CONFIG, serializedPayload);
}
