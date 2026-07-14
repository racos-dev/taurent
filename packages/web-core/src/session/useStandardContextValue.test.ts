/**
 * useStandardContextValue.test.ts
 *
 * Integration tests for useStandardContextValue verifying that the
 * `SessionSnapshot.capabilities` block (Rust-resolved) is the single source
 * of truth for capability flags. There is no separate `getServerCapabilities`
 * Tauri command in v2 — capabilities ride alongside session metadata.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useStandardContextValue, type CapabilityBridge } from './useStandardContextValue';
import { makeServerCapabilities, type ServerCapabilities } from '@taurent/bridge';
import type { SessionController } from './sessionController';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper() {
  const queryClient = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createMockController(overrides: Partial<SessionController> = {}): SessionController {
  return {
    serverId: 'test-server-id',
    sessionGeneration: 1,
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    ...overrides,
  } as unknown as SessionController;
}

function createMockBridge(overrides: Partial<CapabilityBridge> = {}): CapabilityBridge {
  return {
    getSessionSnapshot: vi.fn().mockResolvedValue({
      session_generation: 1,
      server_id: 'test-server-id',
      server_name: 'Test Server',
      server_url: 'http://localhost:8080',
      api_version: '5.1.0',
      app_version: 'v5.0.0',
      status: 'connected',
      last_error: null,
      capabilities: makeServerCapabilities({
        supports_search: false,
        supports_rss: false,
        supports_webseed_management: false,
      }),
    }),
    ...overrides,
  };
}

function makeCapabilitiesSnapshot(
  capabilities: Partial<ServerCapabilities> = {},
  apiVersion: string | null = '5.1.0',
  overrides: Partial<import('@taurent/bridge').SessionSnapshot> = {},
) {
  return {
    session_generation: 1,
    server_id: 'test-server-id',
    server_name: 'Test Server',
    server_url: 'http://localhost:8080',
    api_version: apiVersion,
    app_version: 'v5.0.0',
    status: 'connected',
    last_error: null,
    capabilities: makeServerCapabilities({
      supports_search: false,
      supports_rss: false,
      supports_webseed_management: false,
      ...capabilities,
    }),
    ...overrides,
  } as const;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useStandardContextValue — Rust capability path via session snapshot', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('capability mapping', () => {
    it('maps every server capability true across the snapshot', async () => {
      const bridge = createMockBridge({
        getSessionSnapshot: vi.fn().mockResolvedValue(
          makeCapabilitiesSnapshot({
            supports_search: true,
            supports_rss: true,
            supports_webseed_management: true,
          }),
        ),
      });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.capabilities.supportsSearch).toBe(true);
      });

      expect(result.current.capabilities.supportsSearch).toBe(true);
      expect(result.current.capabilities.supportsRss).toBe(true);
      expect(result.current.capabilities.supportsWebseedManagement).toBe(true);
    });

    it('maps every server capability false across the snapshot', async () => {
      const bridge = createMockBridge({
        getSessionSnapshot: vi.fn().mockResolvedValue(makeCapabilitiesSnapshot()),
      });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.capabilities.supportsSearch).toBe(false);
      });

      expect(result.current.capabilities.supportsSearch).toBe(false);
      expect(result.current.capabilities.supportsRss).toBe(false);
      expect(result.current.capabilities.supportsWebseedManagement).toBe(false);
    });

    it('maps mixed capability values verbatim from the snapshot', async () => {
      const bridge = createMockBridge({
        getSessionSnapshot: vi.fn().mockResolvedValue(
          makeCapabilitiesSnapshot({
            supports_search: true,
            supports_rss: false,
            supports_webseed_management: true,
          }),
        ),
      });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.capabilities.supportsSearch).toBe(true);
      });

      expect(result.current.capabilities.supportsSearch).toBe(true);
      expect(result.current.capabilities.supportsRss).toBe(false);
      expect(result.current.capabilities.supportsWebseedManagement).toBe(true);
    });

    it('defaults to all-false capabilities when bridge.getSessionSnapshot is absent', () => {
      const bridge = createMockBridge({ getSessionSnapshot: undefined });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      // Always defined, no loading/error surfaces — consumers can rely on it.
      expect(result.current.capabilities.supportsSearch).toBe(false);
      expect(result.current.capabilities.supportsRss).toBe(false);
      expect(result.current.capabilities.supportsWebseedManagement).toBe(false);
    });
  });

  describe('server metadata (getSessionSnapshot)', () => {
    it('populates serverName, serverUrl, apiVersion and appVersion from the snapshot', async () => {
      const bridge = createMockBridge({
        getSessionSnapshot: vi.fn().mockResolvedValue({
          session_generation: 1,
          server_id: 'test-server-id',
          server_name: 'My Qbit',
          server_url: 'http://192.168.1.10:8080',
          api_version: '5.1.2',
          app_version: 'v5.0.0',
          status: 'connected',
          last_error: null,
          capabilities: makeServerCapabilities({
            supports_search: false,
            supports_rss: false,
            supports_webseed_management: false,
          }),
        }),
      });
      const controller = createMockController();

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.serverName).toBe('My Qbit');
      });

      expect(result.current.serverName).toBe('My Qbit');
      expect(result.current.serverUrl).toBe('http://192.168.1.10:8080');
      expect(result.current.apiVersion).toBe('5.1.2');
      expect(result.current.appVersion).toBe('v5.0.0');
    });

    it('retries a transient snapshot failure for the current session generation', async () => {
      vi.useFakeTimers();
      const bridge = createMockBridge({
        getSessionSnapshot: vi.fn()
          .mockRejectedValueOnce(new Error('temporary IPC failure'))
          .mockResolvedValueOnce(
            makeCapabilitiesSnapshot({
              supports_search: true,
              supports_rss: true,
            }),
          ),
      });
      const controller = createMockController();

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      vi.useRealTimers();

      await waitFor(() => {
        expect(result.current.capabilities.supportsSearch).toBe(true);
      });

      expect(bridge.getSessionSnapshot).toHaveBeenCalledTimes(2);
      expect(result.current.capabilities.supportsRss).toBe(true);
    });

    it('ignores a stale snapshot response after the controller moves to a newer server generation', async () => {
      let resolveStaleSnapshot: (snapshot: ReturnType<typeof makeCapabilitiesSnapshot>) => void = () => {};
      const staleSnapshotPromise = new Promise<ReturnType<typeof makeCapabilitiesSnapshot>>((resolve) => {
        resolveStaleSnapshot = resolve;
      });

      const bridge = createMockBridge({
        getSessionSnapshot: vi.fn()
          .mockReturnValueOnce(staleSnapshotPromise)
          .mockResolvedValueOnce(
            makeCapabilitiesSnapshot(
              { supports_search: true },
              '5.2.0',
              {
                session_generation: 2,
                server_id: 'new-server-id',
                server_name: 'New Server',
              },
            ),
          ),
      });

      let controller = createMockController({
        serverId: 'old-server-id',
        sessionGeneration: 1,
      });

      const { result, rerender } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      controller = createMockController({
        serverId: 'new-server-id',
        sessionGeneration: 2,
      });
      rerender();

      await waitFor(() => {
        expect(result.current.serverName).toBe('New Server');
      });

      await act(async () => {
        resolveStaleSnapshot(
          makeCapabilitiesSnapshot(
            { supports_search: false, supports_rss: true },
            '4.6.6',
            {
              session_generation: 1,
              server_id: 'old-server-id',
              server_name: 'Old Server',
            },
          ),
        );
        await Promise.resolve();
      });

      expect(result.current.serverName).toBe('New Server');
      expect(result.current.apiVersion).toBe('5.2.0');
      expect(result.current.capabilities.supportsSearch).toBe(true);
      expect(result.current.capabilities.supportsRss).toBe(false);
    });
  });
});
