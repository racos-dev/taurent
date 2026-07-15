// Mobile RSS screen hook — wires useRssScreenModel to mobile bridge.
//
// Composes useQBClient + BridgeAdapter.qBClient into RSS adapter functions
// via createRssAdapterFns, then delegates to useRssScreenModel.

import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useQBClient } from '../connection/QBClientProvider';
import {
  useRssScreenModel,
  createRssAdapterFns,
} from '@taurent/web-core';

export function useRssScreen() {
  const { serverId, sessionGeneration, isConnected, capabilities } = useQBClient();

  const { getRssItems, getRssRules, mutations } = createRssAdapterFns(BridgeAdapter.qBClient);

  const model = useRssScreenModel({
    scope: { serverId, sessionGeneration, isConnected },
    capabilities,
    getRssItems,
    getRssRules,
    mutations,
  });

  return model;
}