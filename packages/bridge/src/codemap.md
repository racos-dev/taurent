# packages/bridge/src/

## Responsibility

Runtime-agnostic bridge layer that normalizes platform-specific command/event transports and exposes a typed API for consumers (desktop/mobile/web-core/web-ui). The source tree is split into:

- `contracts/` — pure bridge interfaces, capabilities, and type contracts
- `transport/` — invoke/listen abstraction plus the Tauri transport implementation
- `adapters/` — desktop and mobile bridge factories built on the transport layer
- `desktop/` — desktop-only helpers (native notifications) isolated from shared surfaces

This module is a thin abstraction over the application's IPC/command surface; it does not implement business logic or qBittorrent HTTP interactions itself.

## Key Files

- **index.ts** — Package entry point. Re-exports pure types/contracts/events, web placeholder helpers, and operation notification registration (`registerOperationFailedNotifier`, `onOperationFailed`) from the runtime-agnostic root. Platform-specific subpath imports (`@taurent/bridge/adapters/desktop`, `@taurent/bridge/adapters/mobile-tauri`, `@taurent/bridge/transport`) keep Tauri dependencies out of the root bundle for shared consumers.
- **types.ts** — All shared DTOs: session types (`SessionSnapshot`, `SessionStatus`, `OperationResponse`), torrent/transfer/category/tag/preferences response types (including `TorrentPropertiesEnvelope`/`TorrentTrackersEnvelope`/`TorrentFilesEnvelope` and their unwrapped aliases), server management types (`SavedServerSummary` with `credential_status`/`credential_warning`), server input types (`AddServerInput`, `UpdateServerInput`, `ServerCredentialsInput`, `TestConnectionResult`), list/add torrent params, probe types (`ProbeResult` tri-state, `ProbeResponse`), `SyncMainData`, `SyncTorrentPeers`, `RetryState`, RSS types (`RSSItemsResponse`, `RSSRulesResponse`, `RssItem`, `RssRule`, `RssRuleInput`), search DTOs (`SearchStatus`, `SearchResult`, `SearchResults`, `SearchPluginCategory`, `SearchPlugin`), capability types (`ServerCapabilities` — 21-field snake_case boolean shape, imported from `./generated/server-capabilities` and re-exported alongside the `makeServerCapabilities()` factory), maindata sync types (`MaindataSnapshotResponse`, `MaindataSyncHealth`, `MaindataSyncChangedEvent`, `MaindataSyncHealth`, `SyncHealthState`, `MaindataSnapshotEnvelope`), `TorrentWebseedsResponse`, `ResolveResult`, retry constants (`MAX_RETRY_ATTEMPTS`, `RETRY_DELAY_MS`).
- **events.ts** — Normalized event payload types: `SessionChangedEvent`, `ResourceInvalidatedEvent`, `OperationFailedEvent`, `ThemeChangedEvent`, and the `BridgeEvent` discriminated union (includes `maindata-sync-changed` variant). `ThemeChangedEvent` imports `ThemePalette`/`ThemeVariant` from `@taurent/shared/theme/types`.
- **platform.ts** — Runtime detection and platform descriptor types. Exports `isTauriRuntime()` (checks `__TAURI_INTERNALS__`), `PlatformDescriptor`, `PlatformNotSupportedError`, `PLATFORM_DESCRIPTOR_KEY` symbol, and `RuntimeType` (`'desktop' | 'mobile-tauri' | 'web'`).
- **sharedBridge.ts** — Shared helper factories imported by both desktop and mobile adapters. Centralizes session lifecycle, server management, qBittorrent client helpers (search/RSS/logout), Rust-owned maindata sync lifecycle, and generic invoke factories. Also exports `probeEndpoint` for probe tri-state normalization. See [adapters/codemap.md](adapters/codemap.md) for details.
- **operationNotifications.ts** — Runtime-agnostic operation-failed notification registration. `registerOperationFailedNotifier` wires a platform notifier; `onOperationFailed` subscribes to `OperationFailedEvent` callbacks. No Tauri dependencies.
- **logging.ts** — Tauri logging bootstrap. Bridges browser console methods to Rust log plugin. In dev forwards all levels; in prod only `warn`/`error`. Attaches runtime log forwarding to display Rust-side logs in the browser console.
- **web.ts** — Future web runtime placeholder. Exports `createWebTransport()` and `createWebBridge()` which throw `WebPlatformNotSupportedError`. Documents the contract a web implementation must satisfy (fetch-based transport, WebSocket/EventSource for events).

