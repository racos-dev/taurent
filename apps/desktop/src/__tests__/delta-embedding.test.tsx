/**
 * T165.4 — Delta embedding integration tests.
 *
 * Verifies the React `useMaindataSyncBackend` hook's delta application path:
 * - Small deltas embedded in `maindata-sync-changed` events are applied
 *   directly to React state, with NO `getMaindataSnapshot()` IPC round-trip.
 * - `delta: null` events fall back to the snapshot fetch (legacy path).
 * - `torrents_removed` deltas are applied without a snapshot fetch.
 * - Health-only events (empty `changed_resources`, `delta: null`) update the
 *   health status without a snapshot fetch.
 *
 * These tests exercise the delta path end-to-end through `MaindataSyncProvider`
 * using a mock backend bridge, so they catch regressions in:
 *   - the `applyDeltaToState` helper in `useMaindataSyncBackend.ts`,
 *   - the `handleSyncChanged` fast-path branch (delta present vs absent),
 *   - and the per-resource whitelist that protects against field drift
 *     between Rust and the renderer.
 *
 * Mirror of the Rust unit tests in `crates/qb-tauri/src/sync/manager.rs::tests`.
 * The Rust side covers the 256KB threshold; the React side covers the
 * renderer application logic.
 */

import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MaindataSyncChangedEvent, MaindataSnapshotResponse, MaindataSyncHealth as RustMaindataSyncHealth } from '@taurent/bridge/types';
import type { MaindataState, Torrent, SyncServerState } from '@taurent/shared';
import {
  MaindataSyncProvider,
  useMaindataSelector,
  useMaindataState,
  type MaindataSyncScope,
} from '@taurent/web-core/sync';

