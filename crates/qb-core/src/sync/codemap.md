# crates/qb-core/src/sync/

## Responsibility

Accumulator-based maindata sync primitives. Contains the `MaindataAccumulator` for applying full/incremental maindata updates, `MaindataSnapshot` as the current accumulated state, `SyncDelta` for parsing and validating incoming updates, and `MaindataSyncHealth` for tracking sync health state.

## Files

| File | Responsibility |
|---|---|---|
| `mod.rs` | Module declarations for `accumulator`, `health`. Re-exports `MaindataAccumulator`, `MaindataSnapshot`, `SyncDelta`, `MaindataSyncHealth`, `SyncHealthState`. |
| `accumulator.rs` | `MaindataAccumulator` — accumulates torrent/category/server state across full and incremental updates. `MaindataSnapshot` — the current accumulated state as a `serde_json::Value`. `SyncDelta::parse()` — validates and normalizes incoming updates (RID validation, container structure, removal/tag arrays, full_update normalization). Uses typed DTOs (`MaindataTorrentRow`, `MaindataCategoryRow`, `MaindataServerState`) for strong typing of torrent/category/server fields, with `#[serde(flatten)] unknown` catch-all for version drift. `try_deserialize_*` helpers fall back to raw `unknown` on deserialization failure. |
| `health.rs` | `MaindataSyncHealth` — state machine tracking sync health. States: `Idle` → `Healthy` ↔ `Degraded` → `Retrying`. `SyncHealthState` enum with transitions on success/failure. Supports exponential backoff on consecutive errors. |

## Design

- **Accumulator pattern**: `MaindataAccumulator` owns the merge semantics. Full updates replace the entire snapshot; incremental updates merge into the existing state. RID staleness is handled by comparing incoming RID against the last-seen RID.
- **Typed row DTOs**: Torrents, categories, and server state are deserialized into typed DTOs (`MaindataTorrentRow`, `MaindataCategoryRow`, `MaindataServerState`) with `Option<T>` fields for all properties. Unknown fields are captured via `#[serde(flatten)] unknown: BTreeMap<String, serde_json::Value>` to avoid losing data from newer qBittorrent versions.
- **Tolerant deserialization**: `try_deserialize_*` helpers attempt JSON-to-DTO deserialization; on failure, they fall back to storing the raw `unknown` map value. This provides strong typing where possible without losing data from version drift.
- **Delta validation**: `SyncDelta::parse()` enforces structural validation: non-negative RID, object-typed `torrents`/`categories`/`server_state` containers, removal arrays as string arrays, `tags` as string arrays or null.
- **Health state machine**: `MaindataSyncHealth` transitions track sync success/failure patterns for exponential backoff and degradation detection.

## Integration

- Used by `qb-tauri/src/sync/manager.rs` for the `LiveSyncManager` Tokio actor.
- `MaindataSyncChangedEvent` in `qb-tauri/src/sync/events.rs` wraps snapshot data for Tauri event emission.
- `SyncManagerRegistry` in `qb-tauri/src/sync/registry.rs` manages per-server sync manager instances.
