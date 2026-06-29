import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { createQBClientBootstrap } from '@taurent/web-core/session';
import { useDesktopSessionOptions } from './sessionAdapter';


const bootstrap = createQBClientBootstrap({
  bridgeAdapter: BridgeAdapter,
  maindataBackendBridge: BridgeAdapter.qBClient,
  useSessionOptions: useDesktopSessionOptions,
});

export const { QBClientProvider, useQBClient, useMaindataState, useMaindataSelector } = bootstrap;