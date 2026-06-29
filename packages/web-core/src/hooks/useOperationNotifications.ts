import { useEffect } from 'react';
import { onOperationFailed } from '@taurent/bridge';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import type { OperationFailedEvent } from '@taurent/bridge/events';
import { subscribeOperationFailures } from './operationFailureReporter';

interface NativeNotificationPayload {
  title: string;
  body: string;
}

type NotificationSource = 'bridge' | 'reporter';

export interface OperationNotificationPayload {
  operation: string;
  message: string;
  source: NotificationSource;
  title: string;
  body: string;
}

export interface UseOperationNotificationsOptions {
  notify?: (message: string) => void;
  toast?: (message: string) => void;
  native?: (payload: NativeNotificationPayload & Pick<OperationNotificationPayload, 'operation' | 'message' | 'source'>) => Promise<boolean | void> | boolean | void;
  isForeground?: () => boolean;
}

const NATIVE_NOTIFICATION_OPERATIONS = [
  'session-health-check:',
  'session-retry:',
  'session-disconnect:',
  'session-disconnected',
  'session-error:',
] as const;

function getDefaultForegroundState(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }

  return document.visibilityState === 'visible' && document.hasFocus();
}

function shouldUseNativeNotification(operation: string): boolean {
  return NATIVE_NOTIFICATION_OPERATIONS.some((prefix) => operation.startsWith(prefix));
}

function formatOperationFailure(operation: string, error: unknown): string {
  if (operation.startsWith('session-health-check:')) {
    return 'Connection check failed. Taurent will keep trying.';
  }
  if (operation.startsWith('session-retry:')) {
    return 'Could not reconnect to the server. Taurent will keep trying.';
  }
  if (operation.startsWith('session-disconnect:') || operation === 'session-disconnected') {
    return formatUserMessageForContext(error, 'connection');
  }
  if (operation.startsWith('session-error:')) {
    return formatUserMessageForContext(error, 'connection');
  }
  if (operation.startsWith('server-switch:')) {
    return formatUserMessageForContext(error, 'server-switch');
  }
  if (operation === 'native-menu-sync') {
    return formatUserMessageForContext(error, 'native-menu');
  }
  return formatUserMessageForContext(error);
}

function buildNotificationPayload(
  operation: string,
  error: unknown,
  source: NotificationSource
): OperationNotificationPayload {
  const message = formatOperationFailure(operation, error);

  return {
    operation,
    message,
    source,
    title: 'Taurent',
    body: message,
  };
}

export function useOperationNotifications({
  notify,
  toast,
  native,
  isForeground = getDefaultForegroundState,
}: UseOperationNotificationsOptions) {
  const toastNotify = toast ?? notify;

  useEffect(() => {
    const routeNotification = (payload: OperationNotificationPayload) => {
      if (native && shouldUseNativeNotification(payload.operation) && !isForeground()) {
        void Promise.resolve(
          native({
            operation: payload.operation,
            message: payload.message,
            source: payload.source,
            title: payload.title,
            body: payload.body,
          })
        ).then((sent) => {
          if (sent === false) {
            toastNotify?.(payload.message);
          }
        }).catch(() => {
          toastNotify?.(payload.message);
        });
        return;
      }

      toastNotify?.(payload.message);
    };

    const unsubReporter = subscribeOperationFailures(({ operation, error }) => {
      routeNotification(buildNotificationPayload(operation, error, 'reporter'));
    });

    const unlisten = onOperationFailed((event: OperationFailedEvent) => {
      routeNotification(buildNotificationPayload(event.operation, event.error, 'bridge'));
    });

    return () => {
      unlisten();
      unsubReporter();
    };
  }, [isForeground, native, toastNotify]);
}
