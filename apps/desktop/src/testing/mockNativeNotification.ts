import type { NativeNotificationPayload } from '@taurent/bridge/transport/tauri';

export type { NativeNotificationPayload };

export async function ensureNativeNotificationPermission(): Promise<'granted'> {
  return 'granted';
}

export async function notifyNative(_payload: NativeNotificationPayload): Promise<boolean> {
  return true;
}
