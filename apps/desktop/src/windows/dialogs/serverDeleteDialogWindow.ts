import { openDialogHostWindow } from './dialogHostWindow';

export const SERVER_DELETE_DIALOG_WINDOW_CONFIG = {
  route: '/server-delete-dialog-window',
  title: 'Delete Server',
  width: 420,
  height: 220,
  minWidth: 420,
  minHeight: 220,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

export async function openServerDeleteDialogWindow(payload: {
  serverId: string;
  serverName: string;
}): Promise<void> {
  await openDialogHostWindow('server-delete', SERVER_DELETE_DIALOG_WINDOW_CONFIG, payload);
}
