/**
 * HomeScreen — `isLoading` behavior via the workspace list controller
 *
 * HomeScreen.tsx consumes `isLoading` from `useTorrentWorkspaceListController`,
 * which in turn reads from the shared `TorrentWorkspaceViewProvider`. The
 * provider derives `isLoading` from the lower-level `useWorkspaceView` hook:
 *
 *     isLoading = rustView.isLoading && rustView.view === null;
 *
 * This contract means:
 *   - The first load (no view yet) reports `isLoading: true`.
 *   - Once the first Rust view lands, `isLoading` flips to `false` even if
 *     subsequent recomputes (filter/sort changes) keep
 *     `rustView.isLoading` true — we want existing rows to stay visible
 *     instead of blanking the workspace.
 *
 * To exercise the list controller without standing up the full provider
 * hierarchy (QBClient, MaindataSyncProvider, BridgeAdapter) we mock the
 * internal `useWorkspaceView` hook and feed it deterministic state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { WorkspaceView, WorkspaceViewRequest } from '@taurent/bridge/types';
import type { Torrent } from '@taurent/shared';
import type {
  UseWorkspaceViewResult,
  WorkspaceViewBridge,
} from '@taurent/web-core/sync/useWorkspaceView';
import {
  createTorrentWorkspaceListController,
  createTorrentWorkspaceViewProvider,
} from '@taurent/web-core/screens';

// ─── Mock useWorkspaceView (the internal dependency under test) ───────────────
//
// The controller imports `useWorkspaceView` from a relative path inside
// packages/web-core. Mocking it via the alias (`@taurent/web-core/sync/useWorkspaceView`)
// resolves to the same absolute file, so vitest's module cache returns the
// mock to the production code regardless of which specifier the production
// code uses.
const useWorkspaceViewMock = vi.fn();

vi.mock('@taurent/web-core/sync/useWorkspaceView', () => ({
  useWorkspaceView: (...args: unknown[]) => useWorkspaceViewMock(...args),
}));

// ─── Test fixtures ───────────────────────────────────────────────────────────

const WORKSPACE_REQUEST_ID = 'desktop-workspace';

function makeEmptyWorkspaceView(): WorkspaceView {
  return {
    request_id: WORKSPACE_REQUEST_ID,
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
  };
}

function makeMockBridge(): WorkspaceViewBridge {
  // The bridge surface is only consumed by the unmocked `useWorkspaceView`
  // implementation, which we have replaced. Pass structurally valid stubs
  // so the production code can be created without runtime errors.
  return {
    qBClient: {
      setWorkspaceView: vi.fn<(request: WorkspaceViewRequest) => Promise<WorkspaceView>>(async () => makeEmptyWorkspaceView()),
      addWorkspaceViewListener: vi.fn(() => () => {}),
    },
  };
}

function makeMockLiveTorrentProvider(): () => Torrent[] {
  return () => [] as Torrent[];
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// ─── Probe component ──────────────────────────────────────────────────────────

interface ProbeHandle {
  isLoading: boolean;
  sortedTorrents: Torrent[];
}

let latestProbe: ProbeHandle | null = null;

function makeProbe(useListController: () => { isLoading: boolean; sortedTorrents: Torrent[] }) {
  return function Probe() {
    const { isLoading, sortedTorrents } = useListController();
    latestProbe = { isLoading, sortedTorrents };
    return React.createElement(
      'div',
      { 'data-testid': 'probe' },
      isLoading ? 'loading' : 'ready',
    );
  };
}

interface RenderOptions {
  bridge: WorkspaceViewBridge;
  liveTorrentProvider: () => Torrent[];
}

function renderController(opts: RenderOptions) {
  const bridge = opts.bridge;
  const liveTorrentProvider = opts.liveTorrentProvider;

  const TorrentWorkspaceViewProvider = createTorrentWorkspaceViewProvider(bridge, liveTorrentProvider);
  const useListController = createTorrentWorkspaceListController(bridge, liveTorrentProvider);
  const Probe = makeProbe(useListController);

  const queryClient = makeQueryClient();

  const view = render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(TorrentWorkspaceViewProvider, null, React.createElement(Probe)),
    ),
  );

  return { ...view, queryClient, TorrentWorkspaceViewProvider, useListController };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HomeScreen workspace controller — isLoading', () => {
  beforeEach(() => {
    latestProbe = null;
    useWorkspaceViewMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('returns isLoading: true before the first Rust workspace view resolves', () => {
    // Initial fetch in flight: isLoading is true and no view has arrived.
    useWorkspaceViewMock.mockReturnValue({
      view: null,
      isLoading: true,
      error: null,
      refresh: vi.fn(async () => {}),
    } satisfies UseWorkspaceViewResult);

    renderController({
      bridge: makeMockBridge(),
      liveTorrentProvider: makeMockLiveTorrentProvider(),
    });

    expect(latestProbe).not.toBeNull();
    expect(latestProbe?.isLoading).toBe(true);
    expect(latestProbe?.sortedTorrents).toEqual([]);
  });

  it('returns isLoading: false after the first workspace view resolves', () => {
    // First view has arrived; isLoading flips off even though the view is empty.
    useWorkspaceViewMock.mockReturnValue({
      view: makeEmptyWorkspaceView(),
      isLoading: false,
      error: null,
      refresh: vi.fn(async () => {}),
    } satisfies UseWorkspaceViewResult);

    renderController({
      bridge: makeMockBridge(),
      liveTorrentProvider: makeMockLiveTorrentProvider(),
    });

    expect(latestProbe).not.toBeNull();
    expect(latestProbe?.isLoading).toBe(false);
    expect(latestProbe?.sortedTorrents).toEqual([]);
  });

  it('keeps isLoading: false during a filter/sort recompute (view is non-null)', () => {
    // Filter or sort change: rustView.isLoading flips back to true while a
    // new view is being computed, but the previous view is still available.
    // The provider must keep reporting isLoading: false so existing rows do
    // not disappear and the spinner does not flash on every keystroke.
    useWorkspaceViewMock.mockReturnValue({
      view: {
        ...makeEmptyWorkspaceView(),
        sorted_hashes: ['hash1', 'hash2'],
        filtered_count: 2,
        total_count: 2,
      },
      isLoading: true,
      error: null,
      refresh: vi.fn(async () => {}),
    } satisfies UseWorkspaceViewResult);

    renderController({
      bridge: makeMockBridge(),
      liveTorrentProvider: makeMockLiveTorrentProvider(),
    });

    expect(latestProbe).not.toBeNull();
    expect(latestProbe?.isLoading).toBe(false);
  });

  it('preserves isLoading: true through a re-render with the same pending state', () => {
    // Guard against regressions where a re-render (e.g. parent state change)
    // could accidentally flip isLoading off while no view has arrived.
    const current: UseWorkspaceViewResult = {
      view: null,
      isLoading: true,
      error: null,
      refresh: vi.fn(async () => {}),
    };
    useWorkspaceViewMock.mockImplementation(() => current);

    const { queryClient } = renderController({
      bridge: makeMockBridge(),
      liveTorrentProvider: makeMockLiveTorrentProvider(),
    });

    expect(latestProbe?.isLoading).toBe(true);

    // Force a re-render by invalidating the QueryClient cache.
    act(() => {
      queryClient.invalidateQueries();
    });

    expect(latestProbe?.isLoading).toBe(true);
    // Reference is unchanged — the provider must derive from the same view state.
    expect(latestProbe).not.toBeNull();
  });
});
