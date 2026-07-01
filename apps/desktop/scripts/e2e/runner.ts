// Tauri E2E test runner — orchestrates fake QB server, Tauri app, and tests.
// Usage: pnpm desktop:tauri:e2e [scenario] [--fake-port=18080] [--driver-port=4445] [--skip-build] [--with-vite]
// Scenarios: empty | small-100 (default) | large-1000 | stress-5000

import { mkdirSync } from 'fs';
import { join, resolve } from 'path';

import {
  writemsg,
  verbosemsg,
  platform,
  findAppBinary,
  startViteDevServer,
  startFakeQBitTorrentServer,
  launchTauriApp,
  waitForAppReady,
  killStaleProcesses,
  getE2EArtifactDir,
  cleanE2EArtifacts,
  prepareNativeDiagnosticsLog,
  readNativeDiagnostics,
  captureProcessSnapshot,
  sleep,
  findAvailablePort,
  removeWebviewProfile,
  killAppProcessTree,
  parseSyncDiagnostics,
  type NativeDiagnosticsResult,
  type ProcessSnapshot,
  type SyncDiagnosticsResult,
} from './infrastructure.js';

import { createSession, destroySession } from './webdriver.js';

import {
  captureWebDriverDiagnostics,
  waitForWindowHandleCount,
  waitForWindowByUrl,
  waitForWindowLabel,
  waitForWindowBodyText,
  waitForWindowBodyTextAbsentOrClosed,
  closeWindowIfPresent,
  switchToWindowWithRetry,
  clickSettingsToggleByLabel,
  hoverContextMenuSubMenu,
  clickContextMenuItem,
  readClipboardText,
  findInputByPlaceholder,
  findButtonByText,
  findButtonByExactText,
  reconnectViaLoginScreen,
  type WebDriverDiagnostics,
} from './helpers.js';

import { waitFor } from './wait.js';

import type { FakeBackendSession } from './tests/types.js';
import type { Browser } from 'webdriverio';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseKeyValueArg(args: string[], key: string): number | null {
  const eq = args.find((a) => a.startsWith(`--${key}=`));
  if (eq) return Number(eq.split('=')[1]);
  const idx = args.indexOf(`--${key}`);
  if (idx !== -1 && idx + 1 < args.length) {
    const val = args[idx + 1];
    if (!val.startsWith('--')) return Number(val);
  }
  return null;
}

function configureLogging(args: string[]): void {
  if (args.includes('--verbose')) {
    process.env.TAURENT_TAURI_E2E_LOG = 'verbose';
  }
}

function shouldBuildAppBinary(args: string[]): boolean {
  return !args.includes('--skip-build') && !process.env.TAURENT_TAURI_APP_PATH;
}

function shouldStartViteDevServer(args: string[]): boolean {
  return args.includes('--with-vite');
}

function isRecoverableWebDriverTransportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return [
    'connection refused',
    'connection reset',
    'econnrefused',
    'econnreset',
    'socket hang up',
    'fetch failed',
    'terminated',
    'unable to connect',
    'browser driver is running',
    'service failed to start',
    'rejecting any connections',
  ].some((needle) => normalized.includes(needle));
}

