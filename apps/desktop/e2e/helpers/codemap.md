# apps/desktop/e2e/helpers/

## Responsibility

Playwright E2E test helpers for the desktop renderer. Provides page navigation, automation control surface accessors, torrent row locators, mocked webview polling, and diagnostic capture utilities for browser-mode tests running against the mocked bridge.

## Design

- **Scenario-driven navigation**: `gotoDesktop(page, options)` navigates to a route with `scenario` and `mockAppState` query params, waits for `window.__TAURENT_AUTOMATION__` to be installed, and clears emitted events.
- **Torrent row locators**: Stable `data-testid="torrent-row"` based locators (`getTorrentRowLocator`, `getTorrentRowByHash`, `readTorrentRowHash`, `readTorrentRowName`) that avoid depending on cell text or column position.
- **Mocked webview polling**: `waitForMockWebview(page, options)` polls the `window.__TAURENT_TAURI_WEBVIEWS__` record list for dialog windows, matching by label, dialog type, URL predicate, and visibility — replacing immediate reads after async actions.

## Key Files

- **desktop.ts** — Core helpers: `gotoDesktop`, `waitForHomeReady`, `readRecordedCalls`, `failNextMutation`, torrent row locators (`getTorrentRowLocator`, `getFirstVisibleTorrentRow`, `getVisibleTorrentRow`, `getTorrentRowByHash`, `readTorrentRowHash`, `readTorrentRowName`), mocked webview polling (`waitForMockWebview`), and event/window/webview readers.

## Flow

1. `gotoDesktop` navigates with scenario params → waits for automation bootstrap.
2. `waitForHomeReady` waits for router.ready mark and torrent content.
3. Test-specific helpers read automation state, interact with torrent rows, poll webview state.

## Integration

- Used by Playwright tests in `apps/desktop/e2e/tests/`.
- Relies on `window.__TAURENT_AUTOMATION__` (installed by `src/testing/mockDesktopBridge.ts`).
- Relies on `window.__TAURENT_TAURI_EVENTS__`, `window.__TAURENT_TAURI_WINDOW__`, `window.__TAURENT_TAURI_WEBVIEWS__` (installed by mock Tauri modules).
