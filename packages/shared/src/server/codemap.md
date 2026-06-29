# packages/shared/src/server/

## Responsibility

Platform-agnostic server management domain layer for qBittorrent. Contains types, validation, and server ID generation utilities. This module is UI-agnostic with no platform-specific imports; both mobile and desktop providers import from here while keeping platform-specific storage (SecureStore, Tauri Store) separate.

## Key Files

- `serverTypes.ts` — Domain types and data builders:
  - `AddServerInput` — input payload for creating a server (name, url, username, password).
  - `UpdateServerInput` — partial update payload (all fields optional).
  - `ServerData` — full server data including auto-generated fields (id, isAuthenticated, lastConnected).
  - `StoredCredentials` — credential pair from storage.
  - `buildNewServer(input, id)` — converts `AddServerInput` + generated id into `ServerData`.
  - `buildServerUpdate(current, updates)` — creates partial update payload with `lastConnected` logic and string trimming.
  - `hasCredentials(server)` — checks if username is present.
  - `CREDENTIAL_KEYS` — key generators for credential storage (`${serverId}_username`, `${serverId}_password`).
  - `SERVERS_LIST_KEY`, `CURRENT_SERVER_KEY` — shared storage keys.

- `validation.ts` — Business-rule validators:
  - `validateServerName`, `validateServerUrl`, `validateUsername`, `validatePassword` — individual field validators returning `string | undefined` (error message or undefined for valid).
  - `validateServerFields(name, url, username, password)` — validates all fields, returns `ValidationResult` with `valid` boolean and `errors` object.
  - `hasValidationErrors`, `getFirstError` — result inspection helpers.
  - `serverFieldValidators` — composable validators object.

- `serverId.ts` — ID generation:
  - `generateServerId()` — format: `server_{timestamp}_{9-char random}`.
  - `isValidServerId(id)` — regex validation against format.
  - `extractServerIdTimestamp(id)` — extracts timestamp portion.

- `index.ts` — Barrel export for all server utilities.

## Design

- **Domain model separation**: Types independent of platform-specific storage.
- **Validation-first**: All server inputs validated before storage operations.
- **Immutable data builders**: `buildNewServer` and `buildServerUpdate` return new objects without side-effects.
- **Server ID format**: `server_{timestamp}_{random}` for unique, time-ordered identification.

## Integration

- Exported from `packages/shared/src/index.ts` indirectly (via `src/index.ts` not directly re-exporting server/, but consumed by apps).
- Used by desktop and mobile server providers for server CRUD operations.
- Imports `Server` type from `../types/server`.
- NOT for storage (platform-specific) or HTTP clients (platform-specific).
