/**
 * sessionController.test.ts
 *
 * Covers the frontend startup-restore contract for T79:
 * - connect() rejects promptly when bridge.sessionConnectById() rejects,
 *   without waiting for connectTimeoutMs or a session-changed error event.
 * - On rejection: promise rejects, isConnecting returns to false,
 *   error state is set, and no stale pending-connect refs remain.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { SessionBridge, SessionEventListener, QueryInvalidator } from '../sessionController';
import { useSessionController } from '../sessionController';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@taurent/shared/utils/perfAudit', () => ({
  mark: vi.fn(),
}));

vi.mock('../hooks/operationFailureReporter', () => ({
  reportOperationFailure: vi.fn(),
}));

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

function createFakeBridge(overrides: Partial<SessionBridge> = {}): SessionBridge {
  return {
    getSessionSnapshot: vi.fn().mockResolvedValue({
      status: 'disconnected' as const,
      server_id: null,
      session_generation: 0,
      last_error: null,
    }),
    sessionConnectById: vi.fn().mockResolvedValue(1),
    sessionDisconnect: vi.fn().mockResolvedValue(1),
    sessionHealthCheck: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function createFakeListeners(): SessionEventListener {
  return {
    createSessionEventListener: vi.fn().mockResolvedValue(() => {}),
    createResourceInvalidatedListener: vi.fn().mockResolvedValue(() => {}),
  };
}

function createFakeInvalidator(): QueryInvalidator {
  return {
    invalidateOnConnect: vi.fn(),
    handleResourceInvalidated: vi.fn(),
  };
}

const BASE_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 0,
  performRetry: vi.fn().mockResolvedValue(undefined),
};

const STABLE_SERVER = { id: 'server-d21a01f90aa246fb86cbcf810a9575e0' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sessionController — command rejection', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('rejects the connect promise when sessionConnectById rejects', async () => {
    const bridge = createFakeBridge({
      sessionConnectById: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const listeners = createFakeListeners();
    const invalidator = createFakeInvalidator();

    const { result } = renderHook(
      () =>
        useSessionController({
          bridge,
          listeners,
          queryClient: makeQueryClient(),
          invalidator,
          retryConfig: BASE_RETRY_CONFIG,
          connectTimeoutMs: 30_000,
        }),
      { wrapper: makeWrapper() }
    );

    // Wait for hydration
    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    // The Promise executor runs synchronously; the promise is assigned immediately.
    // Wrap both the synchronous setIsConnecting(true) call inside connect() and the
    // async catch-handler setState calls in act() so React can flush the updates
    // before we assert.
    await act(async () => {
      const connectPromise = result.current.connect(STABLE_SERVER.id);
      // The promise should reject.
      // Note: the catch handler in the controller sets error state; we verify
      // promise rejection here and state in the test below.
      await expect(connectPromise).rejects.toThrow('Connection refused');
    });
  });

  it('sets isConnecting to false and records error after command rejection', async () => {
    const bridge = createFakeBridge({
      sessionConnectById: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const listeners = createFakeListeners();
    const invalidator = createFakeInvalidator();

    const { result } = renderHook(
      () =>
        useSessionController({
          bridge,
          listeners,
          queryClient: makeQueryClient(),
          invalidator,
          retryConfig: BASE_RETRY_CONFIG,
          connectTimeoutMs: 30_000,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    // Wrap both the synchronous setIsConnecting(true) call inside connect() and the
    // async catch-handler setState calls in act() so React can flush the updates
    // before we assert on subsequent state.
    await act(async () => {
      const connectPromise = result.current.connect(STABLE_SERVER.id);
      // Wait for rejection to settle
      try {
        await connectPromise;
      } catch {
        // expected
      }
    });

    // After rejection, isConnecting should be false and error should be set.
    await waitFor(() => {
      expect(result.current.isConnecting).toBe(false);
    });
    expect(result.current.error).toBe('Connection refused');
    expect(result.current.isConnected).toBe(false);
  });

  it('rejects promptly without waiting for connectTimeoutMs', async () => {
    const bridge = createFakeBridge({
      sessionConnectById: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const listeners = createFakeListeners();
    const invalidator = createFakeInvalidator();

    const { result } = renderHook(
      () =>
        useSessionController({
          bridge,
          listeners,
          queryClient: makeQueryClient(),
          invalidator,
          retryConfig: BASE_RETRY_CONFIG,
          connectTimeoutMs: 30_000,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    const start = Date.now();
    await act(async () => {
      try {
        await result.current.connect(STABLE_SERVER.id);
      } catch {
        // expected
      }
    });
    const elapsed = Date.now() - start;

    // Should settle well before the 30s timeout
    expect(elapsed).toBeLessThan(5_000);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBe('Connection refused');
  });

  it('does not double-reject when command rejects and error event also fires', async () => {
    const bridge = createFakeBridge({
      sessionConnectById: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const listeners = createFakeListeners();
    const invalidator = createFakeInvalidator();

    const { result } = renderHook(
      () =>
        useSessionController({
          bridge,
          listeners,
          queryClient: makeQueryClient(),
          invalidator,
          retryConfig: BASE_RETRY_CONFIG,
          connectTimeoutMs: 30_000,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    // Wrap both the synchronous setIsConnecting(true) call inside connect() and the
    // async catch-handler setState calls in act() so React can flush the updates
    // before we assert.
    let connectPromise: Promise<void> | null = null;
    await act(async () => {
      connectPromise = result.current.connect(STABLE_SERVER.id);

      // Wait for command rejection to settle
      try {
        await connectPromise;
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(result.current.isConnecting).toBe(false);
    });

    // Now simulate the error event arriving — should not throw.
    // The listener invokes multiple setState calls synchronously (setSessionGeneration,
    // setServerId, reconcile → setIsConnected/setIsConnecting/setError); wrap in act
    // so React flushes the updates before we inspect the result.
    await act(async () => {
      const registered = (listeners.createSessionEventListener as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as ((e: { server_id: string; status: string; session_generation: number; last_error: string | null }) => void) | undefined;
      if (registered) {
        registered({
          server_id: STABLE_SERVER.id,
          status: 'error',
          session_generation: 1,
          last_error: 'Connection refused',
        });
      }
    });

    // Promise already rejected — should not throw again.
    // Safe non-null access: the act block above always assigns connectPromise.
    if (!connectPromise) throw new Error('connectPromise was not assigned');
    await expect(connectPromise).rejects.toThrow('Connection refused');
  });
});