# crates/qb-core/src/

## Responsibility

Source files for the `qb-core` crate. Contains all Rust modules that implement the qBittorrent Web API client, session lifecycle, error taxonomy, server domain types, typed DTO parsers, wire normalization, capability resolution, and Tauri-free sync primitives.

## Files

| File | Responsibility |
|---|---|---|
| `lib.rs` | Crate root. Declares `pub mod` for `capability`, `client`, `dto`, `error`, `normalize`, `server`, `session`, `sync`. Conditionally compiles `mod tests`. Re-exports: `BackendError`, `BackendResult`, all server DTOs (`ActiveServerSummary`, `AddServerInput`, `CredentialStatus`, `NormalizeServerUrlInput`, `NormalizeServerUrlOutput`, `ProbeServerSchemeResult`, `SavedServerSummary`, `ServerCredentialsInput`, `ServerRecord`, `ServerValidationResult`, `TestConnectionResult`, `UpdateServerInput`), all DTO types and parser functions (`parse_build_info`, `parse_categories`, `parse_preferences`, `parse_rss_items`, `parse_rss_rules`, `parse_search_plugins`, `parse_search_results`, `parse_search_start_id`, `parse_search_statuses`, `parse_sync_torrent_peers`, `parse_tags`, `parse_torrent_files`, `parse_torrent_list`, `parse_torrent_properties`, `parse_torrent_trackers`, `parse_transfer_info`, `parse_webseeds`), and all DTO types (`BuildInfoDto`, `PreferencesDto`, `PreferencesUpdateDto`, `RssItemDto`, `RssRuleDto`, `SearchPluginCategoryDto`, `SearchPluginDto`, `SearchResultDto`, `SearchResultsDto`, `SearchStatusDto`, `TorrentDto`, `TorrentFileDto`, `TorrentPropertiesDto`, `TrackerDto`, `TransferInfoDto`, `WebSeedDto`), `SafeServerSummary`, `ServerIdentity`, `SessionManager`, `SessionState`, `SessionStatus`. |
| `client.rs` | HTTP client layer. `normalize_server_url()` ensures scheme and trailing-slash normalization (strips `/api/v2` suffix). `validate_server_url_format()` validates URL scheme. `qb_auth_headers()` builds Cookie/Origin/Referer headers. `qbittorrent_login()` authenticates and returns `(Client, cookie)` with separate login/request timeouts. `qb_get()`, `qb_post_form()`, `qb_post_multipart()` are generic authenticated request helpers. `qb_probe()` returns `ProbeResponse { status_code, data }` without erroring on non-2xx. `qb_sync_maindata()` handles incremental sync with `rid` parameter, returns `(rid, Value)`. RSS helper functions wrap `/api/v2/rss/*` endpoints: `qb_get_rss_items()`, `qb_get_rss_rules()`, `qb_add_rss_feed()`, `qb_set_rss_feed_url()`, `qb_remove_rss_item()`, `qb_set_rss_rule()`, `qb_rename_rss_rule()`, `qb_remove_rss_rule()`. `is_network_error()` classifies error strings. |
| `dto.rs` | Typed DTO parsers for all qBittorrent Web API responses. **Category DTOs**: `CategoryDto`, `Categories` (BTreeMap), `parse_categories()`. **Torrent list**: `TorrentDto` (40+ fields with drift-tolerant `Option` fields for newer qB versions), `parse_torrent_list()`. **Torrent properties**: `TorrentPropertiesDto` (30+ fields, `is_private` optional), `parse_torrent_properties()`. **Trackers**: `TrackerDto`, `parse_torrent_trackers()`. **Files**: `TorrentFileDto` (with `piece_range: [i64; 2]`), `parse_torrent_files()`. **Tags**: `parse_tags()` (strict: rejects non-string entries). **Peer sync**: `SyncTorrentPeers`, `SyncTorrentPeersPeerData` (all fields optional for incremental deltas), `parse_sync_torrent_peers()`. **Web seeds**: `WebSeedDto`, `parse_webseeds()`. **Transfer info**: `TransferInfoDto` (core fields required, `free_space_on_disk` optional), `parse_transfer_info()`. **Build info**: `BuildInfoDto` (`zlib`/`platform` optional), `parse_build_info()`. **Search DTOs**: `SearchStatusDto`, `SearchResultDto`, `SearchResultsDto`, `SearchPluginCategoryDto`, `SearchPluginDto`, `parse_search_start_id()` (accepts 3 wire shapes), `parse_search_statuses()`, `parse_search_results()`, `parse_search_plugins()`. **RSS DTOs**: `RssItemDto` (keyed tree, array, legacy `{ feeds, folders }` shapes), `RssRuleDto` (keyed and wrapped-array shapes, camelCase/snake_case aliases), `parse_rss_items()`, `parse_rss_rules()`. **Maindata row DTOs**: `MaindataTorrentRow`, `MaindataCategoryRow`, `MaindataServerState` (all fields `Option<T>` with `#[serde(flatten)] unknown` catch-all for version drift), used by the accumulator. **Preferences**: `PreferencesDto` (~207 fields, `deserialize_loose_number` for v4/v5 compatibility), `PreferencesUpdateDto` (all `Option<T>`, `skip_serializing_if`), `parse_preferences()`. **Custom deserializers**: `deserialize_full_update()`, `deserialize_loose_number()`, `deserialize_loose_number_option()`, `deserialize_rss_loose_bool()`, `LooseNumberMapValue`. |
| `normalize.rs` | Wire-format normalization helpers. `join_tags`/`split_tags` (comma-joined), `join_categories`/`split_categories` (newline-joined), `build_add_torrent_options` — constructs multipart form fields with `\n`-joined URLs and `savepath` wire format. Supports `contentLayout`, `stopCondition`, `addToTop` fields. |
| `capability.rs` | Tri-state capability resolution. `CapabilityState` (`Confirmed`/`Unsupported`/`Unknown`, `#[serde(rename_all = "lowercase")]`), `ResolvedCapabilities` (`supports_search`, `supports_rss`, `supports_pause_resume`, `#[serde(rename_all = "snake_case")]`), `parse_version`, `api_version_meets`, `resolve_capabilities` (accepts probe results + version strings). |
| `error.rs` | `BackendError` enum with 6 variants: `Network`, `Http` (status + body_snippet), `Auth`, `Parse`, `InvalidResponse`, `Other`. Provides `From` impls for `reqwest::Error` (classifies timeout/connect as Network), `serde_json::Error` (Parse), `std::io::Error` (Network). Classification helpers: `is_network()`, `is_http()`, `is_auth()`, `is_parse()`, `is_http_403()`, `is_network_error()`. `Display` impl for logging. `BackendResult<T>` type alias. `is_network_error_message()` function for string-based network error detection. |
| `session.rs` | `SessionManager` — owns full session state including credentials. Fields: `state` (public `SessionState`), `server_identity` (credentials), `http_client`, `session_cookie`. Methods: `connect()`, `set_connecting()`, `disconnect()`, `reconnect()`, `switch_server()`, `set_error()`, `clear_error()`, `teardown()`, `refresh_session()`. Every mutation increments `session_generation`. `ServerIdentity` holds password (never serialized to frontend). `SafeServerSummary` is the password-free subset. `SessionStatus` enum: `Disconnected`, `Connecting`, `Connected`, `Error`. |
| `server.rs` | Domain DTOs for server management. `ServerRecord` (internal, password `#[serde(skip)]`), `SavedServerSummary` (renderer-safe, no password), `ActiveServerSummary`, `AddServerInput`, `UpdateServerInput` (partial update with `Option` fields), `ServerCredentialsInput`, `PathMapping`, `TestConnectionResult`. `CredentialStatus` enum: `Stored`, `SessionOnly`, `Missing`, `Unavailable`, `NotRequested`, `Unknown`. `NormalizeServerUrlInput`, `NormalizeServerUrlOutput` for URL normalization commands. `ProbeServerSchemeResult` for scheme detection. `ServerValidationResult` for URL validation. |
| `sync/` | Accumulator-based maindata sync primitives. `MaindataAccumulator` + `MaindataSnapshot` for full/incremental delta merge. `SyncDelta::parse` validates RID, container structure, removal/tag arrays, full_update normalization. `MaindataSyncHealth` state machine (`Idle`→`Healthy`↔`Degraded`→`Retrying`). `SyncHealthState` enum. Sub-module files: `mod.rs`, `accumulator.rs`, `health.rs`. |

