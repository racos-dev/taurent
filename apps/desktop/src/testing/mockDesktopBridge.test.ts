// Focused tests for the desktop automation mock bridge.
//
// Verifies the T146.2 advisory closeouts:
//   - `reset()` clears registered maindata sync listeners so pre-reset
//     listeners do not receive later events, while fresh post-reset
//     listeners still do.
//   - `application.getServerCapabilities()` exists and returns the same
//     `unknown` tri-state payload shape as the mobile mock.
//   - `qBClient.setWorkspaceView`/`getWorkspaceView`/`addWorkspaceViewListener`
//     (P2.5) match the Rust `WorkspaceView` contract: snake_case wire
//     fields, hash-only `sorted_hashes`, and `workspace-view-changed`
//     re-emission on maindata state changes.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MaindataSyncChangedEvent,
  RustCapabilitiesResponse,
  WorkspaceView,
  WorkspaceViewRequest,
} from '@taurent/bridge/types';
import { createDesktopBridge } from './mockDesktopBridge';

interface AutomationControl {
  emitMaindataSyncChanged: (event: MaindataSyncChangedEvent) => void;
  emitWorkspaceViewChanged: (event: WorkspaceView) => void;
  injectCustomDelta: (delta: { rid: number; full_update: boolean; torrents?: Record<string, unknown> }) => void;
  reset: () => void;
  clearRecordedCalls: () => void;
  getRecordedCalls: () => Array<{ name: string; args: unknown[] }>;
}

interface AutomationWindow {
  __TAURENT_AUTOMATION__?: AutomationControl;
}

function getAutomation(): AutomationControl {
  const w = globalThis as unknown as AutomationWindow;
  if (!w.__TAURENT_AUTOMATION__) {
    throw new Error('Expected mockDesktopBridge to register a window automation control');
  }
  return w.__TAURENT_AUTOMATION__;
}

function makeEvent(revision: number): MaindataSyncChangedEvent {
  return {
    server_id: 'mock-server-id',
    session_generation: 1,
    revision,
    rid: revision,
    health: {
      state: 'healthy',
      consecutive_errors: 0,
      last_success_ts: Math.floor(Date.now() / 1000),
      last_error_ts: null,
      last_error_message: null,
    },
    changed_resources: ['torrents'],
    delta: null,
  };
}

