// Session platform adapter — desktop-specific wiring for createSessionProvider.
// All heavy session logic lives in web-core's sessionController.

import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { createSessionEventListener, createResourceInvalidatedListener } from '@taurent/bridge/transport/tauri';
import { MAX_RETRY_ATTEMPTS, RETRY_DELAY_MS } from '@taurent/bridge/types';
import { createSessionAdapter } from '@taurent/web-core/session';

const { useSessionOptions } = createSessionAdapter({
  bridgeAdapter: BridgeAdapter,
  listenerFactories: { createSessionEventListener, createResourceInvalidatedListener },
  retryConfig: {
    maxAttempts: MAX_RETRY_ATTEMPTS,
    baseDelayMs: 0,
    performRetry: async (_serverId: string, attemptNumber: number) => {
      // Desktop exponential backoff: delay grows with each attempt
      const delayMs = RETRY_DELAY_MS * Math.pow(2, attemptNumber - 1);
      await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
      await BridgeAdapter.sessionReconnect();
    },
  },
});

export { useSessionOptions as useDesktopSessionOptions };
