import { expect, type Locator, type Page } from '@playwright/test';

type Scenario = 'empty' | 'small-100' | 'large-1000' | 'stress-5000';
export const APP_SCENARIOS = [
  'connected',
  'no-saved-servers',
  'no-saved-servers-failure',
  'saved-server-disconnected',
  'saved-server-unavailable',
  'saved-server-credential-missing',
  'saved-server-credential-unavailable',
] as const;
type AppScenario = (typeof APP_SCENARIOS)[number];

interface RecordedCall {
  name: string;
  args: unknown[];
}

interface DesktopAutomation {
  reset(): void;
  clearRecordedCalls(): void;
  getRecordedCalls(): RecordedCall[];
  setNextMutationFailure(operation: string, error: string): void;
  getPendingMutationFailure(): { operation: string; error: string } | null;
  syncCallCount(): number;
}

interface MockTauriEventRecord {
  event: string;
  id: number;
  payload: unknown;
}

export interface MockWebviewRecord {
  label: string;
  url: string;
  title: string;
  visible: boolean;
}

declare global {
  interface Window {
    __TAURENT_AUTOMATION__?: DesktopAutomation;
    __TAURENT_PERF_MARKS__?: Record<string, number>;
    __TAURENT_TAURI_EVENTS__?: {
      getEmittedEvents(): MockTauriEventRecord[];
      clearEmittedEvents(): void;
      emitEvent(eventName: string, payload?: unknown): Promise<void>;
    };
    __TAURENT_TAURI_WINDOW__?: {
      requestClose(): Promise<boolean>;
      isVisible(): Promise<boolean>;
      label(): string;
    };
    __TAURENT_TAURI_WEBVIEWS__?: {
      getWindows(): MockWebviewRecord[];
      clearWindows(): void;
    };
  }
}

export async function gotoDesktop(
  page: Page,
  options: {
    path?: string;
    scenario?: Scenario;
    appScenario?: AppScenario;
    searchParams?: Record<string, string>;
  } = {},
) {
  const {
    path = '/',
    scenario = 'empty',
    appScenario = 'connected',
    searchParams = {},
  } = options;

  const [rawPathname, rawSearch = ''] = path.split('?');
  const normalizedPath = rawPathname.startsWith('/') ? rawPathname : `/${rawPathname}`;
  const query = new URLSearchParams(rawSearch);
  query.set('scenario', scenario);
  query.set('mockAppState', appScenario);
  for (const [key, value] of Object.entries(searchParams)) {
    query.set(key, value);
  }

  await page.addInitScript(() => {
    window.localStorage.setItem('taurent:perf-audit', '1');
  });

  await page.goto(`${normalizedPath}?${query.toString()}`);
  try {
    await page.waitForFunction(
      () => (window as unknown as { __TAURENT_AUTOMATION__?: unknown }).__TAURENT_AUTOMATION__ != null,
      { timeout: 15_000 },
    );
  } catch (error) {
    // The mock desktop bridge installs `window.__TAURENT_AUTOMATION__` as a
    // side effect of evaluating `mockDesktopBridge.ts`. The most common
    // cause for this timeout is automation alias drift — the Vite config
    // aliased the wrong bridge subpath and the production bridge (which
    // has no automation side effect) was loaded instead. Capture a small
    // bootstrap snapshot so the failure points at the actual cause
    // instead of a bare Playwright timeout.
    const diagnostics = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return {
        url: window.location.href,
        hasAutomation: w.__TAURENT_AUTOMATION__ != null,
        hasTauriEvents: w.__TAURENT_TAURI_EVENTS__ != null,
        hasTauriWindow: w.__TAURENT_TAURI_WINDOW__ != null,
        hasTauriWebviews: w.__TAURENT_TAURI_WEBVIEWS__ != null,
        hasPerfMarks: w.__TAURENT_PERF_MARKS__ != null,
        bodySnippet: (document.body.textContent ?? '').slice(0, 240),
      };
    }).catch(() => ({ url: '<unavailable>', hasAutomation: false }));
    const hint = diagnostics.hasAutomation
      ? 'window.__TAURENT_AUTOMATION__ became available after the wait window — try increasing the helper timeout or check for slow React Query bootstrap.'
      : 'The mock desktop bridge side effect did not run. Under VITE_AUTOMATION=1 the app imports the bridge from @taurent/bridge/adapters/desktop; ensure apps/desktop/vite.config.ts keeps that alias ahead of the broad @taurent/bridge source alias so mockDesktopBridge.ts is loaded instead of the real bridge.';
    const underlying = error instanceof Error ? error.message : String(error);
    throw new Error(
      `desktop automation bootstrap did not install window.__TAURENT_AUTOMATION__ within 15s. ${hint} ` +
        `Underlying waitForFunction error: ${underlying}. ` +
        `Diagnostics: ${JSON.stringify(diagnostics)}`,
      { cause: error },
    );
  }
  await page.evaluate(() => {
    window.__TAURENT_TAURI_EVENTS__?.clearEmittedEvents();
    window.__TAURENT_TAURI_WEBVIEWS__?.clearWindows();
  });
}

