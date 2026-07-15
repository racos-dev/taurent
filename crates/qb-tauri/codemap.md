# crates/qb-tauri/

## Responsibility

Tauri integration crate that bridges `qb-core` to the Tauri runtime. Provides:

- **Tauri commands** (`commands/` module) organized by domain (app, categories, preferences, servers, session, sync, tags, torrents, transfer).
- **Managed state** (`SessionStateHandle`, `ServerRepoStateHandle`) shared across commands.
- **Server repository** with OS-backed secure credential storage (macOS Keychain / cross-platform `tauri-plugin-secure-storage`).
- **App builder helpers** for initializing platform-specific Tauri plugins.
- **Session event emission** (`session-changed`, `resource-invalidated`, etc.) to notify the renderer of state changes.
- **Live sync manager** — background Tokio actors that poll `/api/v2/sync/maindata`, accumulate deltas, and emit `maindata-sync-changed` events with optional embedded deltas.

## Design

**Module map**:

| Module | Role |
|---|---|---|
| `lib.rs` | Crate root. Declares public modules: `app_builder`, `client`, `commands`, `server_repo`, `session`, `sync`. |
| `app_builder.rs` | `add_shared_plugins()`, `add_desktop_plugins()`, `add_mobile_plugins()` — composable plugin initialization for `tauri::Builder`. Defines fixed-size window deny-list for `tauri_plugin_window_state`. Platform-conditional compilation via `#[cfg(feature = "desktop")]` / `#[cfg(feature = "mobile")]`. |
| `client.rs` | Tauri-aware request helpers wrapping `qb-core` HTTP functions. `SessionRequestContext` extracts client, URL, cookie, generation, server_id, supports_pause_resume. `capture_request_context()` / `capture_request_context_from_handle()` variants. `qb_get()`, `qb_post()`, `qb_post_multipart()`, `qb_probe()` add structured logging and error description. `qb_sync_maindata()` / `qb_sync_maindata_with_request()` implement **stale-cookie recovery**: on HTTP 403, re-authenticates using stored server credentials, validates generation, retries with `rid=None`. RSS wrappers for all `/api/v2/rss/*` endpoints. `describe_backend_error()` for human-readable error messages. |
| `session.rs` | `SessionStateHandle = Arc<Mutex<SessionManager>>`. Commands: `session_connect`, `session_connect_by_id`, `session_switch_server_by_id`, `session_disconnect`, `session_reconnect`, `session_health_check`, `session_switch_server`, `session_set_error`, `session_clear_error`, `session_teardown`, `session_set_connecting`, `get_session_state`, `get_session_status`, `get_session_generation`, `get_session_snapshot`, `bootstrap_session`, `get_bootstrap_contract`. Emits `session-changed` events via `app.emit()`. `load_app_version()` probes `/api/v2/app/version` post-login and returns the raw app version string — failure aborts connect. `load_resolved_capabilities()` probes `/api/v2/app/webapiVersion` and delegates to `QbResolver::resolve(webapi_version, app_version)` to resolve webapi-version-keyed and app-version-keyed caps (including `supports_pause_resume` from `[app_versions]`) from the TOML. Defines `SessionSnapshot`, `SessionChangedEvent`, `ActiveServerChangedEvent`, `ResourceInvalidatedEvent`, `OperationFailedEvent`, `BootstrapContract` types. |
| `server_repo.rs` | `ServerRepositoryState` — in-memory server metadata map + transient passwords + `tauri-plugin-store` persistence. Passwords stored in macOS Keychain (via `security-framework`) or `tauri-plugin-secure-storage`. Operations: `init_repository()`, `add_server()`, `update_server()`, `remove_server()`, `select_server()`, `select_server_and_persist()`, `list_servers()`, `get_active_server()`, `get_server_password()`, `test_connection_raw()`, `test_saved_server()`. URL normalization on add/update. `CredentialStatus` computed from keychain + transient map. |
| `error.rs` | `CommandError` enum (Backend, SessionNotConnected, RequestFailed, JsonError, IoError). `From<BackendError>` and `From<String>` impls. `thiserror` for `Display`/`Error` derive. |
| `commands/` | Domain-organized Tauri command handlers. `app.rs` (RSS + global limits), `categories.rs` (category CRUD), `preferences.rs` (preferences, version, build info, capabilities), `servers.rs` (server CRUD, path mappings, connection testing), `session.rs` (re-exports from crate::session), `sync.rs` (maindata snapshot/status/start/stop), `tags.rs` (tag management), `torrents.rs` (torrent operations, search, file priority, share limits, export), `transfer.rs` (transfer info, speed limits, ban peers, cookies). |
| `sync/` | Live maindata sync actor. `LiveSyncManager` (752 lines) — background Tokio actor with delta embedding (256KB threshold), exponential backoff (5-60s), visibility-aware polling, health state machine, `should_emit_sync_changed` suppression. `LiveSyncHandle` (stop/refresh/set_visible). `SyncManagerRegistry` — per-server `Arc<Mutex<HashMap<String, SyncEntry>>>` with shared snapshot/revision/health Arcs. `MaindataSyncChangedEvent` with `changed_resources` and optional `delta`. `setup_sync_lifecycle` event-driven wiring. `get_maindata_snapshot` with diagnostic timing. Sub-module files: `mod.rs`, `manager.rs`, `registry.rs`, `lifecycle.rs`, `events.rs`. |

**Feature flags**:

| Feature | Plugins |
|---|---|
| `desktop` | clipboard-manager, dialog, window-state, secure-storage, opener |
| `mobile` | fs, dialog, deep-link, shell, secure-storage |

**Shared plugins** (both platforms): store, http, notification.

## Flow

Command execution pattern:
1. Renderer calls `invoke("command_name", args)`.
2. Tauri dispatches to the `#[tauri::command]` function.
3. Command acquires `State<SessionStateHandle>`, locks the mutex, captures `SessionRequestContext`.
4. Command delegates HTTP to `qb-core` via `crate::client::qb_get()` / `qb_post()`.
5. On success: optionally emits `resource-invalidated` event, returns DTO with `session_generation`.
6. On failure: returns `String` error; some commands emit `session-changed` with error state.

Sync flow:
1. `setup_sync_lifecycle` observes `session-changed` events.
2. On connect: `start_sync_for_session()` creates `LiveSyncManager`, spawns Tokio task.
3. Manager polls `/api/v2/sync/maindata` with `MaindataAccumulator`, tracks health.
4. On each successful poll: emits `maindata-sync-changed` with optional embedded delta.
5. On disconnect: `stop_sync_for_server()` signals stop, removes from registry.

Server repository flow:
1. `init_repository()` reads `.servers.dat` (or mobile equivalent) from `tauri-plugin-store`.
2. Passwords loaded from OS keychain on demand (not eagerly).
3. Mutations (`add_server`, `update_server`, etc.) update in-memory state + keychain + store.
4. `save_repository()` persists metadata (no passwords) to store.

## Integration

- **Depends on**: `qb-core`, `tauri`, various `tauri-plugin-*` crates, `reqwest`, `security-framework` (macOS), `uuid`, `urlencoding`, `thiserror`, `tokio`.
- **Consumed by**: `apps/desktop/src-tauri` and `apps/mobile/src-tauri` which call `add_shared_plugins()`/`add_desktop_plugins()`/`add_mobile_plugins()` and register commands.
- **State sharing**: `SessionStateHandle` and `ServerRepoStateHandle` are registered as Tauri managed state and injected into all commands via `State<'_, T>`.
