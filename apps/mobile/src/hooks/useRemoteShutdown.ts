// Mobile remote shutdown hook.
//
// Wires useRemoteShutdown from web-core to mobile BridgeAdapter.application.shutdown().
// Kept here so SettingsScreen doesn't need to import BridgeAdapter directly.

import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useQBClient } from '../connection/QBClientProvider';
import { useRemoteShutdown } from '@taurent/web-core/hooks';

export function useRemoteShutdownMutation() {
  const { isConnected, serverId, sessionGeneration } = useQBClient();

  return useRemoteShutdown({
    scope: { serverId, sessionGeneration, isConnected },
    mutationFn: () => BridgeAdapter.application.shutdown(),
  });
}