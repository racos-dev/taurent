# crates/qb-core/src/workspace/

## Responsibility
Pure-Rust derivation engine for the torrent workspace screen. Consumes a `MaindataSnapshot` and produces a `WorkspaceView` — a filtered, sorted, faceted projection of the torrent list. Ported from JS derivation utilities (`torrentFilter.ts`, `sortTorrents.ts`, `deriveTorrentList.ts`) to avoid expensive JS re-evaluation on every sync tick.

## Design

### Engine architecture (`mod.rs`)
`WorkspaceViewEngine` drives a 5-pass derivation pipeline in `compute()`:
1. **Filter + sort** — iterate all torrents, compute unfiltered status counts and speed totals, filter by `passes_all_filters`, sort matching hashes by the 35-field comparator
2. **Category facets** — ``derive_category_counts`` (ignores own category filter)
3. **Tag facets** — `derive_tag_counts` (ignores own tag filter)
4. **Tracker facets** — `derive_tracker_counts` (ignores own tracker filter)
5. **Sidebar projections** — convert raw facet counts into ordered sidebar item lists

### Key patterns
- **Diff-based emission** — `compute_and_diff` returns `Some(view)` only when the new view differs via `PartialEq` (cheap scalar → maps → sidebar → sorted_hashes)
- **Cross-filtered facet counts** — each facet dimension ignores exactly its own filter, so sidebar counts reflect totals for other active filters
- **Hash-only output** — `sorted_hashes` carries only torrent hashes, not full rows; renderer maps back from its own store
- **Collator caching** — `CollatorCache` maps locale strings to `Arc<CollatorBorrowed<'static>>`, acquired once per `compute()`
- **Sentinel values for numeric sort** — mirrors JS sort semantics: negative availability → ±∞, negative ETA → ∞, None popularity → −∞, negative ratio → −∞
- **Zero-allocation filter paths** — `matches_torrent_search` normalizes inline (no regex); tag parsing returns a lazy iterator

### Submodules

| Module | Responsibility |
|--------|----------------|
| `filter.rs` | Five filter predicates (status, category, tag, tracker, search) plus `passes_all_filters` / `passes_all_filters_except` |
| `facets.rs` | Cross-filtered count derivation and sidebar item construction (categories, tags, trackers) |
| `sort.rs` | 35-field sort comparator + `CollatorCache` with locale-aware collation |
| `view.rs` | `WorkspaceView` output type and sidebar item structs with custom `PartialEq` |
| `fixture.rs` | 20-row test fixture (`HAND_FIXTURE_ROWS`) covering all status buckets, sentinel values, CJK/accented names |

## Flow
```
MaindataSnapshot → WorkspaceViewEngine::compute()
                         │
                         ├─ Pass 1: Iterate all torrents
                         │   ├── Unfiltered: accumulate dlspeed/upspeed sums
                         │   ├── Unfiltered: bucket into status_counts (12 buckets + "all")
                         │   └── Filtered: passes_all_filters() → collect hash
                         │
                         ├─ Sort filtered_hashes via compare_hashes(collator)
                         │
                         ├─ Pass 2: derive_category_counts()  (ignore category filter)
                         ├─ Pass 3: derive_tag_counts()       (ignore tag filter)
                         ├─ Pass 4: derive_tracker_counts()   (ignore tracker filter)
                         │
                         └─ Pass 5: sidebar projections
                              ├── sidebar_categories_from_counts()
                              ├── sidebar_tags_from_counts()
                              └── sidebar_trackers_from_map()
                                   │
                                   → WorkspaceView (request_id, revision, sorted_hashes,
                                     filtered_count, total_count, speed totals, status_counts,
                                     facet_counts, sidebar items, is_filtered)

compute_and_diff() compares new view vs cached → Some(view) if changed, None if identical
```

### Clone-then-release lock contract
Call site (`qb-tauri::workspace`):
1. Clone `MaindataSnapshot` while holding shared mutex
2. Drop mutex lock
3. Lock engine mutex
4. Call `compute_and_diff(&cloned_snapshot)`
— avoids blocking the snapshot mutex across the entire derivation pass.

## Integration

### Dependencies
- `crate::dto::{MaindataTorrentRow, MaindataCategoryRow}` — typed DTOs from qBittorrent sync data
- `crate::sync::MaindataSnapshot` — accumulated snapshot (torrents BTreeMap, categories, tags, server_state)
- `url` crate — tracker URL parsing and hostname extraction
- `icu_collator` + `icu_locale` — locale-aware string collation for `localeCompare` parity
- `serde` — serialization for Tauri command I/O
- `log` — collator failure warnings

### Consumers
- `qb-tauri::workspace::WorkspaceViewState` — wraps the engine + shared snapshot Arc, exposes `set_workspace_view`/`get_workspace_view` Tauri commands, calls `maybe_emit_workspace_view` from the sync loop
- Renderer receives `WorkspaceView` via Tauri IPC and maps `sorted_hashes` back to its local `Torrent` object store
