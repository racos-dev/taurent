/**
 * ConnectedServerUnavailableOverlay tests — browser mode
 *
 * Tests:
 * - null when isConnected is false (even if sync is degraded)
 * - null when connected but sync health is healthy
 * - visible when connected and sync health is degraded
 * - visible when connected and sync health is retrying
 * - displays serverName or serverUrl as identity
 * - falls back to "Current server" when both are null
 * - Open Servers: navigate('/login') immediately, then disconnect
 * - navigate is called even when disconnect rejects
 * - button shows loading spinner while disconnect is in-progress
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render, fireEvent } from '@testing-library/react';
import type {
  ConnectionHealthState,
  MaindataSyncHealth,
  MaindataSyncHealthStatus,
} from '@taurent/web-core';
import { ConnectedServerUnavailableOverlay } from './ConnectedServerUnavailableOverlay';

// ─── Shared mock state ─────────────────────────────────────────────────────────
//
// All state is held in plain objects (not `let` primitives) so vi.mock factory
// always sees the current values even when they are mutated in-place.
//
const qbClientState = {
  isConnected: true,
  serverName: 'My Server' as string | null,
  serverUrl: 'http://localhost:8080' as string | null,
  disconnect: vi.fn().mockResolvedValue(undefined),
};

const connectionHealthState = {
  state: 'connected_healthy' as ConnectionHealthState,
  serverIdentity: 'My Server' as string | null,
  reconnected: false,
  unavailableSinceMs: null as number | null,
  lastErrorMessage: null as string | null,
};

const navigateFn = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateFn,
  MemoryRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@taurent/web-core/sync', () => ({
  useConnectionHealth: () => connectionHealthState,
}));

vi.mock('../../connection', () => ({
  useQBClient: () => ({
    isConnected: qbClientState.isConnected,
    serverName: qbClientState.serverName,
    serverUrl: qbClientState.serverUrl,
    disconnect: qbClientState.disconnect,
  }),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildHealth(status: MaindataSyncHealthStatus): MaindataSyncHealth {
  return {
    status,
    consecutiveErrorCount: status === 'retrying' ? 5 : status === 'degraded' ? 1 : 0,
    lastSuccessfulSyncAt: status === 'idle' ? null : Date.now() - 1000,
    lastErrorAt: status === 'idle' ? null : Date.now() - 500,
    lastErrorMessage: status === 'retrying' ? 'sync failed' : null,
  };
}

function resetState() {
  qbClientState.isConnected = true;
  qbClientState.serverName = 'My Server';
  qbClientState.serverUrl = 'http://localhost:8080';
  qbClientState.disconnect.mockResolvedValue(undefined);
  connectionHealthState.state = 'connected_healthy';
  connectionHealthState.serverIdentity = 'My Server';
  connectionHealthState.reconnected = false;
  connectionHealthState.unavailableSinceMs = null;
  connectionHealthState.lastErrorMessage = null;
  navigateFn.mockClear();
}

/**
 * Translate the legacy (syncHealth, protectedHealth, isConnected) shape into
 * the derived ConnectionHealthState the hook would produce. Mirrors the
 * derivation order in useConnectionHealth:
 *
 *   disconnected           — !isConnected
 *   connected_unavailable  — maindata retrying OR protected >= 2 errors
 *   connected_degraded     — maindata degraded OR protected status=degraded
 *   connected_healthy      — otherwise
 */
function deriveState(args: {
  isConnected: boolean;
  syncHealth: MaindataSyncHealth;
  protectedHealth: { consecutiveErrorCount: number; status: 'idle' | 'healthy' | 'degraded' };
}): ConnectionHealthState {
  const { isConnected, syncHealth, protectedHealth } = args;
  if (!isConnected) return 'disconnected';
  if (syncHealth.status === 'retrying' || protectedHealth.consecutiveErrorCount >= 2) {
    return 'connected_unavailable';
  }
  if (syncHealth.status === 'degraded' || protectedHealth.status === 'degraded') {
    return 'connected_degraded';
  }
  return 'connected_healthy';
}

function applyState(overrides: {
  isConnected?: boolean;
  serverName?: string | null;
  serverUrl?: string | null;
  syncHealth?: MaindataSyncHealth;
  protectedHealth?: { consecutiveErrorCount: number; status: 'idle' | 'healthy' | 'degraded' };
}) {
  if (overrides.isConnected !== undefined) qbClientState.isConnected = overrides.isConnected;
  if (overrides.serverName !== undefined) qbClientState.serverName = overrides.serverName;
  if (overrides.serverUrl !== undefined) qbClientState.serverUrl = overrides.serverUrl;

  const syncHealth: MaindataSyncHealth = overrides.syncHealth ?? buildHealth('healthy');
  const protectedHealth = overrides.protectedHealth ?? {
    status: 'idle' as const,
    consecutiveErrorCount: 0,
  };

  connectionHealthState.state = deriveState({
    isConnected: qbClientState.isConnected,
    syncHealth,
    protectedHealth,
  });
  connectionHealthState.serverIdentity =
    qbClientState.serverName ?? qbClientState.serverUrl ?? 'Current server';
}

