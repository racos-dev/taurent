# apps/mobile/src/connection/

## Responsibility

Manages qBittorrent server connections, session lifecycle, and server list persistence. Provides two Context providers:

- `QBClientProvider` — Active session lifecycle (connect, disconnect, maindata sync, capability probes, retry).
- `ServerManagerProvider` — Server CRUD (add, update, remove, test, switch) and selection.

This directory is the mobile platform adapter layer that maps Tauri `BridgeAdapter` commands to the generic server/session bridge interfaces expected by web-core provider factories.

## Key Files

- **QBClientProvider.tsx** — Instantiates `createQBClientBootstrap` from `@taurent/web-core/session` with the mobile `BridgeAdapter`, `maindataBackendBridge` (BridgeAdapter.qBClient), and `useMobileSessionOptions`. Exports `QBClientProvider`, `useQBClient`, and `useMaindataState`.
- **ServerManager.tsx** — Instantiates `createServerManagerBindings` from `@taurent/web-core` with `BridgeAdapter.servers` and `BridgeAdapter.capabilities`. Exports `ServerManagerProvider` (thin wrapper) and `useServerManager`.
- **sessionAdapter.ts** — Instantiates `createSessionAdapter` from `@taurent/web-core/session` with `BridgeAdapter`, Tauri listener factories (`createSessionEventListener`, `createResourceInvalidatedListener`), and retry config. Exports `mobileSessionBridge`, `mobileSessionListeners`, and `useMobileSessionOptions`.
- **index.ts** — Barrel re-export for `QBClientProvider`, `useQBClient`, `useMaindataState`, `ServerManagerProvider`, `useServerManager`.

## Design

- **Provider Factory Pattern**: Both providers use web-core factory functions (`createQBClientBootstrap`, `createServerManagerBindings`) that accept mobile-specific configuration and return pre-wired provider + hook pairs. This keeps mobile glue minimal.
- **Session Adapter**: `sessionAdapter.ts` delegates to `createSessionAdapter` from web-core, supplying the bridge adapter, Tauri event listener factories, and retry configuration. Mobile uses fixed-delay retry (no exponential backoff) via `BridgeAdapter.sessionConnectById`.
- **QueryScope**: Both providers derive `{ serverId, sessionGeneration, isConnected }` from the session state. These three values scope React Query caches so that switching servers or sessions automatically invalidates stale data.
- **Re-export Surface**: `index.ts` re-exports the public API so consumers (`hooks/`, `screens/`, `auth/`) import from a single path.

## Flow

1. App.tsx mounts `ServerManagerProvider` then `QBClientProvider` (outer → inner).
2. `ServerManagerProvider` initializes by listing saved servers from `BridgeAdapter.servers.listServers()` and determining the active server.
3. `QBClientProvider` reads the session snapshot from `BridgeAdapter.getSessionSnapshot()`, establishes or resumes a connection, and starts maindata sync via the backend bridge.
4. When connected, the provider probes capabilities (`probeSearch`, `probeRss`), queries version/build info, and starts maindata sync via `BridgeAdapter.qBClient` (backend-owned sync path).
5. Session events (`SessionChanged`, `ResourceInvalidated`) and maindata sync events are received via Tauri listeners and dispatched to web-core invalidation helpers, which invalidate React Query caches.
6. On disconnect or error, retry logic calls `BridgeAdapter.sessionConnectById()` with fixed-delay attempts up to `MAX_RETRY_ATTEMPTS`.

## Integration

- **@taurent/bridge/adapters/mobile-tauri** — `BridgeAdapter` for all Tauri commands (session, servers, torrents, transfer, application).
- **@taurent/bridge/transport/tauri** — `createSessionEventListener`, `createResourceInvalidatedListener` for Tauri event subscriptions.
- **@taurent/bridge/types** — `MAX_RETRY_ATTEMPTS`, `RETRY_DELAY_MS` constants.
- **@taurent/web-core/session** — `createQBClientBootstrap` factory.
- **@taurent/web-core/session** — `createSessionAdapter` factory.
- **@taurent/web-core** — `createServerManagerBindings` factory, invalidation helpers.