export async function waitForHomeReady(page: Page) {
  await expect(page).toHaveURL(/\/($|\?)/, { timeout: 10_000 });
  await page.waitForFunction(
    () => window.__TAURENT_PERF_MARKS__?.['router.ready'] != null,
    { timeout: 10_000 },
  );
  await page.waitForFunction(() => {
    const text = document.body.textContent ?? '';
    return text.includes('No torrents') || text.includes('Torrent 1');
  }, { timeout: 15_000 });
}

export async function readRecordedCalls(page: Page): Promise<RecordedCall[]> {
  return page.evaluate(() => window.__TAURENT_AUTOMATION__?.getRecordedCalls() ?? []);
}

export async function failNextMutation(page: Page, operation: string, error: string) {
  await page.evaluate(
    ({ nextOperation, nextError }) => {
      window.__TAURENT_AUTOMATION__?.setNextMutationFailure(nextOperation, nextError);
    },
    { nextOperation: operation, nextError: error },
  );
}

export async function fillMagnet(page: Page, magnetUri: string) {
  await page.getByPlaceholder('magnet:?xt=urn:btih:...').fill(magnetUri);
}

export async function submitPrimary(page: Page, label = 'Add Torrent') {
  await page.getByRole('button', { name: label, exact: true }).click();
}

export async function readLatestRecordedCall(page: Page, name: string): Promise<RecordedCall | null> {
  const calls = await readRecordedCalls(page);
  return [...calls].reverse().find((call) => call.name === name) ?? null;
}

export async function readSyncCallCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__TAURENT_AUTOMATION__?.syncCallCount() ?? 0);
}

export async function readEmittedTauriEvents(page: Page): Promise<MockTauriEventRecord[]> {
  return page.evaluate(() => window.__TAURENT_TAURI_EVENTS__?.getEmittedEvents() ?? []);
}

export async function readPendingMutationFailure(
  page: Page,
): Promise<{ operation: string; error: string } | null> {
  return page.evaluate(() => window.__TAURENT_AUTOMATION__?.getPendingMutationFailure() ?? null);
}

export async function readMockWindowVisibility(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__TAURENT_TAURI_WINDOW__?.isVisible() ?? true);
}

export async function readMockWindowLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__TAURENT_TAURI_WINDOW__?.label() ?? null);
}

export async function requestMockWindowClose(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__TAURENT_TAURI_WINDOW__?.requestClose() ?? false);
}

export async function emitMockTauriEvent(page: Page, eventName: string, payload: unknown) {
  await page.evaluate(
    ({ nextEventName, nextPayload }) => window.__TAURENT_TAURI_EVENTS__?.emitEvent(nextEventName, nextPayload),
    { nextEventName: eventName, nextPayload: payload },
  );
}

export async function readMockWebviews(page: Page): Promise<MockWebviewRecord[]> {
  return page.evaluate(() => window.__TAURENT_TAURI_WEBVIEWS__?.getWindows() ?? []);
}

// ─── Torrent row helpers ─────────────────────────────────────────────────────
//
// The current desktop torrent table renders row elements with stable
// `data-testid="torrent-row"` plus `data-torrent-hash` / `data-torrent-name`
// attributes (see apps/desktop/src/components/TorrentTable/TorrentTableRow.tsx).
// Targeting rows through those attributes avoids relying on cell indexes or
// table layout, which split header/body tables make fragile.

/**
 * Locator that matches every rendered torrent row in the main window body.
 * Use this when you need to count or iterate rows; prefer the narrower
 * helpers below when you only need a specific row.
 */
export function getTorrentRowLocator(page: Page): Locator {
  return page.locator('[data-testid="torrent-row"]');
}

/**
 * Return the first visible torrent row in the main window body. The "first"
 * row is whichever row Playwright resolves as `.first()` — typically the
 * topmost rendered row in the virtualized list.
 */
export function getFirstVisibleTorrentRow(page: Page): Locator {
  return getTorrentRowLocator(page).first();
}

/**
 * Return the torrent row at the given rendered index. Indexes follow
 * Playwright's `.nth()` semantics (0-based) and refer to the order rows are
 * rendered, which for the virtualized list reflects the visible/logical order
 * from top to bottom.
 */
export function getVisibleTorrentRow(page: Page, index: number): Locator {
  return getTorrentRowLocator(page).nth(index);
}

/**
 * Return the torrent row whose `data-torrent-hash` attribute matches the
 * provided hash. Resolves to zero or one row; the helper does not wait.
 */
