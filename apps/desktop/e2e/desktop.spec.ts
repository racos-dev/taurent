/**
 * Desktop mocked renderer integration — main-window coverage for routing,
 * selection, mocked side effects, and reconnect behavior.
 *
 * T149.3 scope: the connected desktop main window is on backend-owned sync
 * (T149.4), which means the renderer `syncMaindata` poller is intentionally
 * disabled. Assertions that previously watched `syncCallCount` to advance
 * have been removed or rewritten to observe backend-owned signals
 * (`qBClient.getMaindataSnapshot` calls, emitted `maindata-sync-changed`
 * events, revision changes, or rendered maindata outcomes) instead.
 *
 * Each spec runs against the Vite dev server started with VITE_AUTOMATION=1,
 * using the mocked desktop bridge and tauri transport. No real Tauri backend
 * is required.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  getFirstVisibleTorrentRow,
  getTorrentRowLocator,
  readRecordedCalls,
  readTorrentRowHash,
  readTorrentRowName,
} from './helpers/desktop';

const TORRENT_HASH_PATTERN = /^abcd[0-9a-f]{28}$/;

/**
 * Wait for the home screen to be fully rendered.
 * "No torrents found" or a rendered torrent row counts as ready.
 */
async function waitForHomeReady(page: Page) {
  await expect(page).toHaveURL(/\/$|\/\?scenario=/, { timeout: 10_000 });
  // Wait for router-ready perf mark (set by App.tsx)
  await page.waitForFunction(() =>
    ((window as unknown) as Record<string, unknown>).__TAURENT_PERF_MARKS__?.['router.ready'] != null,
    { timeout: 10_000 },
  );
  // Also wait for either "No torrents" or at least one rendered torrent row.
  await page.waitForFunction(() => {
    const noTorrents = document.body.textContent?.includes('No torrents');
    const hasRow = document.querySelector('[data-testid="torrent-row"]') != null;
    return noTorrents || hasRow;
  }, { timeout: 15_000 });
}

// ─── Spec: hidden window polling ─────────────────────────────────────────────
//
// Removed in T149.3: the connected desktop main window is on backend-owned
// sync, which intentionally disables the renderer poller that the
// the removed renderer poller's visibility-change handler. The renderer-poller
// `syncCallCount` counter never advances in this lane, so any assertion of
// the form "switching visibility changes sync cadence" is provably wrong.
// Renderer-poller visibility behaviour was covered in
// `packages/web-core/src/sync/__tests__/useMaindataSync.health.test.ts`,
// and the backend sync contract is covered in
// `apps/desktop/e2e/sync-backend.spec.ts`.

/**
 * Assert the torrent table is visible with at least one row rendered.
 * Uses a bounded poll to allow React virtualisation to finish initial render.
 */
async function expectTableWithRows(page: Page, minRows = 1) {
  await expect(page.locator('th', { hasText: /^Name$/ }).first()).toBeVisible({ timeout: 15_000 });
  const rows = getTorrentRowLocator(page);
  await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(minRows);
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
}

async function clickSortableHeader(page: Page, label: string) {
  const header = page.locator('th', { hasText: new RegExp(`^${label}$`, 'i') }).first();
  await expect(header).toBeVisible({ timeout: 15_000 });
  await header.click();
  return header;
}

async function expectFirstVisibleTorrentName(page: Page, expectedName: string) {
  await expect.poll(
    () => readTorrentRowName(getFirstVisibleTorrentRow(page)),
    { timeout: 10_000 },
  ).toBe(expectedName);
}

interface Phase9RecordedCall {
  name: string;
  args: unknown[];
}

interface Phase9Automation {
  clearSyncFaults(): void;
  reset(): void;
  clearRecordedCalls(): void;
  getRecordedCalls(): Phase9RecordedCall[];
  setAppScenario(appScenario: 'connected' | 'no-saved-servers' | 'saved-server-disconnected' | 'saved-server-unavailable'): void;
  getState(): {
    rid: number;
    torrents: Record<string, { name: string }>;
    server_state?: Record<string, unknown>;
  };
  injectCustomDelta(delta: {
    rid: number;
    full_update?: boolean;
    torrents?: Record<string, unknown>;
    server_state?: Record<string, unknown>;
  }): void;
  emitSessionChanged(event: {
    session_generation: number;
    server_id: string | null;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    last_error: string | null;
  }): void;
  emitResourceInvalidated(event: {
    server_id: string;
    session_generation: number;
    resource: string;
  }): void;
  emitMaindataSyncChanged(event: {
    server_id: string;
    session_generation: number;
    revision: number;
    rid: number;
    health: {
      state: 'healthy' | 'degraded' | 'retrying' | 'idle';
      consecutive_errors: number;
      last_success_ts: number | null;
      last_error_ts: number | null;
      last_error_message: string | null;
    };
    changed_resources: string[];
  }): void;
}

