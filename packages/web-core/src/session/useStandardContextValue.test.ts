/**
 * useStandardContextValue.test.ts
 *
 * Integration tests for useStandardContextValue verifying that the
 * `SessionSnapshot.capabilities` block (Rust-resolved) is the single source
 * of truth for capability flags. There is no separate `getServerCapabilities`
 * Tauri command in v2 — capabilities ride alongside session metadata.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
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
    sessionGeneration: 0,
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
) {
  return {
    session_generation: 1,
    server_id: 'test-server-id',
    server_name: 'Test Server',
    server_url: 'http://localhost:8080',
    api_version: apiVersion,
    status: 'connected',
    last_error: null,
    capabilities: makeServerCapabilities({
      supports_search: false,
      supports_rss: false,
      supports_webseed_management: false,
      ...capabilities,
    }),
  } as const;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useStandardContextValue — Rust capability path via session snapshot', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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
    it('populates serverName, serverUrl and apiVersion from the snapshot', async () => {
      const bridge = createMockBridge({
        getSessionSnapshot: vi.fn().mockResolvedValue({
          session_generation: 1,
          server_id: 'test-server-id',
          server_name: 'My Qbit',
          server_url: 'http://192.168.1.10:8080',
          api_version: '5.1.2',
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
    });
  });
});
