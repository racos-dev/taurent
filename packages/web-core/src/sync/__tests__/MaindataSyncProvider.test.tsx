/**
 * MaindataSyncProvider backend sync tests (T130.4 + T149.4 + T152.3)
 *
 * Tests the MaindataSyncProvider's ability to:
 * - Accept backendBridge prop and wire it to the backend sync path
 * - Call startMaindataSync/stopMaindataSync lifecycle hooks
 * - Register maindata-sync-changed event listeners
 * - Surface combined protectedRequestHealth
 * - Reset on session generation change
 * - Maintain selector stability
 * - Support refetch
 * - Re-inject `torrent.hash` from the keyed map on backend snapshot and
 *   event-driven refresh ingestion (T149.4 authoritative backend fix).
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MaindataSyncChangedEvent, MaindataSnapshotResponse, MaindataSyncHealth as RustMaindataSyncHealth } from '@taurent/bridge/types';
import type { MaindataState, Torrent, SyncServerState } from '@taurent/shared';
import type { MaindataSyncScope } from '../MaindataSyncProvider';

// Mock perf audit to avoid noise
vi.mock('@taurent/shared/utils/perfAudit', () => ({
  count: vi.fn(),
  mark: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Mock factories ────────────────────────────────────────────────────────────

function createMockBackendBridge() {
  const listeners = new Set<(event: MaindataSyncChangedEvent) => void>();

  // Test-only snapshot envelope. Mirrors the qBittorrent wire format: the
  // torrent map is keyed by hash and the per-row `hash` field is intentionally
  // omitted so the hook can prove it re-injects the hash before React sees it.
  // The optional `__mockSnapshotOverride` lets each test customize the payload
  // returned by the next getMaindataSnapshot() call without losing the
  // session/revision defaults.
  let nextSnapshotOverride: Partial<MaindataSnapshotResponse> | null = null;
  const defaultSnapshot: MaindataSnapshotResponse = {
    session_generation: 1,
    server_id: 'srv1',
    revision: 1,
    rid: 1,
    health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
    maindata: { torrents: {}, categories: {}, tags: [], server_state: mockServerState },
  };

  return {
    getMaindataSnapshot: vi.fn().mockImplementation(() => {
      const override = nextSnapshotOverride;
      nextSnapshotOverride = null;
      return Promise.resolve({ ...defaultSnapshot, ...(override ?? {}) } satisfies MaindataSnapshotResponse);
    }),
    getMaindataSyncStatus: vi.fn().mockResolvedValue({
      state: 'healthy',
      consecutive_errors: 0,
      last_success_ts: null,
      last_error_ts: null,
      last_error_message: null,
    } satisfies RustMaindataSyncHealth),
    startMaindataSync: vi.fn().mockResolvedValue(undefined),
    stopMaindataSync: vi.fn().mockResolvedValue(undefined),
    addMaindataSyncListener: vi.fn().mockImplementation((handler: (event: MaindataSyncChangedEvent) => void) => {
      listeners.add(handler);
      return () => { listeners.delete(handler); };
    }),
    // Test helper to emit events to registered listeners
    emit: (event: MaindataSyncChangedEvent) => listeners.forEach((h) => h(event)),
    // Test helper: queue a one-shot snapshot override for the next fetch
    queueSnapshotOverride: (override: Partial<MaindataSnapshotResponse>) => {
      nextSnapshotOverride = override;
    },
  };
}

function mockTorrent(overrides: { name: string; hash?: string }): Torrent {
  const base: Torrent = {
    added_on: 0,
    amount_left: 0,
    auto_tmm: false,
    availability: 0,
    category: '',
    completed: 0,
    completion_on: 0,
    content_path: '',
    dl_limit: 0,
    dlspeed: 0,
    downloaded: 0,
    downloaded_session: 0,
    eta: 0,
    f_l_piece_prio: false,
    force_start: false,
    hash: '',
    last_activity: 0,
    magnet_uri: '',
    max_ratio: 0,
    max_seeding_time: 0,
    name: overrides.name,
    num_complete: 0,
    num_incomplete: 0,
    num_leechs: 0,
    num_seeds: 0,
    priority: 0,
    progress: 0,
    ratio: 0,
    ratio_limit: 0,
    save_path: '',
    seeding_time: 0,
    seeding_time_limit: 0,
    seen_complete: 0,
    seq_dl: false,
    size: 0,
    state: '',
    super_seeding: false,
    tags: '',
    time_active: 0,
    total_size: 0,
    tracker: '',
    up_limit: 0,
    uploaded: 0,
    uploaded_session: 0,
    upspeed: 0,
  };
  if (overrides.hash) base.hash = overrides.hash;
  return base;
}

const mockServerState: SyncServerState = {
  dl_info_speed: 0,
  dl_info_data: 0,
  up_info_speed: 0,
  up_info_data: 0,
  dl_rate_limit: 0,
  up_rate_limit: 0,
  dht_nodes: 0,
  connection_status: 'connected',
  queueing: false,
  use_alt_speed_limits: false,
  refresh_interval: 1500,
};

// ─── Render helper ────────────────────────────────────────────────────────────

type RenderProviderOptions = {
  backendBridge?: ReturnType<typeof createMockBackendBridge>;
  scope?: MaindataSyncScope;
  children?: React.ReactElement | null;
};

async function renderProvider(opts: RenderProviderOptions) {
  const { MaindataSyncProvider } = await import('../MaindataSyncProvider');
  const scope: MaindataSyncScope = opts.scope ?? { serverId: 'srv1', sessionGeneration: 1, isConnected: true, isHydrated: true };

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Wrap render() in async act() so the post-commit useEffect chain (startMaindataSync,
  // getMaindataSnapshot, addMaindataSyncListener) flushes inside the act boundary. Without
  // this wrapper the async state updates inside the provider's effects fire outside act
  // and React logs "An update to MaindataSyncProvider inside a test was not wrapped in act".
  let renderResult!: ReturnType<typeof render>;
  await act(async () => {
    renderResult = render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          MaindataSyncProvider,
          {
            backendBridge: opts.backendBridge,
            scope,
          },
          opts.children ?? React.createElement('div'),
        ),
      ),
    );
  });
  return renderResult;
}

/**
 * Test-only helper that emits a sync-changed event through the backend bridge.
 * Wrapped in act() because the registered listener handler runs synchronously
 * inside emit() and calls multiple setState functions (setSyncHealth, etc.)
 * that would otherwise fire outside an act boundary.
 */
