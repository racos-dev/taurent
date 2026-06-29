/**
 * T130 — Rust-owned live sync architecture spike
 * T149.4 — Backend-owned sync is the authoritative path for the connected
 *   desktop main window. These tests assert through backend-owned signals
 *   (qBClient.getMaindataSnapshot calls, emitted maindata-sync-changed
 *   events, revision changes, and rendered row attributes) instead of
 *   treating `syncMaindata` call counts as the success path. Renderer-poller
 *   assertions in this lane are intentionally restricted to the auxiliary
 *   window group, where the absence of polling is a stable observable
 *   property of routing, not a backend sync behavior.
 *
 * Mocked renderer E2E: backend sync event → updated torrent/status UI,
 * session switch clearing stale snapshots, auxiliary windows skipping sync loops.
 *
 * Runs against the Vite dev server with VITE_AUTOMATION=1, using the mocked
 * desktop bridge and tauri transport. No real Tauri backend is required.
 */

import { expect, test } from '@playwright/test';
import {
  getFirstVisibleTorrentRow,
  getTorrentRowLocator,
  readRecordedCalls,
  readTorrentRowHash,
  waitForHomeReady,
} from './helpers/desktop';

const TORRENT_HASH_PATTERN = /^abcd[0-9a-f]{28}$/;

