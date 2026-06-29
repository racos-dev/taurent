# login

## Responsibility

Headless controller for LoginScreen orchestration. Manages server selection, server deletion with confirm dialog, and connection status derivation.

## Key Files

- `useLoginScreenController.ts` — Main controller hook with server selection, delete flow, and status derivation

## Design Patterns

- **Server selection**: `handleSelectServer` calls `connect(server.id)` with success/error callbacks
- **Delete flow**: `handleDeleteServer` opens confirm dialog; `confirmDelete` executes removal; `deletingServerId` tracks in-flight deletion
- **Status derivation**: `getServerStatus(server)` returns 'disconnected' | 'connecting' | 'connected' based on `isConnecting` and `connectedServerId`
- **Error categorization**: Optional `classifyError` callback categorizes connection errors for platform-specific handling

## Flow

1. App route mounts controller with injected connect/removeServer/servers
2. User taps server → `handleSelectServer` calls connect
3. On success → `onConnectSuccess()` callback (navigate to home)
4. On failure → `onConnectError(message, category)` callback (navigate to login with error state)
5. User long-presses server → `handleDeleteServer` opens confirm dialog
6. User confirms → `confirmDelete` removes server

## Integration

- Imports `Server` from `@taurent/shared/types/server`
- Imports `getErrorMessage`, `ErrorCategory` from `@taurent/shared/utils/error`
- Used by desktop/mobile LoginScreen routes
- Consumes injected `connect`, `removeServer`, `isConnecting`, `connectedServerId` from session/server contexts
