// Session platform adapter — mobile-specific wiring for createSessionProvider.
// All heavy session logic lives in web-core's sessionController.

import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { createSessionEventListener, createResourceInvalidatedListener } from '@taurent/bridge/transport/tauri';
import { MAX_RETRY_ATTEMPTS, RETRY_DELAY_MS } from '@taurent/bridge/types';
import { createSessionAdapter } from '@taurent/web-core/session';

const { bridge, listeners, useSessionOptions } = createSessionAdapter({
  bridgeAdapter: BridgeAdapter,
  listenerFactories: { createSessionEventListener, createResourceInvalidatedListener },
  retryConfig: {
    maxAttempts: MAX_RETRY_ATTEMPTS,
    baseDelayMs: RETRY_DELAY_MS,
    // Mobile retry: simple fixed-delay retry (no exponential backoff)
    performRetry: async (serverId: string) => {
      await BridgeAdapter.sessionConnectById(serverId);
    },
  },
});

export { bridge as mobileSessionBridge, listeners as mobileSessionListeners };
export { useSessionOptions as useMobileSessionOptions };
