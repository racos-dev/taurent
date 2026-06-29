// Shared auth boundary factory.
// Platform-agnostic: accepts injected app hooks so no Tauri imports leak into web-core.
//
// Responsibilities:
//   - Route decision logic via useSessionBootstrap
//   - Navigation via react-router primitives
//   - Loading state via injected LoadingComponent

import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSessionBootstrap } from './useSessionBootstrap';
import type { QBClientContextValue } from './QBClientContextValue';
import type { ServerManagerContextType } from '../server/ServerManagerContextType';

const DEFAULT_PUBLIC_PATHS = ['/servers', '/add-server'] as const;

export interface CreateAuthBoundaryOptions {
  useQBClient: () => QBClientContextValue;
  useServerManager: () => ServerManagerContextType;
  LoadingComponent: React.ComponentType<{ text?: string }>;
  publicPaths?: readonly string[];
  /** Path to the server list/picker screen (default: '/servers') */
  serverListPath?: string;
}

export function createAuthBoundary({
  useQBClient,
  useServerManager,
  LoadingComponent,
  publicPaths = DEFAULT_PUBLIC_PATHS,
  serverListPath = '/servers',
}: CreateAuthBoundaryOptions) {
  function AuthBoundary() {
    const navigate = useNavigate();
    const location = useLocation();
    const { servers, currentServer, loading: serversLoading } = useServerManager();
    const { connect, isConnected, isConnecting, isHydrated, serverId } = useQBClient();
    const locationState = location.state as { suppressConnectedRedirect?: boolean } | null;

    const { isLoading, loadingText, redirectTarget } = useSessionBootstrap({
      serversCount: servers.length,
      serversLoading,
      currentServer,
      connectedServerId: serverId,
      isHydrated,
      isConnecting,
      isConnected,
      pathname: location.pathname,
      publicPaths,
      connect,
      serverListPath,
      suppressConnectedPublicRedirect: locationState?.suppressConnectedRedirect === true,
    });

    useEffect(() => {
      if (redirectTarget) {
        navigate(redirectTarget.path, {
          replace: redirectTarget.replace,
          state: redirectTarget.state,
        });
      }
    }, [redirectTarget, navigate]);

    if (isLoading) {
      return <LoadingComponent text={loadingText} />;
    }

    return <Outlet />;
  }

  return { AuthBoundary };
}