## Design Patterns

- **Transport abstraction**: `transport/transport.ts` defines the minimal `Transport` interface (`invoke<T>(cmd, args?)` + `listen<T>(event, handler)`) so concrete runtime implementations can be injected.
- **Factory injection**: Both adapter factories (`createDesktopBridge`, `createMobileTauriBridge`) accept an optional `Transport` parameter for testability and future web runtimes.
- **Shared helper factories**: `sharedBridge.ts` centralizes operations identical across platforms (`createSessionHelpers`, `createServerHelpers`, `createQbClientHelpers`, `createSyncHelpers`), minimizing duplication between the adapters. Generic `makeInvoke`/`makeInvokeNoArgs` factories provide reusable invoke wrappers.
- **Adapter pattern**: The adapter files translate domain methods to `transport.invoke()` calls. Both adapters compose shared helper factories from `sharedBridge.ts` with platform-specific command mappings.
- **Root-level session lifecycle**: `DesktopBridge` and `MobileBridge` both extend `SessionLifecycleBridge` — session methods live at the **bridge root**, not under a `session` property. This reflects the desktop session-ownership pattern where auxiliary windows inherit session state via `getSessionSnapshot()`.
- **Capability descriptors**: `BridgeCapabilities` interface with per-platform constants (`DESKTOP_CAPABILITIES`, `MOBILE_CAPABILITIES`) exposed as `bridge.capabilities` for consumer-side feature gating.
- **Probe tri-state semantics**: `probeEndpoint` distinguishes "endpoint not present" (`supported: false`) from "network/auth error" (`supported: null`).
- **Rust-owned sync lifecycle**: `createSyncHelpers` wraps maindata snapshot/status/start/stop commands and provides `addMaindataSyncListener` — a synchronous-unsubscribe event listener that handles async registration races and transport errors safely.
- **Operation notification decoupling**: `operationNotifications.ts` provides a registration/subscription pattern for `OperationFailedEvent` that is runtime-agnostic and decoupled from any platform event system.

## Flow (call path)

```
Consumer (web-core / web-ui / apps/*)
  → Bridge adapter method (bridge.torrents.getList(), bridge.servers.listServers(), etc.)
  → sharedBridge helpers (session/server/qb/sync) or direct adapter invoke (torrent/transfer)
  → transport.invoke(cmd, args)
  → Tauri transport (createTauriTransport.invoke) — only layer that calls @tauri-apps/api
  → Rust command handler (qb-tauri / qb-core)
```

Events flow the reverse direction:
```
Rust event emission → Tauri event bus → Transport.listen → consumer callback
```

Maindata sync events:
```
Rust sync manager → maindata-sync-changed event → Transport.listen → addMaindataSyncListener → consumer callback
```

## Integration

- **Public surface**: Package exports typed adapters and types under `@taurent/bridge`. Public subpaths include `@taurent/bridge/contracts`, `@taurent/bridge/transport`, `@taurent/bridge/adapters`, `@taurent/bridge/adapters/desktop`, and `@taurent/bridge/adapters/mobile-tauri`.
- **Platform boundary**: `packages/web-core` and `packages/web-ui` depend on the contracts exported here; only `transport/tauriTransport.ts` and `desktop/notification.ts` contain `@tauri-apps/*` dependencies.
- **Logging bootstrap**: Both apps call `setupTauriLogging(isDev)` before importing/rendering `App`, establishing the console→Rust log bridge at startup.
- **Root entry**: `index.ts` exports pure types, the web placeholder, and operation notification registration from the root; all Tauri-specific exports are behind explicit subpaths to keep the root tree web-safe.
