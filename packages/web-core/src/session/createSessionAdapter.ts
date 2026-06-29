// Session adapter factory — creates session bridge, listeners, and the
// useSessionOptions hook from platform-specific configuration.
//
// This eliminates the nearly-identical sessionAdapter.ts files in desktop and
// mobile. Each app provides its BridgeAdapter, listener factories, and retry
// config; this factory produces the objects needed by createSessionProvider.

import { useMemo } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import {
  createSessionBridge,
  createSessionListeners,
  type SessionLifecycleBridgeAdapter,
  type ListenerFactories,
} from './createSessionBridge';
import { createDefaultInvalidator } from './resourceInvalidation';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  performRetry: (serverId: string, attemptNumber: number) => Promise<void>;
}

export interface CreateSessionAdapterOptions {
  bridgeAdapter: SessionLifecycleBridgeAdapter;
  listenerFactories: ListenerFactories;
  retryConfig: RetryConfig;
}

export function createSessionAdapter({
  bridgeAdapter,
  listenerFactories,
  retryConfig,
}: CreateSessionAdapterOptions) {
  const bridge = createSessionBridge({ bridgeAdapter });
  const listeners = createSessionListeners({ listenerFactories });

  function useSessionOptions(queryClient: QueryClient) {
    return useMemo(
      () => ({
        bridge,
        listeners,
        invalidator: createDefaultInvalidator(queryClient),
        retryConfig,
      }),
      [queryClient]
    );
  }

  return { bridge, listeners, useSessionOptions };
}
