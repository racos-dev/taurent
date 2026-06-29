// Shared headless bootstrap hook for auth/session route decision logic.
//
// This hook is platform-agnostic and contains no Tauri imports.
// It accepts all required state and callbacks as options, making it reusable
// across desktop and mobile implementations.
//
// Responsibilities:
//   - Route decision logic for hydration/loading states
//   - No saved servers -> add-server route
//   - Saved servers but no current server -> login route
//   - Protected route while disconnected -> auto-connect (unless on public route)
//   - Auto-connect failure -> login route with { error, serverId }
//
// What it does NOT do:
//   - Does NOT render any UI (headless)
//   - Does NOT handle navigation directly; returns redirect target info
//   - Does NOT know about platform-specific loading spinners
//
// Flash prevention:
//   During startup, multiple state transitions (isHydrated, isConnecting,
//   isConnected) can cause isLoading to toggle on/off rapidly, creating a
//   flash loop. This hook uses a "settling" mechanism: once bootstrap enters
//   a loading state, it stays loading until the connection outcome is
//   definitively resolved (connected or failed). This prevents intermediate
//   state flicker.

import { useEffect, useState } from 'react';

export interface UseSessionBootstrapOptions {
  /** Total number of saved servers */
  serversCount: number;
  /** Whether the server list is currently loading */
  serversLoading: boolean;
  /** The currently selected server (if any) */
  currentServer: { id: string } | null;
  /** The server ID of the currently connected session (if any) */
  connectedServerId: string | null;
  /** Whether the session controller has completed hydration */
  isHydrated: boolean;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Whether the session is currently connected */
  isConnected: boolean;
  /** Current pathname */
  pathname: string;
  /** Paths that are considered public (skip auto-connect, redirect if connected) */
  publicPaths: readonly string[];
  /** Callback to initiate connection to a server */
  connect: (serverId: string) => Promise<void>;
  /** Path to the server list/picker screen (default: '/servers') */
  serverListPath?: string;
  /** Let a connected session stay on a public route for explicit server switching flows. */
  suppressConnectedPublicRedirect?: boolean;
}

export interface UseSessionBootstrapReturn {
  /** True while bootstrap is determining route (loading/hydrating/connecting) */
  isLoading: boolean;
  /** Human-readable loading stage text */
  loadingText: string;
  /** Whether bootstrap decision is complete and Outlet can render */
  isReady: boolean;
  /** Redirect target if a navigation decision was made this render */
  redirectTarget: { path: string; replace?: boolean; state?: Record<string, unknown> } | null;
  /** Whether an auto-connect attempt is in progress */
  isAttemptingAutoConnect: boolean;
}

/**
 * Headless bootstrap hook that centralizes session/route decision logic.
 *
 * Uses a settling mechanism to prevent flash loops during startup.
 * Once the hook enters a loading state (hydrating or connecting), it stays
 * loading until the connection outcome is definitively resolved. This prevents
 * intermediate state transitions from causing the loading indicator to flash.
 *
 * Callers must invoke the redirectTarget if non-null at the start of their effect,
 * before any other logic, to prevent flash of wrong content.
 *
 * Usage in a component:
 * ```tsx
 * const { isLoading, loadingText, isReady, redirectTarget, isAttemptingAutoConnect } = useSessionBootstrap({
 *   serversCount: servers.length,
 *   serversLoading,
 *   currentServer,
 *   connectedServerId: serverId,
 *   isHydrated,
 *   isConnecting,
 *   isConnected,
 *   pathname: location.pathname,
 *   publicPaths: ['/servers', '/add-server'],
 *   connect,
 * });
 *
 * // Handle redirect first
 * useEffect(() => {
 *   if (redirectTarget) {
 *     navigate(redirectTarget.path, { replace: redirectTarget.replace, state: redirectTarget.state });
 *   }
 * }, [redirectTarget, navigate]);
 * ```
 */
