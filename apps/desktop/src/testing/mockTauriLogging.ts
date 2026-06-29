/**
 * Mock for @taurent/bridge/logging in desktop automation mode.
 *
 * The real `setupTauriLogging` (in `packages/bridge/src/logging.ts`) imports
 * `@tauri-apps/plugin-log` and the Tauri `isTauri()` probe, which cannot
 * resolve under the headless Chromium renderer used by Playwright.
 *
 * In `VITE_AUTOMATION=1` the Vite alias layer swaps this file in for
 * `@taurent/bridge/logging`, so the production logging bootstrap becomes a
 * no-op. The desktop `main.tsx` still imports and awaits the function, which
 * preserves the required bootstrap order without pulling Tauri plugin code
 * into the browser runtime.
 */
export async function setupTauriLogging(isDevelopment: boolean): Promise<void> {
  void isDevelopment;
  // no-op in automation mode
}
