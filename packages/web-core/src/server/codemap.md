# server

## Responsibility

Headless server manager controller for CRUD operations on saved qBittorrent servers. Manages server list, selection, addition, removal, editing, connection testing, and atomic server switching with cross-window synchronization.

## Key Files

- `index.ts` — Barrel export
- `controller.ts` — Main controller hook with full CRUD operations; defines `ServerBridgeInterface`, `toServer` converter, `SessionEventListenerFactory`; subscribes to `session-changed` to refresh server list on server switches (cross-window sync)
- `useTestServerConnection.ts` — Hook for testing server connections with loading/error state
- `ServerManagerContextType.ts` — `ServerManagerState` and `ServerManagerContextType` interface (extends state with CRUD + test/switch/refresh methods)

## Design Patterns

- **Bridge interface**: Uses `ServerBridgeInterface` for platform-agnostic operations (listServers, addServer, updateServer, removeServer, selectServer, testServerConnection, sessionSwitchServerById)
- **Saved server updates**: `updateServer` supports metadata updates and can pass a new password through to the bridge when the UI explicitly provides one. `updateServerCredentials` remains separately exposed only when bridge capabilities opt in.
- **Server mapping**: Converts bridge DTOs (`SavedServerSummary`) to safe types (`Server`) without passwords; preserves `currentServer` reference identity when ID unchanged to prevent spurious re-evaluations
- **Atomic server switch**: `switchServer` calls `sessionSwitchServerById` which commits new session only on success; on failure the previous session remains intact
- **Cross-window sync**: Controller subscribes to `session-changed` events via optional `createSessionEventListener` factory; refreshes server list so auxiliary windows stay in sync
- **Loading states**: All operations set loading state for UI feedback

## Flow

1. `useServerManagerController` loads servers on mount via `bridge.listServers()` + `bridge.getActiveServer()`
2. CRUD operations call bridge methods, update local state, and preserve reference identity
3. `switchServer` calls atomic `sessionSwitchServerById` then refreshes list
4. `session-changed` events trigger server list refresh for cross-window sync
5. `useTestServerConnection` manages test connection state independently

## Integration

- Imports types from `@taurent/shared` (Server) and `@taurent/bridge` (SavedServerSummary, TestConnectionResult, BridgeCapabilities)
- Used by desktop/mobile for server management UI (settings, login screens)
- Exported to `session/createServerManagerProvider` for provider creation
- `ServerManagerContextType` is the context shape consumed by app shells
