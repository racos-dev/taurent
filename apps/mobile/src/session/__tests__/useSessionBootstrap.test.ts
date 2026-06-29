import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSessionBootstrap } from '@taurent/web-core/session/useSessionBootstrap';

const STABLE_SERVER = { id: 'server-1' };
const NO_SERVER = null;
const PUBLIC_PATHS = ['/servers', '/add-server'] as const;

const baseOptions = {
  serversCount: 0,
  serversLoading: false,
  currentServer: NO_SERVER as { id: string } | null,
  connectedServerId: null as string | null,
  isHydrated: true,
  isConnecting: false,
  isConnected: false,
  pathname: '/',
  publicPaths: PUBLIC_PATHS,
  connect: vi.fn(),
};

describe('useSessionBootstrap', () => {
  it('redirects to /add-server when no saved servers exist', async () => {
    const { result } = renderHook(() =>
      useSessionBootstrap({ ...baseOptions, serversCount: 0 }),
    );

    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    expect(result.current.redirectTarget).toEqual({
      path: '/add-server',
      replace: true,
    });
  });

  it('does not redirect when already on /add-server with no servers', async () => {
    const { result } = renderHook(() =>
      useSessionBootstrap({ ...baseOptions, serversCount: 0, pathname: '/add-server' }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.redirectTarget).toBeNull();
  });

  it('redirects to /servers when servers exist but no current server selected', async () => {
    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 2,
        currentServer: NO_SERVER,
      }),
    );

    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    expect(result.current.redirectTarget).toEqual({
      path: '/servers',
      replace: true,
    });
  });

  it('auto-connects and redirects to /servers with error on connect failure', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        isConnected: false,
        pathname: '/',
        connect,
      }),
    );

    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    expect(connect).toHaveBeenCalledWith('server-1');
    expect(result.current.redirectTarget).toEqual({
      path: '/servers',
      replace: true,
      state: { error: 'Connection refused', serverId: 'server-1' },
    });
  });

  it('redirects home when connected user visits a public path', async () => {
    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        connectedServerId: 'server-1',
        isConnected: true,
        pathname: '/servers',
      }),
    );

    await waitFor(() => {
      expect(result.current.redirectTarget).not.toBeNull();
    });

    expect(result.current.redirectTarget).toEqual({
      path: '/',
      replace: true,
    });
  });

  it('does not redirect when connected user is on a protected route', async () => {
    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        connectedServerId: 'server-1',
        isConnected: true,
        pathname: '/',
      }),
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.redirectTarget).toBeNull();
  });

  it('shows loading while hydrating', () => {
    const { result } = renderHook(() =>
      useSessionBootstrap({ ...baseOptions, isHydrated: false }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingText).toBe('Initializing...');
  });

  it('shows loading while fetching servers', () => {
    const { result } = renderHook(() =>
      useSessionBootstrap({ ...baseOptions, serversLoading: true }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingText).toBe('Loading servers...');
  });

  it('shows connecting text during auto-connect', async () => {
    const connect = vi.fn().mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const { result } = renderHook(() =>
      useSessionBootstrap({
        ...baseOptions,
        serversCount: 1,
        currentServer: STABLE_SERVER,
        isConnected: false,
        pathname: '/',
        connect,
      }),
    );

    await waitFor(() => {
      expect(result.current.isAttemptingAutoConnect).toBe(true);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingText).toBe('Connecting...');
    expect(connect).toHaveBeenCalledWith('server-1');
  });
});
