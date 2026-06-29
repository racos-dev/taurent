import type { ReactNode } from 'react';
import { createServerManagerBindings } from '@taurent/web-core';
import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import type { ServerManagerContextType } from '@taurent/web-core/server/ServerManagerContextType';

// Re-export the shared context type so consumers don't need to reach into web-core
export type { ServerManagerContextType };

const { ServerManagerProvider: MobileServerManagerProvider, useServerManager } =
  createServerManagerBindings<ServerManagerContextType>({
    bridge: BridgeAdapter.servers,
    capabilities: BridgeAdapter.capabilities,
  });

export { useServerManager };

interface ServerManagerProviderProps {
  children: ReactNode;
}

// Thin wrapper — matches the public API surface that desktop also exposes
export function ServerManagerProvider({ children }: ServerManagerProviderProps) {
  return <MobileServerManagerProvider>{children}</MobileServerManagerProvider>;
}
