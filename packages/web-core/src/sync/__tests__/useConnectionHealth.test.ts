/**
 * useConnectionHealth tests
 *
 * Covers the unified connection-health state machine:
 * - State derivation from isConnected + syncHealth + protectedRequestHealth
 * - serverIdentity resolution order (serverName > serverUrl > fallback)
 * - unavailableSinceMs transitions into / out of connected_unavailable
 * - reconnected debounce (>= 3000ms unhealthy before flash, <3000ms stays silent)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, act } from '@testing-library/react';
import { useMaindataState, type MaindataSyncContextValue } from '../MaindataSyncProvider';
import {
  useConnectionHealth,
  type ConnectionHealth,
} from '../useConnectionHealth';
import type { MaindataSyncHealth } from '../useMaindataSyncBackend';
import type { ProtectedRequestHealth } from '../protectedRequestHealth';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../MaindataSyncProvider', () => ({
  useMaindataState: vi.fn(),
}));

const mockedUseMaindataState = vi.mocked(useMaindataState);

// ─── Fixture data ─────────────────────────────────────────────────────────────

const HEALTHY_SYNC: MaindataSyncHealth = {
  status: 'healthy',
  consecutiveErrorCount: 0,
  lastSuccessfulSyncAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
};

const DEGRADED_SYNC: MaindataSyncHealth = {
  status: 'degraded',
  consecutiveErrorCount: 1,
  lastSuccessfulSyncAt: null,
  lastErrorAt: Date.now(),
  lastErrorMessage: 'transient sync error',
};

const RETRYING_SYNC: MaindataSyncHealth = {
  status: 'retrying',
  consecutiveErrorCount: 2,
  lastSuccessfulSyncAt: null,
  lastErrorAt: Date.now(),
  lastErrorMessage: 'network down',
};

const HEALTHY_PROTECTED: ProtectedRequestHealth = {
  status: 'idle',
  consecutiveErrorCount: 0,
  lastErrorAt: null,
  lastSuccessAt: null,
};

const BELOW_THRESHOLD_PROTECTED: ProtectedRequestHealth = {
  status: 'degraded',
  consecutiveErrorCount: 1,
  lastErrorAt: Date.now(),
  lastSuccessAt: null,
};

const AT_THRESHOLD_PROTECTED: ProtectedRequestHealth = {
  status: 'degraded',
  consecutiveErrorCount: 2,
  lastErrorAt: Date.now(),
  lastSuccessAt: null,
};

// ─── Test helpers ─────────────────────────────────────────────────────────────

interface MockQBClientState {
  isConnected: boolean;
  serverName: string | null;
  serverUrl: string | null;
}

/**
 * Build a mutable mock `useQBClient` whose return value can be updated between
 * renders. Each `setState` causes subsequent calls (including those triggered
 * by renderHook rerender) to return the new value.
 */
function makeUseQBClient(initial: MockQBClientState) {
  let state: MockQBClientState = initial;
  const fn = vi.fn(() => state);
  return Object.assign(fn, {
    setState: (next: MockQBClientState) => {
      state = next;
    },
    getState: () => state,
  });
}

function buildMaindataStateMock(
  syncHealth: MaindataSyncHealth,
  protectedRequestHealth: ProtectedRequestHealth,
): MaindataSyncContextValue {
  return {
    maindataState: null,
    isConnected: true,
    isHydrated: true,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
    syncHealth,
    protectedRequestHealth,
  };
}