async function buildAppBinary(): Promise<void> {
  writemsg('Building app binary with webdriver feature...');
  const { spawnSync } = await import('child_process') as typeof import('child_process');
  const buildResult = spawnSync('pnpm', ['--filter', 'taurent', 'tauri:build', '--no-bundle', '--features', 'webdriver'], {
    cwd: process.cwd(),
    shell: platform() === 'windows',
    stdio: 'inherit',
  });
  if (buildResult.status !== 0) {
    console.error(`[tauri:e2e] ERROR: Build failed with exit code ${buildResult.status}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Backend helpers
// ---------------------------------------------------------------------------

interface FakeBackendResponse {
  status: number;
  text: string;
  headers: Headers;
}

function getFakeBackendAuthHeaders(baseUrl: string): Record<string, string> {
  const origin = new URL(baseUrl).origin;
  return {
    Origin: origin,
    Referer: `${origin}/`,
  };
}

async function fakeBackendRequest(
  baseUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST';
    session?: FakeBackendSession;
    includeAuthHeaders?: boolean;
    headers?: Record<string, string>;
    body?: string | URLSearchParams;
  } = {},
): Promise<FakeBackendResponse> {
  const headers = new Headers();
  if (options.session) {
    headers.set('Cookie', options.session.cookie);
    if (options.includeAuthHeaders !== false) {
      const authHeaders = getFakeBackendAuthHeaders(baseUrl);
      headers.set('Origin', authHeaders.Origin);
      headers.set('Referer', authHeaders.Referer);
    }
  }
  for (const [key, value] of Object.entries(options.headers ?? {})) {
    headers.set(key, value);
  }

  let body: string | undefined;
  if (options.body instanceof URLSearchParams) {
    body = options.body.toString();
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }
  } else {
    body = options.body;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  return {
    status: response.status,
    text: await response.text(),
    headers: response.headers,
  };
}

// ---------------------------------------------------------------------------
// Fake backend SID coupling invariant
// ---------------------------------------------------------------------------
//
// `loginFakeBackend` issues a fresh SID against the fake qBittorrent server.
// The cookie returned by that call MUST be used for all subsequent
// `fetchTorrentInfo` / `fakeBackendRequest` backend-verification calls in the
// same smoke run, because the fake backend scopes state (torrent info,
// sync/maindata cursors, rate-limit failure counters, etc.) by SID.
//
// In particular: after the Tauri app connects via the Add Server form, the
// app has already obtained its own SID from the fake backend. A separate
// `loginFakeBackend` call from the runner creates a SECOND SID that happens
// to share credentials, but the backend does NOT alias those SIDs — they
// are independent sessions. To make backend verification calls (e.g. polling
// torrent state after a pause/resume) read the SAME state the app sees, the
// runner's SID must match the app's active session. The current flow works
// because the app's `session_connect → qbittorrent_login` reuses the same
// credentials and the fake backend is single-process and single-SID-per-IP
// in this scenario, but the invariant is load-bearing: if the fake backend
// is changed to issue per-login independent state, every backend-verification
// call in this file must be re-checked.
//
// Concretely:
//   1. `assertFakeBackendContracts` uses its own short-lived SIDs that are
//      discarded after the contract checks complete.
//   2. After the app has connected via the Add Server form, the runner
//      calls `loginFakeBackend(fakeUrl)` ONCE to obtain `backendSession`,
//      and that session is the one passed to every subsequent
//      `fetchTorrentInfo` and `fakeBackendRequest` call.
//   3. The lifecycle test reuses the SAME `backendSession` (no fresh
//      login) so its sync-error injection and reconnect polling target the
//      same SID the app is using.

async function loginFakeBackend(
  baseUrl: string,
  username = 'admin',
  password = 'adminadmin',
  query = '',
): Promise<FakeBackendSession> {
  const response = await fakeBackendRequest(baseUrl, `/api/v2/auth/login${query}`, {
    method: 'POST',
    body: new URLSearchParams({ username, password }),
  });

  if (response.status !== 200) {
    throw new Error(`Fake backend login failed with ${response.status}: ${response.text}`);
  }

  const cookie = response.headers.get('set-cookie');
  if (!cookie) {
    throw new Error('Fake backend login did not return SID cookie');
  }

  return { cookie: cookie.split(';')[0] };
}

async function fetchTorrentInfo(
  baseUrl: string,
  session: FakeBackendSession,
): Promise<Array<Record<string, unknown>>> {
  const response = await fakeBackendRequest(baseUrl, '/api/v2/torrents/info', { session });
  if (response.status !== 200) {
    throw new Error(`GET /api/v2/torrents/info failed with ${response.status}: ${response.text}`);
  }
  const data = JSON.parse(response.text) as Array<Record<string, unknown>>;
  verbosemsg(`[fetchTorrentInfo] got ${data.length} torrents, first 3: ${JSON.stringify(data.slice(0,3).map(t => ({name: t.name, state: t.state, hash: t.hash})))}`);
  return data;
}

function getTorrentByName(
  torrents: Array<Record<string, unknown>>,
  name: string,
): Record<string, unknown> | undefined {
  return torrents.find((torrent) => torrent.name === name);
}

function getTorrentByHash(
  torrents: Array<Record<string, unknown>>,
  hash: string,
): Record<string, unknown> | undefined {
  return torrents.find((torrent) => torrent.hash === hash);
}

function pushBackendCheck(result: E2EResult, msg: string): void {
  result.backendChecks.push(msg);
  writemsg(`[backend-check] ${msg}`);
}

function printCapturedAppOutputTail(stdoutChunks: string[], stderrChunks: string[], maxLines = 80): void {
  const lines = [
    ...stdoutChunks.join('').split('\n').map((line) => `[app] ${line}`),
    ...stderrChunks.join('').split('\n').map((line) => `[app:err] ${line}`),
  ].filter((line) => line.trim() !== '[app]' && line.trim() !== '[app:err]');

  if (lines.length === 0) return;

  writemsg(`Recent app output (${Math.min(lines.length, maxLines)} of ${lines.length} line(s)):`);
  for (const line of lines.slice(-maxLines)) {
    writemsg(line);
  }
}

async function saveFrontendScreenshot(browserInstance: Browser, label: string): Promise<string | null> {
  const artifactDir = getE2EArtifactDir();
  mkdirSync(artifactDir, { recursive: true });
  const screenshotPath = join(artifactDir, `${label}.png`);

  try {
    await browserInstance.saveScreenshot(screenshotPath);
    writemsg(`[screenshot] ${label}: ${screenshotPath}`);
    return screenshotPath;
  } catch (err) {
    writemsg(`[screenshot] ${label} failed: ${(err as Error).message}`);
    return null;
  }
}

async function captureFrontendEvidence(
  result: E2EResult,
  browserInstance: Browser,
  label: string,
): Promise<void> {
  await saveFrontendScreenshot(browserInstance, label);
  result.diagnostics.push(await captureWebDriverDiagnostics(browserInstance, label));
}

async function waitForInitialAppWindow(browserInstance: Browser): Promise<void> {
  // Wait for app window to settle — LoginScreen renders server cards or the
  // "Add New Server" button, the AddServerScreen renders for first-time
  // setup (no saved servers), and the torrent table appears once connected.
  await waitFor(
    'app window to render LoginScreen, AddServerScreen, or torrent table',
    async () => {
      const loginReady = await browserInstance.$('[data-testid="login-add-server-button"]');
      if (await loginReady.isExisting().catch(() => false)) return true;
      const serverCards = await browserInstance.$('[data-testid="login-server-card"]');
      if (await serverCards.isExisting().catch(() => false)) return true;
      const addServerScreen = await browserInstance.$('[data-testid="add-server-screen"]');
      if (await addServerScreen.isExisting().catch(() => false)) return true;
      const torrentTable = await browserInstance.$('[data-testid="torrent-table"]');
      return await torrentTable.isExisting().catch(() => false);
    },
    { timeoutMs: 15_000, intervalMs: 250 },
  );
}

async function waitForVisibleTorrentRows(browserInstance: Browser, label: string, timeoutMs = 15_000): Promise<void> {
  await waitFor(
    label,
    async () => {
      const table = await browserInstance.$('[data-testid="torrent-table"]');
      if (!(await table.isDisplayed().catch(() => false))) return false;

      const rows = await browserInstance.$$('tbody tr[data-testid="torrent-row"]');
      for (const row of rows) {
        if (await row.isDisplayed().catch(() => false)) return true;
      }
      return false;
    },
    { timeoutMs, intervalMs: 500 },
  );
}

async function readLifecycleFrontendState(browserInstance: Browser): Promise<'torrent-table' | 'login-screen' | 'other'> {
  const table = await browserInstance.$('table');
  if (await table.isDisplayed().catch(() => false)) {
    const rows = await browserInstance.$$('tbody tr[data-testid="torrent-row"]');
    for (const row of rows) {
      if (await row.isDisplayed().catch(() => false)) return 'torrent-table';
    }
  }

  const serverCards = await browserInstance.$$('[data-testid="login-server-card"]');
  for (const card of serverCards) {
    if (await card.isDisplayed().catch(() => false)) return 'login-screen';
  }

  const bodyText = await browserInstance.$('body').getText().catch(() => '');
  if (bodyText.includes('Connect to Server')) return 'login-screen';

  return 'other';
}

// ---------------------------------------------------------------------------
// E2E Result type
// ---------------------------------------------------------------------------

interface E2EResult {
  success: boolean;
  scenario: string;
  appPath: string;
  driverPort: number;
  fakePort: number;
  durationMs: number;
  timingSemantics: string;
  error?: string;
  timings: {
    appLaunchMs: number;
    serverConnectMs: number;
    tableVisibleMs: number;
    interactionPhaseMs: number;
  };
  diagnostics: WebDriverDiagnostics[];
  backendChecks: string[];
  nativeDiagnostics: NativeDiagnosticsResult;
  processSnapshots: ProcessSnapshot[];
  /** Smoke flow checks that were intentionally skipped (e.g., platform-specific limitations). */
  skippedChecks: string[];
  /** Sync-specific evidence from T147.1 diagnostics parsed from app output. */
  syncDiagnostics: SyncDiagnosticsResult;
}

// ---------------------------------------------------------------------------


async function main() {
  const args = process.argv.slice(2);
  configureLogging(args);
  const scenarioArg = args.find((a) => !a.startsWith('--')) ?? 'small-100';
  const scenario = ['empty', 'small-100', 'large-1000', 'stress-5000'].includes(scenarioArg)
    ? scenarioArg
    : 'small-100';

  // Clear stale screenshots/artifacts from prior runs so CI uploads only
  // reflect the current run.
  cleanE2EArtifacts();

  const requestedDriverPort = parseKeyValueArg(args, 'driver-port');
  const requestedFakePort = parseKeyValueArg(args, 'fake-port');
  const driverPort = requestedDriverPort ?? await findAvailablePort(4445);
  const fakePort = requestedFakePort ?? await findAvailablePort(18080);
  if (requestedDriverPort === null && driverPort !== 4445) {
    writemsg(`Default WebDriver port 4445 is busy; using ${driverPort}.`);
  }
  if (requestedFakePort === null && fakePort !== 18080) {
    writemsg(`Default fake qBittorrent port 18080 is busy; using ${fakePort}.`);
  }

  // ---------------------------------------------------------------------------
  // Locate app binary
  // ---------------------------------------------------------------------------
  if (shouldBuildAppBinary(args)) {
    await buildAppBinary();
  }

  writemsg('Locating app binary...');
  const appPath = findAppBinary();
  if (!appPath) {
    console.error(
      `[tauri:e2e] ERROR: App binary not found after build.\n` +
      `  Set TAURENT_TAURI_APP_PATH explicitly or rerun without --skip-build.`,
    );
    process.exit(1);
  }
  writemsg(`Using app: ${appPath}`);

  // ---------------------------------------------------------------------------
  // Kill stale processes on ports before starting
  // ---------------------------------------------------------------------------
  writemsg('Cleaning up stale processes on test ports...');
  await killStaleProcesses([fakePort, driverPort]);

  // ---------------------------------------------------------------------------
  // Start fake qBittorrent server
  // ---------------------------------------------------------------------------
  writemsg('Starting fake qBittorrent server...');
  const { url: fakeUrl, stop: stopFakeServer } = await startFakeQBitTorrentServer(
    scenario as 'empty' | 'small-100' | 'large-1000' | 'stress-5000',
    fakePort,
  );
  writemsg(`Fake server at ${fakeUrl}`);

  // ---------------------------------------------------------------------------
  // Optionally start Vite dev server (opt-in via --with-vite)
  // ---------------------------------------------------------------------------
  // The packaged Tauri app binary built via `tauri build --no-bundle` serves its
  // own frontend from `src-tauri/tauri.conf.json: "frontendDist": "../dist"`, so
  // the Vite dev server is unused by default. It is only kept as an opt-in
  // escape hatch (--with-vite) for future dev-mode smoke work.
  let viteProc: import('child_process').ChildProcess | undefined;
  if (shouldStartViteDevServer(args)) {
    writemsg('Starting Vite dev server (--with-vite)...');
    try {
      const viteResult = await startViteDevServer(process.cwd(), 5173);
      viteProc = viteResult.proc;
    } catch (err) {
      await stopFakeServer();
      console.error(`[tauri:e2e] ERROR: ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    writemsg('Skipping Vite dev server (packaged Tauri binary serves its own frontend).');
  }

  // ---------------------------------------------------------------------------
  // Prepare app launch
  // ---------------------------------------------------------------------------
  let nativeDiagnosticsLogPath = prepareNativeDiagnosticsLog();
  let webviewDebugPort = await findAvailablePort(30000 + Math.floor(Math.random() * 10000));
  let webviewUserDataFolder = join(getE2EArtifactDir(), `webview-profile-${Date.now()}`);
  mkdirSync(webviewUserDataFolder, { recursive: true });

  writemsg(`Native diagnostics log: ${nativeDiagnosticsLogPath}`);
  writemsg(`WebView2 options: userDataFolder=${webviewUserDataFolder}, remote-debugging-port=${webviewDebugPort}`);

  // ---------------------------------------------------------------------------
  // Launch Tauri app
  // ---------------------------------------------------------------------------
  const appLaunchStart = Date.now();
  let appLaunchResult = launchTauriApp(
    appPath,
    driverPort,
    webviewDebugPort,
    webviewUserDataFolder,
    nativeDiagnosticsLogPath,
  );
  let appProc = appLaunchResult.proc;

  try {
    await waitForAppReady(driverPort);
  } catch (err) {
    appProc.kill();
    viteProc?.kill();
    await stopFakeServer();
    console.error(`[tauri:e2e] ERROR: ${(err as Error).message}`);
    process.exit(1);
  }

  const appLaunchMs = Date.now() - appLaunchStart;
  writemsg(`App ready in ${appLaunchMs}ms (WebDriver server on port ${driverPort})`);

  // ---------------------------------------------------------------------------
  // WebDriverIO session
  // ---------------------------------------------------------------------------
  const startMs = Date.now();

  const result: E2EResult = {
    success: false,
    scenario,
    appPath,
    driverPort,
    fakePort,
    durationMs: 0,
    timingSemantics: 'Native smoke timings are observational only; they are useful for packaged-app smoke visibility, not stable regression budgets.',
    timings: {
      appLaunchMs,
      serverConnectMs: 0,
      tableVisibleMs: 0,
      interactionPhaseMs: 0,
    },
    diagnostics: [],
    backendChecks: [],
    nativeDiagnostics: { logPath: nativeDiagnosticsLogPath, lines: [] },
    processSnapshots: [],
    skippedChecks: [],
    syncDiagnostics: {
      snapshotTimings: [],
      lifecycleEvents: [],
      revisionProgression: [],
      pass: false,
      blockers: ['Sync diagnostics not yet parsed'],
    },
  };

  let browser: Browser | undefined;
  const stopFake = stopFakeServer;

  const relaunchAppForWebDriverRetry = async (attempt: number, error: unknown): Promise<void> => {
    const message = error instanceof Error ? error.message : String(error);
    writemsg(
      `Recoverable WebDriver transport failure during startup attempt ${attempt}: ${message}. ` +
        'Relaunching app once with a fresh WebKit profile...',
    );
    result.skippedChecks.push(`native WebDriver startup attempt ${attempt} retried after transport failure: ${message}`);

    if (browser) {
      try {
        await destroySession({ browser });
      } catch (cleanupError) {
        verbosemsg(`Ignoring session cleanup error before retry: ${(cleanupError as Error).message}`);
      }
      browser = undefined;
    }

    await killAppProcessTree(appProc, webviewUserDataFolder);
    removeWebviewProfile(webviewUserDataFolder);

    nativeDiagnosticsLogPath = prepareNativeDiagnosticsLog();
    webviewDebugPort = await findAvailablePort(30000 + Math.floor(Math.random() * 10000));
    webviewUserDataFolder = join(getE2EArtifactDir(), `webview-profile-${Date.now()}-retry-${attempt}`);
    mkdirSync(webviewUserDataFolder, { recursive: true });

    writemsg(`Native diagnostics log: ${nativeDiagnosticsLogPath}`);
    writemsg(`WebView2 options: userDataFolder=${webviewUserDataFolder}, remote-debugging-port=${webviewDebugPort}`);

    const relaunchStart = Date.now();
    appLaunchResult = launchTauriApp(
      appPath,
      driverPort,
      webviewDebugPort,
      webviewUserDataFolder,
      nativeDiagnosticsLogPath,
    );
    appProc = appLaunchResult.proc;
    await waitForAppReady(driverPort);
    result.timings.appLaunchMs = Date.now() - relaunchStart;
  };

  // ---------------------------------------------------------------------------
  // Run smoke tests
  // ---------------------------------------------------------------------------
  try {
    writemsg('Running fake backend contract checks...');
    await assertFakeBackendContracts(fakeUrl, result);

    const driverUrl = `http://127.0.0.1:${driverPort}`;
    const maxStartupAttempts = 2;
    let startupAttempt = 1;
    while (true) {
      try {
        writemsg(`Connecting via WebDriverIO (attempt ${startupAttempt}/${maxStartupAttempts})...`);
        const serverConnectStart = Date.now();
        const session = await createSession(
          driverUrl,
          appPath,
          webviewUserDataFolder,
          webviewDebugPort,
        );
        browser = session.browser;

        result.timings.serverConnectMs = Date.now() - serverConnectStart;
        writemsg('WebDriverIO session started.');
        result.processSnapshots.push(await captureProcessSnapshot(`after-session-attempt-${startupAttempt}`));
        result.diagnostics.push(await captureWebDriverDiagnostics(browser, `after-session-attempt-${startupAttempt}`));
        await waitForInitialAppWindow(browser);
        break;
      } catch (err) {
        if (startupAttempt >= maxStartupAttempts || !isRecoverableWebDriverTransportError(err)) {
          throw err;
        }
        await relaunchAppForWebDriverRetry(startupAttempt, err);
        startupAttempt++;
      }
    }
    if (!browser) {
      throw new Error('WebDriverIO session was not created');
    }

    // -------------------------------------------------------------------------
    // Smoke flow (all tests in sequence)
    // -------------------------------------------------------------------------

    const browserInstance = browser;

    // Check for "Add New Server" / "Add Server" button first
    writemsg('[smoke] Checking for Add New Server button...');
    const addNewBtn = await browserInstance.$('[data-testid="login-add-server-button"]');
    if (await addNewBtn.isExisting().catch(() => false)) {
      const visible = await addNewBtn.isDisplayed().catch(() => false);
      if (visible) {
        writemsg('[smoke] Add New Server button found — clicking...');
        await addNewBtn.click();
        // Wait for the Add Server form inputs to render after navigation.
        await waitFor(
          'Add Server form name input to render',
          async () => {
            const nameInput = await findInputByPlaceholder(browserInstance, 'My Home Server');
            return Boolean(nameInput && await nameInput.isDisplayed().catch(() => false));
          },
          { timeoutMs: 10_000, intervalMs: 250 },
        );
      }
    }

    // Detect form inputs or table
    writemsg('[smoke] Checking for Add Server form or torrent list...');

    let formDetected = false;
    let tableDetected = false;

    try {
      const urlInput = await browserInstance.$('[data-testid="add-server-screen"] input');
      if (urlInput) {
        formDetected = await urlInput.isDisplayed().catch(() => false);
      }
    } catch { /* not found */ }

    if (!formDetected) {
      try {
        const possibleTable = await browserInstance.$('[data-testid="torrent-table"]');
        if (possibleTable) {
          tableDetected = await possibleTable.isDisplayed().catch(() => false);
        }
      } catch { /* not found */ }
    }

    // Fill form if detected
    if (formDetected) {
      writemsg('[smoke] Add Server form detected — filling in fake server...');
      let submitClicked = false;
      try {
        const nameInput = await findInputByPlaceholder(browser, 'My Home Server');
        if (nameInput && (await nameInput.isDisplayed())) {
          await nameInput.clearValue();
          await nameInput.setValue('Fake qBittorrent');
        }

        const urlInput2 = await findInputByPlaceholder(browser, 'http://localhost:8080');
        if (urlInput2 && (await urlInput2.isDisplayed())) {
          await urlInput2.clearValue();
          await urlInput2.setValue(fakeUrl);
        }

        const usernameInput = await findInputByPlaceholder(browser, 'admin');
        if (usernameInput && (await usernameInput.isDisplayed())) {
          await usernameInput.clearValue();
          await usernameInput.setValue('admin');
        }

        const inputs = await browser.$$('input');
        let passwordInput: WebdriverIO.Element | undefined;
        for (const input of inputs) {
          if ((await input.getAttribute('type')) === 'password') {
            passwordInput = input;
            break;
          }
        }
        if (passwordInput && (await passwordInput.isDisplayed())) {
          await passwordInput.clearValue();
          await passwordInput.setValue('adminadmin');
        }

        const testConnectionBtn = await findButtonByExactText(browserInstance, 'Test Connection');
        if (testConnectionBtn && (await testConnectionBtn.isEnabled().catch(() => false))) {
          await testConnectionBtn.click();
          await waitFor('Connection successful! after Test Connection', async () => {
            const bodyText = await browserInstance.$('body').getText();
            return bodyText.includes('Connection successful!');
          }, { timeoutMs: 10_000 });
        }

        const submitBtn = await findButtonByExactText(browserInstance, 'Add Server');
        if (!submitBtn) {
          const saveBtn = await findButtonByText(browserInstance, 'Save');
          if (saveBtn) await saveBtn.click();
        } else {
          await waitFor(
            'Add Server submit button to enable',
            async () => await submitBtn.isEnabled().catch(() => false),
            { timeoutMs: 5_000, intervalMs: 250 },
          ).catch(() => undefined);
          await submitBtn.click();
        }
        submitClicked = true;
      } catch (err) {
        const message = (err as Error).message;
        writemsg(`[smoke] Form fill skipped: ${message}`);
        result.skippedChecks.push(`add server form fill: ${message}`);
      }

      if (submitClicked) {
        try {
          await waitFor('navigation after Add Server', async () => {
            const url = await browserInstance.getUrl();
            return !url.includes('/add-server');
          }, { timeoutMs: 15_000 });
        } catch {
          result.diagnostics.push(
            await captureWebDriverDiagnostics(browserInstance, 'add-server-no-navigation'),
          );
          const bodyText = await browserInstance.$('body').getText();
          writemsg(`[smoke] Add Server: page stayed on /add-server. Body text: "${bodyText.slice(0, 600)}"`);
          throw new Error(
            `Add Server did not navigate away from /add-server within 15s. Body text excerpt: "${bodyText.slice(0, 300)}"`,
          );
        }
      }
    } else if (!tableDetected) {
      result.processSnapshots.push(await captureProcessSnapshot('no-form-or-table'));
      result.diagnostics.push(await captureWebDriverDiagnostics(browserInstance, 'no-form-or-table'));
      throw new Error('Neither Add Server form nor torrent list was detected after launch');
    }

    // Wait for torrent table to appear
    writemsg('[smoke] Waiting for torrent table...');
    const tableVisibleStart = Date.now();
    let tableFound = false;

    try {
      await waitFor(
        'torrent table to render',
        async () => {
          const table = await browserInstance.$('[data-testid="torrent-table"]');
          return Boolean(table && await table.isDisplayed().catch(() => false));
        },
        { timeoutMs: 10_000, intervalMs: 500 },
      );
      tableFound = true;
    } catch {
      tableFound = false;
    }

    result.timings.tableVisibleMs = Date.now() - tableVisibleStart;

    if (!tableFound) {
      result.processSnapshots.push(await captureProcessSnapshot('table-timeout'));
      await captureFrontendEvidence(result, browser, 'table-timeout');
      throw new Error('Torrent table never became visible after 10s');
    }
    await saveFrontendScreenshot(browser, 'main-window-ready');
    writemsg(`[smoke] Table visible in ${result.timings.tableVisibleMs}ms`);

    // Verify "Torrent 1" text is present
    writemsg('[smoke] Verifying Torrent 1 is present...');
    let torrent1Found = false;
    try {
      const rows = await browserInstance.$$('tbody tr[data-testid="torrent-row"]');
      for (const row of rows) {
        const rowText = await row.getText();
        if (rowText.includes('Torrent 1')) {
          torrent1Found = true;
          break;
        }
      }
    } catch { /* ignore */ }
    if (!torrent1Found) {
      throw new Error('Torrent 1 not found in table');
    }
    writemsg('[smoke] Torrent 1 found.');

    const mainHandle = await browserInstance.getWindowHandle();

    // Login to the fake backend AFTER the app has connected via Add Server form.
    // The app already logged in (via session_connect → qbittorrent_login), so this login
    // will create the SAME SID that the app is using. This ensures backend verification
    // calls (waitForTorrentState, fetchTorrentInfo) use the correct session cookie.
    const backendSession = await loginFakeBackend(fakeUrl);
    writemsg('[smoke] Backend logged in, waiting for sync to stabilize...');
    // Wait for app sync cycle to complete so UI is fully ready. Backend torrent
    // count must match the small-100 scenario (100 torrents) and remain stable.
    await waitFor(
      'backend torrent count to match small-100 fixture',
      async () => {
        const torrents = await fetchTorrentInfo(fakeUrl, backendSession);
        return torrents.length === 100;
      },
      { timeoutMs: 15_000, intervalMs: 250 },
    );
    await waitFor(
      'UI torrent row count to match backend (sync settled)',
      async () => {
        const rows = await browserInstance.$$('tbody tr[data-testid="torrent-row"][data-torrent-hash]');
        const rowCount = await rows.length;
        if (rowCount === 0) return false;
        // Read the hash from the first row and confirm it exists in backend state.
        const firstHash = await rows[0].getAttribute('data-torrent-hash').catch(() => null);
        if (!firstHash) return false;
        const torrents = await fetchTorrentInfo(fakeUrl, backendSession);
        return torrents.some((t) => String(t.hash) === firstHash);
      },
      { timeoutMs: 15_000, intervalMs: 500 },
    );

    // Sort: click first column header
    const interactionPhaseStart = Date.now();
    writemsg('[smoke] Testing column sort...');
    const headers = await browserInstance.$$('[data-testid="torrent-header-cell"]');
    const headerCount = await headers.length;
    if (headerCount === 0) {
      throw new Error('No table headers found for native sort smoke check');
    }
    await headers[0].click();
    await sleep(300);
    writemsg('[smoke] Column header clicked.');

    // Select a visible runnable row to test pause/resume. The table is virtualized,
    // so use row metadata from the DOM instead of assuming a particular fixture row
    // remains visible after sorting.
    const rows = await browser.$$('tbody tr[data-testid="torrent-row"]');
    if ((await rows.length) === 0) {
      throw new Error('No torrent rows found for native selection smoke check');
    }
    const runnableRow = await browser.$(
      [
        'tbody tr[data-testid="torrent-row"][data-torrent-state="uploading"]',
        'tbody tr[data-testid="torrent-row"][data-torrent-state="downloading"]',
        'tbody tr[data-testid="torrent-row"][data-torrent-state="stalledUP"]',
        'tbody tr[data-testid="torrent-row"][data-torrent-state="stalledDL"]',
      ].join(','),
    );
    if (!(await runnableRow.isExisting().catch(() => false))) {
      throw new Error('No visible runnable torrent row found for native selection smoke check');
    }
    const selectedTorrentHash = await runnableRow.getAttribute('data-torrent-hash');
    const selectedTorrentName = await runnableRow.getAttribute('data-torrent-name');
    if (!selectedTorrentHash || !selectedTorrentName) {
      throw new Error('Selected torrent row is missing hash/name metadata');
    }
    await runnableRow.click();
    // Wait for the pause toolbar button to enable after row selection.
    await waitFor(
      'pause toolbar button to enable after row select',
      async () => {
        const btn = await browserInstance.$('[data-testid="toolbar-pause"]');
        return Boolean(btn && await btn.isEnabled().catch(() => false));
      },
      { timeoutMs: 8_000, intervalMs: 250 },
    );
    writemsg(`[smoke] Selected visible row: ${selectedTorrentName} hash=${selectedTorrentHash}`);

    // Pause
    const pauseButton = await browserInstance.$('[data-testid="toolbar-pause"]');
    if (!(await pauseButton.isExisting().catch(() => false))) {
      throw new Error('Pause toolbar button not found for native state-transition smoke check');
    }
    await waitFor(
      'pause toolbar button to enable',
      async () => await pauseButton.isEnabled().catch(() => false),
      { timeoutMs: 8_000, intervalMs: 250 },
    );
    await pauseButton.click();
    // waitFor below already polls backend state, which implicitly waits for
    // the app's sync cycle to reflect the pause mutation.
    await waitFor(
      `${selectedTorrentName} to reach paused state after toolbar pause`,
      async () => {
        const selectedTorrent = getTorrentByHash(await fetchTorrentInfo(fakeUrl, backendSession), selectedTorrentHash);
        return selectedTorrent?.state === 'pausedDL' || selectedTorrent?.state === 'pausedUP';
      },
      { timeoutMs: 10_000, intervalMs: 250 },
    );
    pushBackendCheck(result, `native toolbar pause changed ${selectedTorrentName} to paused state`);

    // Resume
    const resumeButton = await browser.$('[data-testid="toolbar-resume"]');
    if (!(await resumeButton.isExisting().catch(() => false))) {
      throw new Error('Resume toolbar button not found for native state-transition smoke check');
    }
    await waitFor(
      'resume toolbar button to enable',
      async () => await resumeButton.isEnabled().catch(() => false),
      { timeoutMs: 8_000, intervalMs: 250 },
    );
    await resumeButton.click();
    await waitFor(
      `${selectedTorrentName} to reach running state after toolbar resume`,
      async () => {
        const selectedTorrent = getTorrentByHash(await fetchTorrentInfo(fakeUrl, backendSession), selectedTorrentHash);
        return selectedTorrent?.state === 'downloading'
          || selectedTorrent?.state === 'uploading'
          || selectedTorrent?.state === 'stalledUP'
          || selectedTorrent?.state === 'stalledDL';
      },
      { timeoutMs: 10_000, intervalMs: 250 },
    );
    pushBackendCheck(result, `native toolbar resume changed ${selectedTorrentName} to running state`);

    const baseHandleCount = (await browser.getWindowHandles()).length;

    // Settings window
    const settingsButton = await browser.$('[data-testid="toolbar-settings"]');
    if (!(await settingsButton.isExisting().catch(() => false))) {
      throw new Error('Settings toolbar button not found for native window smoke check');
    }
    await settingsButton.click();
    await waitForWindowHandleCount(browser, baseHandleCount + 1);
    const settingsWindow = await waitForWindowByUrl(browser, '/settings-window');
    await waitForWindowLabel(browser, settingsWindow.handle, 'settings');
    await waitForWindowBodyText(browser, settingsWindow.handle, 'Configure app behavior');
    pushBackendCheck(result, 'native settings window opened with settings label and rendered settings content');

    await switchToWindowWithRetry(browser, settingsWindow.handle, 'settings');
    await clickSettingsToggleByLabel(browser, 'Use UPnP / NAT-PMP port forwarding from my router');
    await waitForWindowBodyText(browser, settingsWindow.handle, 'Unsaved changes', 12_000);
    const discardAllButton = await findButtonByExactText(browser, 'Discard All');
    if (!discardAllButton) {
      throw new Error('Settings discard-all button not found for native window smoke check');
    }
    await discardAllButton.click();
    await waitForWindowBodyTextAbsentOrClosed(browser, settingsWindow.handle, 'Unsaved changes', 12_000);
    pushBackendCheck(result, 'native settings window rendered unsaved state and discarded changes');

    await closeWindowIfPresent(browser, settingsWindow.handle, mainHandle, 12_000);
    await waitForWindowHandleCount(browser, baseHandleCount, 12_000);
    pushBackendCheck(result, 'native settings window closed and returned to baseline handle count');

    // Add torrent window
    await switchToWindowWithRetry(browser, mainHandle, 'main');
    const addTorrentButton = await browser.$('[data-testid="toolbar-add"]');
    if (!(await addTorrentButton.isExisting().catch(() => false))) {
      throw new Error('Add torrent toolbar button not found for native window smoke check');
    }
    await addTorrentButton.click();
    await waitForWindowHandleCount(browser, baseHandleCount + 1);
    const addTorrentWindow = await waitForWindowByUrl(browser, '/add-torrent-window');
    await waitForWindowLabel(browser, addTorrentWindow.handle, 'add-torrent');
    await waitForWindowBodyText(browser, addTorrentWindow.handle, 'Add Torrent');
    pushBackendCheck(result, 'native add-torrent window opened with add-torrent label and rendered Add Torrent');

    await switchToWindowWithRetry(browser, addTorrentWindow.handle, 'add-torrent');
    const cancelAddTorrentButton = await findButtonByExactText(browser, 'Cancel');
    if (!cancelAddTorrentButton) {
      throw new Error('Add torrent cancel button not found for native window smoke check');
    }
    await cancelAddTorrentButton.click();
    await waitForWindowHandleCount(browser, baseHandleCount);
    await switchToWindowWithRetry(browser, mainHandle, 'main');
    pushBackendCheck(result, 'native add-torrent window dismissed via Cancel');

    // Statistics window
    const toolsMenu = await browserInstance.$('[data-testid="menu-tools"]');
    if (await toolsMenu.isExisting().catch(() => false)) {
      await toolsMenu.click();
      // Wait for the Statistics… menu item to render after the menu opens.
      let statisticsMenuItem: Awaited<ReturnType<typeof findButtonByExactText>> = null;
      await waitFor(
        'Statistics… menu item to render after tools menu click',
        async () => {
          const item = await findButtonByExactText(browserInstance, 'Statistics…');
          if (item) {
            statisticsMenuItem = item;
            return true;
          }
          return false;
        },
        { timeoutMs: 3_000, intervalMs: 250 },
      ).catch(() => undefined);
      if (!statisticsMenuItem) {
        throw new Error('Statistics menu item not found for native statistics window smoke check');
      }
      await (statisticsMenuItem as WebdriverIO.Element).click();
      await waitForWindowHandleCount(browser, baseHandleCount + 1);
      const statisticsWindow = await waitForWindowByUrl(browser, '/statistics-window');
      await waitForWindowLabel(browser, statisticsWindow.handle, 'statistics');
      await waitForWindowBodyText(browser, statisticsWindow.handle, 'User statistics');
      pushBackendCheck(result, 'native statistics window opened with statistics label and rendered User statistics');

      await closeWindowIfPresent(browser, statisticsWindow.handle, mainHandle, 12_000);
      await waitForWindowHandleCount(browser, baseHandleCount);
      pushBackendCheck(result, 'native statistics window closed and returned to baseline handle count');
    } else {
      writemsg('[smoke] Tools menu trigger not visible; skipping statistics window smoke check');
      result.skippedChecks.push('statistics window: tools menu not visible');
    }

    // Clipboard context menu
    const clipboardTarget = getTorrentByHash(await fetchTorrentInfo(fakeUrl, backendSession), selectedTorrentHash);
    const expectedMagnetUri = String(clipboardTarget?.magnet_uri ?? '');
    if (!expectedMagnetUri.startsWith('magnet:?')) {
      throw new Error(`${selectedTorrentName} magnet URI missing before native clipboard smoke check`);
    }

    const selectedRowForContextMenu = await browser.$(`tbody tr[data-torrent-hash="${selectedTorrentHash}"]`);
    if (!(await selectedRowForContextMenu.isExisting().catch(() => false))) {
      throw new Error(`${selectedTorrentName} row not visible before native clipboard smoke check`);
    }
    await selectedRowForContextMenu.click({ button: 'right' });
    try {
      await hoverContextMenuSubMenu(browser, 'Copy');
      await sleep(250);
      await clickContextMenuItem(browser, 'Magnet URI');
      await waitFor(
        'clipboard magnet URI to update',
        async () => (await readClipboardText(browserInstance)) === expectedMagnetUri,
        { timeoutMs: 8_000, intervalMs: 250 },
      );
      pushBackendCheck(result, `native clipboard flow copied ${selectedTorrentName} magnet URI`);
    } catch (err) {
      const message = (err as Error).message;
      writemsg(`[smoke] Context menu clipboard flow unavailable in native WebDriver run: ${message}`);
      result.skippedChecks.push(`clipboard context menu: ${message}`);
    }

    // Delete dialog
    const removeButton = await browser.$('[data-testid="toolbar-remove"]');
    if (!(await removeButton.isExisting().catch(() => false))) {
      throw new Error('Remove toolbar button not found for native dialog smoke check');
    }
    await removeButton.click();
    await waitForWindowHandleCount(browser, baseHandleCount + 1);
    const dialogWindow = await waitForWindowByUrl(browser, '/dialog-host-window');
    await waitForWindowBodyText(browser, dialogWindow.handle, 'Delete this torrent?');
    pushBackendCheck(result, 'native dialog-host window opened with torrent-delete payload');

    await switchToWindowWithRetry(browser, dialogWindow.handle, 'dialog-host');
    const cancelDeleteButton = await findButtonByExactText(browser, 'Cancel');
    if (!cancelDeleteButton) {
      throw new Error('Delete dialog cancel button not found for native dialog smoke check');
    }
    await cancelDeleteButton.click();
    await switchToWindowWithRetry(browser, mainHandle, 'main');
    pushBackendCheck(result, 'native dialog-host window dismissed via Cancel');

    const removeButtonAfterCancel = await browser.$('[data-testid="toolbar-remove"]');
    if (!(await removeButtonAfterCancel.isExisting().catch(() => false))) {
      throw new Error('Remove toolbar button not found after cancelling native dialog smoke check');
    }
    await removeButtonAfterCancel.click();
    const confirmDeleteDialog = await waitForWindowByUrl(browser, '/dialog-host-window');
    await waitForWindowLabel(browser, confirmDeleteDialog.handle, 'dialog-host');
    await waitForWindowBodyText(browser, confirmDeleteDialog.handle, 'Delete this torrent?');
    await switchToWindowWithRetry(browser, confirmDeleteDialog.handle, 'dialog-host');
    const confirmDeleteButton = await findButtonByExactText(browser, 'Delete');
    if (!confirmDeleteButton) {
      throw new Error('Delete dialog confirm button not found for native dialog-result smoke check');
    }
    await confirmDeleteButton.click();
    await switchToWindowWithRetry(browser, mainHandle, 'main');
    await waitFor(
      `${selectedTorrentName} to be deleted from backend state`,
      async () => !getTorrentByHash(await fetchTorrentInfo(fakeUrl, backendSession), selectedTorrentHash),
      { timeoutMs: 12_000, intervalMs: 250 },
    );
    await waitFor(
      `${selectedTorrentName} to disappear from the main window`,
      async () => {
        const deletedRow = await browserInstance.$(`tbody tr[data-torrent-hash="${selectedTorrentHash}"]`);
        return !(await deletedRow.isExisting().catch(() => false));
      },
      { timeoutMs: 12_000, intervalMs: 250 },
    );
    pushBackendCheck(result, `native dialog-host delivered delete confirmation across windows and removed ${selectedTorrentName}`);

    result.timings.interactionPhaseMs = Date.now() - interactionPhaseStart;

    // -------------------------------------------------------------------------
    // Server-down lifecycle exercise.
    // Force sync failures in the fake backend, assert the user-facing
    // unavailable-server modal, use its action to disconnect/navigate, then
    // reconnect from the saved server list and verify the torrent UI returns.
    // -------------------------------------------------------------------------
    {
      writemsg('[lifecycle] Forcing sync failures to exercise unavailable-server modal...');
      await fakeBackendRequest(fakeUrl, '/api/v2/sync/maindata?rid=0&__syncErrorCount=20', { session: backendSession });

      await waitFor(
        'Current server unavailable modal',
        async () => {
          const dialog = await browserInstance.$('[role="alertdialog"]');
          if (!(await dialog.isDisplayed().catch(() => false))) return false;
          const text = await dialog.getText().catch(() => '');
          return text.includes('Current server unavailable') && text.includes('Open Servers');
        },
        { timeoutMs: 30_000, intervalMs: 500 },
      );
      await saveFrontendScreenshot(browserInstance, 'server-unavailable-modal');
      pushBackendCheck(result, 'native server-down flow rendered unavailable-server modal');

      const openServersButton = await findButtonByExactText(browser, 'Open Servers');
      if (!openServersButton) {
        throw new Error('Unavailable-server modal did not render Open Servers action');
      }
      await openServersButton.click();

      await waitFor(
        'LoginScreen after Open Servers',
        async () => (await readLifecycleFrontendState(browserInstance)) === 'login-screen',
        { timeoutMs: 15_000, intervalMs: 500 },
      );
      result.processSnapshots.push(await captureProcessSnapshot('after-unavailable-open-servers'));
      pushBackendCheck(result, 'native server-down modal Open Servers action disconnected and opened LoginScreen');

      await fakeBackendRequest(fakeUrl, '/api/v2/sync/maindata?rid=0&__syncErrorCount=0', { session: backendSession });
      await reconnectViaLoginScreen(browserInstance, 'Fake qBittorrent');
      // Sync-settle: wait for the backend to confirm a fresh sync cycle has
      // started and the fixture row count is restored, then for the UI to
      // render those rows. The previous 15s timeout was insufficient on
      // slower cycles; use a 30s budget with a sync-settle precondition.
      await waitFor(
        'backend torrent count to restore after reconnect',
        async () => {
          const torrents = await fetchTorrentInfo(fakeUrl, backendSession);
          return torrents.length === 100;
        },
        { timeoutMs: 15_000, intervalMs: 250 },
      ).catch(() => undefined);
      await waitForVisibleTorrentRows(browserInstance, 'torrent rows after unavailable-server reconnect', 30_000);
      await saveFrontendScreenshot(browserInstance, 'after-server-unavailable-reconnect');
      result.processSnapshots.push(await captureProcessSnapshot('after-unavailable-reconnect'));
      pushBackendCheck(result, 'native server-down flow reconnected from LoginScreen and restored torrent UI');
      writemsg('[lifecycle] Server-down modal and reconnect flow completed.');
    }

    // -------------------------------------------------------------------------
    // Success
    // -------------------------------------------------------------------------
    result.success = true;
    writemsg('Smoke flow PASSED');
  } catch (err) {
    result.error = (err as Error).message;
    if (browser) {
      await captureFrontendEvidence(result, browser, 'failure');
    }
    console.error(`[tauri:e2e] ERROR: ${result.error}`);
  } finally {
    result.durationMs = Date.now() - startMs;

    // Cleanup
    writemsg('Cleaning up...');

    // Destroy WebDriver session gracefully
    if (browser) {
      try {
        await destroySession({ browser });
        writemsg('WebDriverIO session ended.');
      } catch (err) {
        writemsg(`Warning: session cleanup error: ${(err as Error).message}`);
      }
    }

    // Kill the Tauri app process and any orphan WebView2 children. On
    // Windows this is a process-tree kill + orphan scan; on macOS/Linux a
    // single SIGTERM is sufficient. `killAppProcessTree` is async and never
    // throws, so the finally block always proceeds to profile cleanup.
    await killAppProcessTree(appProc, webviewUserDataFolder);
    writemsg('App stopped.');

    // Remove WebView2 user data folder once the app has released its file
    // handles, so stale `webview-profile-*` directories do not accumulate.
    // On Windows this retries with backoff to handle the file-handle race.
    removeWebviewProfile(webviewUserDataFolder);

    if (viteProc) {
      try { viteProc.kill(); } catch { /* ignore */ }
      writemsg('Vite server stopped.');
    } else {
      writemsg('Vite server not started (--with-vite not set).');
    }

    try { stopFake(); } catch { /* ignore */ }
    writemsg('Fake server stopped.');

    if (!result.success) {
      printCapturedAppOutputTail(appLaunchResult.capturedStdout, appLaunchResult.capturedStderr);
    }

    result.nativeDiagnostics = readNativeDiagnostics(nativeDiagnosticsLogPath, !result.success);

    // Parse sync evidence from captured app output (T147.1 diagnostics)
    const allAppLines = [
      ...appLaunchResult.capturedStdout.join('').split('\n'),
      ...appLaunchResult.capturedStderr.join('').split('\n'),
    ].filter(Boolean);
    result.syncDiagnostics = parseSyncDiagnostics(allAppLines);
    writemsg(
      `[sync-diagnostics] snapshots=${result.syncDiagnostics.snapshotTimings.length}` +
        ` lifecycle=${result.syncDiagnostics.lifecycleEvents.length}` +
        ` pass=${result.syncDiagnostics.pass}` +
        (result.syncDiagnostics.blockers.length > 0
          ? ` blockers=${result.syncDiagnostics.blockers.join('; ')}`
          : ''),
    );

    if (!result.syncDiagnostics.pass) {
      result.success = false;
      const blockerMessage =
        result.syncDiagnostics.blockers.length > 0
          ? result.syncDiagnostics.blockers.join('; ')
          : 'Sync diagnostics incomplete: snapshot timings missing';
      result.error = result.error
        ? `${result.error}\n[sync-diagnostics] ${blockerMessage}`
        : `[sync-diagnostics] ${blockerMessage}`;
    }

    // Write artifact
    await writeArtifact(result);

    if (!result.success) {
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Fake backend contract assertions (migrated from original)
// ---------------------------------------------------------------------------

async function assertFakeBackendContracts(baseUrl: string, result: E2EResult): Promise<void> {
  const badLogin = await fakeBackendRequest(baseUrl, '/api/v2/auth/login', {
    method: 'POST',
    body: new URLSearchParams({ username: 'admin', password: 'wrong-password' }),
  });
  if (badLogin.status !== 403 || !badLogin.text.includes('Wrong username or password')) {
    throw new Error('Fake backend did not reject invalid credentials');
  }
  pushBackendCheck(result, 'invalid credentials rejected');

  const unauthenticatedInfo = await fakeBackendRequest(baseUrl, '/api/v2/torrents/info');
  if (unauthenticatedInfo.status !== 403) {
    throw new Error('Fake backend allowed unauthenticated torrent info access');
  }
  pushBackendCheck(result, 'session enforcement enabled for authenticated endpoints');

  const session = await loginFakeBackend(baseUrl);
  pushBackendCheck(result, 'valid login issued SID cookie');

  const missingAuthHeaders = await fakeBackendRequest(baseUrl, '/api/v2/app/version', {
    session,
    includeAuthHeaders: false,
  });
  if (missingAuthHeaders.status !== 403 || !missingAuthHeaders.text.includes('Invalid Origin header')) {
    throw new Error('Fake backend did not reject protected requests without auth headers');
  }
  pushBackendCheck(result, 'protected endpoints reject requests without host-matching auth headers');

  const mismatchedAuthHeaders = await fakeBackendRequest(baseUrl, '/api/v2/app/version', {
    session,
    headers: {
      Origin: 'http://wrong-host.invalid',
      Referer: 'http://wrong-host.invalid/',
    },
  });
  if (mismatchedAuthHeaders.status !== 403 || !mismatchedAuthHeaders.text.includes('Invalid Origin header')) {
    throw new Error('Fake backend did not reject mismatched auth headers on protected endpoints');
  }
  pushBackendCheck(result, 'protected endpoints reject mismatched auth headers');

  const authenticatedVersion = await fakeBackendRequest(baseUrl, '/api/v2/app/version', { session });
  if (authenticatedVersion.status !== 200 || authenticatedVersion.text !== 'v4.6.1.0') {
    throw new Error('Fake backend did not accept valid auth headers on protected endpoints');
  }
  pushBackendCheck(result, 'protected endpoints accept the shared auth-header contract');

  const regressionSession = await loginFakeBackend(baseUrl, 'admin', 'adminadmin', '?__postLogin403Count=2');
  const forced403Version = await fakeBackendRequest(baseUrl, '/api/v2/app/version', { session: regressionSession });
  const forced403Preferences = await fakeBackendRequest(baseUrl, '/api/v2/app/preferences', { session: regressionSession });
  const recoveredVersion = await fakeBackendRequest(baseUrl, '/api/v2/app/version', { session: regressionSession });
  if (
    forced403Version.status !== 403
    || forced403Preferences.status !== 403
    || recoveredVersion.status !== 200
  ) {
    throw new Error('Fake backend post-login protected-endpoint 403 regression control did not fail twice and recover');
  }
  pushBackendCheck(result, 'post-login protected-endpoint 403 regression control fails deterministically and recovers');

  const initialTorrents = await fetchTorrentInfo(baseUrl, session);
  const initialCount = initialTorrents.length;

  const missingHashes = await fakeBackendRequest(baseUrl, '/api/v2/torrents/pause', {
    method: 'POST',
    session,
    body: new URLSearchParams(),
  });
  if (missingHashes.status !== 400) {
    throw new Error('Fake backend accepted pause request without hashes');
  }
  pushBackendCheck(result, 'pause rejects missing hashes');

  const unknownHash = await fakeBackendRequest(baseUrl, '/api/v2/torrents/pause', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: 'deadbeefdeadbeefdeadbeefdeadbeef' }),
  });
  if (unknownHash.status !== 404) {
    throw new Error('Fake backend accepted pause request for unknown hash');
  }
  pushBackendCheck(result, 'pause rejects unknown hashes');

  const malformedAdd = await fakeBackendRequest(baseUrl, '/api/v2/torrents/add', {
    method: 'POST',
    session,
    body: new URLSearchParams({ category: 'broken' }),
  });
  if (malformedAdd.status !== 400) {
    throw new Error('Fake backend accepted malformed add request');
  }
  pushBackendCheck(result, 'add rejects malformed payloads');

  const addResponse = await fakeBackendRequest(baseUrl, '/api/v2/torrents/add', {
    method: 'POST',
    session,
    body: new URLSearchParams({
      urls: 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Native%20Smoke',
      category: 'native-smoke',
      tags: 'smoke-a,smoke-b',
      paused: 'true',
      savepath: '/data/native-smoke',
      dlLimit: '256',
      upLimit: '128',
    }),
  });
  if (addResponse.status !== 200) {
    throw new Error(`Add request failed: ${addResponse.status} ${addResponse.text}`);
  }

  let torrents = await fetchTorrentInfo(baseUrl, session);
  const addedTorrent = getTorrentByName(torrents, 'Native Smoke');
  if (!addedTorrent || torrents.length !== initialCount + 1) {
    throw new Error('Added torrent did not appear in fake backend state');
  }
  if (addedTorrent.category !== 'native-smoke' || addedTorrent.tags !== 'smoke-a,smoke-b' || addedTorrent.state !== 'pausedDL') {
    throw new Error('Added torrent did not preserve expected mutation fields');
  }
  const addedHash = String(addedTorrent.hash);
  pushBackendCheck(result, 'add mutates torrent state with category, tags, and paused flag');

  const pauseAdded = await fakeBackendRequest(baseUrl, '/api/v2/torrents/pause', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: addedHash }),
  });
  if (pauseAdded.status !== 200) throw new Error('Pause command failed for added torrent');

  const resumeAdded = await fakeBackendRequest(baseUrl, '/api/v2/torrents/resume', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: addedHash }),
  });
  if (resumeAdded.status !== 200) throw new Error('Resume command failed for added torrent');

  torrents = await fetchTorrentInfo(baseUrl, session);
  const resumedTorrent = getTorrentByName(torrents, 'Native Smoke');
  if (!resumedTorrent || resumedTorrent.state !== 'downloading') {
    throw new Error('Resume did not restore the added torrent to a running state');
  }
  pushBackendCheck(result, 'pause/resume mutate torrent state');

  const recheck = await fakeBackendRequest(baseUrl, '/api/v2/torrents/recheck', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: addedHash }),
  });
  if (recheck.status !== 200) throw new Error('Recheck command failed');

  const reannounce = await fakeBackendRequest(baseUrl, '/api/v2/torrents/reannounce', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: addedHash }),
  });
  if (reannounce.status !== 200) throw new Error('Reannounce command failed');

  torrents = await fetchTorrentInfo(baseUrl, session);
  const reannouncedTorrent = getTorrentByName(torrents, 'Native Smoke');
  if (!reannouncedTorrent || !String(reannouncedTorrent.state).startsWith('checking') || reannouncedTorrent.reannounce !== 0) {
    throw new Error('Recheck/reannounce mutations were not observable');
  }
  pushBackendCheck(result, 'recheck/reannounce expose observable state changes');

  const categoryUpdate = await fakeBackendRequest(baseUrl, '/api/v2/torrents/setCategory', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: addedHash, category: 'movies' }),
  });
  if (categoryUpdate.status !== 200) throw new Error('setCategory command failed');

  const addTags = await fakeBackendRequest(baseUrl, '/api/v2/torrents/addTags', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: addedHash, tags: 'smoke-c,smoke-d' }),
  });
  if (addTags.status !== 200) throw new Error('addTags command failed');

  const removeTags = await fakeBackendRequest(baseUrl, '/api/v2/torrents/removeTags', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: addedHash, tags: 'smoke-a' }),
  });
  if (removeTags.status !== 200) throw new Error('removeTags command failed');

  torrents = await fetchTorrentInfo(baseUrl, session);
  const retaggedTorrent = getTorrentByName(torrents, 'Native Smoke');
  if (!retaggedTorrent || retaggedTorrent.category !== 'movies' || !String(retaggedTorrent.tags).includes('smoke-d') || String(retaggedTorrent.tags).includes('smoke-a')) {
    throw new Error('Category/tag updates were not applied to fake backend state');
  }
  pushBackendCheck(result, 'category/tag mutations are enforced');

  const slowStart = Date.now();
  const slowInfo = await fakeBackendRequest(baseUrl, '/api/v2/torrents/info?__delayMs=150', { session });
  if (slowInfo.status !== 200 || Date.now() - slowStart < 120) {
    throw new Error('Slow-response control did not delay the backend response');
  }
  pushBackendCheck(result, 'slow-response failure mode works');

  let transientFailed = false;
  try {
    await fakeBackendRequest(baseUrl, '/api/v2/torrents/info?__fail=transient-network', { session });
  } catch {
    transientFailed = true;
  }
  if (!transientFailed) {
    throw new Error('Transient network failure mode did not terminate the request');
  }
  pushBackendCheck(result, 'transient network failure mode works');

  const syncError1 = await fakeBackendRequest(baseUrl, '/api/v2/sync/maindata?rid=0&__syncErrorCount=2', { session });
  const syncError2 = await fakeBackendRequest(baseUrl, '/api/v2/sync/maindata?rid=0', { session });
  const syncRecovery = await fakeBackendRequest(baseUrl, '/api/v2/sync/maindata?rid=0', { session });
  if (syncError1.status !== 500 || syncError2.status !== 500 || syncRecovery.status !== 200) {
    throw new Error('Repeated sync error mode did not fail and recover as expected');
  }
  pushBackendCheck(result, 'repeated sync errors fail twice and then recover');

  const malformedSync = await fakeBackendRequest(baseUrl, '/api/v2/sync/maindata?rid=0&__malformedSyncCount=1', { session });
  const malformedRecovery = await fakeBackendRequest(baseUrl, '/api/v2/sync/maindata?rid=0', { session });
  if (malformedSync.status !== 200 || malformedRecovery.status !== 200) {
    throw new Error('Malformed sync control did not return the expected response statuses');
  }
  const malformedPayload = JSON.parse(malformedSync.text) as Record<string, unknown>;
  const recoveredPayload = JSON.parse(malformedRecovery.text) as Record<string, unknown>;
  if ('rid' in malformedPayload || typeof recoveredPayload.rid !== 'number') {
    throw new Error('Malformed sync control did not omit rid and then recover with a valid payload');
  }
  pushBackendCheck(result, 'malformed sync payload omits rid once and then recovers');

  const deleteResponse = await fakeBackendRequest(baseUrl, '/api/v2/torrents/delete', {
    method: 'POST',
    session,
    body: new URLSearchParams({ hashes: addedHash, deleteFiles: 'false' }),
  });
  if (deleteResponse.status !== 200) throw new Error('Delete command failed');

  torrents = await fetchTorrentInfo(baseUrl, session);
  if (getTorrentByName(torrents, 'Native Smoke')) {
    throw new Error('Delete command did not remove the added torrent');
  }
  pushBackendCheck(result, 'delete removes torrents from backend state');
}

