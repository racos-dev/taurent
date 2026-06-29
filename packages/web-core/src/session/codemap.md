# session

## Responsibility

Headless session layer for qBittorrent connection lifecycle. Owns the session state machine, bridge/listener adapters, context factories, bootstrap, auth boundary, and resource invalidation. This package replaces the old `connection/` layer.

## Key Files

- `index.ts` — Barrel export
- `sessionController.ts` — Core state machine: connect (with module-scope in-flight deduplication across StrictMode remounts), disconnect, retry (with platform-specific performRetry), session-changed handling, visibility recovery health check, post-hydration health check for restored connected sessions; background retry interval (30s) after max attempts exhausted; HMR disposal guard clears stale in-flight connect
- `useSessionBootstrap.ts` — Headless hook for auth route decision logic and initial session hydration; uses settling mechanism to prevent flash loops
- `createSessionProvider.tsx` — Factory for creating platform-specific session providers
- `createServerManagerProvider.tsx` — Factory for creating server manager provider
- `resourceInvalidation.ts` — Translates resource-invalidated events into scoped query invalidations; also handles `invalidateOnConnect` for all resource types
- `QBClientContextValue.ts` — Context value type definition (connect, disconnect, retry, isConnected, isHydrated, serverId, capabilities, etc.)
- `useStandardContextValue.ts` — Standard context value hook that wires capability discovery (including Rust-resolved capabilities via `getServerCapabilities`), server metadata (auto-derived from bridge session snapshot), and session controller into QBClientContextValue
- `createQBClientContext.ts` — Factory for QBClient React context + useQBClient hook
- `createQBClientBootstrap.tsx` — Factory combining context, session provider, maindata sync provider, and standard context value into QBClientProvider + useQBClient hook; composes `InternalSessionProvider` → `MaindataSyncProvider` provider tree
- `createServerManagerContext.ts` — Factory for server manager React context
- `createServerManagerContextValue.ts` — Factory for server manager context value
- `createServerManagerBindings.tsx` — Higher-level bindings factory composing context + provider + context value + optional platform extension
- `createSessionBridge.ts` — Factory for `SessionBridge` + `SessionEventListener` implementations from platform adapters
- `createSessionAdapter.ts` — Combines bridge, listeners, invalidator, and retry config into session provider options
- `createAuthBoundary.tsx` — Session-aware auth boundary used by app shells

## Design Patterns

- **Platform injection**: Accepts `SessionBridge`, `SessionEventListener`, and invalidator/retry dependencies; never imports Tauri directly
- **Event-driven state**: Uses `session-changed` and related session events to drive state, not polling
- **Query scope invalidation**: Session generation changes propagate through invalidation so server-backed caches reset on reconnect
- **Provider factory pattern**: Desktop/mobile create providers by injecting their specific implementations once
- **Bootstrap factory**: `createQBClientBootstrap` produces the fully wired provider tree (QBClientProvider + MaindataSyncProvider) from bridge/session dependencies
- **Adapter factory**: `createSessionAdapter` packages bridge/listener/invalidation/retry setup for `createSessionProvider`
- **Context bridge**: Session context feeds query-scoped hooks; feature controllers read scoped data through the context
- **In-flight connect deduplication**: Module-scope `_inflightConnect` entry survives StrictMode unmount/remount so a second `connect()` call returns the same promise
- **Listener-first snapshot**: Event listeners are registered BEFORE fetching the session snapshot to prevent missed events
- **Post-hydration health check**: After snapshot hydration, fires silent `sessionHealthCheck()` probe
- **Background retry interval**: After max retry attempts exhausted, retries every 30s until connection restores
- **Visibility recovery**: Listens to `visibilitychange` and probes `sessionHealthCheck()` when tab becomes visible

## Flow

1. App shell creates `QBClientProvider` via `createQBClientBootstrap`
2. `useStandardContextValue` runs capability probes and fetches server metadata
3. `sessionController` registers event listeners, fetches snapshot, reconciles state
4. `connect(serverId)` calls bridge, waits for `session-changed` event to confirm
5. `resourceInvalidation` handles `resource-invalidated` events by invalidating scoped queries
6. `useSessionBootstrap` drives route decisions based on hydration/connection state

## Integration

- Exports `SessionController` interface used by provider factories and bootstrap helpers
- Uses types from `@taurent/bridge` (SessionSnapshot, SessionStatus, events)
- Depends on `query/invalidation` for cache management
- Used by desktop/mobile to create `QBClientProvider`, `ServerManagerProvider`, and auth/session boundaries
