import { openDialogHostWindow } from './dialogHostWindow';

export const EDIT_CATEGORY_DIALOG_WINDOW_CONFIG = {
  route: '/edit-category-dialog-window',
  title: 'Edit Category',
  width: 400,
  height: 260,
  minWidth: 400,
  minHeight: 260,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

export async function openEditCategoryDialogWindow(payload: {
  name: string;
  savePath: string;
}): Promise<void> {
  await openDialogHostWindow('edit-category', EDIT_CATEGORY_DIALOG_WINDOW_CONFIG, payload);
}
