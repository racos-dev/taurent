import { openDialogHostWindow } from './dialogHostWindow';

export const CREATE_DIALOG_WINDOW_CONFIG = {
  route: '/create-dialog-window',
  title: 'Create',
  width: 400,
  height: 260,
  minWidth: 400,
  minHeight: 260,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

export async function openCreateDialogWindow(payload: {
  type: 'category' | 'tag';
  hashes?: string[];
}): Promise<void> {
  await openDialogHostWindow('create', CREATE_DIALOG_WINDOW_CONFIG, {
    type: payload.type,
    ...(payload.hashes && payload.hashes.length > 0
      ? { hashes: payload.hashes.join(',') }
      : {}),
  });
}
