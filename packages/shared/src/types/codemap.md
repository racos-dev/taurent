# packages/shared/src/types/

## Responsibility

Canonical TypeScript type-level contracts for the qBittorrent integration and local application state used across the workspace. Contains:

- Protocol DTOs that mirror qBittorrent Web API responses (payload shapes consumed from the daemon).
- Local domain types describing application-managed entities (Server, authentication state, manager context types).
- Strongly-typed discriminants and enums used to represent API constants and state machines.

These types are authoritative for serialisation/deserialisation boundaries and for compile-time guarantees in stores, adapters, and UI components.

## Key Files

- `qbittorrent.ts` — API DTOs and enums (594 lines):
  - **Core DTOs**: `Torrent` (39 fields), `Preferences` (150+ fields), `TorrentProperties`, `Tracker`, `WebSeed`, `TorrentFile`, `Category`, `TransferInfo`, `BuildInfo`, `SearchResult`, `SearchStatus`, `SearchPlugin`, `RSSItem`, `RSSRule`, `Cookie`.
  - **Enums**: `TrackerStatus` (Disabled/NotContacted/Working/Updating/NotWorking), `FilePriority` (DoNotDownload/Normal/High/Maximal), `PieceState`, `TorrentConnectionStatus` (Connected/Firewalled/Disconnected), `TorrentState` (19 states from Error to Unknown).
  - **Sync payloads**: `SyncMainData` — incremental delta with `rid`, `full_update`, optional maps (`torrents`, `categories`, `tags`) and removal arrays (`torrents_removed`, `categories_removed`, `tags_removed`), plus `server_state`. `SyncTorrentPeers` — peer delta with partial peer data. `SyncTorrentPeersPeerData` — all fields optional for incremental deltas.
  - **Accumulated state**: `MaindataState` — merged result of applying all deltas on top of initial snapshot (fully populated maps, not partial). `SyncServerState` — server state with optional extended statistics.

- `server.ts` — Server domain and manager context types (66 lines):
  - `Server` — persisted server descriptor (id, name, url, username, isAuthenticated, lastConnected, credentialStatus, credentialWarning).
  - `CredentialStatus` — union: `stored | session_only | missing | unavailable | not_requested | unknown`.
  - `TestConnectionResult` — `{ success: boolean; error?: string }`.
  - `ServerManagerState` — `{ servers, currentServer, loading, error }`.
  - `ServerManagerContextType` — state + async CRUD APIs: `addServer`, `removeServer`, `updateServer`, `updateServerCredentials`, `testServerConnection`, `testSavedServerConnection`, `refreshServers`, `switchServer`.

- `auth.ts` — Authentication primitives (18 lines):
  - `LoginCredentials` — credentials input DTO (username, password, optional baseUrl).
  - `AuthState` — canonical UI/auth store shape (isAuthenticated, user, loading, error).
  - `AuthContextType` — extends `AuthState` with imperative async operations (`login`, `logout`, `refreshAuth`).


## Design

- **API-first DTOs**: Types in `qbittorrent.ts` match qBittorrent Web API responses exactly for deserialization targeting.
- **Record<> maps for keyed payloads**: `SyncMainData` uses `Record<string, T>` for server-sent maps keyed by torrent hash, matching incremental sync semantics.
- **Partial delta types**: All fields in `SyncMainData`, `SyncTorrentPeers`, and `SyncTorrentPeersPeerData` are optional because deltas only include changed fields.
- **Enums as discriminants**: Fixed API values use string/number enums for type-safe switching.
- **Async context shape**: Context types follow React-context-friendly pattern of state + async actions returning Promises.

## Flow

1. Network layer fetches JSON from the qBittorrent Web API and deserializes into these DTOs.
2. Sync endpoints produce `SyncMainData`/`SyncTorrentPeers` payloads with maps and delta arrays.
3. `mergeMaindata` (in `utils/maindata.ts`) reconciles deltas into `MaindataState` by key.
4. Stores expose typed state mirroring these interfaces; context types provide imperative APIs.
5. UI components import these types for prop typing and enum-backed logic.

## Integration

- **Stores**: `ServerManagerContextType` and `AuthContextType` consumed by server/auth stores and providers.
- **Network/adapter layer**: DTOs are target types for API clients and mapping layers.
- **Schemas and validation**: Types are source-of-truth for Zod schemas in `../schemas/` — maintain parity between Zod schemas and TypeScript interfaces.
- **Cross-package usage**: Distributed from `@taurent/shared` and imported by desktop/mobile app packages.
- **Developer notes**: Prefer adding optional fields over removing for backwards compatibility. Use `Record<string, T>` only when upstream API returns map-like objects.
