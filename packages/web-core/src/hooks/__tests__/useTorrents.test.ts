/**
 * useTorrents.test.ts
 *
 * Tests for the `createTorrentsHook` factory function. The factory wires
 * a platform-provided `scopeProvider` (useMaindataState) and a
 * `WorkspaceViewBridge` into a `useTorrents(options)` hook that returns
 * the filtered/sorted torrent list and a derived `isLoading` flag.
 *
 * The focus of this test file is the `isLoading` derivation:
 *
 *     isLoading =
 *       (isConnected && isHydrated && maindataState === null) ||
 *       (rustView.isLoading && rustView.view === null);
 *
 * — the first clause covers the "maindata not hydrated yet" case (no
 * `torrents` map available), and the second clause covers the
 * "workspace view not computed yet" case while keeping the existing
 * `view` visible across filter/sort recomputes (so a filter change does
 * not blank the workspace).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTorrentsHook } from '../useTorrents';
import type { WorkspaceViewBridge } from '../useTorrents';
import type { WorkspaceView } from '@taurent/bridge/types';
import type { MaindataState, Torrent } from '@taurent/shared';

// ─── React Query setup ────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper() {
  const queryClient = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ─── Controllable workspace view + bridge mock ────────────────────────────────

interface ControllableWorkspaceView {
  view: WorkspaceView | null;
  isLoading: boolean;
  error: string | null;
  listeners: Set<(event: WorkspaceView) => void>;
  emit(event: WorkspaceView): void;
}

function createControllableWorkspaceView(): ControllableWorkspaceView {
  const listeners = new Set<(event: WorkspaceView) => void>();
  return {
    view: null,
    isLoading: true,
    error: null,
    listeners,
    emit(event) {
      this.view = event;
      this.isLoading = false;
      this.error = null;
      listeners.forEach((fn) => fn(event));
    },
  };
}

function createMockWorkspaceViewBridge(
  controllable: ControllableWorkspaceView,
): WorkspaceViewBridge {
  return {
    qBClient: {
      setWorkspaceView: vi.fn().mockImplementation(async () => {
        // Promise that resolves when emit() is called on the controllable.
        // The closure overwrites `controllable.emit` so the *next* emit call
        // resolves this promise. Subsequent setWorkspaceView calls chain
        // through the same wrapping — emit eventually resolves all pending
        // promises in registration order.
        return new Promise<WorkspaceView>((resolve) => {
          const originalEmit = controllable.emit.bind(controllable);
          controllable.emit = (event: WorkspaceView) => {
            originalEmit(event);
            resolve(event);
          };
        });
      }),
      addWorkspaceViewListener: vi.fn().mockImplementation(
        (handler: (event: WorkspaceView) => () => void) => {
          controllable.listeners.add(handler);
          return () => {
            controllable.listeners.delete(handler);
          };
        },
      ),
    },
  };
}

// ─── Controllable scope provider ──────────────────────────────────────────────

interface ControllableScope {
  isConnected: boolean;
  isHydrated: boolean;
  maindataState: MaindataState | null;
}

function createMockScopeProvider(scope: ControllableScope) {
  return () => ({
    isConnected: scope.isConnected,
    isHydrated: scope.isHydrated,
    maindataState: scope.maindataState,
  });
}

// ─── Factories for WorkspaceView and MaindataState fixtures ───────────────────

function makeWorkspaceView(overrides: Partial<WorkspaceView> = {}): WorkspaceView {
  return {
    request_id: 'torrents',
    revision: 1,
    sorted_hashes: [],
    filtered_count: 0,
    total_count: 0,
    total_dl_speed: 0,
    total_ul_speed: 0,
    status_counts: {},
    category_counts: {},
    tag_counts: {},
    tracker_counts: {},
    sidebar_categories: [],
    sidebar_tags: [],
    sidebar_trackers: [],
    is_filtered: false,
    ...overrides,
  };
}

function makeTorrent(overrides: Partial<Torrent> & { hash: string }): Torrent {
  return {
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
    hash: overrides.hash,
    last_activity: 0,
    magnet_uri: '',
    max_ratio: 0,
    max_seeding_time: 0,
    name: `torrent-${overrides.hash}`,
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
}

function makeMaindataState(torrents: Record<string, Torrent> = {}): MaindataState {
  return {
    rid: 1,
    torrents,
    categories: {},
    tags: [],
    server_state: null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createTorrentsHook', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('returns isLoading=true when connected+hydrated but maindataState is null', () => {
    // First clause of isLoading:
    //   isConnected && isHydrated && maindataState === null
    // → workspace view request has not been issued yet (no torrents to
    //   filter), but the renderer should not blank the screen with a
    //   stale empty list. Loading state wins.
    const scope: ControllableScope = {
      isConnected: true,
      isHydrated: true,
      maindataState: null,
    };
    const controllable = createControllableWorkspaceView();
    const bridge = createMockWorkspaceViewBridge(controllable);
    const useTorrents = createTorrentsHook(createMockScopeProvider(scope), bridge);

    const { result } = renderHook(() => useTorrents(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.torrents).toEqual([]);
  });

  it('returns isLoading=true when maindataState is present but the first workspace view is unresolved', async () => {
    // Second clause of isLoading:
    //   rustView.isLoading && rustView.view === null
    // The renderer has maindata (it can list torrents in principle), but
    // the Rust workspace view engine has not produced a first view yet.
    const torrent = makeTorrent({ hash: 'hash-1' });
    const scope: ControllableScope = {
      isConnected: true,
      isHydrated: true,
      maindataState: makeMaindataState({ 'hash-1': torrent }),
    };
    const controllable = createControllableWorkspaceView();
    const bridge = createMockWorkspaceViewBridge(controllable);
    const useTorrents = createTorrentsHook(createMockScopeProvider(scope), bridge);

    const { result } = renderHook(() => useTorrents(), { wrapper: makeWrapper() });

    // Wait for the bridge to record the initial setWorkspaceView call —
    // at this point rustView.isLoading=true and rustView.view=null, so
    // the second clause of isLoading fires.
    await waitFor(() => {
      expect(bridge.qBClient.setWorkspaceView).toHaveBeenCalled();
    });

    expect(result.current.isLoading).toBe(true);
    // No sorted_hashes yet → no torrents exposed to the UI.
    expect(result.current.torrents).toEqual([]);
  });

  it('returns isLoading=false after the first workspace view resolves with no torrents', async () => {
    // The empty list (filtered_count=0, total_count=5) is the *first*
    // view — the UI must not stay in loading after Rust answers.
    const torrent = makeTorrent({ hash: 'hash-1' });
    const scope: ControllableScope = {
      isConnected: true,
      isHydrated: true,
      maindataState: makeMaindataState({ 'hash-1': torrent }),
    };
    const controllable = createControllableWorkspaceView();
    const bridge = createMockWorkspaceViewBridge(controllable);
    const useTorrents = createTorrentsHook(createMockScopeProvider(scope), bridge);

    const { result } = renderHook(() => useTorrents(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(bridge.qBClient.setWorkspaceView).toHaveBeenCalled();
    });

    // Resolve the first view — 5 torrents in maindata, but filter excludes them all.
    const firstView = makeWorkspaceView({
      request_id: 'torrents',
      sorted_hashes: [],
      total_count: 5,
      filtered_count: 0,
      is_filtered: true,
    });

    act(() => {
      controllable.emit(firstView);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Empty sorted_hashes → empty torrents list, but no longer loading.
    expect(result.current.torrents).toEqual([]);
  });

  it('keeps isLoading=false across a later filter/sort recompute (existing view stays visible)', async () => {
    // 1. First render with default filter — Rust returns a view with one torrent.
    // 2. Emit() resolves the first view, isLoading flips to false.
    // 3. Re-render with a different filter — useWorkspaceView sets isLoading=true
    //    on the new request, but rustView.view is *still* the first view
    //    (not null), so the second clause of isLoading short-circuits to false.
    const torrent = makeTorrent({ hash: 'hash-1' });
    const scope: ControllableScope = {
      isConnected: true,
      isHydrated: true,
      maindataState: makeMaindataState({ 'hash-1': torrent }),
    };
    const controllable = createControllableWorkspaceView();
    const bridge = createMockWorkspaceViewBridge(controllable);
    const useTorrents = createTorrentsHook(createMockScopeProvider(scope), bridge);

    const { result, rerender } = renderHook(
      ({ filter }: { filter: string }) => useTorrents({ filter }),
      {
        wrapper: makeWrapper(),
        initialProps: { filter: 'all' },
      },
    );

    await waitFor(() => {
      expect(bridge.qBClient.setWorkspaceView).toHaveBeenCalledTimes(1);
    });

    // Emit the first view.
    const firstView = makeWorkspaceView({
      request_id: 'torrents',
      sorted_hashes: ['hash-1'],
      total_count: 1,
      filtered_count: 1,
      is_filtered: false,
    });

    act(() => {
      controllable.emit(firstView);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.torrents).toHaveLength(1);
    });

    // Sanity: first view is populated.
    expect(result.current.torrents[0]?.hash).toBe('hash-1');

    // Now re-render with a new filter — this triggers a new setWorkspaceView,
    // a new addWorkspaceViewListener registration, and setIsLoading(true)
    // inside useWorkspaceView. We deliberately do *not* emit a new view
    // yet — the point is to verify the existing view remains visible.
    rerender({ filter: 'downloading' });

    await waitFor(() => {
      expect(bridge.qBClient.setWorkspaceView).toHaveBeenCalledTimes(2);
    });

    // The view is not null (still the first view), so isLoading stays false
    // even though rustView.isLoading is true.
    expect(result.current.isLoading).toBe(false);
    // The previously-known torrents are still visible — no blank state.
    expect(result.current.torrents).toHaveLength(1);
    expect(result.current.torrents[0]?.hash).toBe('hash-1');
  });

  it('returns isLoading=false when not connected', () => {
    // When disconnected there is no server to query and no maindata to
    // hydrate — the UI should show an empty list, not a loading spinner.
    const scope: ControllableScope = {
      isConnected: false,
      isHydrated: false,
      maindataState: null,
    };
    const controllable = createControllableWorkspaceView();
    const bridge = createMockWorkspaceViewBridge(controllable);
    const useTorrents = createTorrentsHook(createMockScopeProvider(scope), bridge);

    const { result } = renderHook(() => useTorrents(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.torrents).toEqual([]);
  });

  it('returns isLoading=false when not hydrated (even though maindataState is null)', () => {
    // Hydration is a separate concern from connection — the scope provider
    // reports isHydrated=false until the first maindata snapshot lands.
    // The first clause of isLoading requires isHydrated=true, so loading
    // stays false in this intermediate state.
    const scope: ControllableScope = {
      isConnected: true,
      isHydrated: false,
      maindataState: null,
    };
    const controllable = createControllableWorkspaceView();
    const bridge = createMockWorkspaceViewBridge(controllable);
    const useTorrents = createTorrentsHook(createMockScopeProvider(scope), bridge);

    const { result } = renderHook(() => useTorrents(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.torrents).toEqual([]);
  });
});