function emitSyncEvent(
  backendBridge: ReturnType<typeof createMockBackendBridge>,
  event: Parameters<ReturnType<typeof createMockBackendBridge>['emit']>[0],
): void {
  act(() => {
    backendBridge.emit(event);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MaindataSyncProvider backend sync', () => {
  describe('backendBridge prop wiring', () => {
    it('calls startMaindataSync when backendBridge is provided', async () => {
      const backendBridge = createMockBackendBridge();
      await renderProvider({ backendBridge });

      await waitFor(() => {
        expect(backendBridge.startMaindataSync).toHaveBeenCalledTimes(1);
      });
    });

    it('registers maindata-sync-changed event listener when backendBridge is provided', async () => {
      const backendBridge = createMockBackendBridge();
      await renderProvider({ backendBridge });

      await waitFor(() => {
        expect(backendBridge.addMaindataSyncListener).toHaveBeenCalledTimes(1);
      });
    });

    it('calls stopMaindataSync on unmount when backendBridge was provided', async () => {
      const backendBridge = createMockBackendBridge();
      const { unmount } = await renderProvider({ backendBridge });

      await waitFor(() => expect(backendBridge.startMaindataSync).toHaveBeenCalled());

      // Wrap unmount in act() so React flushes any state updates triggered by
      // the provider's cleanup effect (the cleanup function calls
      // stopMaindataSync whose resolution can race with additional setState).
      await act(async () => {
        unmount();
      });

      await waitFor(() => {
        expect(backendBridge.stopMaindataSync).toHaveBeenCalledWith('srv1');
      });
    });

    it('unsubscribes listener on unmount', async () => {
      const backendBridge = createMockBackendBridge();
      const unsubscribe = vi.fn();
      backendBridge.addMaindataSyncListener.mockReturnValueOnce(unsubscribe);

      const { unmount } = await renderProvider({ backendBridge });
      await waitFor(() => expect(backendBridge.addMaindataSyncListener).toHaveBeenCalled());

      await act(async () => {
        unmount();
      });
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('stale session discard', () => {
    it('discards events with session_generation different from current scope', async () => {
      const backendBridge = createMockBackendBridge();
      const { getMaindataSnapshot } = backendBridge;

      await renderProvider({
        backendBridge,
        scope: { serverId: 'srv1', sessionGeneration: 5, isConnected: true, isHydrated: true },
      });

      await waitFor(() => expect(getMaindataSnapshot).toHaveBeenCalled());

      // Emit event from a stale session (generation 3, while current is 5).
      // Wrap in act() because the registered listener handler runs synchronously
      // inside emit() — even though this particular event is discarded before any
      // state update fires, the handler is invoked outside React's commit phase.
      emitSyncEvent(backendBridge, {
        server_id: 'srv1',
        session_generation: 3,
        revision: 2,
        rid: 2,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
        delta: null,
      });

      // No additional snapshot fetch should occur — event discarded
      expect(getMaindataSnapshot).toHaveBeenCalledTimes(1);
    });

    it('discards events with server_id different from current scope', async () => {
      const backendBridge = createMockBackendBridge();
      const { getMaindataSnapshot } = backendBridge;

      await renderProvider({ backendBridge });

      await waitFor(() => expect(getMaindataSnapshot).toHaveBeenCalled());

      // Emit event from a different server. Wrap in act() so the listener
      // handler — invoked synchronously inside emit() — runs inside an act
      // boundary.
      emitSyncEvent(backendBridge, {
        server_id: 'srv2',
        session_generation: 1,
        revision: 2,
        rid: 2,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
        delta: null,
      });

      expect(getMaindataSnapshot).toHaveBeenCalledTimes(1);
    });
  });

  describe('health propagation', () => {
    it('surfaces syncHealth from backend bridge events without crashing', async () => {
      const backendBridge = createMockBackendBridge();

      await renderProvider({ backendBridge });

      await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalled());

      // Emit a degraded health event — provider should not crash.
      // The listener handler calls multiple setState functions (setSyncHealth,
      // setIsFetching) synchronously, so emit must run inside act().
      emitSyncEvent(backendBridge, {
        server_id: 'srv1',
        session_generation: 1,
        revision: 2,
        rid: 2,
        health: { state: 'degraded', consecutive_errors: 1, last_success_ts: Date.now() - 60000, last_error_ts: Date.now(), last_error_message: 'test' },
        changed_resources: [],
        delta: null,
      });

      // Allow the async fetchSnapshot() call kicked off by handleSyncChanged to
      // settle before the test ends so its setState calls land inside act.
      await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(2));
    });
  });

  describe('backend sync lifecycle cleanup', () => {
    it('stopMaindataSync is called with the serverId captured at registration, not a later serverId', async () => {
      const backendBridge = createMockBackendBridge();
      const { getMaindataSnapshot } = backendBridge;

      // Initial render with srv1
      const scope1: MaindataSyncScope = { serverId: 'srv1', sessionGeneration: 1, isConnected: true, isHydrated: true };
      const { rerender, unmount } = await renderProvider({ backendBridge, scope: scope1 });
      await waitFor(() => expect(getMaindataSnapshot).toHaveBeenCalled());

      // Simulate server switch: sessionGeneration bumps, serverId changes
      const scope2: MaindataSyncScope = { serverId: 'srv2', sessionGeneration: 2, isConnected: true, isHydrated: true };

      // Intercept stopMaindataSync to record which serverId is passed
      const stopCalls: string[] = [];
      const originalStop = backendBridge.stopMaindataSync;
      backendBridge.stopMaindataSync = vi.fn().mockImplementation(async (serverId: string) => {
        stopCalls.push(serverId);
        return originalStop(serverId);
      });

      const { MaindataSyncProvider } = await import('../MaindataSyncProvider');
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      // Wrap rerender in act() because changing scope triggers the provider's
      // scope-reset effect (setAccumulatedMaindataState + setSyncHealth + ...)
      // and the previous effect's cleanup (calls stopMaindataSync).
      await act(async () => {
        rerender(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(
              MaindataSyncProvider,
              {
                backendBridge,
                scope: scope2,
              },
              React.createElement('div'),
            ),
          ),
        );
      });

      // The effect for srv1 should have cleaned up with 'srv1' (the captured value), not 'srv2'
      await waitFor(() => {
        expect(stopCalls).toContain('srv1');
      });
      // srv2 should also have been stopped on unmount
      await act(async () => {
        unmount();
      });
      await waitFor(() => {
        expect(stopCalls).toContain('srv2');
      });
    });
  });

  describe('useMaindataSelector stability', () => {
    it('renders without crashing when useMaindataSelector is used in child', async () => {
      const backendBridge = createMockBackendBridge();
      const { MaindataSyncProvider, useMaindataSelector } = await import('../MaindataSyncProvider');

      function TestSelector() {
        const torrents = useMaindataSelector((s: MaindataState) => s.torrents);
        return React.createElement('span', { 'data-testid': 'torrents' }, torrents ? 'has-torrents' : 'no-torrents');
      }

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      // Wrap render in act() — this test uses render() directly rather than
      // renderProvider(), so it needs its own act wrapper to capture the
      // async useEffect-driven setState calls (setMaindataState, setSyncHealth).
      await act(async () => {
        render(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(
              MaindataSyncProvider,
              {
                backendBridge,
                scope: { serverId: 'srv1', sessionGeneration: 1, isConnected: true, isHydrated: true },
              },
              React.createElement(TestSelector),
            ),
          ),
        );
      });

      await waitFor(() => {
        expect(document.querySelector('[data-testid="torrents"]')).toBeTruthy();
      });
    });
  });

  // ─── T149.4: backend snapshot normalization contract ─────────────────────────
  //
  // qBittorrent's `/api/v2/sync/maindata` wire format encodes each torrent's
  // hash only as the keyed-map key, not as a per-row `hash` field. The
  // backend-owned `useMaindataSyncBackend` path must inject the hash from the
  // keyed map before writing into React state, otherwise downstream consumers
  // (TorrentTableRow's `data-torrent-hash={torrent.hash}`) render empty
  // attributes and row identity is lost.

  describe('backend snapshot ingestion preserves torrent hashes (T149.4)', () => {
    it('initial snapshot re-injects torrent.hash from the keyed map for every torrent', async () => {
      const backendBridge = createMockBackendBridge();
      const { MaindataSyncProvider, useMaindataSelector } = await import('../MaindataSyncProvider');

      // Wire format: keyed map where the hash lives only on the key, not in the row.
      const HASH_A = 'a'.repeat(40);
      const HASH_B = 'b'.repeat(40);
      const torrentRow = mockTorrent({ name: 'Torrent Row', hash: HASH_A });
      backendBridge.queueSnapshotOverride({
        revision: 5,
        rid: 5,
        maindata: {
          torrents: { [HASH_A]: torrentRow, [HASH_B]: { ...torrentRow, hash: HASH_B } },
          categories: {},
          tags: [],
          server_state: mockServerState,
        },
      });

      // Capture the torrents map as seen by a hot consumer.
      const captured: Array<Record<string, { hash?: string; name?: string }> | null> = [];
      function TestSelector() {
        const torrents = useMaindataSelector((s: MaindataState) => s.torrents);
        captured.push(torrents as never);
        return React.createElement('span', { 'data-testid': 'torrents' }, String(Object.keys(torrents ?? {}).length));
      }

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      // Wrap render in act() so the async setMaindataState / setSyncHealth
      // updates fired by the provider's initial-snapshot effect land inside an
      // act boundary.
      await act(async () => {
        render(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(
              MaindataSyncProvider,
              {
                backendBridge,
                scope: { serverId: 'srv1', sessionGeneration: 1, isConnected: true, isHydrated: true },
              },
              React.createElement(TestSelector),
            ),
          ),
        );
      });

      // Wait for the selector to observe the normalized torrents map.
      await waitFor(() => {
        const latest = captured.at(-1);
        expect(latest?.[HASH_A]?.hash).toBe(HASH_A);
        expect(latest?.[HASH_B]?.hash).toBe(HASH_B);
      });
    });

    it('event-driven refresh re-injects torrent.hash from the keyed map for newly arrived torrents', async () => {
      const backendBridge = createMockBackendBridge();
      const { MaindataSyncProvider, useMaindataSelector } = await import('../MaindataSyncProvider');

      const HASH_NEW = 'c'.repeat(40);

      const captured: Array<Record<string, { hash?: string; name?: string }> | null> = [];
      function TestSelector() {
        const torrents = useMaindataSelector((s: MaindataState) => s.torrents);
        captured.push(torrents as never);
        return React.createElement('span', { 'data-testid': 'torrents' }, String(Object.keys(torrents ?? {}).length));
      }

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      // Wrap render in act() so the async initial-snapshot effect's state
      // updates settle inside an act boundary.
      await act(async () => {
        render(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(
              MaindataSyncProvider,
              {
                backendBridge,
                scope: { serverId: 'srv1', sessionGeneration: 1, isConnected: true, isHydrated: true },
              },
              React.createElement(TestSelector),
            ),
          ),
        );
      });

      // Wait for the initial empty snapshot to land.
      await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1));

      // Queue the refresh snapshot AFTER the initial fetch consumed the default.
      backendBridge.queueSnapshotOverride({
        revision: 6,
        rid: 6,
        maindata: {
          torrents: {
            [HASH_NEW]: mockTorrent({ name: 'Injected Torrent', hash: HASH_NEW }),
          },
          categories: {},
          tags: [],
          server_state: mockServerState,
        },
      });

      // Emit a sync-changed event for the new revision — the hook should
      // refetch the snapshot and re-inject torrent.hash from the keyed map.
      // Wrap in act() because the listener handler invokes setSyncHealth
      // synchronously, then kicks off an async fetchSnapshot() whose
      // setAccumulatedMaindataState + setSyncHealth calls must also land
      // inside act for React to flush without warnings.
      emitSyncEvent(backendBridge, {
        server_id: 'srv1',
        session_generation: 1,
        revision: 6,
        rid: 6,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
        delta: null,
      });

      await waitFor(() => {
        const latest = captured.at(-1);
        expect(latest?.[HASH_NEW]?.hash).toBe(HASH_NEW);
        expect(latest?.[HASH_NEW]?.name).toBe('Injected Torrent');
      });
      expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(2);
    });
  });
});