export function getTorrentRowByHash(page: Page, hash: string): Locator {
  return page.locator(`[data-testid="torrent-row"][data-torrent-hash="${hash}"]`);
}

/**
 * Read the `data-torrent-hash` attribute from a torrent row locator. Returns
 * the hash string or `null` when the row no longer exists. Use this instead
 * of inferring a hash from cell text or column position.
 */
export async function readTorrentRowHash(row: Locator): Promise<string | null> {
  return row.getAttribute('data-torrent-hash');
}

/**
 * Read the `data-torrent-name` attribute from a torrent row locator. Returns
 * the torrent name or `null` when the row no longer exists. Use this instead
 * of reading a specific column cell, which can shift when column order or
 * visibility changes.
 */
export async function readTorrentRowName(row: Locator): Promise<string | null> {
  return row.getAttribute('data-torrent-name');
}

// ─── Mocked webview polling ──────────────────────────────────────────────────
//
// Several main-window actions open dialog windows through asynchronous
// continuations. Reading mocked webview state immediately after the click
// races the dialog-open flow. These helpers poll the mocked webview record
// list so the test waits for the observable outcome instead of guessing
// timing.

export type WebviewUrlPredicate = string | RegExp | ((url: string) => boolean);

export interface WaitForMockWebviewOptions {
  /** Match only webviews with this label (e.g. `'dialog-host'`). */
  label?: string;
  /**
   * Match a `dialog=<value>` substring in the webview url. This mirrors the
   * `dialog=...` query parameter used by the dialog-host route, so callers
   * can target a specific dialog type without parsing the url themselves.
   */
  dialog?: string;
  /**
   * Match a `type=<value>` substring in the webview url. Used together with
   * `dialog` to disambiguate dialogs that share a host (e.g. `torrent-text`
   * with `type=rename` vs `type=setLocation`).
   */
  type?: string;
  /** Match a substring of the webview title. */
  title?: string;
  /**
   * Extra URL predicate. Accepts a substring (string), a regular expression,
   * or a predicate function. Combined with the structural `dialog` / `type`
   * markers above so most call sites only need a small set of options.
   */
  url?: WebviewUrlPredicate;
  /**
   * Visibility requirement. When `true` (default for dialog-opening flows),
   * only matches webviews whose mocked visibility flag is true. Pass
   * `false` to match hidden webviews (e.g. after a close request).
   */
  visible?: boolean;
  /** Poll timeout in milliseconds. Defaults to 10s. */
  timeout?: number;
}

function buildUrlMatcher(
  predicate: WebviewUrlPredicate | undefined,
): ((url: string) => boolean) | null {
  if (predicate == null) return null;
  if (typeof predicate === 'function') return predicate;
  if (predicate instanceof RegExp) return (url) => predicate.test(url);
  return (url) => url.includes(predicate);
}

function buildWebviewMatcher(
  options: WaitForMockWebviewOptions,
): (window: MockWebviewRecord) => boolean {
  const { label, dialog, type, title, url, visible } = options;
  const urlMatcher = buildUrlMatcher(url);
  return (window) => {
    if (label != null && window.label !== label) return false;
    if (dialog != null && !window.url.includes(`dialog=${dialog}`)) return false;
    if (type != null && !window.url.includes(`type=${type}`)) return false;
    if (title != null && !window.title.includes(title)) return false;
    if (urlMatcher != null && !urlMatcher(window.url)) return false;
    if (visible != null && window.visible !== visible) return false;
    return true;
  };
}

/**
 * Poll the mocked webview record list for one that matches the given
 * structural markers and/or URL predicate. Resolves with the first matching
 * record once one is observed, and throws (via `expect.poll`) if no match
 * is found before the timeout elapses.
 *
 * Typical use: wait for a dialog-opening menu item to register a
 * `dialog-host` webview before navigating the page to the dialog-host
 * route. Replaces immediate `readMockWebviews` reads after async actions.
 */
export async function waitForMockWebview(
  page: Page,
  options: WaitForMockWebviewOptions = {},
): Promise<MockWebviewRecord> {
  const { timeout = 10_000 } = options;
  const matcher = buildWebviewMatcher(options);
  let matched: MockWebviewRecord | null = null;
  await expect
    .poll(
      async () => {
        const windows = await readMockWebviews(page);
        const found = windows.find(matcher) ?? null;
        matched = found;
        return found != null;
      },
      { timeout },
    )
    .toBe(true);
  // `expect.poll` only resolves after the predicate returns true, which means
  // at least one iteration observed a non-null `matched` record. The cast
  // through `unknown` is intentional: TypeScript does not narrow the
  // outer `matched` variable from the predicate's boolean result.
  return matched as unknown as MockWebviewRecord;
}
