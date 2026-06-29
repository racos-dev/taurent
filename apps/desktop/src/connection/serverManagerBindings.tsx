/* eslint-disable react-refresh/only-export-components */
import { useEffect, type ReactNode } from 'react';
import { listen } from '@tauri-apps/api/event';
import { createServerManagerBindings } from '@taurent/web-core';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import type { ServerManagerContextType as SharedServerManagerContextType } from '@taurent/web-core/server/ServerManagerContextType';

export interface ServerManagerContextType extends SharedServerManagerContextType {
  updateServerCredentials: NonNullable<SharedServerManagerContextType['updateServerCredentials']>;
}

// ---------------------------------------------------------------------------
// Helper: runtime invariant for desktop's required updateServerCredentials
// ---------------------------------------------------------------------------

function requireUpdateServerCredentials(
  baseValue: SharedServerManagerContextType,
): ServerManagerContextType {
  if (!baseValue.updateServerCredentials) {
    throw new Error(
      'Desktop ServerManager requires updateServerCredentials but it is not available from the controller. ' +
        'Ensure the bridge advertises supportsCredentialsUpdate: true.'
    );
  }
  return {
    ...baseValue,
    updateServerCredentials: baseValue.updateServerCredentials,
  };
}

// ---------------------------------------------------------------------------
// Bindings — called exactly once, shared by both the provider and hook
// ---------------------------------------------------------------------------

const { ServerManagerProvider: DesktopServerManagerProvider, useServerManager } =
  createServerManagerBindings<ServerManagerContextType>({
    bridge: BridgeAdapter.servers,
    capabilities: BridgeAdapter.capabilities,
    // createSessionEventListener intentionally omitted for the main window.
    // Passing it would register a second independent Tauri session-changed listener
    // that calls loadServers() on every session event, producing fresh currentServer
    // object references that spuriously re-trigger useSessionBootstrap's auto-connect.
    // The settings auxiliary window does not perform server switches, so cross-window
    // server-list sync is not required here.
    extendContextValue: requireUpdateServerCredentials,
  });

// ---------------------------------------------------------------------------
// Cross-window sync: listen for server-list-changed events emitted by the
// Settings window after a server removal and re-fetch the server list so the
// main window sees the updated (possibly empty) list.
// ---------------------------------------------------------------------------

function ServerListSyncListener() {
  const { refreshServers } = useServerManager();

  useEffect(() => {
    const unlisten = listen('server-list-changed', () => {
      void refreshServers();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refreshServers]);

  return null;
}

// ---------------------------------------------------------------------------
// Provider component — wraps the internal provider
// ---------------------------------------------------------------------------

interface ServerManagerProviderProps {
  children: ReactNode;
}

export function ServerManagerProvider({ children }: ServerManagerProviderProps) {
  return (
    <DesktopServerManagerProvider>
      <ServerListSyncListener />
      {children}
    </DesktopServerManagerProvider>
  );
}

// Re-export the hook
export { useServerManager };