## Design

- **Module isolation**: `client` handles HTTP mechanics, `session` handles lifecycle state, `server` handles server DTOs, `dto` handles typed response parsers, `error` handles the error taxonomy, `normalize` handles wire-format normalization, `capability` handles tri-state capability resolution, `sync` handles accumulator-based maindata sync. No circular dependencies.
- **Typed DTO boundary**: `dto.rs` enforces strict structural validation at the Rust boundary. All parsers return `BackendError::InvalidResponse` for structural violations and `BackendError::Parse` for JSON decode errors. Unknown fields are silently ignored via serde defaults. Drift-tolerant fields use `Option<T>`.
- **Maindata row DTOs**: `MaindataTorrentRow`, `MaindataCategoryRow`, `MaindataServerState` use all-`Option` fields with `#[serde(flatten)] unknown: BTreeMap<String, serde_json::Value>` catch-all for qBittorrent version drift. Tolerant deserialization via `try_deserialize_*` helpers falls back to raw `unknown` on failure.
- **RSS normalization in Rust**: RSS items/rules parsing moved from TypeScript to `dto.rs`. Handles 3 legacy item shapes (keyed tree, array, `{ feeds, folders }`) and 2 rule shapes (keyed, wrapped array). Metadata keys (`session_generation`, `server_id`) are skipped.
- **Preferences v4/v5 compatibility**: `PreferencesDto` uses `deserialize_loose_number` custom deserializer to handle type inconsistencies across qBittorrent versions (booleans vs numbers for enum fields).
- **`parse_response_bytes()`**: Tries JSON parsing first; falls back to raw UTF-8 string. Handles qBittorrent endpoints that return plain text (`"Ok."`).
- **Body snippet truncation**: `body_snippet()` truncates response bodies to 200 chars for error reporting without leaking large payloads.

## Flow

Request lifecycle in `client.rs`:
1. `normalize_server_url()` ensures consistent URL format.
2. `qb_auth_headers()` builds Cookie + Origin + Referer headers.
3. `qb_authenticated_request()` wraps a `reqwest::Client` request with those headers.
4. Response bytes are parsed via `parse_response_bytes()` into `serde_json::Value`.

Session lifecycle in `session.rs`:
1. `SessionManager::new()` → `Disconnected` with generation 0.
2. `set_connecting()` → stores identity, clears cookie/client, sets `Connecting`.
3. `connect()` → stores client/cookie, sets `Connected`, bumps generation.
4. `disconnect()` → clears cookie/client/server, sets `Disconnected`, bumps generation.
5. `reconnect()` → reuses stored identity, sets `Connecting`, bumps generation.
6. `refresh_session()` → replaces client/cookie **without** bumping generation (silent recovery).

## Integration

- Used exclusively by `qb-tauri` crate.
- `reqwest` is the sole HTTP runtime dependency.
- `serde`/`serde_json` for serialization of DTOs and API responses.
- `log` for structured logging (consumed by Tauri's logging plugin).
