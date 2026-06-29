import { openDialogHostWindow } from './dialogHostWindow';

export const CONFIRM_DIALOG_WINDOW_CONFIG = {
  route: '/confirm-dialog-window',
  title: 'Confirm',
  width: 400,
  height: 200,
  minWidth: 400,
  minHeight: 200,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

export async function openConfirmDialogWindow(payload: {
  name: string;
  type: 'category' | 'tag';
}): Promise<void> {
  await openDialogHostWindow('confirm', CONFIRM_DIALOG_WINDOW_CONFIG, payload);
}
