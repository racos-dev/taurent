// Shared test helpers for Tauri E2E tests.

import type { Browser } from 'webdriverio';

// ---------------------------------------------------------------------------
// Text scanning helpers (WebDriverIO-compatible)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sync lifecycle helpers for T147.2 remediation — disconnect/reconnect
// ---------------------------------------------------------------------------

/**
 * Disconnect from the current server via the Tauri IPC bridge.
 *
 * Uses `browser.execute()` to call `session_disconnect` on the Rust side,
 * which emits `session-changed(disconnected)` and triggers the sync lifecycle
 * teardown (stop-signal + stopped events). Falls back gracefully if the Tauri
 * IPC is not available in the current WebDriver context.
 *
 * This is safe to call when the app is already connected. After disconnect,
 * the React session controller will set `isConnected=false`, `serverId=null`,
 * and `AuthBoundary` will redirect to `/login`.
 */
export async function disconnectViaBridge(browserInstance: Browser): Promise<{ success: boolean; generation?: number; error?: string }> {
  const { writemsg } = await import('./infrastructure.js');
  type DisconnectResult = { success: boolean; generation?: number; error?: string };

  try {
    const raw: DisconnectResult = await browserInstance.executeAsync(async (done: (result: DisconnectResult) => void) => {
      try {
        const w = globalThis as Record<string, unknown>;
        const internals = w.__TAURI_INTERNALS__ as Record<string, unknown> | undefined;
        if (!internals || typeof internals.invoke !== 'function') {
          done({ success: false, error: 'IPC_NOT_AVAILABLE' });
          return;
        }
        const generation = await (internals.invoke as (...args: unknown[]) => Promise<number>)('session_disconnect');
        done({ success: true, generation });
      } catch (err) {
        done({ success: false, error: `IPC_ERROR:${String(err)}` });
      }
    });
    const result = raw;

    if (!result.success) {
      writemsg(`[disconnect] ${result.error ?? 'unknown error'}`);
      return result;
    }
    writemsg(`[disconnect] session_disconnect succeeded, generation=${result.generation}`);
    return result;
  } catch (err) {
    const msg = `browser.execute failed: ${(err as Error).message}`;
    writemsg(`[disconnect] ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Reconnect to a server by clicking its entry on the LoginScreen.
 *
 * After disconnect, the app redirects to `/login` which shows saved servers.
 * Finds the server by its name text and clicks the parent server-entry element
 * (which has an `onClick` handler that calls `controller.handleSelectServer`).
 *
 * Returns the number of attempts made, or throws if the server is not found
 * within the timeout.
 */
export async function reconnectViaLoginScreen(
  browserInstance: Browser,
  serverName: string,
  timeoutMs = 15_000,
): Promise<void> {
  const { writemsg, sleep } = await import('./infrastructure.js');

  writemsg(`[reconnect] Looking for server "${serverName}" on LoginScreen...`);
  const start = Date.now();
  let attempts = 0;

  while (Date.now() - start < timeoutMs) {
    attempts++;
    try {
      const serverCards = await browserInstance.$$('[data-testid="login-server-card"]');
      for (const card of serverCards) {
        const name = await card.getAttribute('data-server-name').catch(() => '');
        if (name === serverName) {
          await card.click();
          const elapsed = Date.now() - start;
          writemsg(`[reconnect] Clicked server "${serverName}" after ${elapsed}ms (${attempts} attempt(s))`);
          return;
        }
      }
    } catch {
      // DOM query failed — retry
    }
    await sleep(500);
  }

  const bodyText = await browserInstance.$('body').getText().catch(() => '');
  throw new Error(
    `[reconnect] Server "${serverName}" not found on LoginScreen within ${timeoutMs}ms (${attempts} attempts). ` +
    `Body text excerpt: "${bodyText.slice(0, 300)}"`,
  );
}

export async function findInputByPlaceholder(
  browserInstance: Browser,
  placeholder: string,
): Promise<WebdriverIO.Element | null> {
  try {
    const input = await browserInstance.$(`input[placeholder="${placeholder}"]`);
    if (await input.isExisting().catch(() => false)) return input as unknown as WebdriverIO.Element;
  } catch {
    // ignore
  }
  return null;
}

export async function findButtonByText(
  browserInstance: Browser,
  text: string,
): Promise<WebdriverIO.Element | null> {
  try {
    const elements = await browserInstance.$$('button');
    for (const el of elements) {
      const elText = await el.getText();
      if (elText.includes(text)) return el;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function findButtonByExactText(
  browserInstance: Browser,
  text: string,
): Promise<WebdriverIO.Element | null> {
  try {
    const elements = await browserInstance.$$('button');
    for (const el of elements) {
      const elText = (await el.getText()).trim();
      if (elText === text) return el;
    }
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// Window handle helpers
// ---------------------------------------------------------------------------

function readErrorParts(error: unknown): string[] {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.name, error.message);
    if (error.stack) parts.push(error.stack);
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    for (const key of ['name', 'code', 'error', 'message', 'status', 'statusCode']) {
      const value = record[key];
      if (typeof value === 'string' || typeof value === 'number') {
        parts.push(String(value));
      }
    }

    for (const key of ['body', 'response', 'value']) {
      const value = record[key];
      if (typeof value === 'string') {
        parts.push(value);
      } else if (value && typeof value === 'object') {
        const nested = value as Record<string, unknown>;
        for (const nestedKey of ['error', 'message', 'name']) {
          const nestedValue = nested[nestedKey];
          if (typeof nestedValue === 'string') parts.push(nestedValue);
        }
      }
    }
  }

  parts.push(String(error));
  return parts.filter(Boolean);
}

export function isNoSuchWindowError(error: unknown): boolean {
  const message = readErrorParts(error).join('\n').toLowerCase();
  return message.includes('no such window')
    || message.includes('no window could be found')
    || message.includes('window not found');
}

interface WindowHandleSnapshot {
  handle: string;
  url?: string;
  title?: string;
  bodyText?: string;
}

async function windowHandleExists(browserInstance: Browser, handle: string): Promise<boolean> {
  const handles = await browserInstance.getWindowHandles().catch((): string[] => []);
  return handles.includes(handle);
}

async function trySwitchToWindow(
  browserInstance: Browser,
  handle: string,
): Promise<boolean> {
  try {
    await browserInstance.switchToWindow(handle);
    return true;
  } catch (err) {
    if (isNoSuchWindowError(err)) return false;
    throw err;
  }
}

async function getUsableWindowHandles(browserInstance: Browser): Promise<string[]> {
  const originalHandle = await browserInstance.getWindowHandle().catch(() => undefined);
  const handles = await browserInstance.getWindowHandles().catch((): string[] => []);
  const usableHandles: string[] = [];

  for (const handle of handles) {
    if (await trySwitchToWindow(browserInstance, handle)) {
      usableHandles.push(handle);
    }
  }

  if (originalHandle && usableHandles.includes(originalHandle)) {
    await browserInstance.switchToWindow(originalHandle).catch(() => undefined);
  }

  return usableHandles;
}

export async function switchToWindowIfAvailable(
  browserInstance: Browser,
  handle: string,
): Promise<boolean> {
  if (!(await windowHandleExists(browserInstance, handle))) {
    return false;
  }

  return trySwitchToWindow(browserInstance, handle);
}

/**
 * Switch to a window with retry logic to handle Tauri WebDriver races after
 * close events. After a window disappears, WebDriver can briefly report stale
 * handles or have no current browsing context.
 */
export async function switchToWindowWithRetry(
  browserInstance: Browser,
  handle: string,
  label: string,
  timeoutMs = 5_000,
): Promise<void> {
  const { waitFor } = await import('./wait.js');
  await waitFor(
    `switch to window "${label}"`,
    async () => switchToWindowIfAvailable(browserInstance, handle),
    { timeoutMs, intervalMs: 250 },
  );
}

export async function waitForWindowHandleGone(
  browserInstance: Browser,
  handle: string,
  timeoutMs = 8_000,
): Promise<void> {
  const { waitFor } = await import('./wait.js');
  await waitFor(
    `window handle ${handle} to close`,
    async () => !(await switchToWindowIfAvailable(browserInstance, handle)),
    { timeoutMs, intervalMs: 250 },
  );
}

async function closeCurrentTauriWindowViaIpc(
  browserInstance: Browser,
): Promise<{ success: boolean; label?: string; error?: string }> {
  return browserInstance.executeAsync(
    (done: (result: { success: boolean; label?: string; error?: string }) => void) => {
      const w = globalThis as typeof globalThis & {
        __TAURENT_WINDOW_LABEL__?: string;
        __TAURI_INTERNALS__?: {
          invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        };
      };
      const label = w.__TAURENT_WINDOW_LABEL__;
      const invoke = w.__TAURI_INTERNALS__?.invoke;

      if (typeof label !== 'string' || !label) {
        done({ success: false, error: 'TAURENT_WINDOW_LABEL_UNAVAILABLE' });
        return;
      }

      if (typeof invoke !== 'function') {
        done({ success: false, label, error: 'TAURI_INVOKE_UNAVAILABLE' });
        return;
      }

      void invoke('plugin:window|close', { label }).catch((err) => {
        console.error(`[tauri:e2e] close window ${label} failed`, err);
      });
      done({ success: true, label });
    },
  );
}

/**
 * Close a specific auxiliary window if it still exists, then optionally return
 * focus to a known surviving window. Missing target windows are treated as
 * success because app-side actions can close windows before WebDriver observes
 * the close request.
 */
export async function closeWindowIfPresent(
  browserInstance: Browser,
  handle: string,
  returnToHandle?: string,
  timeoutMs = 8_000,
): Promise<boolean> {
  const existedBeforeClose = await switchToWindowIfAvailable(browserInstance, handle);

  if (existedBeforeClose) {
    const closeResult = await closeCurrentTauriWindowViaIpc(browserInstance).catch((err) => {
      if (isNoSuchWindowError(err)) {
        return { success: true } satisfies { success: boolean; label?: string; error?: string };
      }
      throw err;
    });

    if (!closeResult.success) {
      throw new Error(`Unable to close Tauri window via IPC: ${closeResult.error ?? 'unknown error'}`);
    }
  }

  await waitForWindowHandleGone(browserInstance, handle, timeoutMs).catch((err) => {
    if (existedBeforeClose) throw err;
  });

  if (returnToHandle) {
    await switchToWindowWithRetry(browserInstance, returnToHandle, returnToHandle, timeoutMs);
  }

  return existedBeforeClose;
}

export async function snapshotWindowHandles(browserInstance: Browser): Promise<WindowHandleSnapshot[]> {
  const originalHandle = await browserInstance.getWindowHandle().catch(() => undefined);
  const handles = await browserInstance.getWindowHandles();
  const snapshots: WindowHandleSnapshot[] = [];

  for (const handle of handles) {
    try {
      await browserInstance.switchToWindow(handle);
      const bodyText = await browserInstance.$('body').getText().catch(() => '');
      snapshots.push({
        handle,
        url: await browserInstance.getUrl().catch(() => undefined),
        title: await browserInstance.getTitle().catch(() => undefined),
        bodyText,
      });
    } catch (err) {
      if (!isNoSuchWindowError(err)) throw err;
    }
  }

  if (originalHandle && await windowHandleExists(browserInstance, originalHandle)) {
    await browserInstance.switchToWindow(originalHandle).catch(() => undefined);
  }

  return snapshots;
}

export async function waitForWindowHandleCount(
  browserInstance: Browser,
  expectedCount: number,
  timeoutMs = 8_000,
): Promise<string[]> {
  const { waitFor } = await import('./wait.js');
  let handles: string[] = [];
  await waitFor(
    `window handle count ${expectedCount}`,
    async () => {
      handles = await getUsableWindowHandles(browserInstance);
      return handles.length === expectedCount;
    },
    { timeoutMs, intervalMs: 250 },
  );
  return handles;
}

export async function waitForWindowByUrl(
  browserInstance: Browser,
  urlFragment: string,
  timeoutMs = 8_000,
): Promise<WindowHandleSnapshot> {
  const { waitFor } = await import('./wait.js');
  let match: WindowHandleSnapshot | undefined;
  await waitFor(
    `window url containing ${urlFragment}`,
    async () => {
      const snapshots = await snapshotWindowHandles(browserInstance);
      match = snapshots.find((snapshot) => snapshot.url?.includes(urlFragment));
      return Boolean(match);
    },
    { timeoutMs, intervalMs: 250 },
  );

  if (!match) {
    throw new Error(`No window handle found for url fragment ${urlFragment}`);
  }

  return match;
}

export async function waitForWindowBodyText(
  browserInstance: Browser,
  handle: string,
  expectedText: string,
  timeoutMs = 8_000,
): Promise<void> {
  const { waitFor } = await import('./wait.js');
  await waitFor(
    `window ${handle} body text containing ${expectedText}`,
    async () => {
      if (!(await switchToWindowIfAvailable(browserInstance, handle))) return false;
      const text = String(
        await browserInstance
          .execute(() => {
            const ctx = globalThis as { document?: { body?: { textContent?: string } | null } | null };
            return ctx.document?.body?.textContent ?? '';
          })
          .catch(() => ''),
      );
      return text.includes(expectedText);
    },
    { timeoutMs, intervalMs: 250 },
  );
}

export async function waitForWindowBodyTextAbsentOrClosed(
  browserInstance: Browser,
  handle: string,
  unexpectedText: string,
  timeoutMs = 8_000,
): Promise<void> {
  const { waitFor } = await import('./wait.js');
  await waitFor(
    `window ${handle} body text to omit ${unexpectedText} or close`,
    async () => {
      if (!(await switchToWindowIfAvailable(browserInstance, handle))) return true;
      const text = String(
        await browserInstance
          .execute(() => {
            const ctx = globalThis as { document?: { body?: { textContent?: string } | null } | null };
            return ctx.document?.body?.textContent ?? '';
          })
          .catch(() => ''),
      );
      return !text.includes(unexpectedText);
    },
    { timeoutMs, intervalMs: 250 },
  );
}

// ---------------------------------------------------------------------------
// Window label helpers
// ---------------------------------------------------------------------------

export async function readCurrentWindowLabel(browserInstance: Browser): Promise<string | null> {
  const label = await browserInstance.execute(() => {
    const w = globalThis as typeof globalThis & { __TAURENT_WINDOW_LABEL__?: string };
    return w.__TAURENT_WINDOW_LABEL__ ?? null;
  });
  return typeof label === 'string' ? label : null;
}

export async function waitForWindowLabel(
  browserInstance: Browser,
  handle: string,
  expectedLabel: string,
  timeoutMs = 8_000,
): Promise<void> {
  const { waitFor } = await import('./wait.js');
  await waitFor(
    `window ${handle} label ${expectedLabel}`,
    async () => {
      if (!(await switchToWindowIfAvailable(browserInstance, handle))) return false;
      return (await readCurrentWindowLabel(browserInstance)) === expectedLabel;
    },
    { timeoutMs, intervalMs: 250 },
  );
}

// ---------------------------------------------------------------------------
// Settings toggle helper
// ---------------------------------------------------------------------------

export async function clickSettingsToggleByLabel(browserInstance: Browser, label: string): Promise<void> {
  const { verbosemsg } = await import('./infrastructure.js');

  // Map well-known labels to their field keys for data-testid based selection
  const LABEL_TO_KEY: Record<string, string> = {
    'Use UPnP / NAT-PMP port forwarding from my router': 'upnp',
  };
  const key = LABEL_TO_KEY[label];

  if (key) {
    // Log all data-testids that contain "settings" for debugging
    const debugFn = `
      var testids = [];
      document.querySelectorAll('*').forEach(function(el) {
        if (el.hasAttribute('data-testid') && el.getAttribute('data-testid').includes('settings')) {
          testids.push(el.getAttribute('data-testid'));
        }
      });
      return testids.join(',');
    `;
    const debugResult = await browserInstance.execute(debugFn);
    verbosemsg(`[clickSettingsToggleByLabel] settings data-testids: "${debugResult}"`);

    // First try the toggle container (has data-testid="settings-toggle-${key}")
    const toggleContainer = await browserInstance.$(`[data-testid="settings-toggle-${key}"]`);
    const containerExists = await toggleContainer?.isExisting().catch(() => false);
    verbosemsg(`[clickSettingsToggleByLabel] data-testid="settings-toggle-${key}" exists=${containerExists}`);
    if (containerExists) {
      const btnInContainer = await toggleContainer.$('button');
      if (btnInContainer) {
        await btnInContainer.click();
        return;
      }
    }

    // Fallback: try the checkbox button directly (has data-testid="settings-checkbox-${key}")
    const testidToggle = await browserInstance.$(`[data-testid="settings-checkbox-${key}"]`);
    const checkboxExists = await testidToggle?.isExisting().catch(() => false);
    verbosemsg(`[clickSettingsToggleByLabel] data-testid="settings-checkbox-${key}" exists=${checkboxExists}`);
    if (checkboxExists) {
      await testidToggle.click();
      return;
    }
  }

  // Fallback: find a flex container with matching text and click its first button.
  // Use browser.execute to do DOM-based search which avoids XPath quoting issues.
  const clickFn = `
    function findToggleContainingText(text) {
      // Match elements that contain the text (possibly split across child nodes)
      var all = document.querySelectorAll('div[class*="flex"]');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.textContent && el.textContent.toLowerCase().includes(text.toLowerCase())) {
          var btn = el.querySelector('button[data-testid^="settings-toggle"], button[data-testid^="settings-checkbox"]');
          if (btn) { btn.click(); return true; }
          // Also try any button descendant
          var btns = el.querySelectorAll('button');
          if (btns.length > 0) { btns[0].click(); return true; }
        }
      }
      return false;
    }
    return findToggleContainingText(arguments[0]);
  `;
  const found = await browserInstance.execute(clickFn, label);
  verbosemsg(`[clickSettingsToggleByLabel] fallback execute() found=${found} for label="${label}"`);
  if (!found) {
    throw new Error(`Settings toggle not found for label: ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Context menu helpers
// ---------------------------------------------------------------------------

export async function hoverContextMenuSubMenu(
  browserInstance: Browser,
  label: string,
): Promise<void> {
  const menuItems = await browserInstance.$$('[role="menuitem"]');
  let trigger: WebdriverIO.Element | null = null;
  for (const item of menuItems) {
    const text = (await item.getText().catch(() => '')).trim();
    if (text === label || text.includes(label)) {
      trigger = item as unknown as WebdriverIO.Element;
      break;
    }
  }
  if (!trigger) {
    throw new Error(`Context menu submenu not found: ${label}`);
  }
  await trigger.moveTo();
}

export async function clickContextMenuItem(
  browserInstance: Browser,
  label: string,
): Promise<void> {
  const menuItems = await browserInstance.$$('[role="menuitem"]');
  let item: WebdriverIO.Element | null = null;
  for (const candidate of menuItems) {
    const text = (await candidate.getText().catch(() => '')).trim();
    if (text === label) {
      item = candidate as unknown as WebdriverIO.Element;
      break;
    }
  }
  if (!item) {
    throw new Error(`Context menu item not found: ${label}`);
  }
  await item.click();
}

export async function readClipboardText(browserInstance: Browser): Promise<string> {
  const value = await browserInstance.executeAsync(async (done: (result: string) => void) => {
    const maybeNavigator = globalThis.navigator as Navigator & {
      clipboard?: { readText: () => Promise<string> };
    };
    if (!maybeNavigator.clipboard?.readText) {
      done('');
      return;
    }
    try {
      const text = await maybeNavigator.clipboard.readText();
      done(text);
    } catch {
      done('');
    }
  });
  return typeof value === 'string' ? value : '';
}

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

export interface WebDriverHandleDiagnostics {
  handle: string;
  url?: string;
  title?: string;
  bodyTextLength?: number;
  bodyTextSample?: string;
  pageSourceSample?: string;
  error?: string;
}

export interface WebDriverDiagnostics {
  label: string;
  url?: string;
  title?: string;
  handles?: WebDriverHandleDiagnostics[];
  contexts?: string[];
  error?: string;
}

export async function captureWebDriverDiagnostics(
  browserInstance: Browser,
  label: string,
): Promise<WebDriverDiagnostics> {
  const diagnostics: WebDriverDiagnostics = { label };

  try {
    diagnostics.url = await browserInstance.getUrl();
  } catch (err) {
    diagnostics.error = `getUrl failed: ${(err as Error).message}`;
  }

  try {
    diagnostics.title = await browserInstance.getTitle();
  } catch (err) {
    diagnostics.error = diagnostics.error
      ? `${diagnostics.error}; getTitle failed: ${(err as Error).message}`
      : `getTitle failed: ${(err as Error).message}`;
  }

  try {
    const browserWithContexts = browserInstance as unknown as Browser & { isMobile?: boolean };
    if (browserWithContexts.isMobile && browserWithContexts.getContexts) {
      const contexts = await browserWithContexts.getContexts();
      diagnostics.contexts = Array.isArray(contexts)
        ? contexts.map((context) => String(context))
        : [JSON.stringify(contexts)];
    }
  } catch (err) {
    diagnostics.error = diagnostics.error
      ? `${diagnostics.error}; getContexts failed: ${(err as Error).message}`
      : `getContexts failed: ${(err as Error).message}`;
  }

  try {
    const handles = await browserInstance.getWindowHandles();
    diagnostics.handles = [];

    for (const handle of handles) {
      const handleDiagnostics: WebDriverHandleDiagnostics = { handle };
      try {
        await browserInstance.switchToWindow(handle);
        handleDiagnostics.url = await browserInstance.getUrl().catch(() => undefined);
        handleDiagnostics.title = await browserInstance.getTitle().catch(() => undefined);

        try {
          const body = await browserInstance.$('body');
          const bodyText = await body.getText().catch(() => '');
          handleDiagnostics.bodyTextLength = bodyText.length;
          handleDiagnostics.bodyTextSample = bodyText.slice(0, 500);
        } catch {
          handleDiagnostics.bodyTextLength = 0;
          handleDiagnostics.bodyTextSample = '';
        }

        const pageSource = await browserInstance.getPageSource().catch(() => '');
        handleDiagnostics.pageSourceSample = pageSource.slice(0, 1000);
      } catch (err) {
        handleDiagnostics.error = (err as Error).message;
      }
      diagnostics.handles.push(handleDiagnostics);
    }
  } catch (err) {
    diagnostics.error = diagnostics.error
      ? `${diagnostics.error}; getWindowHandles failed: ${(err as Error).message}`
      : `getWindowHandles failed: ${(err as Error).message}`;
  }

  const handleSummary = diagnostics.handles
    ?.map((h) => `${h.handle}: url=${h.url ?? '<unknown>'} title=${h.title ?? '<unknown>'} body=${h.bodyTextLength ?? 0}`)
    .join(' | ');

  const { verbosemsg } = await import('./infrastructure.js');
  verbosemsg(
    `[diagnostics:${label}] url=${diagnostics.url ?? '<unknown>'} title=${diagnostics.title ?? '<unknown>'}` +
      (handleSummary ? ` handles=[${handleSummary}]` : ''),
  );

  return diagnostics;
}
