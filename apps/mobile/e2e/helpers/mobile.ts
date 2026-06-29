import { expect, type Page } from '@playwright/test';

export const APP_SCENARIOS = [
  'connected',
  'no-saved-servers',
  'saved-server-disconnected',
  'saved-server-unavailable',
  'saved-server-credential-missing',
] as const;
type AppScenario = (typeof APP_SCENARIOS)[number];

interface RecordedCall {
  name: string;
  args: unknown[];
}

interface MobileAutomation {
  reset(): void;
  clearRecordedCalls(): void;
  getRecordedCalls(): RecordedCall[];
  getPreferences(): Record<string, unknown>;
  setNextMutationFailure(operation: string, error: string): void;
  getPendingMutationFailure(): { operation: string; error: string } | null;
}

declare global {
  interface Window {
    __TAURENT_AUTOMATION__?: MobileAutomation;
    __TAURENT_PERF_MARKS__?: Record<string, number>;
  }
}

export async function gotoMobile(
  page: Page,
  options: {
    path?: string;
    scenario?: string;
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
  await page.waitForFunction(() => window.__TAURENT_AUTOMATION__ != null);
}

export async function waitForHomeReady(page: Page) {
  await expect(page).toHaveURL(/\/($|\?)/, { timeout: 10_000 });
  // Mobile doesn't set router.ready perf mark; wait for torrent list or empty state
  await page.waitForFunction(() => {
    const text = document.body.textContent ?? '';
    return text.includes('No torrents') || text.includes('Torrent 1') || text.includes('no torrents');
  }, { timeout: 15_000 });
}

export async function readRecordedCalls(page: Page): Promise<RecordedCall[]> {
  return page.evaluate(() => window.__TAURENT_AUTOMATION__?.getRecordedCalls() ?? []);
}

export async function readLatestRecordedCall(page: Page, name: string): Promise<RecordedCall | null> {
  const calls = await readRecordedCalls(page);
  return [...calls].reverse().find((call) => call.name === name) ?? null;
}

export async function readPreferences(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    () => (window.__TAURENT_AUTOMATION__?.getPreferences() ?? null) as Record<string, unknown> | null,
  );
}

export async function clearRecordedCalls(page: Page): Promise<void> {
  await page.evaluate(() => window.__TAURENT_AUTOMATION__?.clearRecordedCalls());
}

export async function failNextMutation(page: Page, operation: string, error: string) {
  await page.evaluate(
    ({ nextOperation, nextError }) => {
      window.__TAURENT_AUTOMATION__?.setNextMutationFailure(nextOperation, nextError);
    },
    { nextOperation: operation, nextError: error },
  );
}

export async function readPendingMutationFailure(
  page: Page,
): Promise<{ operation: string; error: string } | null> {
  return page.evaluate(() => window.__TAURENT_AUTOMATION__?.getPendingMutationFailure() ?? null);
}