// ─── Spec: table sort ───────────────────────────────────────────────────────────

test.describe('table sort', () => {
  async function goToScenario(page: Page, scenario: string) {
    await page.goto(`/?scenario=${scenario}`);
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL(`/?scenario=${scenario}`);
    await waitForHomeReady(page);
  }

  test('sorts by name without page errors', async ({ page }) => {
    await goToScenario(page, 'small-100');
    await clickSortableHeader(page, 'Name');
    await expectFirstVisibleTorrentName(page, 'Torrent 99');
    await expectTableWithRows(page, 1);
  });

  test('sorts by progress without page errors', async ({ page }) => {
    await goToScenario(page, 'small-100');
    await clickSortableHeader(page, 'Progress');
    await expectFirstVisibleTorrentName(page, 'Torrent 99');
    await expectTableWithRows(page, 1);
  });

  test('sorts by size without page errors', async ({ page }) => {
    await goToScenario(page, 'small-100');
    await clickSortableHeader(page, 'Size');
    await expectFirstVisibleTorrentName(page, 'Torrent 100');
    await expectTableWithRows(page, 1);
  });
});

// ─── Spec: row selection ───────────────────────────────────────────────────────

test.describe('row selection', () => {
  test('clicking a row opens the detail pane and supports closing it again', async ({ page }) => {
    await page.goto('/?scenario=small-100');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=small-100');
    await waitForHomeReady(page);
    await expectTableWithRows(page, 1);

    const firstRowName = await readTorrentRowName(getFirstVisibleTorrentRow(page));
    expect(firstRowName).not.toBeNull();
    await page.getByRole('cell', { name: firstRowName!, exact: true }).click();

    await expect(page.getByRole('button', { name: 'Close properties pane' })).toBeVisible();
    await expect(page.locator('h2.truncate.text-xs.font-semibold').first()).toHaveText(/Torrent \d+/);

    await page.getByRole('button', { name: 'Close properties pane' }).click();
    await expect(page.getByRole('button', { name: 'Close properties pane' })).not.toBeVisible();
  });
});

// ─── Spec: empty startup ──────────────────────────────────────────────────────

test.describe('empty startup', () => {
  test('connected empty scenario shows the empty-state table view', async ({ page }) => {
    await page.goto('/?scenario=empty&mockAppState=connected');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=empty&mockAppState=connected');
    await waitForHomeReady(page);

    await expect(page.getByText('No torrents')).toBeVisible();
  });
});

// ─── Spec: category filter ──────────────────────────────────────────────────────

test.describe('category filter', () => {
  test('filtering by category updates table rows', async ({ page }) => {
    await page.goto('/?scenario=large-1000');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=large-1000');
    await waitForHomeReady(page);
    await expectTableWithRows(page, 1);

    const categoryItem = page.getByRole('button', { name: /videos/i }).first();
    await categoryItem.click();

    await expect(categoryItem).toHaveAttribute('aria-pressed', 'true');
    await expectFirstVisibleTorrentName(page, 'Torrent 999');
    await expectTableWithRows(page, 1);
  });

  test('clearing category filter restores rows', async ({ page }) => {
    await page.goto('/?scenario=large-1000');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=large-1000');
    await waitForHomeReady(page);
    await expectTableWithRows(page, 1);

    // Click a category to activate filter
    const categoryItem = page.getByRole('button', { name: /videos/i }).first();
    await categoryItem.click();
    await expect(categoryItem).toHaveAttribute('aria-pressed', 'true');
    await expectFirstVisibleTorrentName(page, 'Torrent 999');

    // Click "All Categories" to clear the filter
    const allCategoriesBtn = page.getByRole('button', { name: /all categories/i });
    await allCategoriesBtn.click();

    await expect(allCategoriesBtn).toHaveAttribute('aria-pressed', 'true');
    await expectFirstVisibleTorrentName(page, 'Torrent 1000');
    await expectTableWithRows(page, 1);
  });
});

