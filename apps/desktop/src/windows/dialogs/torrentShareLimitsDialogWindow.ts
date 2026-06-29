import { openDialogHostWindow } from './dialogHostWindow';

export const TORRENT_SHARE_LIMITS_DIALOG_WINDOW_CONFIG = {
  route: '/torrent-share-limits-dialog-window',
  title: 'Share Limits',
  width: 400,
  height: 380,
  minWidth: 400,
  minHeight: 380,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

export async function openTorrentShareLimitsDialogWindow(payload: {
  ratio: number;
  seedingTime: number;
  hashes: string[];
}): Promise<void> {
  const serializedPayload = {
    ratio: String(payload.ratio),
    seedingTime: String(payload.seedingTime),
    hashes: payload.hashes.join(','),
  };
  await openDialogHostWindow('torrent-share-limits', TORRENT_SHARE_LIMITS_DIALOG_WINDOW_CONFIG, serializedPayload);
}
