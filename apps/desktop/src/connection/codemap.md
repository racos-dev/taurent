# apps/desktop/src/connection/

## Responsibility

Provides qBittorrent connection management for the desktop app. It wires the shared web-core session provider with desktop-specific bridge, event listeners, invalidation, and retry logic. This folder now contains only the desktop session adapter (sessionAdapter.ts); server management is handled directly via the BridgeAdapter.servers APIs (there is no serverAdapter.ts in this folder).

Key responsibilities:
- Surface a SessionBridge and SessionEventListeners to web-core's createSessionProvider
- Provide query invalidation hooks and retry configuration for reconnects
- Ensure desktop session ownership semantics are enforced (desktop windows use the session owned by the main process/Rust layer)

## Key Files

- **sessionAdapter.ts** — Thin platform adapter. Delegates to web-core's createSessionAdapter, supplying BridgeAdapter and listener factories. Exposes desktopSessionBridge, desktopSessionListeners, and useDesktopSessionOptions. Retry uses exponential backoff (baseDelayMs=0, delay = RETRY_DELAY_MS * 2^(attempt-1)).
- **QBClientProvider.tsx** — Provider that composes `createQBClientBootstrap` (from `@taurent/web-core/session`) with `BridgeAdapter` and `useDesktopSessionOptions`, then re-exports `useQBClient`, `useMaindataState`, `useMaindataSelector` via bootstrap destructuring. Keeps a single context instance.
- **ServerManager.tsx** — UI/provider for multi-server management. Note: server bridge functions are invoked via BridgeAdapter.servers directly rather than a local serverAdapter file.
- **index.ts** — Re-exports QBClientProvider, useQBClient, ServerManagerProvider, useServerManager.

## Design

- Session Provider Factory: consume web-core's createSessionProvider and supply desktop-specific options from useDesktopSessionOptions.
- Desktop Session Bridge: sessionAdapter.ts implements SessionBridge using BridgeAdapter.getSessionSnapshot, BridgeAdapter.sessionConnectById, and BridgeAdapter.sessionDisconnect.
- Event Listeners: sessionAdapter provides listener factories using BridgeAdapter event helpers (createSessionEventListener, createResourceInvalidatedListener).
- Query Invalidator: uses createDefaultInvalidator(queryClient) from web-core to invalidate query caches on session changes or resource invalidation events.
- Retry Logic: desktop implements exponential backoff retry in `performRetry` (baseDelayMs=0, delay = RETRY_DELAY_MS * 2^(attempt-1), calls `BridgeAdapter.sessionConnectById` after each delay).
- Capability Probing & Maindata Sync: QBClientProvider composes capability probes and maindata sync on top of the session provider (via BridgeAdapter.application.* and BridgeAdapter.qBClient.syncMaindata).
- Desktop Session Ownership (critical): the desktop app relies on the Rust/tauri side to own and manage the underlying QBittorrent session. Renderer code must not instantiate its own QBittorrent client or duplicate session lifecycle. Instead, it should use BridgeAdapter.getSessionSnapshot() and listen for session-changed/resource-invalidated events to stay in sync.

## Flow

1. sessionAdapter.ts exports desktopSessionBridge and desktopSessionListeners and a hook useDesktopSessionOptions(queryClient).
2. useDesktopSessionOptions(queryClient) returns the options object for createSessionProvider:
   - bridge: desktopSessionBridge
   - listeners: desktopSessionListeners
   - invalidator: createDefaultInvalidator(queryClient)
   - retryConfig: maxAttempts, baseDelayMs, performRetry (exponential backoff + BridgeAdapter.sessionConnectById)
3. QBClientProvider.tsx calls createSessionProvider with the desktop options to provide useQBClient() to the app.
4. Server management operations (list, add, select, remove, test) are performed via BridgeAdapter.servers.* from UI/server manager code — there is no local serverAdapter.ts proxy file in this directory anymore.
5. On connect/disconnect/resource invalidated events, listeners trigger the invalidator to refresh queries (torrents, preferences, categories, tags) and capability probes/maindata sync run as appropriate.

## Integration

- Uses BridgeAdapter from `@taurent/bridge/adapters/desktop` for all Tauri IPC surface (session lifecycle, servers APIs, application probes, qBClient sync).
- Uses web-core building blocks: createSessionProvider, createDefaultInvalidator, capability probes, and maindata sync helpers.
- Exposes and re-exports useQBClient()/QBClientProvider for app components.
- App.tsx (or the app root) should wrap the UI with QBClientProvider; ServerManagerProvider (if used) wraps QBClientProvider and interacts with BridgeAdapter.servers directly.
- Important: maintain the desktop session ownership pattern — renderer code must rely on the session snapshot/events from the BridgeAdapter and must not create or manage its own QBittorrentClient instances.