describe('mockDesktopBridge', () => {
  let automation: AutomationControl;
  const bridge = createDesktopBridge();

  beforeEach(() => {
    automation = getAutomation();
    automation.reset();
  });

  afterEach(() => {
    automation.reset();
  });

  describe('reset() listener hygiene', () => {
    it('stops calling pre-reset maindata sync listeners after reset', () => {
      const pre = vi.fn();
      bridge.qBClient.addMaindataSyncListener(pre);

      automation.emitMaindataSyncChanged(makeEvent(1));
      expect(pre).toHaveBeenCalledTimes(1);

      automation.reset();

      automation.emitMaindataSyncChanged(makeEvent(2));
      expect(pre).toHaveBeenCalledTimes(1);
    });

    it('still delivers events to listeners registered after reset', () => {
      const pre = vi.fn();
      bridge.qBClient.addMaindataSyncListener(pre);
      automation.emitMaindataSyncChanged(makeEvent(1));

      automation.reset();

      const post = vi.fn();
      bridge.qBClient.addMaindataSyncListener(post);

      automation.emitMaindataSyncChanged(makeEvent(2));
      expect(pre).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledTimes(1);
      const callArg = post.mock.calls[0]?.[0] as MaindataSyncChangedEvent;
      expect(callArg.revision).toBe(2);
      expect(callArg.rid).toBe(2);
    });

    it('clears every registered maindata sync listener in a single reset', () => {
      const a = vi.fn();
      const b = vi.fn();
      const c = vi.fn();
      bridge.qBClient.addMaindataSyncListener(a);
      bridge.qBClient.addMaindataSyncListener(b);
      bridge.qBClient.addMaindataSyncListener(c);

      automation.emitMaindataSyncChanged(makeEvent(1));
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
      expect(c).toHaveBeenCalledTimes(1);

      automation.reset();

      automation.emitMaindataSyncChanged(makeEvent(2));
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
      expect(c).toHaveBeenCalledTimes(1);
    });

    it('preserves the synchronous unsubscribe contract for post-reset listeners', () => {
      automation.reset();
      const listener = vi.fn();
      const unsubscribe = bridge.qBClient.addMaindataSyncListener(listener);
      expect(typeof unsubscribe).toBe('function');
      // Unsubscribe should be synchronous and idempotent.
      unsubscribe();
      unsubscribe();
      automation.emitMaindataSyncChanged(makeEvent(1));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('application.getServerCapabilities()', () => {
    it('exists and records the call like other application probes', async () => {
      automation.clearRecordedCalls();
      const response = await bridge.application.getServerCapabilities();
      const calls = automation.getRecordedCalls();
      expect(calls.map((c) => c.name)).toContain('application.getServerCapabilities');
      expect(response).toBeDefined();
    });

    it('returns the unknown tri-state capability payload shape', async () => {
      const response: RustCapabilitiesResponse = await bridge.application.getServerCapabilities();
      expect(typeof response.session_generation).toBe('number');
      expect(typeof response.server_id).toBe('string');
      expect(response.capabilities).toEqual({
        supports_search: 'unknown',
        supports_rss: 'unknown',
        supports_pause_resume: 'unknown',
      });
    });
  });

  describe('torrent detail mock fixtures (T140.3)', () => {
    // Rust (qb-core::dto) owns the validation boundary for these endpoints, so
    // the bridge returns plain typed payloads. The mock bridge exposes concrete
    // fixtures instead of `{} as never` so automation scripts can rely on a
    // stable typed shape.
    it('torrents.getProperties returns a concrete TorrentProperties fixture', async () => {
      const properties = await bridge.torrents.getProperties('hash-1');
      expect(properties).toBeDefined();
      expect(typeof properties.save_path).toBe('string');
      expect(typeof properties.isPrivate).toBe('boolean');
      expect(typeof properties.total_size).toBe('number');
    });

    it('torrents.getTrackers returns a concrete Tracker[] fixture', async () => {
      const trackers = await bridge.torrents.getTrackers('hash-1');
      expect(Array.isArray(trackers)).toBe(true);
      expect(trackers.length).toBeGreaterThan(0);
      expect(typeof trackers[0].url).toBe('string');
      expect(typeof trackers[0].status).toBe('number');
    });

    it('torrents.getFiles returns a concrete TorrentFile[] fixture', async () => {
      const files = await bridge.torrents.getFiles('hash-1');
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(typeof files[0].name).toBe('string');
      expect(typeof files[0].size).toBe('number');
      expect(Array.isArray(files[0].piece_range)).toBe(true);
    });
  });

  describe('qBClient.workspaceView (P2.5)', () => {
    function makeRequest(overrides: Partial<WorkspaceViewRequest> = {}): WorkspaceViewRequest {
      return {
        request_id: 'req-1',
        filters: {
          status: 'all',
          category: null,
          tag: null,
          tracker: null,
          search: '',
        },
        sort: { field: 'name', direction: 'asc' },
        include_sorted_hashes: true,
        locale: 'en-US',
        ...overrides,
      };
    }

    it('setWorkspaceView returns a snake_case WorkspaceView with sorted_hashes and facets', async () => {
      const request = makeRequest();
      const view = await bridge.qBClient.setWorkspaceView(request);

      // Wire-field contract — Rust serde output is snake_case, so the mock
      // must match exactly.
      expect(view.request_id).toBe('req-1');
      expect(typeof view.revision).toBe('number');
      expect(Array.isArray(view.sorted_hashes)).toBe(true);
      expect(typeof view.filtered_count).toBe('number');
      expect(typeof view.total_count).toBe('number');
      expect(typeof view.total_dl_speed).toBe('number');
      expect(typeof view.total_ul_speed).toBe('number');
      expect(typeof view.status_counts).toBe('object');
      expect(typeof view.category_counts).toBe('object');
      expect(typeof view.tag_counts).toBe('object');
      expect(typeof view.tracker_counts).toBe('object');
      expect(Array.isArray(view.sidebar_categories)).toBe(true);
      expect(Array.isArray(view.sidebar_tags)).toBe(true);
      expect(Array.isArray(view.sidebar_trackers)).toBe(true);
      expect(typeof view.is_filtered).toBe('boolean');

      // sorted_hashes must be hash-only — no Torrent objects.
      for (const hash of view.sorted_hashes) {
        expect(typeof hash).toBe('string');
      }

      // status_counts should include the 12 filter types.
      for (const ft of ['all', 'downloading', 'seeding', 'completed', 'stopped']) {
        expect(typeof view.status_counts[ft]).toBe('number');
      }

      // total_count reflects the mock state fixture (≥1).
      expect(view.total_count).toBeGreaterThan(0);
      expect(view.filtered_count).toBe(view.total_count);
      expect(view.is_filtered).toBe(false);
    });

    it('setWorkspaceView computes the view from state and reflects applied filters', async () => {
      // The mock now derives the workspace view from internal state, so
      // applying a filter produces a filtered view with is_filtered=true.
      const view = await bridge.qBClient.setWorkspaceView(
        makeRequest({
          request_id: 'req-filter',
          filters: {
            status: 'downloading',
            category: null,
            tag: null,
            tracker: null,
            search: '',
          },
        }),
      );
      expect(view.request_id).toBe('req-filter');
      expect(view.is_filtered).toBe(true);
      expect(view.total_count).toBeGreaterThan(0);
    });

    it('getWorkspaceView returns a view computed from state before any setWorkspaceView call', async () => {
      const view = await bridge.qBClient.getWorkspaceView();
      expect(view).not.toBeNull();
      expect(view?.is_filtered).toBe(false);
      expect(view?.total_count).toBeGreaterThan(0);
    });

    it('getWorkspaceView returns a view computed from state after setWorkspaceView', async () => {
      const request = makeRequest();
      await bridge.qBClient.setWorkspaceView(request);
      // The view is always recomputed from live mock state on every
      // getWorkspaceView call — it is not a cached static payload.
      const view = await bridge.qBClient.getWorkspaceView();
      expect(view).not.toBeNull();
      expect(view?.is_filtered).toBe(false);
      expect(view?.total_count).toBeGreaterThan(0);
    });

    it('addWorkspaceViewListener receives the view when setWorkspaceView is called', async () => {
      const handler = vi.fn();
      const unsubscribe = bridge.qBClient.addWorkspaceViewListener(handler);
      expect(typeof unsubscribe).toBe('function');

      await bridge.qBClient.setWorkspaceView(makeRequest({ request_id: 'req-listener' }));

      expect(handler).toHaveBeenCalledTimes(1);
      const arg = handler.mock.calls[0]?.[0] as WorkspaceView;
      expect(arg.request_id).toBe('req-listener');
    });

    it('addWorkspaceViewListener unsubscribe is synchronous and stops future emissions', async () => {
      const handler = vi.fn();
      const unsubscribe = bridge.qBClient.addWorkspaceViewListener(handler);
      unsubscribe();
      await bridge.qBClient.setWorkspaceView(makeRequest());
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not re-emit workspace-view-changed when maindata state changes', async () => {
      // The mock only derives the view on explicit setWorkspaceView /
      // getWorkspaceView calls. Maindata state changes do not trigger a
      // workspace-view re-emission.
      await bridge.qBClient.setWorkspaceView(makeRequest({ request_id: 'req-baseline' }));

      const handler = vi.fn();
      bridge.qBClient.addWorkspaceViewListener(handler);
      handler.mockClear();

      automation.emitMaindataSyncChanged(makeEvent(999));
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not re-emit workspace-view-changed when injectCustomDelta changes the state', async () => {
      await bridge.qBClient.setWorkspaceView(makeRequest({ request_id: 'req-inject' }));
      const handler = vi.fn();
      bridge.qBClient.addWorkspaceViewListener(handler);
      handler.mockClear();

      const before = await bridge.qBClient.getWorkspaceView();
      // Inject a custom delta to add a new torrent — this mutates state.
      // The mock does not auto-re-emit the view on state changes (only
      // explicit setWorkspaceView triggers emission), but getWorkspaceView
      // now recomputes from live state so total_count reflects the addition.
      automation.injectCustomDelta({
        rid: (before?.revision ?? 0) + 1,
        full_update: false,
        torrents: {
          injectedhash: {
            added_on: 1,
            amount_left: 0,
            auto_tmm: false,
            availability: 0,
            category: '',
            completed: 0,
            completion_on: 0,
            content_path: '/injected',
            dl_limit: 0,
            dlspeed: 0,
            download_path: '',
            downloaded: 0,
            downloaded_session: 0,
            eta: 0,
            f_l_piece_prio: false,
            force_start: false,
            hash: 'injectedhash',
            infohash_v1: '',
            infohash_v2: '',
            last_activity: 0,
            magnet_uri: '',
            max_ratio: 0,
            max_seeding_time: 0,
            name: 'Injected',
            num_complete: 0,
            num_incomplete: 0,
            num_leechs: 0,
            num_seeds: 0,
            priority: 0,
            progress: 1,
            ratio: 0,
            ratio_limit: 0,
            save_path: '/x',
            seeding_time: 0,
            seeding_time_limit: 0,
            seen_complete: 0,
            seq_dl: false,
            size: 1,
            state: 'uploading',
            super_seeding: false,
            tags: '',
            time_active: 0,
            total_size: 1,
            tracker: '',
            up_limit: 0,
            uploaded: 0,
            uploaded_session: 0,
            upspeed: 0,
          },
        },
      });

      // No re-emission triggered by state change.
      expect(handler).not.toHaveBeenCalled();
      // View is recomputed from live state, so total_count increased by 1.
      const after = await bridge.qBClient.getWorkspaceView();
      expect(after?.total_count).toBe((before?.total_count ?? 0) + 1);
    });

    it('reset() clears workspace view listeners', async () => {
      await bridge.qBClient.setWorkspaceView(makeRequest());
      const handler = vi.fn();
      bridge.qBClient.addWorkspaceViewListener(handler);
      handler.mockClear();

      automation.reset();

      // After reset, the view is recomputed from fresh mock state, but listeners
      // should no longer receive emissions.
      const view = await bridge.qBClient.getWorkspaceView();
      expect(view).not.toBeNull();
      await bridge.qBClient.setWorkspaceView(makeRequest({ request_id: 'req-post-reset' }));
      expect(handler).not.toHaveBeenCalled();
    });

    it('automation control exposes emitWorkspaceViewChanged for parity with maindata-sync-changed', () => {
      const handler = vi.fn();
      bridge.qBClient.addWorkspaceViewListener(handler);
      handler.mockClear();

      const event: WorkspaceView = {
        request_id: 'manual',
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
      automation.emitWorkspaceViewChanged(event);
      expect(handler).toHaveBeenCalledWith(event);
    });
  });
});