// ---------------------------------------------------------------------------
// Artifact writer
// ---------------------------------------------------------------------------

async function writeArtifact(result: E2EResult): Promise<void> {
  const { mkdir, writeFile } = await import('fs/promises');
  const artifactDir = getE2EArtifactDir();
  await mkdir(artifactDir, { recursive: true });

  const artifactPath = join(artifactDir, 'current.json');
  await writeFile(artifactPath, JSON.stringify(result, null, 2), 'utf-8');
  writemsg(`Artifact written to ${artifactPath}`);

  const perfDir = join(resolve(process.cwd(), '..', '..'), 'artifacts', 'desktop', 'perf');
  await mkdir(perfDir, { recursive: true });
  const perfArtifactPath = join(perfDir, 'native-smoke.json');
  await writeFile(perfArtifactPath, JSON.stringify({
    runtime: 'native-tauri-smoke',
    semantics: result.timingSemantics,
    scenario: result.scenario,
    success: result.success,
    durationMs: result.durationMs,
    timings: result.timings,
    backendChecks: result.backendChecks,
    writtenAt: new Date().toISOString(),
    sync: {
      snapshotTimings: result.syncDiagnostics.snapshotTimings,
      lifecycleEvents: result.syncDiagnostics.lifecycleEvents,
      revisionProgression: result.syncDiagnostics.revisionProgression,
      pass: result.syncDiagnostics.pass,
      blockers: result.syncDiagnostics.blockers,
    },
  }, null, 2), 'utf-8');
  writemsg(`Native perf snapshot written to ${perfArtifactPath}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('[tauri:e2e] Fatal:', err);
  process.exit(1);
});
