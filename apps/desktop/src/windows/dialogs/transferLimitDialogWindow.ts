import { openDialogHostWindow } from './dialogHostWindow';

export const TRANSFER_LIMIT_DIALOG_WINDOW_CONFIG = {
  route: '/transfer-limit-dialog-window',
  title: 'Transfer Limit',
  width: 400,
  height: 220,
  minWidth: 400,
  minHeight: 220,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

const TRANSFER_GLOBAL_SPEED_DIALOG_WINDOW_CONFIG = {
  route: '/transfer-limit-dialog-window',
  title: 'Global Speed Limits',
  width: 400,
  height: 340,
  minWidth: 400,
  minHeight: 340,
  resizable: false,
  minimizable: false,
  decorations: true,
  centerOverOpener: true,
} as const;

type TransferLimitDialogDirection = 'download' | 'upload';

export type TransferLimitDialogMode = 'single' | 'combined';

export async function openTransferLimitDialogWindow(payload: {
  direction: TransferLimitDialogDirection;
  /** Initial value in bytes per second */
  value: number;
  /** Whether alternative speed limits are currently active */
  isAltSpeed: boolean;
}): Promise<void> {
  const serializedPayload = {
    mode: 'single',
    direction: payload.direction,
    value: String(payload.value),
    isAltSpeed: payload.isAltSpeed ? '1' : '0',
  };
  await openDialogHostWindow('transfer-limit', TRANSFER_LIMIT_DIALOG_WINDOW_CONFIG, serializedPayload);
}

/**
 * Open the combined global speed limits dialog for the tray "Set Global Speed Limits..." action.
 * Reads current normal global download/upload limits, renders both inputs in one dialog,
 * and submits both `BridgeAdapter.transfer.setDownloadLimit(...)` and `setUploadLimit(...)`.
 * Does NOT touch alternate-speed preferences.
 */
export async function openGlobalSpeedLimitsDialogWindow(): Promise<void> {
  const serializedPayload = {
    mode: 'combined',
    // direction/value/isAltSpeed intentionally omitted for combined mode;
    // TransferLimitDialogScreen fetches live limits directly.
  };
  await openDialogHostWindow(
    'transfer-limit',
    TRANSFER_GLOBAL_SPEED_DIALOG_WINDOW_CONFIG,
    serializedPayload
  );
}