export function useSessionBootstrap({
  serversCount,
  serversLoading,
  currentServer,
  connectedServerId,
  isHydrated,
  isConnecting,
  isConnected,
  pathname,
  publicPaths,
  connect,
  serverListPath = '/servers',
  suppressConnectedPublicRedirect = false,
}: UseSessionBootstrapOptions): UseSessionBootstrapReturn {
  const [isAttemptingAutoConnect, setIsAttemptingAutoConnect] = useState(false);
  const [autoConnectFailure, setAutoConnectFailure] = useState<{ error: string; serverId: string } | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<UseSessionBootstrapReturn['redirectTarget']>(null);

  // ─── Flash prevention: settling guard ──────────────────────────────────
  // Once bootstrap enters a loading state, we stay loading until the outcome
  // is definitively resolved. This prevents isLoading from flickering between
  // true/false during rapid state transitions at startup.
  const [hasEnteredLoading, setHasEnteredLoading] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);

  // Track whether we've ever started an auto-connect attempt for this
  // bootstrap cycle, to prevent re-triggering after failure.
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  const isOnPublicPath = publicPaths.some((path) => pathname === path);

  // Reset the settling guard when the connected server changes (e.g., user
  // switches servers from settings), so the new connection can settle fresh.
  useEffect(() => {
    setHasEnteredLoading(false);
    setHasResolved(false);
    setAutoConnectAttempted(false);
  }, [connectedServerId]);

  // Clear auto-connect failure when connection succeeds
  useEffect(() => {
    if (isConnected) {
      setAutoConnectFailure(null);
      setHasResolved(true);
    }
  }, [isConnected]);

  // Compute redirect target — deterministic based on state
  useEffect(() => {
    // Still hydrating or loading servers — show loading, no redirect yet
    if (!isHydrated || serversLoading) {
      setRedirectTarget(null);
      return;
    }

    // No saved servers — must add one first
    if (serversCount === 0) {
      setRedirectTarget(pathname === '/add-server' ? null : { path: '/add-server', replace: true });
      return;
    }

    // Have servers but none selected as current — go to login
    if (serversCount > 0 && !currentServer) {
      setRedirectTarget(isOnPublicPath ? null : { path: serverListPath, replace: true });
      return;
    }

    if (autoConnectFailure) {
      setRedirectTarget(
        isOnPublicPath
          ? null
          : {
              path: serverListPath,
              replace: true,
              state: autoConnectFailure,
            }
      );
      return;
    }

    // Connected user on a public path — redirect to home
    if (isConnected && isOnPublicPath && !suppressConnectedPublicRedirect) {
      setRedirectTarget({ path: '/', replace: true });
      return;
    }

    // Protected route: we have a current server but are not connected and not on public path
    // Auto-connect will be triggered below
    if (currentServer && !isConnected && !isOnPublicPath) {
      // Let the auto-connect effect handle this
      setRedirectTarget(null);
      return;
    }

    // All other cases: no redirect needed
    setRedirectTarget(null);
  }, [
    isHydrated,
    serversLoading,
    serversCount,
    currentServer,
    isConnected,
    suppressConnectedPublicRedirect,
    connectedServerId,
    autoConnectFailure,
    isOnPublicPath,
    pathname,
    serverListPath,
  ]);

  // Auto-connect effect: triggered when we have a current server, not connected, and on protected route
  useEffect(() => {
    if (!isHydrated || serversLoading) {
      return;
    }

    if (serversCount === 0 || !currentServer) {
      return;
    }

    if (autoConnectFailure) {
      return;
    }

    if (isOnPublicPath) {
      return;
    }

    // Already connected — nothing to do.
    // The auto-connect guard below only applies when disconnected; if connected
    // to a different server (cross-window lag), leave the session alone and let
    // the session-changed event from the server-switch bring the two in sync.
    if (isConnected) {
      return;
    }

    // Already attempting auto-connect or currently connecting — let it continue
    if (isAttemptingAutoConnect || isConnecting) {
      return;
    }

    // Prevent re-triggering after a failed auto-connect in this bootstrap cycle
    if (autoConnectAttempted) {
      return;
    }

    setAutoConnectAttempted(true);
    setIsAttemptingAutoConnect(true);

    const attemptAutoConnect = async () => {
      try {
        await connect(currentServer.id);
        setIsAttemptingAutoConnect(false);
        setAutoConnectFailure(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Auto-connect failed';
        setIsAttemptingAutoConnect(false);
        setAutoConnectFailure({
          error: errorMessage,
          serverId: currentServer.id,
        });
      }
    };

    attemptAutoConnect();
  }, [
    isHydrated,
    serversLoading,
    serversCount,
    currentServer,
    isConnected,
    connectedServerId,
    autoConnectFailure,
    isOnPublicPath,
    isAttemptingAutoConnect,
    isConnecting,
    autoConnectAttempted,
    connect,
  ]);

  // ─── Derived loading state with flash prevention ────────────────────────
  // The raw loading state would flicker during rapid transitions. Instead,
  // once we enter a loading state, we stay loading until the connection
  // outcome is definitively resolved (connected or failed).
  const rawIsLoading = !isHydrated || serversLoading || isConnecting || isAttemptingAutoConnect;

  // Advance the settling flags monotonically — once set, they stay set
  // until the connectedServerId changes (which resets them above).
  if (rawIsLoading && !hasEnteredLoading) {
    setHasEnteredLoading(true);
  }

  if ((isConnected || autoConnectFailure) && !hasResolved) {
    setHasResolved(true);
  }

  // Stay loading if we've entered loading but haven't resolved yet,
  // UNLESS we've navigated to a public path (add-server, login) where
  // showing the loading screen would be wrong.
  const isLoading = rawIsLoading || (hasEnteredLoading && !hasResolved && !isOnPublicPath);

  const loadingText = (() => {
    if (!isHydrated) return 'Initializing...';
    if (serversLoading) return 'Loading servers...';
    if (isAttemptingAutoConnect || isConnecting) return 'Connecting...';
    return '';
  })();

  const isReady = !isLoading && redirectTarget === null;

  return {
    isLoading,
    loadingText,
    isReady,
    redirectTarget,
    isAttemptingAutoConnect,
  };
}
