/**
 * Shared renderer-side operation-failure reporting primitive.
 *
 * Allows background code (session health checks, retry loops, native menu sync, etc.)
 * to report failures through a single channel that `useOperationNotifications` subscribes to,
 * keeping `packages/web-core` UI-agnostic and preserving T41's toast routing surface.
 */

export interface OperationFailurePayload {
  operation: string;
  error: unknown;
  /** Unix-ms timestamp; defaults to Date.now() at call time. */
  timestamp?: number;
}

type OperationFailureListener = (payload: OperationFailurePayload) => void;

const listeners = new Set<OperationFailureListener>();

/**
 * Report an operation failure from renderer-side background code.
 * The payload is normalized by `useOperationNotifications` before showing a toast.
 */
export function reportOperationFailure(payload: OperationFailurePayload): void {
  const p: OperationFailurePayload = {
    ...payload,
    timestamp: payload.timestamp ?? Date.now(),
  };
  listeners.forEach((listener) => listener(p));
}

/**
 * Subscribe to operation failure events emitted by `reportOperationFailure`.
 * Returns an unsubscribe function.
 */
export function subscribeOperationFailures(listener: OperationFailureListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
