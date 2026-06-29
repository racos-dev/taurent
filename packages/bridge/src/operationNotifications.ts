// @taurent/bridge
// Runtime-agnostic operation notification registration.
// No Tauri dependencies - pure bridge logic.

import type { OperationFailedEvent } from './events';

type Notifier = (callback: (event: OperationFailedEvent) => void) => () => void;

let registeredNotifier: Notifier | null = null;

export function registerOperationFailedNotifier(notifier: Notifier): void {
  if (registeredNotifier !== null) {
    console.warn('[bridge] operation-failed notifier already registered; ignoring duplicate registration');
    return;
  }
  registeredNotifier = notifier;
}

export function onOperationFailed(callback: (event: OperationFailedEvent) => void): () => void {
  if (registeredNotifier === null) {
    console.warn('[bridge] no operation-failed notifier registered; subscription will be a no-op');
    return () => {};
  }
  return registeredNotifier(callback);
}