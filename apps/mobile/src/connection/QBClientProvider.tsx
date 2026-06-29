import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { createQBClientBootstrap } from '@taurent/web-core/session';
import { useMobileSessionOptions } from './sessionAdapter';

export type { QBClientContextValue } from '@taurent/web-core/session';

const {
  QBClientProvider,
  useQBClient,
  useMaindataState,
  useMaindataSelector,
} = createQBClientBootstrap({
  bridgeAdapter: BridgeAdapter,
  maindataBackendBridge: BridgeAdapter.qBClient,
  useSessionOptions: useMobileSessionOptions,
});

export { QBClientProvider, useQBClient, useMaindataState, useMaindataSelector };
