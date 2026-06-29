# apps/desktop/scripts/e2e/

## Responsibility

Native desktop Tauri end-to-end runner and the supporting infrastructure (fake backend, Vite, WebDriverIO orchestration) that drives the packaged app through smoke scenarios. Validates both the fake backend API contract and the full renderer → Rust → fake-server lifecycle.

## Design

`runner.ts` is the orchestrator (1227 lines). Support modules split concerns: `infrastructure.ts` (process / port management, native diagnostics, sync diagnostic parsing), `helpers.ts` (WebDriverIO utilities, window handle helpers, settings toggle helpers, context menu helpers, clipboard, disconnect/reconnect lifecycle helpers, diagnostic capture), `webdriver.ts` (WebDriverIO client), and `wait.ts` (readiness / barrier helpers). Modular smoke tests live under `tests/` and export a `TestModule` shape the runner can iterate over.

The runner performs:
1. **Fake backend contract assertions** — validates auth, session enforcement, torrent mutations, slow-response/transient-failure/sync-error modes before connecting the real app.
2. **Native app smoke** — adds a server via form fill, waits for torrent table, exercises pause/resume, opens settings/add-torrent/statistics windows, tests context menu clipboard flow, confirms delete dialog.
3. **Server-down lifecycle exercise** — forces fake backend sync failures, asserts the unavailable-server modal, opens the saved-server list through the modal action, and reconnects via LoginScreen to trigger sync teardown/restart evidence (T147.2).
4. **Artifact writing** — writes `current.json` and `native-smoke.json` with timings, backend checks, process snapshots, and sync diagnostics.

`infrastructure.ts` provides sync diagnostic parsing (`parseSyncDiagnostics`) that extracts `get_maindata_snapshot` timing, `LiveSyncManager` lifecycle events, and revision progression from captured app stdout/stderr.

`helpers.ts` provides window/diagnostic helpers plus `reconnectViaLoginScreen` (clicks a saved server on LoginScreen) for lifecycle testing.

## Flow

Build the Tauri webdriver binary unless `--skip-build` or `TAURENT_TAURI_APP_PATH` is used → locate the Tauri binary → kill stale processes → start fake backend → start Vite → launch app → wait for WebDriver endpoint → create session → run fake backend contract checks → run native smoke tests → exercise server-down lifecycle → capture diagnostics → clean up → write artifacts.

## Integration

- Uses the fake backend at `../testing/fake-qbittorrent.ts`.
- Uses WebDriverIO for native app automation.
- Writes artifacts to `artifacts/desktop/tauri-e2e` and `artifacts/desktop/perf`.
- Invoked by `pnpm desktop:tauri:e2e`.
