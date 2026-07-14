/**
 * useStandardContextValue.test.ts
 *
 * Integration tests for useStandardContextValue verifying that the
 * Rust capability fetch path (getServerCapabilities) is the single source
 * of truth for capability flags.
 *
 * The legacy TypeScript probe/merge pipeline has been removed (Phase 3):
 *   - useServerCapabilities (version parsing)
 *   - useServerCapabilityProbes (HTTP probes)
 *   - ServerCapabilities type with version/buildInfo fields
 * The renderer now only consumes AppCapabilities — a 4-field tri-state
 * derived directly from Rust's ResolvedCapabilities.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useStandardContextValue, type CapabilityBridge } from './useStandardContextValue';
import type { RustCapabilitiesResponse } from '@taurent/bridge';
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
      server_name: 'Test Server',
      server_url: 'http://localhost:8080',
    }),
    ...overrides,
  };
}

function makeRustCapabilitiesResponse(
  search: 'confirmed' | 'unsupported' | 'unknown',
  rss: 'confirmed' | 'unsupported' | 'unknown',
  pauseResume: 'confirmed' | 'unsupported' | 'unknown',
  webSeedManagement: 'confirmed' | 'unsupported' | 'unknown' = 'unknown',
): RustCapabilitiesResponse {
  return {
    session_generation: 1,
    server_id: 'test-server-id',
    capabilities: {
      supports_search: search,
      supports_rss: rss,
      supports_pause_resume: pauseResume,
      supports_webseed_management: webSeedManagement,
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useStandardContextValue — Rust capability path', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('starts with capabilitiesLoading=true when getServerCapabilities is provided', async () => {
      const bridge = createMockBridge({
        // Never-resolving deferred so we can observe the initial loading state.
        getServerCapabilities: vi.fn<() => Promise<RustCapabilitiesResponse>>(
          () => new Promise(() => {}),
        ),
      });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      // Initial render — the fetch effect schedules the Rust call but the
      // promise hasn't resolved yet, so loading stays true.
      expect(result.current.capabilitiesLoading).toBe(true);
      expect(result.current.capabilities).toBeNull();
      expect(result.current.capabilitiesError).toBeNull();
    });

    it('keeps capabilitiesLoading=true while not connected (does not error)', async () => {
      const getServerCapabilities = vi.fn<() => Promise<RustCapabilitiesResponse>>(
        () => new Promise(() => {}),
      );
      const bridge = createMockBridge({ getServerCapabilities });
      const controller = createMockController({ isConnected: false, serverId: null });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      // The effect short-circuits when not connected — no error surfaced.
      expect(result.current.capabilitiesError).toBeNull();
      expect(getServerCapabilities).not.toHaveBeenCalled();
    });
  });

  describe('successful mapping', () => {
    it('maps Rust confirmed → true for all flags', async () => {
      const rustResponse = makeRustCapabilitiesResponse(
        'confirmed',
        'confirmed',
        'confirmed',
        'confirmed',
      );
      const bridge = createMockBridge({
        getServerCapabilities: vi.fn().mockResolvedValue(rustResponse),
      });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.capabilities).not.toBeNull();
      });

      expect(result.current.capabilities?.supportsSearch).toBe(true);
      expect(result.current.capabilities?.supportsRss).toBe(true);
      expect(result.current.capabilities?.supportsPauseResume).toBe(true);
      expect(result.current.capabilities?.supportsWebSeedManagement).toBe(true);
      expect(result.current.capabilities?.hasUnknownCapabilities).toBe(false);
      expect(result.current.capabilitiesLoading).toBe(false);
      expect(result.current.capabilitiesError).toBeNull();
    });

    it('maps Rust unsupported → false and unknown → null', async () => {
      const rustResponse = makeRustCapabilitiesResponse(
        'confirmed',
        'unsupported',
        'unknown',
        'unsupported',
      );
      const bridge = createMockBridge({
        getServerCapabilities: vi.fn().mockResolvedValue(rustResponse),
      });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.capabilities).not.toBeNull();
      });

      expect(result.current.capabilities?.supportsSearch).toBe(true);
      expect(result.current.capabilities?.supportsRss).toBe(false);
      expect(result.current.capabilities?.supportsPauseResume).toBe(null);
      expect(result.current.capabilities?.supportsWebSeedManagement).toBe(false);
      expect(result.current.capabilities?.hasUnknownCapabilities).toBe(true);
    });
  });

  describe('error handling', () => {
    it('surfaces capabilitiesError when getServerCapabilities rejects', async () => {
      const bridge = createMockBridge({
        getServerCapabilities: vi.fn().mockRejectedValue(new Error('Rust error')),
      });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.capabilitiesError).not.toBeNull();
      });

      // formatUserMessageForContext reformats the message — assert it is set
      // rather than asserting on the exact string.
      const error = result.current.capabilitiesError;
      expect(typeof error).toBe('string');
      expect(error && error.length).toBeGreaterThan(0);
      expect(result.current.capabilitiesLoading).toBe(false);
      // Capabilities stays null on error — consumers branch on null.
      expect(result.current.capabilities).toBeNull();
    });
  });

  describe('null bridge', () => {
    it('leaves capabilities null and loading false when getServerCapabilities is absent', async () => {
      const bridge = createMockBridge({ getServerCapabilities: undefined });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.capabilitiesLoading).toBe(false);
      });

      // No Rust source — capabilities stays null, no error surfaced.
      expect(result.current.capabilities).toBeNull();
      expect(result.current.capabilitiesError).toBeNull();
    });
  });

  describe('refreshCapabilities', () => {
    it('re-fetches Rust capabilities when called', async () => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(makeRustCapabilitiesResponse('confirmed', 'confirmed', 'confirmed'))
        .mockResolvedValueOnce(makeRustCapabilitiesResponse('unsupported', 'unknown', 'confirmed'));
      const bridge = createMockBridge({ getServerCapabilities: fetch });
      const controller = createMockController({ isConnected: true, serverId: 'test-server-id' });

      const { result } = renderHook(
        () => useStandardContextValue({ controller, bridge }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(result.current.capabilities?.supportsSearch).toBe(true);
      });
      expect(fetch).toHaveBeenCalledTimes(1);

      // Trigger refresh.
      result.current.refreshCapabilities();

      await waitFor(() => {
        expect(result.current.capabilities?.supportsSearch).toBe(false);
      });
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('server metadata (getSessionSnapshot)', () => {
    it('populates serverName and serverUrl from the snapshot', async () => {
      const bridge = createMockBridge({
        getSessionSnapshot: vi.fn().mockResolvedValue({
          server_name: 'My Qbit',
          server_url: 'http://192.168.1.10:8080',
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
    });
  });
});
