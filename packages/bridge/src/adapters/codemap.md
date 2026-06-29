# packages/bridge/src/adapters/

## Responsibility

Platform-specific bridge adapter factories that translate the typed `DesktopBridge` / `MobileBridge` contract into `transport.invoke()` calls against the Rust backend. Each adapter is a complete, self-contained bridge implementation for one runtime target.

## Files

- **desktop.ts** — `createDesktopBridge(transport?)` factory. Builds and returns a `DesktopBridge` object. Exports a default singleton `BridgeAdapter` using the default Tauri transport. Also re-exports `NativeMenuState`, `NativeUiAction`, `ResolveResult` types.
- **mobile-tauri.ts** — `createMobileTauriBridge(transport?)` factory. Builds and returns a `MobileBridge` object. Exports a default singleton `BridgeAdapter` using the default Tauri transport.
- **index.ts** — Barrel re-export of both adapters and their types.

## Design

- **Factory + optional injection**: Both `createDesktopBridge` and `createMobileTauriBridge` accept an optional `Transport` parameter. If omitted, `createTauriTransport()` is used. This enables test mocking and future web transport injection without rewriting adapter logic.
- **Shared helper composition**: Both adapters compose four shared helper factories from `sharedBridge.ts`:
  - `createSessionHelpers(t)` — session lifecycle invoke wrappers (sessionConnectById, sessionDisconnect, sessionReconnect, sessionSwitchServer, sessionSwitchServerById, sessionSetError, sessionClearError, sessionSetConnecting, getSessionSnapshot, getSessionGeneration, getSessionStatus, sessionHealthCheck)
  - `createServerHelpers(t)` — canonical server management invoke wrappers (listServers, getActiveServer, addServer, updateServer, removeServer, selectServer, testServerConnection, testSavedServerConnection)
  - `createQbClientHelpers(t)` — qB client helpers (getRssItems/Rules, RSS CRUD, search lifecycle, plugin management, logout)
  - `createSyncHelpers(t)` — Rust-owned maindata sync lifecycle (getMaindataSnapshot, getMaindataSyncStatus, startMaindataSync, stopMaindataSync, addMaindataSyncListener)
- **Desktop adapter specifics**:
  - Uses direct `transport.invoke` calls (unified command names).
  - Implements `DesktopBridge` interface including `syncMenuState`, `exitApp`, `getPendingNativeUiActions`, `getPendingViewActions`, `setViewListenersReady`/`resetViewListenersReady`, `getDownloadCompletionNotificationsEnabled`/`setDownloadCompletionNotificationsEnabled`, `getPathMappings`/`setPathMappings`, `resolveLocalPath`, `openLocalPath`, `revealLocalItem`.
  - `torrent.getProperties/getTrackers/getFiles` unwrap Rust envelope objects (`{ properties }`, `{ trackers }`, `{ files }`) to match the mobile contract.
  - `servers` includes `normalizeServerUrl`, `probeServerScheme`, and `sessionSwitchServerById` for add-server flows.
- **Mobile adapter specifics**:
  - Uses canonical unprefixed Tauri command names (e.g., `get_torrent_list`, not `cmd_get_torrent_list`).
  - Exposes `transfer.*`, `categories.*`, `tags.*`, `application.*`, `servers.*` namespaces aligned with desktop.
  - Full torrent parity with desktop: `setAutoManagement`, `setShareLimits`, `setSequentialDownload`, `setFirstLastPiecePriority`, `setSuperSeeding`, `exportTorrent`.
  - `addTorrent` invokes `add_torrent` (mobile-specific command) with an `options` payload key (vs desktop's `add_torrent_options`).
  - Tag operations send comma-joined strings via `tags.join(',')` to match the mobile backend's older command signatures.
  - `servers` includes `normalizeServerUrl`, `probeServerScheme`, and `sessionSwitchServerById`.
  - `application` includes `getPreferences`/`setPreferences` (desktop-aligned).

## Flow

```
createDesktopBridge(transport?)
  ├── transport = transport ?? createTauriTransport()
  ├── createSessionHelpers(transport)  → session lifecycle methods
  ├── createServerHelpers(transport)   → server management methods
  ├── createQbClientHelpers(transport) → search/RSS helpers
  ├── createSyncHelpers(transport)     → maindata sync lifecycle
  │
  └── Returns DesktopBridge object:
        ├── root: session methods (getSessionSnapshot, sessionConnectById, etc.)
        ├── torrents: { getList, pause, resume, delete, getProperties, ... }
        ├── transfer: { getInfo, getSpeedLimitsMode, toggleSpeedLimitsMode, getCookies, ... }
        ├── categories: { getCategories, createCategory, ... }
        ├── tags: { getTags, createTags, addTorrentTags, ... }
        ├── application: { getPreferences, setPreferences, getVersion, probeSearch, probeRss, getServerCapabilities, ... }
        ├── qBClient: { getMaindataSnapshot, getMaindataSyncStatus, startMaindataSync, addMaindataSyncListener, getRssItems, ... }
        ├── servers: { listServers, getActiveServer, addServer, normalizeServerUrl, probeServerScheme, sessionSwitchServerById, ... }
        └── desktop-only: syncMenuState, exitApp, getPathMappings, resolveLocalPath, openLocalPath, revealLocalItem, getDownloadCompletionNotificationsEnabled, ...
```

The mobile adapter follows the same structure, implementing `MobileBridge` with the same shared helpers but different command name mappings and mobile-specific operations (e.g., global speed limits via `set_global_download_limit`/`set_global_upload_limit`).

## Integration

- **Upstream consumers**: `packages/web-core`, `packages/web-ui`, and `apps/*` import the appropriate adapter (desktop or mobile) to get a typed bridge object.
- **Transport dependency**: Both adapters depend on `../transport/tauriTransport` for `createTauriTransport()` default and on `../transport/transport` for the `Transport` type.
- **Shared bridge dependency**: Both import `createSessionHelpers`, `createServerHelpers`, `createQbClientHelpers`, `createSyncHelpers`, and `probeEndpoint` from `../sharedBridge`.
- **Contract compliance**: Desktop adapter implements `DesktopBridge`; mobile adapter implements `MobileBridge`. Both extend `SessionLifecycleBridge` at the root level.
- **Capabilities**: Each adapter attaches its platform's `BridgeCapabilities` constant (`DESKTOP_CAPABILITIES` / `MOBILE_CAPABILITIES`) as `bridge.capabilities`.
- **Singleton export**: Both files export a default `BridgeAdapter` singleton for convenience, but the factory functions are the preferred API for custom transport injection.