beforeEach(() => {
  // Default: healthy across the board. Tests override as needed.
  mockedUseMaindataState.mockReturnValue(
    buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ─── State derivation ─────────────────────────────────────────────────────────

describe('useConnectionHealth — state derivation', () => {
  it('returns disconnected when isConnected is false', () => {
    const useQBClient = makeUseQBClient({
      isConnected: false,
      serverName: 'localhost',
      serverUrl: 'http://localhost:8080',
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.state).toBe('disconnected');
  });

  it('returns connected_healthy when connected and both health signals are healthy', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'my-server',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.state).toBe('connected_healthy');
  });

  it('returns connected_degraded when syncHealth.status is degraded (1 error) but not retrying', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'my-server',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(DEGRADED_SYNC, HEALTHY_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.state).toBe('connected_degraded');
  });

  it('returns connected_unavailable when syncHealth.status is retrying', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'my-server',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(RETRYING_SYNC, HEALTHY_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.state).toBe('connected_unavailable');
  });

  it('returns connected_unavailable when protectedRequestHealth.consecutiveErrorCount >= 2', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'my-server',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, AT_THRESHOLD_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.state).toBe('connected_unavailable');
  });

  it('prefers connected_degraded over connected_unavailable for the protected below-threshold case', () => {
    // Below-threshold protected (1 error) is degraded, not unavailable.
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'my-server',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, BELOW_THRESHOLD_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.state).toBe('connected_degraded');
  });

  it('returns connected_degraded when sync is degraded even if protected is below threshold (combined degraded)', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'my-server',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(DEGRADED_SYNC, BELOW_THRESHOLD_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.state).toBe('connected_degraded');
  });
});

// ─── serverIdentity resolution ────────────────────────────────────────────────

describe('useConnectionHealth — serverIdentity resolution', () => {
  it('prefers serverName over serverUrl and fallbackIdentity', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'My Server',
      serverUrl: 'http://localhost:8080',
    });

    const { result } = renderHook(() =>
      useConnectionHealth({
        useQBClient,
        fallbackIdentity: 'fallback-label',
      }),
    );

    expect(result.current.serverIdentity).toBe('My Server');
  });

  it('falls back to serverUrl when serverName is null', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: null,
      serverUrl: 'http://qbittorrent.local:8080',
    });

    const { result } = renderHook(() =>
      useConnectionHealth({
        useQBClient,
        fallbackIdentity: 'fallback-label',
      }),
    );

    expect(result.current.serverIdentity).toBe('http://qbittorrent.local:8080');
  });

  it('falls back to fallbackIdentity when serverName and serverUrl are both null', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: null,
      serverUrl: null,
    });

    const { result } = renderHook(() =>
      useConnectionHealth({
        useQBClient,
        fallbackIdentity: 'fallback-label',
      }),
    );

    expect(result.current.serverIdentity).toBe('fallback-label');
  });

  it('returns null when no identity source is available', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: null,
      serverUrl: null,
    });

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.serverIdentity).toBeNull();
  });
});

// ─── unavailableSinceMs tracking ──────────────────────────────────────────────

describe('useConnectionHealth — unavailableSinceMs tracking', () => {
  it('sets unavailableSinceMs when entering connected_unavailable and clears it when leaving', () => {
    vi.useFakeTimers();
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);

    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });

    // Render 1: healthy — no unavailableSinceMs
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    const { result, rerender } = renderHook(() => useConnectionHealth({ useQBClient }));
    expect(result.current.unavailableSinceMs).toBeNull();

    // Render 2: become unavailable — should set unavailableSinceMs
    vi.setSystemTime(start + 5_000);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(RETRYING_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_unavailable');
    expect(result.current.unavailableSinceMs).toBe(start + 5_000);

    // Render 3: recover — should clear unavailableSinceMs
    vi.setSystemTime(start + 8_000);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_healthy');
    expect(result.current.unavailableSinceMs).toBeNull();
  });

  it('does not set unavailableSinceMs when mounted directly into connected_unavailable (initial mount is not a transition)', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(RETRYING_SYNC, HEALTHY_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.state).toBe('connected_unavailable');
    // No "since" timestamp on initial mount — we don't know how long it was
    // unavailable before the hook attached.
    expect(result.current.unavailableSinceMs).toBeNull();
  });

  it('does not set unavailableSinceMs when transitioning between healthy and degraded (only unavailable triggers the timestamp)', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });

    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    const { result, rerender } = renderHook(() => useConnectionHealth({ useQBClient }));
    expect(result.current.unavailableSinceMs).toBeNull();

    // Move to degraded (not unavailable)
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(DEGRADED_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_degraded');
    expect(result.current.unavailableSinceMs).toBeNull();
  });
});

// ─── reconnected debounce ─────────────────────────────────────────────────────

