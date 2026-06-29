# packages/bridge/

## Responsibility

Runtime abstraction layer exposing a unified TypeScript bridge API for platform code (desktop/mobile) to reach qBittorrent through Tauri. The only package in the workspace allowed to import `@tauri-apps/*`.

Split into three architectural layers:
- **contracts/** — pure types, capabilities, and bridge interfaces
- **transport/** — platform-agnostic invoke/listen contract plus the Tauri transport implementation
- **adapters/** — desktop and mobile Tauri bridge factories that map domain methods onto transport calls

## Source Structure

```
packages/bridge/src/
├── index.ts                    # Runtime-agnostic root barrel (no Tauri deps)
├── types.ts                    # DTOs, probe types, retry constants, SyncMainData, sync health, RSS/search/capability DTOs
├── events.ts                   # Normalized events (SessionChanged, ResourceInvalidated, OperationFailed, ThemeChanged, MaindataSyncChanged)
├── platform.ts                 # Platform abstraction types
├── web.ts                      # Web placeholder (throws if used)
├── sharedBridge.ts             # Shared helper factories (createSessionHelpers, createServerHelpers, createQbClientHelpers, createSyncHelpers, generic invoke factories)
├── logging.ts                  # setupTauriLogging() via @tauri-apps/plugin-log
├── operationNotifications.ts   # Runtime-agnostic operation-failed notification registration
├── desktop.ts                  # Re-export: adapters/desktop
├── mobile-tauri.ts             # Re-export: adapters/mobile-tauri
├── contracts/
│   ├── interfaces.ts           # Canonical method surfaces (SessionLifecycleBridge, DesktopBridge, MobileBridge, QBClientBridge, sub-bridges) + ResolveResult, ServerUrlProbeBridge, NativeMenuState, NativeUiAction
│   ├── capabilities.ts         # BridgeCapabilities, DESKTOP_CAPABILITIES, MOBILE_CAPABILITIES
│   └── index.ts                # Barrel re-export
├── transport/
│   ├── transport.ts            # Transport interface (invoke + listen) + factory helpers
│   ├── tauriTransport.ts       # createTauriTransport: @tauri-apps/api invoke/listen wiring + event helpers + maindata-sync-changed listener
│   ├── tauri.ts                # Convenience re-export barrel
│   └── index.ts                # Re-exports
├── adapters/
│   ├── desktop.ts              # createDesktopBridge: DesktopBridge factory (direct invoke calls, shared helper composition)
│   ├── mobile-tauri.ts         # createMobileTauriBridge: MobileBridge factory (unprefixed commands, full torrent parity with desktop)
│   └── index.ts                # Re-exports
└── desktop/
    └── notification.ts         # Desktop notification helper via @tauri-apps/plugin-notification
```

## Design Patterns

- **Transport abstraction**: `transport/transport.ts` defines the minimal `Transport` interface (`invoke` + `listen`). `transport/tauriTransport.ts` is the only runtime implementation; `@tauri-apps/api` usage is confined here.
- **Factory + adapter**: `adapters/desktop.ts` and `adapters/mobile-tauri.ts` export bridge factories returning `DesktopBridge`/`MobileBridge`. They compose sub-bridges (torrents, transfer, servers, application, qBClient) as thin wrappers over `transport.invoke`.
- **Shared helper factories** (`sharedBridge.ts`): `createSessionHelpers`, `createServerHelpers`, `createQbClientHelpers`, and `createSyncHelpers` are used by both adapters. `probeEndpoint` normalizes try/catch → tri-state `ProbeResult`. `makeInvoke`/`makeInvokeNoArgs` provide generic invoke wrappers for shared helper composition.
- **Session lifecycle at root**: Both `DesktopBridge` and `MobileBridge` extend `SessionLifecycleBridge` — session methods live at the root of the bridge object, not under a nested `session` property.
- **Canonical vs compatibility**: Desktop uses direct `transport.invoke` calls (previously `cmd_*` prefixed, now unified unprefixed names); mobile uses unprefixed names. Both map to the same Tauri command names.
- **Capability flags**: `BridgeCapabilities` exposed as `bridge.capabilities` on both adapters.
- **Probe tri-state**: `probeSearch()`/`probeRss()` return `{ supported: boolean | null, error?: string }` where `null` = probe failure, `true`/`false` = explicit support detection.
- **Rust-owned sync lifecycle**: `createSyncHelpers` wraps maindata snapshot/status/start/stop commands and provides a synchronous-unsubscribe event listener (`addMaindataSyncListener`) that handles async registration races safely.
- **Operation notification registration**: `operationNotifications.ts` provides runtime-agnostic `registerOperationFailedNotifier`/`onOperationFailed` for subscribing to `OperationFailedEvent` without platform coupling.

## Flow

1. Consumer imports `createDesktopBridge` or `createMobileTauriBridge`.
2. Factory assembles a `Transport` (default: `createTauriTransport()`), creates shared helpers (`createSessionHelpers`, `createServerHelpers`, `createQbClientHelpers`, `createSyncHelpers`), and returns bridge object.
3. Consumer calls bridge method (e.g., `bridge.torrents.getList(params)`).
4. Adapter calls `transport.invoke<T>(cmd, args)` directly or via shared helpers.
5. `createTauriTransport.invoke` delegates to `@tauri-apps/api/core.invoke` via `tauriInvoke`/`invokeWrap`.
6. Response is typed via DTOs from `types.ts`.
7. Events are exposed via `createSessionEventListener`, `createResourceInvalidatedListener`, `createMaindataSyncChangedListener`, etc.
8. Maindata sync changes flow through `maindata-sync-changed` events → `addMaindataSyncListener` → consumer callback.

## Integration

- **Exports**: Root barrel (`src/index.ts`) re-exports contracts, types, events, transport contract, platform types, web placeholder helpers, and operation notification registration only. Platform-specific entrypoints: `@taurent/bridge/adapters/desktop` and `@taurent/bridge/adapters/mobile-tauri`.
- **Depends on**: `@taurent/shared` (types only — `ThemePalette`, `ThemeVariant`, qBittorrent types), `@tauri-apps/api`, `@tauri-apps/plugin-log`, `@tauri-apps/plugin-notification`, `@tauri-apps/plugin-shell`.
- **Consumed by**: `apps/desktop`, `apps/mobile`, `@taurent/web-core` (types and runtime-agnostic helpers only).

## Key Interfaces

- `SessionLifecycleBridge` — root-level session/lifecycle contract (connect, disconnect, getSessionSnapshot, sessionHealthCheck)
- `DesktopBridge` — extends `SessionLifecycleBridge` with `capabilities`, `torrents`, `transfer`, `categories`, `tags`, `application`, `qBClient`, `servers`, `syncMenuState`, `exitApp`, `getPendingNativeUiActions`, `getPathMappings`/`setPathMappings`, `resolveLocalPath`, `openLocalPath`/`revealLocalItem`, download completion notifications
- `MobileBridge` — extends `SessionLifecycleBridge` with `capabilities`, `torrents` (full parity with desktop), `transfer`, `categories`, `tags`, `application`, `servers` (with `normalizeServerUrl`/`probeServerScheme`), `qBClient` (with `request` for raw qB API)
- `NativeMenuState` — macOS menu state (`can_*`, `view_*`, `in_window_menubar`, tray fields)
- `NativeUiAction` — serializable UI-open actions (`'settings' | 'about' | 'add-torrent' | { type: 'nav'; route: 'search' | 'rss' } | { type: 'add-torrent-source'; source: 'file' | 'link' } | { type: 'set-global-speed-limits' }`)
- `ResolveResult` — union type for server-to-local path resolution (`{ kind: 'resolved'; localPath } | { kind: 'unmapped'; serverPath }`)

## Recommended Read Order

1. `src/contracts/interfaces.ts` — canonical contract surface
2. `src/transport/transport.ts` — transport abstraction
3. `src/transport/tauriTransport.ts` — Tauri invoke/listen wiring
4. `src/sharedBridge.ts` — shared helper factories (session, server, qbClient, sync)
5. `src/adapters/desktop.ts` and `src/adapters/mobile-tauri.ts` — concrete adapters
6. `src/types.ts` — DTOs, probe types, sync health, RSS/search/capability DTOs
7. `src/contracts/capabilities.ts` — capability flags
