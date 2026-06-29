# apps/mobile/src/testing/

## Responsibility

Test infrastructure for the mobile app in `VITE_AUTOMATION=1` browser automation mode. Provides mock implementations of all Tauri-native dependencies (bridge, transport, dialog, store, logging) so that Playwright E2E tests can run against a mocked renderer runtime without a real Tauri backend.

## Key Files

- **mockMobileBridge.ts** — Full mock implementation of the `MobileBridge` interface. Implements all bridge methods (session, torrents, transfer, categories, tags, application, servers, qBClient) with in-memory state. Supports scenario selection (empty, small-100, large-1000, stress-5000) and app-state scenarios (connected, no-saved-servers, saved-server-disconnected, saved-server-unavailable, saved-server-credential-missing). Maintains a representative in-memory qBittorrent preferences object: `application.getPreferences()` returns the current state, `application.setPreferences()` merges partial updates and emits a `preferences` invalidation, and automation reset restores deterministic defaults. Handles `MaindataSyncChangedEvent` for backend sync path compatibility. Exposes `window.__TAURENT_AUTOMATION__` control API for Playwright (injectDelta, injectCustomDelta, getPreferences, resetPreferences, setNextMutationFailure, reset, etc.). Records all bridge calls for test assertions.
- **mockTauriTransport.ts** — Mock Tauri transport (`createTauriTransport`) that returns no-op `invoke`/`listen` functions. Also provides in-memory listener registrars and emit functions (`emitSessionChanged`, `emitResourceInvalidated`, `emitOperationFailed`, `emitThemeChanged`) for simulating Tauri events in tests. Includes `patchPointerEventsForHeadless()` to fix DnD Kit's `PointerSensor` in headless Chromium.
- **mockTauriPluginDialog.ts** — Stub for `@tauri-apps/plugin-dialog` `open()` function. Always returns `null` (no real file picker in headless mode).
- **mockTauriPluginStore.ts** — In-memory `Store` class mirroring `@tauri-apps/plugin-store`'s API. Uses a shared `Map<string, Map<string, unknown>>` keyed by label. `load()` and `save()` are no-ops.
- **mockTauriLogging.ts** — No-op stub for `setupTauriLogging()`. There is no real Tauri logging backend in automation mode.

## Design

- **VITE_AUTOMATION aliasing**: These mocks are swapped in via Vite resolve aliases when `VITE_AUTOMATION=1` (configured in `apps/mobile/vite.config.ts`). The real Tauri imports are never loaded in automation mode.
- **Scenario-driven state**: `mockMobileBridge` supports multiple data scenarios (deterministic torrent counts) and app-state scenarios (connection status, server availability, credential issues). Scenario is selected via URL param (`?scenario=small-100`) or localStorage fallback.
- **Persistent preferences**: The mock seeds a complete representative `Preferences` object covering the mobile settings registry. Preference reads return defensive copies; partial writes merge into the current state, preserve call recording, emit standard resource invalidation, and reset to defaults through `reset()` or `resetPreferences()`.
- **Delta injection**: Tests can inject incremental maindata deltas via `window.__TAURENT_AUTOMATION__.injectDelta()` or `injectCustomDelta()`. Deltas are queued and returned on the next `syncMaindata()` poll call.
- **Mutation failure injection**: `setNextMutationFailure(operation, error)` causes the next call to the specified operation to reject. Used to test error handling in UI.
- **Event simulation**: `emitSessionChanged` and `emitResourceInvalidated` dispatch events to registered listeners, simulating Tauri backend events.
- **Call recording**: All bridge method calls are recorded in `_recordedCalls` for test assertions.

## Flow

1. `vite.config.ts` detects `VITE_AUTOMATION=1` and aliases Tauri imports to the mock modules.
2. `main.tsx` calls `setupTauriLogging()` which is a no-op in automation mode.
3. `QBClientProvider` and other providers use the mocked `BridgeAdapter` (from `mockMobileBridge.ts`) instead of the real Tauri bridge.
4. `sessionAdapter.ts` uses the mocked transport and listener factories from `mockTauriTransport.ts`.
5. `platform/index.ts` uses the mocked `Store` (from `mockTauriPluginStore.ts`) and `open()` (from `mockTauriPluginDialog.ts`).
6. Playwright tests control the mock state via `window.__TAURENT_AUTOMATION__` API.

## Integration

- **apps/mobile/vite.config.ts** — Vite resolve aliases that swap real imports for mocks when `VITE_AUTOMATION=1`. Also includes `themeInitPlugin` that injects theme/accent initialization scripts into the HTML to prevent flash-of-unstyled-content.
- **@taurent/bridge/contracts/interfaces** — `MobileBridge` type that the mock implements.
- **@taurent/bridge/contracts/capabilities** — `MOBILE_CAPABILITIES` constant used by the mock.
- **@taurent/bridge/types** — All bridge-related types (`SessionSnapshot`, `SyncMainData`, `OperationResponse`, etc.).
- **@taurent/bridge/events** — Event types (`SessionChangedEvent`, `ResourceInvalidatedEvent`).
- **./fixtures/torrent** — `createMaindataState`, `createDeltaMaindata` for building deterministic test data.
- **Playwright E2E tests** — Consume `window.__TAURENT_AUTOMATION__` for test control.