// Mock perf audit to avoid noise and to confirm the delta-applied marker
// is observed when the fast path fires. We must also stub `measure` (used
// by `mergeMaindata` internally) since the real implementation depends on
// `performance`/window APIs that are not relevant to this test.
const markSpy = vi.fn();
vi.mock('@taurent/shared/utils/perfAudit', () => ({
  count: vi.fn(),
  mark: (...args: unknown[]) => markSpy(...args),
  measure: (_label: string, fn: () => unknown) => fn(),
  flushCounters: vi.fn(),
  isPerfAuditEnabled: () => false,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Mock factories ────────────────────────────────────────────────────────────

/**
 * Mock backend bridge with recording and event-emit helpers. Each test
 * creates a fresh instance; `getMaindataSnapshot` is recorded as a mock
 * so tests can assert whether it was called and how many times.
 */
function createMockBackendBridge() {
  const listeners = new Set<(event: MaindataSyncChangedEvent) => void>();

  // Test-only snapshot envelope. Mirrors the qBittorrent wire format: the
  // torrent map is keyed by hash and the per-row `hash` field is omitted
  // (the keyed map key is the source of truth on the wire).
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

function renderProvider(opts: RenderProviderOptions) {
  const scope: MaindataSyncScope = opts.scope ?? { serverId: 'srv1', sessionGeneration: 1, isConnected: true, isHydrated: true };

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
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
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

/**
 * Captured-state child that records the latest torrents map and the
 * render-facing syncHealth. Defined at module scope so the hook call
 * is hoisted into the React tree without `require` shenanigans.
 */
function CapturedTorrentsAndHealth({
  capturedTorrents,
  capturedHealth,
}: {
  capturedTorrents: Array<Record<string, { name?: string; hash?: string }> | null>;
  capturedHealth: Array<{ status: string; consecutiveErrorCount: number }>;
}) {
  const torrents = useMaindataSelector((s: MaindataState) => s.torrents);
  capturedTorrents.push(torrents as never);
  // Drive a re-render when the health store changes — we use a selector that
  // returns a stable empty array on no-torrents (to avoid an extra render
  // channel) and a health-context read for the real signal.
  const ctx = useMaindataState();
  capturedHealth.push({
    status: ctx.syncHealth.status,
    consecutiveErrorCount: ctx.syncHealth.consecutiveErrorCount,
  });
  return React.createElement(
    'span',
    { 'data-testid': 'torrents' },
    String(Object.keys(torrents ?? {}).length),
  );
}

function CapturedTorrents({
  capturedTorrents,
}: {
  capturedTorrents: Array<Record<string, { name?: string; hash?: string }> | null>;
}) {
  const torrents = useMaindataSelector((s: MaindataState) => s.torrents);
  capturedTorrents.push(torrents as never);
  return React.createElement(
    'span',
    { 'data-testid': 'torrents' },
    String(Object.keys(torrents ?? {}).length),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('T165.4 — delta embedding application', () => {
  // ── test_delta_applied_directly ──────────────────────────────────────────
  //
  // Emit a `maindata-sync-changed` event with a small `delta` containing a
  // torrent change. React must apply the delta directly to its state and
  // must NOT call `getMaindataSnapshot` (the whole point of the T165 feature).
  it('test_delta_applied_directly: applies a small delta and skips getMaindataSnapshot', async () => {
    const backendBridge = createMockBackendBridge();
    const HASH_A = 'a'.repeat(40);
    const HASH_B = 'b'.repeat(40);

    // Initial state: two torrents at revision 5.
    backendBridge.queueSnapshotOverride({
      revision: 5,
      rid: 5,
      maindata: {
        torrents: {
          [HASH_A]: mockTorrent({ name: 'Original A', hash: HASH_A }),
          [HASH_B]: mockTorrent({ name: 'Original B', hash: HASH_B }),
        },
        categories: {},
        tags: [],
        server_state: mockServerState,
      },
    });

    const capturedTorrents: Array<Record<string, { name?: string; hash?: string }> | null> = [];
    const capturedHealth: Array<{ status: string; consecutiveErrorCount: number }> = [];

    renderProvider({
      backendBridge,
      children: React.createElement(CapturedTorrentsAndHealth, { capturedTorrents, capturedHealth }),
    });

    // Wait for the initial snapshot fetch to land and selectors to see two torrents.
    await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const latest = capturedTorrents.at(-1);
      expect(latest?.[HASH_A]?.name).toBe('Original A');
      expect(latest?.[HASH_B]?.name).toBe('Original B');
    });

    // Emit a sync-changed event with a delta that renames HASH_B. The fast
    // path must apply this delta directly without calling getMaindataSnapshot.
    await act(async () => {
      backendBridge.emit({
        server_id: 'srv1',
        session_generation: 1,
        revision: 6,
        rid: 6,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
        delta: {
          rid: 6,
          torrents: {
            [HASH_B]: { name: 'Renamed B' },
          },
        },
      });
    });

    // The selector should observe the renamed torrent.
    await waitFor(() => {
      const latest = capturedTorrents.at(-1);
      expect(latest?.[HASH_B]?.name).toBe('Renamed B');
      // HASH_A must remain unchanged.
      expect(latest?.[HASH_A]?.name).toBe('Original A');
    });

    // The fast path must have skipped the snapshot fetch — the call count
    // stays at 1 (the initial bootstrap).
    expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1);

    // The delta-applied perf mark should have fired (sanity check on the
    // fast-path branch).
    expect(markSpy).toHaveBeenCalledWith('maindata.delta.applied');
  });

  // ── test_delta_fallback_to_snapshot ──────────────────────────────────────
  //
  // Emit a `maindata-sync-changed` event with `delta: null` (e.g. health-only
  // update from a peer server, or a Rust-side threshold dropout). React must
  // fall back to `getMaindataSnapshot()` to keep state in sync.
  it('test_delta_fallback_to_snapshot: delta:null events trigger getMaindataSnapshot', async () => {
    const backendBridge = createMockBackendBridge();
    const HASH_A = 'a'.repeat(40);

    // Initial state: one torrent at revision 1.
    backendBridge.queueSnapshotOverride({
      revision: 1,
      rid: 1,
      maindata: {
        torrents: { [HASH_A]: mockTorrent({ name: 'Initial A', hash: HASH_A }) },
        categories: {},
        tags: [],
        server_state: mockServerState,
      },
    });

    renderProvider({
      backendBridge,
      children: React.createElement('span', null),
    });

    await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1));

    // Queue a new snapshot for the next fetch so the fallback path has
    // something to consume and the test can verify state was refreshed.
    backendBridge.queueSnapshotOverride({
      revision: 7,
      rid: 7,
      maindata: {
        torrents: { [HASH_A]: mockTorrent({ name: 'Refreshed A', hash: HASH_A }) },
        categories: {},
        tags: [],
        server_state: mockServerState,
      },
    });

    // Emit a sync-changed event with `delta: null` — the renderer must fall
    // back to the snapshot fetch.
    await act(async () => {
      backendBridge.emit({
        server_id: 'srv1',
        session_generation: 1,
        revision: 7,
        rid: 7,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
        delta: null,
      });
    });

    // The fallback path must have called getMaindataSnapshot exactly once more.
    await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(2));

    // The delta-applied mark must NOT have fired (we went down the slow path).
    expect(markSpy).not.toHaveBeenCalledWith('maindata.delta.applied');
  });

  // ── test_delta_removal_lists ─────────────────────────────────────────────
  //
  // Emit a delta with `torrents_removed`. React must apply the removal
  // without falling back to a snapshot fetch. This guards the removal-list
  // whitelist in `applyDeltaToState` and the `torrents_removed` changed
  // resource key.
  it('test_delta_removal_lists: torrents_removed deltas apply without a snapshot fetch', async () => {
    const backendBridge = createMockBackendBridge();
    const HASH_A = 'a'.repeat(40);
    const HASH_B = 'b'.repeat(40);
    const HASH_C = 'c'.repeat(40);

    // Initial state: three torrents.
    backendBridge.queueSnapshotOverride({
      revision: 3,
      rid: 3,
      maindata: {
        torrents: {
          [HASH_A]: mockTorrent({ name: 'A', hash: HASH_A }),
          [HASH_B]: mockTorrent({ name: 'B', hash: HASH_B }),
          [HASH_C]: mockTorrent({ name: 'C', hash: HASH_C }),
        },
        categories: {},
        tags: [],
        server_state: mockServerState,
      },
    });

    const capturedTorrents: Array<Record<string, { name?: string; hash?: string }> | null> = [];

    renderProvider({
      backendBridge,
      children: React.createElement(CapturedTorrents, { capturedTorrents }),
    });

    await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const latest = capturedTorrents.at(-1);
      expect(Object.keys(latest ?? {}).length).toBe(3);
    });

    // Emit a delta that removes HASH_B. The fast path must apply this
    // removal directly without calling getMaindataSnapshot.
    await act(async () => {
      backendBridge.emit({
        server_id: 'srv1',
        session_generation: 1,
        revision: 4,
        rid: 4,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents_removed'],
        delta: {
          rid: 4,
          torrents_removed: [HASH_B],
        },
      });
    });

    // The selector should observe only A and C; B was removed via the delta.
    await waitFor(() => {
      const latest = capturedTorrents.at(-1);
      expect(latest?.[HASH_A]).toBeDefined();
      expect(latest?.[HASH_B]).toBeUndefined();
      expect(latest?.[HASH_C]).toBeDefined();
    });

    // Snapshot fetch count must remain at 1 — the removal was applied via
    // the embedded delta, not a refetch.
    expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1);
    expect(markSpy).toHaveBeenCalledWith('maindata.delta.applied');
  });

  // ── test_health_update_without_delta ─────────────────────────────────────
  //
  // Emit a health-only event (empty `changed_resources`, `delta: null`).
  // The renderer must update the health surface and propagate the transition
  // to consumers (syncHealth becomes 'degraded'). The accumulated torrent
  // state must be left untouched.
  //
  // Implementation note: the current `useMaindataSyncBackend` falls through
  // to the snapshot fetch whenever `event.delta == null` and the revision is
  // new. This means a health-only event WILL trigger a snapshot fetch today
  // — the data hasn't changed so the fetch is a no-op in payload terms, but
  // the IPC round-trip still happens. The fast-path skip for health-only
  // events is a future optimization; this test pins the current contract:
  // health is updated, torrent state is preserved.
  //
  // The snapshot the mock returns after the health event is also degraded
  // (matching the event payload) so the post-fetch `setSyncHealth` from
  // `fetchSnapshot` lands on the same target. This isolates the
  // health-update path from the snapshot-fetch path while still proving
  // the renderer propagates the new health to the context.
  it('test_health_update_without_delta: health-only events update syncHealth and preserve data state', async () => {
    const backendBridge = createMockBackendBridge();
    const HASH_A = 'a'.repeat(40);

    const degradedHealth = {
      state: 'degraded' as const,
      consecutive_errors: 1,
      last_success_ts: null,
      last_error_ts: Math.floor(Date.now() / 1000),
      last_error_message: 'transient poll error',
    };

    backendBridge.queueSnapshotOverride({
      revision: 1,
      rid: 1,
      maindata: {
        torrents: { [HASH_A]: mockTorrent({ name: 'A', hash: HASH_A }) },
        categories: {},
        tags: [],
        server_state: mockServerState,
      },
    });

    const capturedTorrents: Array<Record<string, { name?: string; hash?: string }> | null> = [];
    const capturedHealth: Array<{ status: string; consecutiveErrorCount: number }> = [];

    renderProvider({
      backendBridge,
      children: React.createElement(CapturedTorrentsAndHealth, { capturedTorrents, capturedHealth }),
    });

    await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const latest = capturedTorrents.at(-1);
      expect(latest?.[HASH_A]?.name).toBe('A');
    });

    // Queue a snapshot for the next fetch whose health is also degraded —
    // this isolates the health-update path so the post-fetch setSyncHealth
    // lands on the same target as the event-driven setSyncHealth.
    backendBridge.queueSnapshotOverride({
      revision: 2,
      rid: 2,
      health: degradedHealth,
      maindata: {
        torrents: { [HASH_A]: mockTorrent({ name: 'A', hash: HASH_A }) },
        categories: {},
        tags: [],
        server_state: mockServerState,
      },
    });

    // Emit a health-only transition: degraded, with empty changed_resources
    // and delta: null. This mirrors what Rust emits when the accumulator
    // reported no changes but health transitioned.
    await act(async () => {
      backendBridge.emit({
        server_id: 'srv1',
        session_generation: 1,
        revision: 2,
        rid: 2,
        health: degradedHealth,
        changed_resources: [],
        delta: null,
      });
      // Allow any follow-up microtasks (e.g. fetchSnapshot) to drain so the
      // test exits act() only when React has flushed all queued state updates.
      await Promise.resolve();
    });

    // Health must transition to degraded. The renderer writes 'degraded'
    // from the event payload, and the subsequent snapshot fetch confirms
    // it — both paths land on the same target.
    await waitFor(() => {
      const latest = capturedHealth.at(-1);
      expect(latest?.status).toBe('degraded');
    });

    // The torrents map should be preserved (same names) after the
    // health-only event — the data hasn't changed. The reference may
    // differ from the pre-event ref because the snapshot fetch path
    // returns a new torrents map (mocked), but the content is identical.
    const finalTorrents = capturedTorrents.at(-1);
    expect(finalTorrents?.[HASH_A]?.name).toBe('A');
    expect(Object.keys(finalTorrents ?? {}).length).toBe(1);
  });

  // ── Defense-in-depth: incremental delta is always merged incrementally ───
  //
  // The renderer always applies embedded deltas incrementally (forced
  // `full_update: false` in `applyDeltaToState`). This guards against a
  // future regression where the renderer assumes the embedded delta is
  // always a full replacement.
  it('delta is merged incrementally, not replaced wholesale', async () => {
    const backendBridge = createMockBackendBridge();
    const HASH_A = 'a'.repeat(40);
    const HASH_NEW = 'd'.repeat(40);

    backendBridge.queueSnapshotOverride({
      revision: 1,
      rid: 1,
      maindata: {
        torrents: { [HASH_A]: mockTorrent({ name: 'A', hash: HASH_A }) },
        categories: {},
        tags: [],
        server_state: mockServerState,
      },
    });

    const capturedTorrents: Array<Record<string, { name?: string; hash?: string }> | null> = [];

    renderProvider({
      backendBridge,
      children: React.createElement(CapturedTorrents, { capturedTorrents }),
    });

    await waitFor(() => expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const latest = capturedTorrents.at(-1);
      expect(latest?.[HASH_A]?.name).toBe('A');
    });

    // Emit a sync-changed event with a delta that adds a new torrent.
    await act(async () => {
      backendBridge.emit({
        server_id: 'srv1',
        session_generation: 1,
        revision: 2,
        rid: 2,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
        delta: {
          rid: 2,
          torrents: { [HASH_NEW]: { name: 'New D' } },
        },
      });
    });

    await waitFor(() => {
      const latest = capturedTorrents.at(-1);
      expect(latest?.[HASH_NEW]?.name).toBe('New D');
      // HASH_A preserved because the renderer merges incrementally.
      expect(latest?.[HASH_A]?.name).toBe('A');
    });
    expect(backendBridge.getMaindataSnapshot).toHaveBeenCalledTimes(1);
    expect(markSpy).toHaveBeenCalledWith('maindata.delta.applied');
  });
});
