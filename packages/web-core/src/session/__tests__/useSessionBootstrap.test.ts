/**
 * useSessionBootstrap.test.ts
 *
 * Covers the frontend startup-restore contract for T79:
 * - Saved currentServer + protected route + connect() rejection redirects
 *   to /servers with { error, serverId } instead of staying in loading state.
 * - The saved server identity is preserved and included in the redirect state.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useSessionBootstrap } from '../useSessionBootstrap';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STABLE_SERVER = { id: 'server-d21a01f90aa246fb86cbcf810a9575e0' };
const PUBLIC_PATHS = ['/servers', '/add-server'] as const;

const baseOptions = {
  serversCount: 1,
  serversLoading: false,
  currentServer: STABLE_SERVER as { id: string } | null,
  connectedServerId: null as string | null,
  isHydrated: true,
  isConnecting: false,
  isConnected: false,
  pathname: '/',
  publicPaths: PUBLIC_PATHS,
  connect: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useSessionBootstrap — startup restore failure', () => {
  it('redirects to /servers with error and serverId when auto-connect rejects', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        isConnected: false,
        pathname: '/',
        connect,
      })
    );

    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    expect(connect).toHaveBeenCalledWith('server-d21a01f90aa246fb86cbcf810a9575e0');
    expect(result.current.redirectTarget).toEqual({
      path: '/servers',
      replace: true,
      state: { error: 'Connection refused', serverId: 'server-d21a01f90aa246fb86cbcf810a9575e0' },
    });
  });

  it('does not stay in loading state after auto-connect rejection', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        isConnected: false,
        pathname: '/',
        connect,
      })
    );

    // First auto-connect is in progress
    await waitFor(() => {
      expect(result.current.isAttemptingAutoConnect).toBe(true);
    });

    // After rejection, bootstrap resolves to a redirect without staying in loading
    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.redirectTarget?.path).toBe('/servers');
  });

  it('preserves saved server identity in redirect state after failure', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Server unreachable'));

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 3,
        currentServer: STABLE_SERVER,
        isConnected: false,
        pathname: '/torrents',
        connect,
      })
    );

    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    const redirectTarget = result.current.redirectTarget;
    expect(redirectTarget).not.toBeNull();
    expect(redirectTarget).toBeDefined();
    if (!redirectTarget) {
      throw new Error('Expected redirectTarget to be set');
    }

    const { state } = redirectTarget;
    expect(state).toHaveProperty('error', 'Server unreachable');
    expect(state).toHaveProperty('serverId', 'server-d21a01f90aa246fb86cbcf810a9575e0');
  });

  it('redirects to /servers with error and serverId when auto-connect rejects on protected route', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        isConnected: false,
        pathname: '/',
        connect,
      })
    );

    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    expect(connect).toHaveBeenCalledWith('server-d21a01f90aa246fb86cbcf810a9575e0');
    expect(result.current.redirectTarget).toEqual({
      path: '/servers',
      replace: true,
      state: { error: 'Connection refused', serverId: 'server-d21a01f90aa246fb86cbcf810a9575e0' },
    });
  });

  it('auto-connect rejection does not fire when already connected', async () => {
    const connect = vi.fn();

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        connectedServerId: 'server-d21a01f90aa246fb86cbcf810a9575e0',
        isConnected: true,
        pathname: '/',
        connect,
      })
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // connect should never have been called — already connected
    expect(connect).not.toHaveBeenCalled();
    expect(result.current.redirectTarget).toBeNull();
  });

  it('does not trigger auto-connect on public paths even with currentServer', async () => {
    const connect = vi.fn();

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        isConnected: false,
        pathname: '/servers',
        connect,
      })
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(connect).not.toHaveBeenCalled();
    expect(result.current.redirectTarget).toBeNull();
  });

  it('shows connecting text while auto-connect attempt is pending', async () => {
    const connect = vi.fn().mockImplementation(() => new Promise(() => {})); // never resolves

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        isConnected: false,
        pathname: '/',
        connect,
      })
    );

    await waitFor(() => {
      expect(result.current.isAttemptingAutoConnect).toBe(true);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingText).toBe('Connecting...');
  });

  it('clears auto-connect failure on subsequent successful connect', async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce(undefined);

    const { result, rerender } = renderHook(
      ({ isConnected }: { isConnected: boolean }) =>
        useSessionBootstrap({
          ...baseOptions,
          serversCount: 1,
          currentServer: STABLE_SERVER,
          isConnected,
          pathname: '/',
          connect,
        }),
      { initialProps: { isConnected: false } }
    );

    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    expect(result.current.redirectTarget?.state).toEqual({
      error: 'Connection refused',
      serverId: 'server-d21a01f90aa246fb86cbcf810a9575e0',
    });

    // Simulate reconnect succeeding
    rerender({ isConnected: true });

    await waitFor(() => {
      expect(result.current.redirectTarget).toBeNull();
    });
  });
});
