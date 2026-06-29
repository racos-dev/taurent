import { openDialogHostWindow } from './dialogHostWindow';

export const TAG_SELECT_DIALOG_WINDOW_CONFIG = {
  route: '/tag-select-dialog-window',
  title: 'Add Tags',
  width: 300,
  height: 400,
  minWidth: 300,
  minHeight: 300,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

export async function openTagSelectDialogWindow(payload: {
  hashes: string[];
}): Promise<void> {
  const serializedPayload = {
    hashes: payload.hashes.join(','),
  };
  await openDialogHostWindow('tag-select', TAG_SELECT_DIALOG_WINDOW_CONFIG, serializedPayload);
}