describe('useConnectionHealth — reconnected debounce', () => {
  it('flashes reconnected=true after recovering from an unhealthy state that lasted >= 3000ms', () => {
    vi.useFakeTimers();
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);

    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });

    // Render 1: healthy
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    const { result, rerender } = renderHook(() => useConnectionHealth({ useQBClient }));
    expect(result.current.reconnected).toBe(false);

    // Render 2: enter unavailable
    vi.setSystemTime(start + 1_000);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(RETRYING_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_unavailable');
    expect(result.current.reconnected).toBe(false);

    // Wait 3 seconds of unhealthy time
    vi.setSystemTime(start + 1_000 + 3_000);

    // Render 3: recover
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_healthy');
    expect(result.current.reconnected).toBe(true);
  });

  it('keeps reconnected=false for quick unhealthy flaps (< 3000ms)', () => {
    vi.useFakeTimers();
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);

    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });

    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    const { result, rerender } = renderHook(() => useConnectionHealth({ useQBClient }));

    // Enter unavailable
    vi.setSystemTime(start + 1_000);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(RETRYING_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_unavailable');

    // Recover quickly (only 1s of unhealthy time)
    vi.setSystemTime(start + 2_000);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_healthy');
    // Quick flap should NOT trigger reconnected flash
    expect(result.current.reconnected).toBe(false);
  });

  it('flashes reconnected=true when recovering from degraded (not just unavailable)', () => {
    vi.useFakeTimers();
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);

    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });

    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    const { result, rerender } = renderHook(() => useConnectionHealth({ useQBClient }));

    // Enter degraded
    vi.setSystemTime(start + 500);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(DEGRADED_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_degraded');

    // Stay in degraded past the debounce threshold, then recover
    vi.setSystemTime(start + 500 + 3_500);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.state).toBe('connected_healthy');
    expect(result.current.reconnected).toBe(true);
  });

  it('auto-clears reconnected after ~2500ms', () => {
    vi.useFakeTimers();
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);

    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });

    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    const { result, rerender } = renderHook(() => useConnectionHealth({ useQBClient }));

    // Enter unavailable
    vi.setSystemTime(start + 1_000);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(RETRYING_SYNC, HEALTHY_PROTECTED),
    );
    rerender();

    // Recover after long enough to trigger reconnected
    vi.setSystemTime(start + 5_000);
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );
    rerender();
    expect(result.current.reconnected).toBe(true);

    // Advance past the 2500ms flash window
    vi.setSystemTime(start + 5_000 + 2_600);
    // The setTimeout in the effect fires when the fake clock passes it.
    // We need a render to flush — the timer is set during the previous effect
    // run, so it just needs the clock to pass for the timer callback to run.
    // Wrap in act() so React batches the setReconnected(false) call that the
    // timer callback makes — without this, React flags a state update that
    // happened outside an act boundary.
    act(() => {
      vi.runOnlyPendingTimers();
    });
    // Re-render is not strictly needed because setReconnected runs synchronously
    // inside the timer callback, which triggers a state update that React will
    // flush on the next opportunity.
    // To force observation, trigger a render via rerender with same props.
    rerender();
    expect(result.current.reconnected).toBe(false);
  });
});

// ─── lastErrorMessage surfacing ───────────────────────────────────────────────

describe('useConnectionHealth — lastErrorMessage', () => {
  it('surfaces syncHealth.lastErrorMessage when present', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(RETRYING_SYNC, HEALTHY_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.lastErrorMessage).toBe('network down');
  });

  it('returns null lastErrorMessage when sync is healthy', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    expect(result.current.lastErrorMessage).toBeNull();
  });
});

// ─── Return shape contract ────────────────────────────────────────────────────

describe('useConnectionHealth — return shape', () => {
  it('returns all documented fields', () => {
    const useQBClient = makeUseQBClient({
      isConnected: true,
      serverName: 'srv',
      serverUrl: null,
    });
    mockedUseMaindataState.mockReturnValue(
      buildMaindataStateMock(HEALTHY_SYNC, HEALTHY_PROTECTED),
    );

    const { result } = renderHook(() => useConnectionHealth({ useQBClient }));

    const expectedKeys: Array<keyof ConnectionHealth> = [
      'state',
      'serverIdentity',
      'reconnected',
      'unavailableSinceMs',
      'lastErrorMessage',
    ];
    for (const key of expectedKeys) {
      expect(result.current).toHaveProperty(key);
    }
  });
});
