import { openDialogHostWindow } from './dialogHostWindow';

export const CATEGORY_SELECT_DIALOG_WINDOW_CONFIG = {
  route: '/category-select-dialog-window',
  title: 'Select Category',
  width: 300,
  height: 400,
  minWidth: 300,
  minHeight: 300,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

export async function openCategorySelectDialogWindow(payload: {
  hashes: string[];
}): Promise<void> {
  const serializedPayload = {
    hashes: payload.hashes.join(','),
  };
  await openDialogHostWindow('category-select', CATEGORY_SELECT_DIALOG_WINDOW_CONFIG, serializedPayload);
}
