import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AuxWindowConfig } from '../auxWindowManager';
import { createWindowLifecycle, openAuxWindow } from '../auxWindowManager';
import { type DialogHostKind } from './registry';

const DIALOG_HOST_LABEL = 'dialog-host';
const DIALOG_HOST_IDLE_TTL_MS = 2 * 60_000;

export type DialogWindowConfig = Omit<AuxWindowConfig, 'label'>;

const lc = createWindowLifecycle({
  label: DIALOG_HOST_LABEL,
  route: '/dialog-host-window',
  title: 'Dialog',
  width: 400,
  height: 220,
  minWidth: 300,
  minHeight: 200,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
  idleTtlMs: DIALOG_HOST_IDLE_TTL_MS,
});

const DIALOG_HOST_WINDOW_CONFIG = lc.windowConfig;



let openSequence = 0;

export const cancelDialogHostIdleClose = lc.cancel;
export const scheduleDialogHostIdleClose = lc.schedule;

/**
 * Dismiss the dialog host window — hide it and schedule idle-close.
 * The label guard is kept because dialog-host is a shared singleton; callers
 * outside the dialog-host renderer should use dismissDialogWindow.
 */
export async function dismissDialogWindow(): Promise<void> {
  const win = await getCurrentWindow();
  if (win.label === DIALOG_HOST_LABEL) {
    await lc.dismiss(() => win.hide());
  }
}

export async function openDialogHostWindow(
  dialog: DialogHostKind,
  dialogConfig: DialogWindowConfig,
  payload: Record<string, string> = {}
): Promise<void> {
  openSequence += 1;
  const hostConfig: AuxWindowConfig = {
    ...dialogConfig,
    label: DIALOG_HOST_LABEL,
    route: DIALOG_HOST_WINDOW_CONFIG.route,
  };

  await openAuxWindow(hostConfig, {
    payload: {
      ...payload,
      dialog,
      openId: String(openSequence),
    },
  });
}
