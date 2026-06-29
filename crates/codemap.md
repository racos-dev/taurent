# crates/

## Responsibility

Workspace-level directory containing all Rust crates. Houses two crate families:

- **`qb-core`** — Tauri-agnostic qBittorrent client library (HTTP, auth, session, error types, wire normalization, capability resolution, typed DTO parsers, accumulator-based sync primitives).
- **`qb-tauri`** — Tauri integration layer that wraps `qb-core` behind `#[tauri::command]` functions and manages OS-level concerns (plugin init, server repository, secure storage, session lifecycle, event emission, sync manager).

## Design

**Layering is strict**: `qb-tauri` depends on `qb-core`; `qb-core` has zero Tauri dependencies. This lets `qb-core` be tested and potentially reused outside Tauri (e.g. a CLI or a different desktop runtime).

Both crates are workspace members declared in the root `Cargo.toml`. The `qb-tauri` crate uses Cargo feature flags (`desktop`, `mobile`) to conditionally compile platform-specific Tauri plugins.

**Rust vs TypeScript ownership rule**: Rust owns application, integration, domain, filesystem, network, qBittorrent, validation, normalization, synchronization, persistence, and native-platform logic that Rust can reasonably handle. TypeScript/React owns frontend UI concerns: rendering, component state that is purely visual, route composition, user interactions, and presentation-specific view models. Do not keep processing logic in TypeScript merely because it already exists there — evaluate whether non-UI logic should move behind a `qb-core`/`qb-tauri` boundary.

**Typed DTO boundary**: `qb-core/src/dto.rs` enforces strict structural validation at the Rust boundary. All parsers return `BackendError::InvalidResponse` for structural violations and `BackendError::Parse` for JSON decode errors. Unknown fields are silently ignored via serde defaults. Drift-tolerant fields use `Option<T>`.

## Flow

Application bootstrap:

1. Desktop/mobile app `main.rs` calls into `qb-tauri` to build a `tauri::Builder` with platform-appropriate plugins.
2. `qb-tauri` registers `SessionStateHandle` (an `Arc<Mutex<SessionManager>>`) and `ServerRepoStateHandle` (a `Mutex<ServerRepositoryState>`) as Tauri managed state.
3. Tauri commands (exposed via `commands/` module) operate on that state, delegating HTTP work to `qb-core`.
4. `SyncManagerRegistry` manages per-server `LiveSyncManager` instances that poll `/api/v2/sync/maindata` and emit `maindata-sync-changed` events.

## Integration

- `qb-core` is consumed by `qb-tauri` and potentially by `apps/desktop` or `apps/mobile` indirectly through the Tauri bridge.
- `qb-tauri` is consumed by the desktop and mobile app crates (`apps/desktop/src-tauri`, `apps/mobile/src-tauri`) which wire up the `tauri::Builder` and register commands.
