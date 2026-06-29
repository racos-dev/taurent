// Desktop-only notification helper — not for mobile/shared consumers.
// This file imports @tauri-apps/plugin-notification and must never be
// reachable from runtime-agnostic bridge surfaces or shared listener imports.
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import type { NativeNotificationPayload } from '../transport/tauriTransport';
export type { NativeNotificationPayload };

type PermissionState = 'granted' | 'denied' | 'default';

export async function ensureNativeNotificationPermission(): Promise<PermissionState> {
  const granted = await isPermissionGranted();
  if (granted) {
    return 'granted';
  }

  return requestPermission();
}

export async function notifyNative({ title, body }: NativeNotificationPayload): Promise<boolean> {
  const permission = await ensureNativeNotificationPermission();
  if (permission !== 'granted') {
    return false;
  }

  await sendNotification({ title, body });
  return true;
}