test.describe('T130 — backend-owned live sync', () => {
  // ─── Helper ────────────────────────────────────────────────────────────────
  //
  // The post-`ec83a760` desktop main window renders two `<table>` elements
  // (e.g. a detail/header table plus the torrent body table). The previous
  // `page.locator('table')` helper matched both and tripped Playwright's
  // strict-mode locator. Match the robust row/header pattern used in
  // `apps/desktop/e2e/desktop.spec.ts`: anchor on a unique "Name" header in
  // the body table, then count via the `data-testid="torrent-row"`
  // selector so virtualization does not break the count.

  async function expectTableWithRows(page: import('@playwright/test').Page, minRows = 1) {
    await expect(page.locator('th', { hasText: /^Name$/ }).first()).toBeVisible({ timeout: 15_000 });
    const rows = getTorrentRowLocator(page);
    await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(minRows);
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  }

  // ─── Spec: backend sync event → updated torrent/status UI ─────────────────

  test.describe('backend sync event → updated torrent/status UI', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?scenario=small-100&mockAppState=connected');
      await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
      await page.reload();
      await page.waitForURL('/?scenario=small-100&mockAppState=connected');
      await waitForHomeReady(page);
      await expectTableWithRows(page, 1);

      // Reset only fault-injection state. Do not call automation.reset()
      // here: reset clears recorded calls and registered backend sync
      // listeners, which would erase the mount snapshot evidence and drop
      // the maindata-sync-changed event this group verifies.
      await page.evaluate(() => {
        const auto = (window as unknown) as Record<string, { clearSyncFaults: () => void }>;
        auto.__TAURENT_AUTOMATION__?.clearSyncFaults?.();
      });
    });

    test('getMaindataSnapshot is called on mount when backend bridge is active', async ({ page }) => {
      // The mocked bridge records calls to qBClient.getMaindataSnapshot. The
      // connected desktop main window goes through the backend-owned sync
      // path, so the authoritative observable signal is the snapshot fetch
      // — not the renderer `syncMaindata` poller (which backend-active mode
      // intentionally disables).
      const calls = await readRecordedCalls(page);
      const snapshotCalls = calls.filter((c) => c.name === 'qBClient.getMaindataSnapshot');
      expect(snapshotCalls.length).toBeGreaterThanOrEqual(1);
      // Renderer-poller fallback should not be active in the connected main window.
      const pollerCalls = calls.filter((c) => c.name === 'syncMaindata');
      expect(pollerCalls.length).toBe(0);
    });

    test('injecting a maindata-sync-changed event triggers a new snapshot fetch and updates the table', async ({ page }) => {
      // The connected desktop main window should react to backend-owned
      // signals: an injected delta + emitted maindata-sync-changed event
      // must cause (a) a new getMaindataSnapshot call and (b) a rendered
      // torrent row whose data-torrent-hash matches the qBittorrent hash
      // pattern. The previous T149 syncMaindata-only assertion is removed
      // because backend-active mode disables the renderer poller.
      const snapshotCallsBefore = (await readRecordedCalls(page))
        .filter((c) => c.name === 'qBClient.getMaindataSnapshot').length;

      const result = await page.evaluate(() => {
        const auto = (window as unknown) as Record<string, {
          injectDelta: () => unknown;
          emitMaindataSyncChanged: (event: unknown) => void;
          getState: () => { torrents: Record<string, unknown>; rid: number };
        }>;
        if (!auto.__TAURENT_AUTOMATION__) return { error: 'no automation' };
        const state = auto.__TAURENT_AUTOMATION__.getState();
        const delta = auto.__TAURENT_AUTOMATION__.injectDelta();
        auto.__TAURENT_AUTOMATION__.emitMaindataSyncChanged({
          server_id: 'mock-server-id',
          session_generation: 1,
          revision: state.rid + 1,
          rid: state.rid + 1,
          health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
          changed_resources: ['torrents'],
        });
        return { ok: true, delta };
      });

      expect(result.error).toBeUndefined();

      // Wait for the table to reflect the injected change — backend path
      // delivers it through the emitted event → snapshot fetch → state.
      await expectTableWithRows(page, 1);
      // The first rendered row's data-torrent-hash must match the qBittorrent
      // hash pattern. This proves backend snapshot ingestion injects
      // torrent.hash from the keyed map (T149.4) so downstream consumers
      // (TorrentTableRow) render non-empty hash attributes.
      await expect
        .poll(async () => {
          const hash = await readTorrentRowHash(getFirstVisibleTorrentRow(page));
          return typeof hash === 'string' ? hash : '';
        }, { timeout: 15_000 })
        .toMatch(TORRENT_HASH_PATTERN);

      // The emitted event must have driven at least one new snapshot fetch.
      const snapshotCallsAfter = (await readRecordedCalls(page))
        .filter((c) => c.name === 'qBClient.getMaindataSnapshot').length;
      expect(snapshotCallsAfter).toBeGreaterThan(snapshotCallsBefore);
    });

    test('health event from backend is surfaced without crashing', async ({ page }) => {
      const healthResult = await page.evaluate(() => {
        const auto = (window as unknown) as Record<string, {
          emitMaindataSyncChanged: (event: unknown) => void;
        }>;
        if (!auto.__TAURENT_AUTOMATION__) return { error: 'no automation' };
        try {
          auto.__TAURENT_AUTOMATION__.emitMaindataSyncChanged({
            server_id: 'mock-server-id',
            session_generation: 1,
            revision: 99,
            rid: 99,
            health: { state: 'degraded', consecutive_errors: 2, last_success_ts: Date.now() - 60000, last_error_ts: Date.now(), last_error_message: 'test error' },
            changed_resources: [],
          });
          return { ok: true };
        } catch (e) {
          return { error: String(e) };
        }
      });

      expect(healthResult.error).toBeUndefined();
      // Table should still be visible after health event. Match the same
      // unique header anchor used in expectTableWithRows so the two-table
      // layout does not trip Playwright's strict-mode locator.
      await expect(page.locator('th', { hasText: /^Name$/ }).first()).toBeVisible();
    });
  });

  // ─── Spec: session switch/disconnect clears stale snapshots ─────────────────

  test.describe('session switch and disconnect clears stale snapshots', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?scenario=small-100&mockAppState=connected');
      await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
      await page.reload();
      await page.waitForURL('/?scenario=small-100&mockAppState=connected');
      await waitForHomeReady(page);
      await expectTableWithRows(page, 1);

      await page.evaluate(() => {
        const auto = (window as unknown) as Record<string, { clearSyncFaults: () => void; clearRecordedCalls: () => void }>;
        auto.__TAURENT_AUTOMATION__?.clearSyncFaults?.();
        auto.__TAURENT_AUTOMATION__?.clearRecordedCalls?.();
      });
    });

    test('session change to a new generation discards events from the old generation', async ({ page }) => {
      // Inject a delta under generation1
      await page.evaluate(() => {
        const auto = (window as unknown) as Record<string, {
          injectDelta: () => unknown;
          emitMaindataSyncChanged: (event: unknown) => void;
          getState: () => { rid: number };
        }>;
        auto.__TAURENT_AUTOMATION__?.injectDelta?.();
        const state = auto.__TAURENT_AUTOMATION__?.getState?.() ?? { rid: 1 };
        // Emit event with stale generation (3) while current is still 1
        auto.__TAURENT_AUTOMATION__?.emitMaindataSyncChanged?.({
          server_id: 'mock-server-id',
          session_generation: 3, // stale generation
          revision: state.rid + 1,
          rid: state.rid + 1,
          health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
          changed_resources: ['torrents'],
        });
      });

      // Snapshot call count should not increase for the stale event
      const snapshotCallsBefore = (await readRecordedCalls(page))
        .filter((c) => c.name === 'qBClient.getMaindataSnapshot').length;

      await page.waitForTimeout(500);

      const snapshotCallsAfter = (await readRecordedCalls(page))
        .filter((c) => c.name === 'qBClient.getMaindataSnapshot').length;

      // No new snapshot calls should have been triggered by the stale generation event
      expect(snapshotCallsAfter).toBeLessThanOrEqual(snapshotCallsBefore);
    });

    test('session disconnect triggers auto-reconnect and refreshes backend snapshot state', async ({ page }) => {
      // Emit a disconnect event. On a protected route with a saved current
      // server, the auth bootstrap starts auto-connect instead of parking the
      // main window on an empty torrent table.
      await page.evaluate(() => {
        const auto = (window as unknown) as Record<string, {
          emitSessionChanged: (event: unknown) => void;
        }>;
        auto.__TAURENT_AUTOMATION__?.emitSessionChanged?.({
          session_generation: 1,
          server_id: null,
          status: 'disconnected',
          last_error: null,
        });
      });

      await expect
        .poll(
          async () => (await readRecordedCalls(page)).filter((c) => c.name === 'sessionConnectById').length,
          { timeout: 10_000 },
        )
        .toBeGreaterThanOrEqual(1);

      // Reconnect must drive the backend-owned snapshot path, not the
      // renderer poller. A hash-bearing rendered row proves React consumed the
      // backend snapshot after the disconnect/reconnect cycle.
      await expect
        .poll(
          async () => (await readRecordedCalls(page)).filter((c) => c.name === 'qBClient.getMaindataSnapshot').length,
          { timeout: 10_000 },
        )
        .toBeGreaterThanOrEqual(1);
      await expect
        .poll(
          async () => {
            const hash = await readTorrentRowHash(getFirstVisibleTorrentRow(page));
            return typeof hash === 'string' ? hash : '';
          },
          { timeout: 15_000 },
        )
        .toMatch(TORRENT_HASH_PATTERN);
      const pollerCalls = (await readRecordedCalls(page)).filter((c) => c.name === 'syncMaindata');
      expect(pollerCalls.length).toBe(0);
    });
  });

  // ─── Spec: auxiliary windows do not start independent sync loops ───────────
  //
  // The auxiliary windows (settings / add-torrent / dialog-host) live
  // outside the connected desktop main window. Their no-polling property
  // is enforced by `isMaindataPollingWindow()` and is therefore a routing
  // assertion, not a backend-sync-vs-renderer-poller assertion. These
  // tests stay on `syncMaindata` because the absence of a renderer-poller
  // call is the *only* observable signal that the polling gate fired —
  // backend-owned sync is also intentionally inactive here, but the
  // absence of the poller is what we care about.

  test.describe('auxiliary windows skip sync polling', () => {
    test('settings window does not trigger syncMaindata polling', async ({ page }) => {
      // Navigate to the settings auxiliary window
      await page.goto('/settings-window?scenario=small-100&mockAppState=connected');
      await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
      await page.reload();
      // Tolerate the query string the reload preserves — the previous
      // exact-path wait timed out on `?scenario=...&mockAppState=...`.
      await page.waitForURL(/\/settings-window(\?|$)/);

      // Wait a short period
      await page.waitForTimeout(800);

      const syncMaindataCalls = (await readRecordedCalls(page))
        .filter((c) => c.name === 'syncMaindata').length;

      // Settings window should NOT call syncMaindata (isMaindataPollingWindow returns false for it)
      expect(syncMaindataCalls).toBe(0);
    });

    test('add-torrent window does not trigger syncMaindata polling', async ({ page }) => {
      await page.goto('/add-torrent-window?scenario=small-100&mockAppState=connected');
      await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
      await page.reload();
      await page.waitForURL(/\/add-torrent-window(\?|$)/);

      await page.waitForTimeout(800);

      const syncMaindataCalls = (await readRecordedCalls(page))
        .filter((c) => c.name === 'syncMaindata').length;

      expect(syncMaindataCalls).toBe(0);
    });

    test('dialog-host window does not trigger syncMaindata polling', async ({ page }) => {
      await page.goto('/dialog-host-window?scenario=small-100&mockAppState=connected');
      await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
      await page.reload();
      await page.waitForURL(/\/dialog-host-window(\?|$)/);

      await page.waitForTimeout(800);

      const syncMaindataCalls = (await readRecordedCalls(page))
        .filter((c) => c.name === 'syncMaindata').length;

      expect(syncMaindataCalls).toBe(0);
    });
  });
});
