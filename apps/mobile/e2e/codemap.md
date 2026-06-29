# apps/mobile/e2e/

## Responsibility

Playwright E2E tests for the mobile renderer running in `VITE_AUTOMATION=1` browser-automation mode (no real Tauri backend). Tests exercise UI flows through mocked bridge, transport, and plugin stubs from `src/testing/`.

## Key Files

- **helpers/mobile.ts** (101 lines) — Shared test helpers: `gotoMobile` (navigates with scenario param), `waitForHomeReady`, `readRecordedCalls`, `readLatestRecordedCall`, `failNextMutation`, `readPendingMutationFailure`, `readSyncCallCount`.
- **bootstrap.spec.ts** (58 lines, 5 tests) — App bootstrap and session lifecycle (scenario loading, connection states, error banners).
- **add-torrent.spec.ts** (79 lines, 3 tests) — Add torrent flows (magnet link, file selection, error handling).
- **settings.spec.ts** (15 lines, 1 test) — Settings screen basic navigation/rendering.
- **search.spec.ts** (16 lines, 1 test) — Search screen basic navigation/rendering.
- **rss.spec.ts** (15 lines, 1 test) — RSS screen basic navigation/rendering.

## Design

- **Automation mode only**: Tests run against `pnpm mobile:renderer:e2e` which starts Vite with `VITE_AUTOMATION=1`. The mocked bridge (`mockMobileBridge.ts`) provides deterministic in-memory state; no real Tauri or qBittorrent server is involved.
- **Scenario-driven**: Tests select data scenarios (e.g., `small-100`, `empty`) via URL params passed to `gotoMobile`. The mock bridge loads the corresponding torrent/maindata state.
- **Call recording assertions**: Helpers like `readRecordedCalls` and `readLatestRecordedCall` let tests verify which bridge methods were invoked and with what arguments.
- **Mutation failure injection**: `failNextMutation(operation, error)` enables testing error UI paths by making the next call to a specific bridge method reject.
- **Shared page model**: `mobile.ts` centralizes page interactions (navigation, waiting for render, reading recorded state) to avoid duplication across spec files.

## Flow

1. `pnpm mobile:renderer:e2e` starts Vite in automation mode, aliasing Tauri imports to mocks.
2. Playwright test opens the mobile app URL with a scenario parameter (e.g., `/?scenario=small-100`).
3. `gotoMobile` navigates Playwright to the URL and waits for the app shell to render.
4. The app boots using the mocked bridge; the mock loads scenario state and records all calls.
5. The test interacts with the UI (clicks buttons, fills forms, navigates routes).
6. The test asserts UI state (text content, visibility) or reads recorded calls to verify bridge invocation.
7. For error paths, `failNextMutation` is called before the triggering action, and the test asserts the error UI appears.

## Integration

- **src/testing/mockMobileBridge.ts** — Full mock bridge consumed at runtime in automation mode.
- **src/testing/mockTauriTransport.ts** — Mock Tauri event transport.
- **src/testing/mockTauriPluginStore.ts** — In-memory Store stub.
- **src/testing/mockTauriPluginDialog.ts** — Stub file picker.
- **src/testing/mockTauriLogging.ts** — No-op logging setup.
- **src/testing/fixtures/torrent.ts** — Deterministic torrent/maindata state builders.
- **vite.config.ts** — Vite resolve aliases for `VITE_AUTOMATION=1` mode.
- **Playwright config**: `apps/mobile/playwright.config.ts` (Chromium, `VITE_AUTOMATION=1` env).
