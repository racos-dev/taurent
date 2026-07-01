// WebDriver session management for Tauri E2E tests.

import type { Browser } from 'webdriverio';
import { isVerboseE2ELog, sleep, writemsg } from './infrastructure.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  browser: Browser;
}

function readRecordProp(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function readStringProp(value: unknown, key: string): string | undefined {
  const prop = readRecordProp(value, key);
  return typeof prop === 'string' && prop.trim().length > 0 ? prop : undefined;
}

function describeSessionError(error: unknown): string {
  const parts = [
    readStringProp(error, 'name'),
    readStringProp(error, 'message'),
    readStringProp(error, 'code'),
    readStringProp(readRecordProp(error, 'cause'), 'message'),
    readStringProp(readRecordProp(error, 'body'), 'message'),
    readStringProp(readRecordProp(readRecordProp(error, 'body'), 'value'), 'message'),
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return [...new Set(parts)].join(': ');
  }

  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRecoverableSessionError(error: unknown): boolean {
  const message = describeSessionError(error).toLowerCase();
  return [
    'connection refused',
    'connection reset',
    'econnrefused',
    'econnreset',
    'etimedout',
    'fetch failed',
    'no such window',
    'socket hang up',
    'terminated',
    'timeout',
    'unable to connect',
    'browser driver is running',
    'service failed to start',
    'rejecting any connections',
  ].some((needle) => message.includes(needle));
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

/**
 * Create a WebDriverIO session connected to the Tauri app.
 */
export async function createSession(
  driverUrl: string,
  appPath: string,
  userDataFolder: string,
  debugPort: number,
): Promise<Session> {
  // Parse driver URL to extract host and port
  // Expected format: "http://127.0.0.1:4445"
  const url = new URL(driverUrl);
  const port = parseInt(url.port, 10) || 4445;
  const hostname = url.hostname || '127.0.0.1';

  const { remote } = await import('webdriverio');
  const options = {
    logLevel: isVerboseE2ELog() ? 'info' : 'silent',
    protocol: 'http',
    hostname,
    port,
    path: '/',
    connectionRetryTimeout: 15_000,
    connectionRetryCount: 1,
    capabilities: {
      browserName: 'wry',
      // Required for Linux WebKitGTK compatibility: forces the WebDriver
      // server to use the classic W3C WebDriver protocol instead of the
      // bidirectional WebDriver BiDi extension. WebKitGTK on Linux does not
      // implement BiDi, so opting out keeps the session compatible.
      'wdio:enforceWebDriverClassic': true,
      'tauri:options': {
        application: appPath,
        webviewOptions: {
          userDataFolder,
          additionalBrowserArguments: [`--remote-debugging-port=${debugPort}`],
        },
      },
    },
  } as unknown as Parameters<typeof remote>[0];

  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const browser = await remote(options) as unknown as Browser;
      return { browser };
    } catch (error) {
      lastError = error;
      const description = describeSessionError(error);
      if (attempt === maxAttempts || !isRecoverableSessionError(error)) {
        throw new Error(`WebDriver session creation failed: ${description}`, { cause: error });
      }
      const retryDelayMs = attempt * 1_000;
      writemsg(
        `WebDriver session creation attempt ${attempt}/${maxAttempts} failed: ${description}; ` +
          `retrying in ${retryDelayMs}ms`,
      );
      await sleep(retryDelayMs);
    }
  }

  throw new Error(`WebDriver session creation failed: ${describeSessionError(lastError)}`);
}

/**
 * Gracefully destroy a WebDriver session.
 * Switches to no window first to avoid hanging on a closed window.
 */
export async function destroySession(session: Session): Promise<void> {
  const { browser } = session;
  try {
    // Try to switch away from any window before closing
    const handles = await browser.getWindowHandles().catch(() => []);
    if (handles.length > 0) {
      try {
        await browser.switchToWindow(handles[0]);
        await browser.close();
      } catch {
        // ignore close errors
      }
    }
  } catch {
    // ignore session-level errors during cleanup
  } finally {
    try {
      await browser.deleteSession();
    } catch {
      // ignore delete errors
    }
  }
}