// ─── Spec: toolbar search ─────────────────────────────────────────────────────

test.describe('toolbar search', () => {
  test('searching filters the visible torrent rows and clearing restores them', async ({ page }) => {
    await page.goto('/?scenario=small-100&mockAppState=connected');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=small-100&mockAppState=connected');
    await waitForHomeReady(page);
    await expectTableWithRows(page, 1);

    const rows = getTorrentRowLocator(page);
    const searchInput = page.getByRole('textbox', { name: 'Filter torrents...' });

    await searchInput.fill('Torrent 100');
    await expect(page.getByRole('cell', { name: 'Torrent 100', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Torrent 99', exact: true })).not.toBeVisible();
    await expectFirstVisibleTorrentName(page, 'Torrent 100');

    await searchInput.fill('');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    await expectFirstVisibleTorrentName(page, 'Torrent 100');
  });
});

// ─── Spec: maindata delta updates ─────────────────────────────────────────────

test.describe('maindata delta', () => {
  test('injecting a delta plus maindata-sync-changed event triggers a backend snapshot fetch and renders the change', async ({ page }) => {
    // The connected desktop main window is on backend-owned sync, so the
    // authoritative observable signal is `qBClient.getMaindataSnapshot` —
    // the renderer `syncMaindata` poller is intentionally disabled.
    // Injecting a delta on its own mutates the mock state but does not
    // advance React, so the test emits a backend `maindata-sync-changed`
    // event at a higher revision to drive a new snapshot fetch and assert
    // the renderer reflects the updated torrent (T149.4 backend contract).
    await page.goto('/?scenario=small-100');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=small-100');
    await waitForHomeReady(page);
    await expectTableWithRows(page, 1);

    // Baseline: the connected main window already fetched an initial snapshot.
    const callsBefore = await readRecordedCalls(page);
    const snapshotCallsBefore = callsBefore.filter((call) => call.name === 'qBClient.getMaindataSnapshot').length;
    expect(snapshotCallsBefore).toBeGreaterThanOrEqual(1);

    // Inject a delta and emit a backend sync-changed event at a higher
    // revision. The renderer must call `qBClient.getMaindataSnapshot` to
    // pick up the change.
    const deltaResult = await page.evaluate(() => {
      const auto = (window as unknown) as Record<string, {
        injectDelta: () => unknown;
        deltaCount: () => number;
        emitMaindataSyncChanged: (event: unknown) => void;
        getState: () => { rid: number; torrents: Record<string, unknown> };
      }>;
      if (!auto.__TAURENT_AUTOMATION__) return { error: 'automation control not found' };
      const delta = auto.__TAURENT_AUTOMATION__.injectDelta();
      const state = auto.__TAURENT_AUTOMATION__.getState();
      auto.__TAURENT_AUTOMATION__.emitMaindataSyncChanged({
        server_id: 'mock-server-id',
        session_generation: 1,
        revision: state.rid + 1,
        rid: state.rid + 1,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
      });
      return {
        delta,
        deltaCount: auto.__TAURENT_AUTOMATION__.deltaCount(),
        torrentCount: Object.keys(state.torrents).length,
      };
    });

    expect(deltaResult.error).toBeUndefined();
    expect(deltaResult.deltaCount).toBe(1);
    // State should reflect at least 100 torrents (some modified, one added)
    expect(deltaResult.torrentCount).toBeGreaterThanOrEqual(100);

    // The emitted event must drive at least one new backend snapshot fetch.
    await expect
      .poll(
        async () =>
          (await readRecordedCalls(page)).filter((call) => call.name === 'qBClient.getMaindataSnapshot').length,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(snapshotCallsBefore);

    // Bring the backend-refreshed row into the rendered viewport through the
    // real toolbar filter. This proves React consumed the refreshed backend
    // snapshot, while avoiding a virtualization-dependent row-count assertion.
    const searchInput = page.getByRole('textbox', { name: 'Filter torrents...' });
    await searchInput.fill('[updated]');
    await expect(page.getByRole('cell', { name: 'Torrent 1 [updated]', exact: true })).toBeVisible({ timeout: 10_000 });
    await expectFirstVisibleTorrentName(page, 'Torrent 1 [updated]');

    // The mock state has hash-bearing torrents (T149.4) so the keyed-map
    // hash can be re-derived from the state for the updated row.
    const updatedState = await page.evaluate(() => {
      const auto = (window as unknown) as {
        __TAURENT_AUTOMATION__?: {
          getState: () => { torrents: Record<string, { name?: string }> };
        };
      };
      const torrents = auto.__TAURENT_AUTOMATION__?.getState().torrents ?? {};
      const updated = Object.entries(torrents).find(([, t]) => (t.name ?? '').includes('[updated]'));
      return updated ? { hash: updated[0], name: updated[1].name ?? '' } : null;
    });
    expect(updatedState).not.toBeNull();
    expect(updatedState!.hash).toMatch(TORRENT_HASH_PATTERN);

    // The first rendered row's hash also matches the qBittorrent pattern,
    // mirroring the sync-backend assertion that backend ingestion injects
    // torrent.hash before React consumes the snapshot.
    const firstRowHash = await readTorrentRowHash(getFirstVisibleTorrentRow(page));
    expect(firstRowHash ?? '').toMatch(TORRENT_HASH_PATTERN);
  });

  test('multiple deltas accumulate in automation state', async ({ page }) => {
    await page.goto('/?scenario=small-100');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=small-100');
    await waitForHomeReady(page);

    const counts = await page.evaluate(() => {
      const auto = (window as unknown) as Record<string, {
        injectDelta: () => unknown;
        deltaCount: () => number;
      }>;
      if (!auto.__TAURENT_AUTOMATION__) return [0, 0];
      auto.__TAURENT_AUTOMATION__.injectDelta();
      auto.__TAURENT_AUTOMATION__.injectDelta();
      return [auto.__TAURENT_AUTOMATION__.deltaCount(), 2];
    });

    expect(counts[0]).toBe(counts[1]);
  });
});

// ─── Phase 5: Adaptive polling ──────────────────────────────────────────────────
//
// Removed in T149.3: this block exercised renderer-poller adaptive behaviour
// (cadence, max in-flight, error backoff, recovery) through `syncCallCount`.
// The connected desktop main window is on backend-owned sync, which
// intentionally disables the renderer poller. Polling cadence, overlap
// guards, and error backoff are backend responsibilities in this lane
// and are observable only through `qBClient.getMaindataSnapshot` call
// counts / `maindata-sync-changed` events. The renderer-poller
// renderer-poller (`useMaindataSync`) health transitions were covered in
// `packages/web-core/src/sync/__tests__/useMaindataSync.health.test.ts`,
// and the backend sync contract is covered in
// `apps/desktop/e2e/sync-backend.spec.ts`.

// ─── Phase 9: reconnect and stale-state recovery ───────────────────────────────

test.describe('Phase 9 — reconnect and stale-state recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?scenario=small-100&mockAppState=connected');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=small-100&mockAppState=connected');
    await waitForHomeReady(page);
    await expectTableWithRows(page, 1);

    // Clear recorded calls and any prior fault-injection state. We
    // intentionally avoid the broader `reset()` here because it also
    // clears `_maindataSyncListeners`, which would unregister the
    // `useMaindataSyncBackend` listener and silently drop the
    // `maindata-sync-changed` event the tests below emit. The mock state
    // and the listener set are already fresh per page in this lane.
    await page.evaluate(() => {
      const auto = (window as unknown) as Record<string, { clearSyncFaults: () => void; clearRecordedCalls: () => void }>;
      auto.__TAURENT_AUTOMATION__?.clearSyncFaults?.();
      auto.__TAURENT_AUTOMATION__?.clearRecordedCalls?.();
    });
  });

  test('auto-recovers after a session error and reloads fresh torrent state', async ({ page }) => {
    // The connected desktop main window is on backend-owned sync. Mutating
    // mock state and emitting a session-changed event with `status: 'error'`
    // is not enough on its own: the reconnect flows through
    // `sessionConnectById`, but the backend sync architecture only re-fetches
    // the snapshot on `maindata-sync-changed` events (or initial mount).
    // Session reconnect alone does not advance the renderer's maindata
    // state. The test therefore (a) drives the session error, (b) waits
    // for the reconnect, (c) emits a `maindata-sync-changed` event at the
    // new revision to force a backend snapshot fetch, then (d) asserts the
    // renderer reflects the renamed "Recovered Torrent" row.
    await expect(page.getByText('Torrent 100')).toBeVisible();

    const snapshotCallsBefore = (await readRecordedCalls(page))
      .filter((call) => call.name === 'qBClient.getMaindataSnapshot').length;

    await page.evaluate(() => {
      const auto = (window as unknown as { __TAURENT_AUTOMATION__?: Phase9Automation }).__TAURENT_AUTOMATION__!;
      const state = auto.getState();
      const hashes = Object.keys(state.torrents);
      const keepHash = hashes[0];
      const keepTorrent = state.torrents[keepHash];

      for (const hash of hashes) {
        if (hash !== keepHash) delete state.torrents[hash];
      }

      state.torrents[keepHash] = {
        ...keepTorrent,
        name: 'Recovered Torrent',
      };
      state.rid += 1;

      auto.emitSessionChanged({
        session_generation: 1,
        server_id: 'mock-server-id',
        status: 'error',
        last_error: 'Connection lost',
      });
    });

    await expect.poll(async () => {
      const calls = await page.evaluate(
        () => ((window as unknown as { __TAURENT_AUTOMATION__?: Phase9Automation }).__TAURENT_AUTOMATION__?.getRecordedCalls() ?? []),
      );
      return calls.filter((call) => call.name === 'sessionConnectById').length;
    }, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    await expect(page).toHaveURL(/\/$|\/\?/, { timeout: 10_000 });

    // Drive a backend-owned refresh via `maindata-sync-changed` so the
    // post-reconnect renderer refetches the snapshot. The mock state has
    // already been mutated above; the snapshot fetch is what causes React
    // to see the renamed "Recovered Torrent" row. The mock retains
    // session_generation = 1 across the reconnect, so the event must use
    // the same generation to land on the registered listener.
    await page.evaluate(() => {
      const auto = (window as unknown as { __TAURENT_AUTOMATION__?: Phase9Automation }).__TAURENT_AUTOMATION__!;
      const state = auto.getState();
      auto.emitMaindataSyncChanged({
        server_id: 'mock-server-id',
        session_generation: 1,
        revision: state.rid + 1,
        rid: state.rid + 1,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
      });
    });

    await expect
      .poll(
        async () =>
          (await readRecordedCalls(page)).filter((call) => call.name === 'qBClient.getMaindataSnapshot').length,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(snapshotCallsBefore);

    await expect(page.getByText('Recovered Torrent')).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => {
      const names = await getTorrentRowLocator(page).evaluateAll((rows) =>
        rows.map((row) => row.getAttribute('data-torrent-name')),
      );
      return names;
    }, { timeout: 10_000 }).toEqual(['Recovered Torrent']);
    await expect(page.getByText('Torrent 100')).not.toBeVisible();
  });

  test('auto-reconnect failure redirects to login with a visible error', async ({ page }) => {
    await page.evaluate(() => {
      const auto = (window as unknown as { __TAURENT_AUTOMATION__?: Phase9Automation }).__TAURENT_AUTOMATION__!;
      auto.setAppScenario('saved-server-unavailable');
      auto.emitSessionChanged({
        session_generation: 1,
        server_id: 'mock-server-id',
        status: 'error',
        last_error: 'Connection lost',
      });
    });

    await expect.poll(async () => {
      const calls = await page.evaluate(
        () => ((window as unknown as { __TAURENT_AUTOMATION__?: Phase9Automation }).__TAURENT_AUTOMATION__?.getRecordedCalls() ?? []),
      );
      return calls.filter((call) => call.name === 'sessionConnectById').length;
    }, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Connect to Server' })).toBeVisible();
    await expect(page.getByText('Could not connect to the server. Try again.')).toBeVisible();
  });

  test('resource invalidation keeps the table stable while a backend sync-changed event drives a new snapshot fetch', async ({ page }) => {
    // The connected desktop main window is on backend-owned sync. The
    // authoritative reactivity surface is `maindata-sync-changed` events
    // (which drive a new `qBClient.getMaindataSnapshot` fetch), not the
    // renderer-poller `syncCallCount` that the previous version of this
    // test relied on. `resource-invalidated` events still flow through to
    // the query cache, but in backend mode the table is fed by
    // `useMaindataSyncBackend`, so we exercise the backend path here and
    // assert the table stays stable across the round-trip.
    const snapshotCallsBefore = (await readRecordedCalls(page))
      .filter((call) => call.name === 'qBClient.getMaindataSnapshot').length;

    await page.evaluate(() => {
      const auto = (window as unknown as { __TAURENT_AUTOMATION__?: Phase9Automation }).__TAURENT_AUTOMATION__!;
      const state = auto.getState();
      const firstHash = Object.keys(state.torrents)[0];

      auto.injectCustomDelta({
        rid: state.rid + 1,
        torrents: {
          [firstHash]: {
            ...state.torrents[firstHash],
            name: 'Fresh After Invalidate',
          },
        },
        server_state: state.server_state,
      });

      // Drive a backend-owned refresh via `maindata-sync-changed`. The
      // `resource-invalidated` event also fires so the React Query layer
      // can invalidate any cached side queries; the table itself is fed
      // by the snapshot fetch that follows the sync-changed event.
      auto.emitMaindataSyncChanged?.({
        server_id: 'mock-server-id',
        session_generation: 1,
        revision: state.rid + 1,
        rid: state.rid + 1,
        health: { state: 'healthy', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
        changed_resources: ['torrents'],
      });
      auto.emitResourceInvalidated({
        server_id: 'mock-server-id',
        session_generation: 1,
        resource: 'torrents',
      });
    });

    await expect
      .poll(
        async () =>
          (await readRecordedCalls(page)).filter((call) => call.name === 'qBClient.getMaindataSnapshot').length,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(snapshotCallsBefore);
    await expectTableWithRows(page, 1);
    // Bring the injected row into the rendered viewport through the real
    // toolbar filter. This proves the backend refresh reached React, not only
    // the mutable automation state.
    const searchInput = page.getByRole('textbox', { name: 'Filter torrents...' });
    await searchInput.fill('Fresh After Invalidate');
    await expect(page.getByRole('cell', { name: 'Fresh After Invalidate', exact: true })).toBeVisible({ timeout: 10_000 });
    await expectFirstVisibleTorrentName(page, 'Fresh After Invalidate');
  });
});

// ─── Phase 8: failure-path resilience ─────────────────────────────────────────

test.describe('Phase 8 — failure-path resilience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?scenario=small-100&mockAppState=connected');
    await page.evaluate(() => window.localStorage.setItem('taurent:perf-audit', '1'));
    await page.reload();
    await page.waitForURL('/?scenario=small-100&mockAppState=connected');
    await waitForHomeReady(page);
    await expectTableWithRows(page, 1);

    await page.evaluate(() => {
      const auto = (window as unknown) as Record<string, {
        clearSyncFaults: () => void;
        reset: () => void;
        clearRecordedCalls: () => void;
      }>;
      auto.__TAURENT_AUTOMATION__?.clearSyncFaults?.();
      auto.__TAURENT_AUTOMATION__?.reset?.();
      auto.__TAURENT_AUTOMATION__?.clearRecordedCalls?.();
    });
  });

  test('session expiry closes a pending dialog so stale destructive intent cannot be submitted', async ({ page }) => {
    await page.goto('/dialog-host-window?dialog=torrent-delete&openId=1&hashes=abcd0000000000000000000000000001&count=1&scenario=small-100&mockAppState=connected');
    await expect(page.getByText('Delete this torrent?')).toBeVisible();

    await page.evaluate(() => {
      const auto = (window as unknown as { __TAURENT_AUTOMATION__?: Phase9Automation }).__TAURENT_AUTOMATION__!;
      auto.emitSessionChanged({
        session_generation: 2,
        server_id: null,
        status: 'error',
        last_error: 'Session expired',
      });
    });

    await expect.poll(() => page.evaluate(() => window.__TAURENT_TAURI_WINDOW__?.isVisible() ?? true), {
      timeout: 10_000,
    }).toBe(false);

    const calls = await page.evaluate(() => window.__TAURENT_AUTOMATION__?.getRecordedCalls() ?? []);
    expect(calls.some((call: { name: string }) => call.name === 'torrents.delete')).toBe(false);
  });

  // Removed in T149.3: `a malformed sync payload does not crash the renderer
  // and the next healthy poll recovers`. Malformed sync is a renderer-poller
  // fault path (the `setMalformedSyncCount` automation control only affects
  // `qBClient.syncMaindata`). The connected desktop main window is on
  // backend-owned sync, where malformed-payload recovery is the backend's
  // responsibility, observable through the emitted `maindata-sync-changed`
  // health payload rather than a `syncCallCount` delta. Health transitions
  // for the renderer poller are covered in
// `packages/web-core/src/sync/__tests__/useMaindataSync.health.test.ts` (now removed),
// and the backend sync contract is covered in
// `apps/desktop/e2e/sync-backend.spec.ts`.
});
