# packages/bridge/src/contracts/

## Responsibility

Pure type-level contracts that define the bridge API surface. Contains no runtime logic or platform dependencies — only TypeScript interfaces, type aliases, and static capability constants. These contracts serve as the authoritative specification for what any bridge implementation (desktop, mobile, future web) must provide.

## Files

- **interfaces.ts** — Complete bridge interface hierarchy. Defines the shape of `DesktopBridge`, `MobileBridge`, and all their sub-domain interfaces. Also exports `ResolveResult` union type and `ServerUrlProbeBridge` interface.
- **capabilities.ts** — `BridgeCapabilities` interface and platform-specific constants (`DESKTOP_CAPABILITIES`, `MOBILE_CAPABILITIES`).
- **index.ts** — Barrel re-export of interfaces and capabilities.

## Design

### Interface Hierarchy

```
SessionLifecycleBridge                    ← root-level session methods (both platforms)
  ├── DesktopBridge                       ← full desktop surface (path mappings, resolve/open/reveal local, notifications)
  └── MobileBridge                        ← full mobile surface (full torrent parity, server URL probing)

TorrentBridgeBase                         ← shared torrent CRUD (both platforms)
  ├── DesktopTorrentBridge                ← desktop: priority, tags, limits, file ops, export, auto-management, share limits, sequential download, super seeding
  └── MobileTorrentBridge                 ← mobile: full parity with desktop (priority, tags, limits, file ops, export, auto-management, share limits, sequential download, super seeding)

TransferBridge                            ← global transfer limits, speed mode, cookies (shared)
CategoriesBridge                          ← category CRUD (shared)
TagsBridge                                ← tag CRUD + torrent tagging (shared)
PreferencesBridge                         ← preferences get/set (standalone, shared)
ApplicationBridge                         ← desktop app info, preferences, probes, shutdown, capabilities
MobileApplicationBridge                   ← mobile app info, preferences, probes, shutdown, capabilities
QBClientBridge                            ← maindata sync lifecycle, RSS, search, logout
ServerBridge                              ← server CRUD, connection testing, credential management, URL normalization, scheme probing
ServerUrlProbeBridge                      ← server URL normalization + scheme probing (used by add-server flows)
NativeMenuState                           ← macOS native menu enabled/checked state + tray fields
NativeUiAction                            ← serializable UI-open actions (settings, about, add-torrent, nav, add-torrent-source, set-global-speed-limits)
BridgeCapabilities                        ← feature flags (supportsCredentialsUpdate)
ResolveResult                             ← union type for server-to-local path resolution
```

### Key Design Decisions

- **Root-level session lifecycle**: `DesktopBridge` and `MobileBridge` both extend `SessionLifecycleBridge` at the root level (not nested under `session`). This reflects the desktop session-ownership pattern where auxiliary windows inherit session state.
- **Base + extended torrent interfaces**: `TorrentBridgeBase` contains operations shared by both platforms. `DesktopTorrentBridge` and `MobileTorrentBridge` extend it with identical sets of platform-specific additions (auto-management, share limits, sequential download, super seeding, export).
- **Platform-specific application bridges**: `ApplicationBridge` (desktop) and `MobileApplicationBridge` (mobile) now have the same method set (both include `getPreferences`/`setPreferences`). Shared consumers should prefer `application.*` namespace to stay desktop-aligned.
- **Capability flags**: `BridgeCapabilities` enables consumer-side feature gating without platform detection. Currently only `supportsCredentialsUpdate` (true on desktop, false on mobile).
- **ServerBridge expanded**: Both platforms expose `sessionSwitchServerById`, `normalizeServerUrl`, and `probeServerScheme` on the server namespace for add-server flows.
- **NativeMenuState**: macOS-specific menu state with `can_*` fields (enabled/disabled) and `view_*` fields (checked state for toggle items). Includes `in_window_menubar` and tray fields (`tray_alt_speed_active`, `tray_connected`).
- **NativeUiAction**: Discriminated union for serializable actions that can queue while the main window is absent. Includes `add-torrent-source` (file vs link) and `set-global-speed-limits` for tray-initiated flows.
- **Desktop-only methods**: `DesktopBridge` uniquely exposes `getPathMappings`/`setPathMappings`, `resolveLocalPath`, `openLocalPath`/`revealLocalItem`, `syncMenuState`, `exitApp`, `getPendingNativeUiActions`/`getPendingViewActions`, and download completion notification settings.

## Flow

Contracts are purely consumed — they define the shape that adapters implement and consumers program against. No control flow exists within this directory.

```
types.ts (DTOs)
  ↓ imported by
interfaces.ts (bridge method signatures using DTOs)
  ↓ imported by
adapters/desktop.ts  → implements DesktopBridge
adapters/mobile-tauri.ts → implements MobileBridge
  ↓ consumed by
packages/web-core, packages/web-ui, apps/* (type-safe bridge access)
```

## Integration

- **Adapters**: `adapters/desktop.ts` imports `DesktopBridge`, `NativeMenuState`, `NativeUiAction`, `ResolveResult`; `adapters/mobile-tauri.ts` imports `MobileBridge`. Both import `BridgeCapabilities` from `capabilities.ts`.
- **Shared consumers**: `packages/web-core` and `packages/web-ui` depend on these interfaces for type-safe bridge access. They never import Tauri-specific code.
- **Bridge root**: `packages/bridge/src/index.ts` re-exports `capabilities` and `interfaces` from the root entry, making them available to all consumers via `@taurent/bridge`.
- **Type dependencies**: Interfaces reference DTOs from `../types` (SessionSnapshot, OperationResponse, TorrentListResponse, MaindataSnapshotResponse, SearchStatus, SearchResults, SearchPlugin, etc.) and capability types from `./capabilities`.
