import { useEffect } from 'react';
import { onOperationFailed } from '@taurent/bridge';
import { classifyError } from '@taurent/shared/utils/error';
import { useTaurentTranslation, type TaurentTFunction } from '@taurent/shared/i18n';
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

function localizedError(error: unknown, context: string | undefined, t: TaurentTFunction): string {
  const category = classifyError(error);
  if (category !== 'unknown') return t(category, { ns: 'errors' });
  if (context) return t(context, { ns: 'errors' });
  return t('unknown', { ns: 'errors' });
}

function formatOperationFailure(operation: string, error: unknown, t: TaurentTFunction): string {
  if (operation.startsWith('session-health-check:')) {
    return t('healthCheck', { ns: 'errors' });
  }
  if (operation.startsWith('session-retry:')) {
    return t('reconnect', { ns: 'errors' });
  }
  if (operation.startsWith('session-disconnect:') || operation === 'session-disconnected') {
    return localizedError(error, 'connection', t);
  }
  if (operation.startsWith('session-error:')) {
    return localizedError(error, 'connection', t);
  }
  if (operation.startsWith('server-switch:')) {
    return localizedError(error, 'serverSwitch', t);
  }
  if (operation === 'native-menu-sync') {
    return localizedError(error, 'nativeMenu', t);
  }
  return localizedError(error, undefined, t);
}

function buildNotificationPayload(
  operation: string,
  error: unknown,
  source: NotificationSource,
  t: TaurentTFunction,
): OperationNotificationPayload {
  const message = formatOperationFailure(operation, error, t);

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
  const { t } = useTaurentTranslation('errors');
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
      routeNotification(buildNotificationPayload(operation, error, 'reporter', t));
    });

    const unlisten = onOperationFailed((event: OperationFailedEvent) => {
      routeNotification(buildNotificationPayload(event.operation, event.error, 'bridge', t));
    });

    return () => {
      unlisten();
      unsubReporter();
    };
  }, [isForeground, native, t, toastNotify]);
}
