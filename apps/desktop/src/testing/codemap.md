# apps/desktop/src/testing/

## Responsibility

Provides mock implementations of Tauri-specific APIs and the desktop bridge for browser-based testing and automation (`VITE_AUTOMATION=1`). These mocks replace native Tauri transport, core APIs, window management, events, DPI, notifications, and logging with in-memory stubs that can be controlled from Playwright or Vitest.

## Design

- **Vite alias replacement**: Mocks are aliased in `vite.config.ts` when `VITE_AUTOMATION=1`, replacing `@taurent/bridge/adapters/desktop`, `@taurent/bridge/transport/tauri`, `@taurent/bridge/logging`, `@tauri-apps/api/core`, `@tauri-apps/api/window`, `@tauri-apps/api/webviewWindow`, `@tauri-apps/api/event`, `@tauri-apps/api/dpi`, `@tauri-apps/plugin-notification`, and `@tauri-apps/plugin-window-state`.
- **In-memory event bus**: `mockTauriEvent.ts` implements a `listen`/`emit` event system with a global listener map. Events are stored in an array for assertion.
- **Scenario-driven mock bridge**: `mockDesktopBridge.ts` provides a full `DesktopBridge` implementation with configurable scenarios (`empty`, `small-100`, `large-1000`, `stress-5000`), app scenarios (`connected`, `no-saved-servers`, etc.), delta injection, mutation failure injection, and sync fault simulation.
- **Automation control surface**: Exposes `window.__TAURENT_AUTOMATION__` for Playwright to inject deltas, set delays, toggle errors, override visibility, and inspect recorded calls.
- **Headless DnD fix**: Patches `PointerEvent.prototype.pointerId` to return `1` for synthetic events in headless Chromium, preventing DnD Kit crashes.

## Key Files

- **mockDesktopBridge.ts** — Full `DesktopBridge` mock with scenario selection, delta injection, mutation recording, and sync fault simulation. Also includes concrete torrent detail fixtures (properties, trackers, files) and maindata sync listener management.
- **mockTauriCore.ts** — No-op mock for `@tauri-apps/api/core` (`invoke`, `transformImage`). Prevents the production bridge's import from breaking Vite module resolution before the mock bridge can install `window.__TAURENT_AUTOMATION__`.
- **mockTauriLogging.ts** — No-op mock for `@taurent/bridge/logging` (`setupTauriLogging`). Replaces the production logging bootstrap that imports `@tauri-apps/plugin-log`, which cannot resolve under headless Chromium. Preserves the required bootstrap order in `main.tsx` without pulling Tauri plugin code into the browser runtime.
- **mockTauriTransport.ts** — No-op transport and in-memory event listener factories (`createSessionEventListener`, `createResourceInvalidatedListener`, `emitResourceInvalidated`, `emitSessionChanged`, `emitMaindataSyncChanged`).
- **mockTauriEvent.ts** — In-memory `listen`/`emit` event bus with `window.__TAURENT_TAURI_EVENTS__` control surface.
- **mockTauriWebviewWindow.ts** — Mock `WebviewWindow` class with `show`/`hide`/`close` and `window.__TAURENT_TAURI_WEBVIEWS__` control surface.
- **mockTauriWindow.ts** — Mock `getCurrentWindow()` with label resolution from pathname and close-request handling.
- **mockTauriWindowState.ts** — No-op `restoreStateCurrent` and `StateFlags`.
- **mockTauriDpi.ts** — Stub `LogicalSize` and `LogicalPosition` classes.
- **mockNativeNotification.ts** — No-op native notification permission and send.
- **fixtures/torrent.ts** — Deterministic torrent/maindata fixture factories (`createTorrent`, `createTorrentList`, `createMaindataState`, `createDeltaMaindata`).

## Flow

1. Vite config aliases Tauri modules to mocks when `VITE_AUTOMATION=1`.
2. App boots with `mockDesktopBridge` as `BridgeAdapter`.
3. Playwright interacts via `window.__TAURENT_AUTOMATION__` to inject scenarios, deltas, and faults.
4. Tests assert on recorded calls, emitted events, and rendered UI state.

## Integration

- Aliased in `apps/desktop/vite.config.ts` and `apps/desktop/playwright.config.ts`.
- Used by Playwright E2E tests and Vitest browser-mode tests.
- `fixtures/torrent.ts` provides deterministic data for both mock bridge and direct test consumption.
- `mockTauriCore.ts` and `mockTauriLogging.ts` are critical for automation bootstrap — without them, the production bridge's imports of Tauri native modules fail before the mock bridge can install its control surface.