function renderOverlay() {
  return render(<ConnectedServerUnavailableOverlay />);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ConnectedServerUnavailableOverlay', () => {
  beforeEach(resetState);
  afterEach(resetState);

  it('returns null when not connected', () => {
    applyState({ isConnected: false, syncHealth: buildHealth('retrying') });
    const { container } = renderOverlay();
    expect(container.firstChild).toBeNull();
  });

  it('returns null when connected and sync is healthy', () => {
    applyState({ syncHealth: buildHealth('healthy') });
    const { container } = renderOverlay();
    expect(container.firstChild).toBeNull();
  });

  it('returns null when connected and sync is idle', () => {
    applyState({ syncHealth: buildHealth('idle') });
    const { container } = renderOverlay();
    expect(container.firstChild).toBeNull();
  });

  it('returns null when connected and sync is degraded below threshold', () => {
    applyState({ syncHealth: buildHealth('degraded') });
    const { container } = renderOverlay();
    expect(container.firstChild).toBeNull();
  });

  it('shows overlay when connected and sync is retrying', () => {
    applyState({ syncHealth: buildHealth('retrying') });
    const { container } = renderOverlay();
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain('Current server unavailable');
    expect(container.textContent).toContain('My Server');
  });

  it('displays serverUrl when serverName is null', () => {
    applyState({ serverName: null, syncHealth: buildHealth('retrying') });
    const { container } = renderOverlay();
    expect(container.textContent).toContain('http://localhost:8080');
  });

  it('falls back to "Current server" when both serverName and serverUrl are null', () => {
    applyState({ serverName: null, serverUrl: null, syncHealth: buildHealth('retrying') });
    const { container } = renderOverlay();
    expect(container.textContent).toContain('Current server');
  });

  it('Open Servers navigates to /login immediately, then disconnects', async () => {
    let resolveDisconnect: () => void;
    qbClientState.disconnect.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDisconnect = resolve; }),
    );
    applyState({ syncHealth: buildHealth('retrying') });

    const { container } = renderOverlay();
    const button = container.querySelector('button')!;

    // Click — should navigate immediately to /login with suppressConnectedRedirect
    await act(async () => {
      fireEvent.click(button);
    });
    expect(navigateFn).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { suppressConnectedRedirect: true },
    });
    expect(qbClientState.disconnect).toHaveBeenCalled();

    // Resolve disconnect — no further navigation
    await act(async () => {
      resolveDisconnect!();
    });
    expect(navigateFn).toHaveBeenCalledTimes(1);
  });

  it('navigates immediately even when disconnect rejects', async () => {
    qbClientState.disconnect.mockRejectedValue(new Error('network error'));
    applyState({ syncHealth: buildHealth('retrying') });

    const { container } = renderOverlay();
    const button = container.querySelector('button')!;

    await act(async () => {
      fireEvent.click(button);
    });

    // Navigate fires before disconnect, so it is called even on reject
    expect(navigateFn).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { suppressConnectedRedirect: true },
    });
    expect(qbClientState.disconnect).toHaveBeenCalled();
  });

  it('shows loading spinner on button while disconnect is in-progress', async () => {
    qbClientState.disconnect.mockImplementation(
      () => new Promise<void>(() => {}),
    );
    applyState({ syncHealth: buildHealth('retrying') });

    const { container } = renderOverlay();
    const button = container.querySelector('button')!;

    await act(async () => {
      fireEvent.click(button);
    });

    const spinner = container.querySelector('span.animate-spin');
    expect(spinner).not.toBeNull();
  });

  // ─── T77.5: protected request outage regressions ─────────────────────────────

  it('shows overlay when connected and healthy maindata but protected-request health is degraded at threshold', () => {
    // Core T77.5 regression: maindata polling is still healthy, but two
    // protected endpoint requests have failed — overlay must show.
    applyState({
      syncHealth: buildHealth('healthy'),
      protectedHealth: { status: 'degraded', consecutiveErrorCount: 2 },
    });
    const { container } = renderOverlay();
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent).toContain('Current server unavailable');
  });

  it('hides overlay when disconnected even if protected-request health is degraded at threshold', () => {
    // Disconnected state must suppress the overlay regardless of protected-request health.
    applyState({
      isConnected: false,
      protectedHealth: { status: 'degraded', consecutiveErrorCount: 2 },
    });
    const { container } = renderOverlay();
    expect(container.firstChild).toBeNull();
  });
});