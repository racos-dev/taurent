//! `MaindataAccumulator` — applies qBittorrent `/api/v2/sync/maindata` deltas
//! onto an accumulated snapshot.
//!
//! This module is Tauri-free and owns all merge semantics:
//! - full-update replacement
//! - incremental torrent field merge with no-op detection
//! - removed torrents/categories/tags
//! - sorted tag accumulation
//! - server_state partial merge with no-op detection

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::dto::{MaindataCategoryRow, MaindataServerState, MaindataTorrentRow};

/// Typed snapshot accumulated from qBittorrent sync maindata deltas.
///
/// Uses `BTreeMap` for deterministic iteration order (useful for tests and
/// snapshot comparison). Torrent, category, and server-state rows are stored
/// as typed DTOs. Unknown wire fields are captured in each row's `unknown`
/// catch-all field.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MaindataSnapshot {
    /// Current sync RID.
    pub rid: u64,
    /// Accumulated torrents. Keys are torrent hashes.
    pub torrents: BTreeMap<String, MaindataTorrentRow>,
    /// Accumulated categories. Keys are category names.
    pub categories: BTreeMap<String, MaindataCategoryRow>,
    /// Sorted list of active tags.
    pub tags: Vec<String>,
    /// Accumulated server state (all fields merged incrementally).
    pub server_state: Option<MaindataServerState>,
}

impl MaindataSnapshot {
    /// Returns true if the snapshot is empty (never received a full update).
    pub fn is_empty(&self) -> bool {
        self.rid == 0 && self.torrents.is_empty() && self.categories.is_empty()
    }

    /// Guarantee that every torrent row has a `hash` field matching its map key.
    ///
    /// Some upstream data sources (e.g. qBittorrent sync deltas for new torrents)
    /// may omit `hash` from the torrent payload even though the map key carries
    /// the correct hash. This method injects the hash into each row so downstream
    /// consumers can rely on `row.hash` without defensive normalization.
    pub fn normalize(mut self) -> Self {
        for (hash, row) in self.torrents.iter_mut() {
            if row.hash.is_none() {
                row.hash = Some(hash.clone());
            }
        }
        self
    }
}

/// A sync maindata delta as received from qBittorrent.
///
/// All fields are optional because qBittorrent only sends changed values.
/// Torrent, category, and server-state entries are deserialized into typed
/// DTOs; unknown wire fields are captured in each row's `unknown` catch-all.
#[derive(Debug, Clone)]
pub struct SyncDelta {
    /// Required. The new RID after applying this delta.
    pub rid: u64,
    /// True when this is a full snapshot (replace all fields).
    pub full_update: bool,
    /// Changed torrent entries (partial — only changed fields per torrent).
    pub torrents: Option<BTreeMap<String, MaindataTorrentRow>>,
    /// Torrent hashes to remove.
    pub torrents_removed: Vec<String>,
    /// Changed category entries (full category objects per entry).
    pub categories: Option<BTreeMap<String, MaindataCategoryRow>>,
    /// Category names to remove.
    pub categories_removed: Vec<String>,
    /// Tags added since last sync.
    pub tags: Vec<String>,
    /// Tags removed since last sync.
    pub tags_removed: Vec<String>,
    /// Partial server state update.
    pub server_state: Option<MaindataServerState>,
}

impl SyncDelta {
    /// Parse a `serde_json::Value` into a `SyncDelta`.
    ///
    /// Returns `Err` when:
    /// - the value is not a JSON object,
    /// - the required `rid` field is missing or is not an unsigned integer,
    /// - a present optional container has the wrong shape:
    ///   - `torrents`, `categories`, `server_state` must be JSON objects
    ///     when present,
    ///   - `torrents_removed`, `categories_removed`, `tags`, `tags_removed`
    ///     must be arrays whose entries are all strings when present.
    ///
    /// `full_update` parsing is tolerant: booleans are used as-is, the
    /// numbers `0`/`1` map to `false`/`true`, and the strings
    /// `"0"`/`"1"`/`"true"`/`"false"` (case-sensitive for the boolean
    /// word) map accordingly. Any other shape — absent, null, array,
    /// object, or unrecognized number/string — is treated as `false`.
    /// This matches the `FullUpdateSchema` normalizer in
    /// `packages/shared/src/schemas/qbittorrent.ts` so backend and
    /// fallback agree on `full_update` semantics.
    ///
    /// Unknown row/object fields are accepted and stored as raw
    /// `serde_json::Value`. This slice only validates the sync envelope
    /// and container shapes; row-level DTO validation remains deferred
    /// (see T144).
    pub fn parse(json: &serde_json::Value) -> Result<Self, &'static str> {
        let obj = json.as_object().ok_or("sync delta must be a JSON object")?;
        let rid_val = obj.get("rid").ok_or("rid field is required")?;
        let rid = rid_val.as_u64().ok_or("rid must be a positive integer")?;

        let full_update = obj
            .get("full_update")
            .map(parse_full_update)
            .unwrap_or(false);

        let torrents = parse_torrents_container(obj, "torrents")?;
        let categories = parse_categories_container(obj, "categories")?;
        let server_state = parse_server_state_container(obj, "server_state")?;

        let torrents_removed = require_string_array(obj, "torrents_removed")?;
        let categories_removed = require_string_array(obj, "categories_removed")?;
        let tags = require_string_array(obj, "tags")?;
        let tags_removed = require_string_array(obj, "tags_removed")?;

        Ok(Self {
            rid,
            full_update,
            torrents,
            torrents_removed,
            categories,
            categories_removed,
            tags,
            tags_removed,
            server_state,
        })
    }
}

/// Parse the tolerant `full_update` field. Accepts booleans as-is, the
/// numbers `0`/`1` mapping to `false`/`true`, and the strings
/// `"0"`/`"1"`/`"true"`/`"false"` accordingly. Any other shape maps to
/// `false`.
///
/// This mirrors the `FullUpdateSchema` normalizer in
/// `packages/shared/src/schemas/qbittorrent.ts` so backend sync and the
/// TypeScript fallback path agree on `full_update` parsing.
fn parse_full_update(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Bool(b) => *b,
        serde_json::Value::Number(n) => matches!(n.as_u64(), Some(1)),
        serde_json::Value::String(s) => matches!(s.as_str(), "1" | "true" | "True"),
        _ => false,
    }
}

/// Parse a torrents container into a typed map, tolerantly deserializing each entry.
fn parse_torrents_container(
    obj: &serde_json::Map<String, serde_json::Value>,
    field: &'static str,
) -> Result<Option<BTreeMap<String, MaindataTorrentRow>>, &'static str> {
    match obj.get(field) {
        None => Ok(None),
        Some(value) if value.is_object() => {
            let raw_obj = value.as_object().unwrap();
            let mut out = BTreeMap::new();
            for (key, val) in raw_obj {
                out.insert(key.clone(), try_deserialize_torrent_row(val));
            }
            Ok(Some(out))
        }
        Some(_) => Err("torrents must be a JSON object when present"),
    }
}

/// Parse a categories container into a typed map, tolerantly deserializing each entry.
fn parse_categories_container(
    obj: &serde_json::Map<String, serde_json::Value>,
    field: &'static str,
) -> Result<Option<BTreeMap<String, MaindataCategoryRow>>, &'static str> {
    match obj.get(field) {
        None => Ok(None),
        Some(value) if value.is_object() => {
            let raw_obj = value.as_object().unwrap();
            let mut out = BTreeMap::new();
            for (key, val) in raw_obj {
                out.insert(key.clone(), try_deserialize_category_row(val));
            }
            Ok(Some(out))
        }
        Some(_) => Err("categories must be a JSON object when present"),
    }
}

/// Parse a server_state container into a typed struct, tolerantly deserializing.
fn parse_server_state_container(
    obj: &serde_json::Map<String, serde_json::Value>,
    field: &'static str,
) -> Result<Option<MaindataServerState>, &'static str> {
    match obj.get(field) {
        None => Ok(None),
        Some(value) if value.is_object() => Ok(Some(try_deserialize_server_state(value))),
        Some(_) => Err("server_state must be a JSON object when present"),
    }
}

/// Tolerant deserialization of a torrent row. On failure, captures all fields in `unknown`.
fn try_deserialize_torrent_row(val: &serde_json::Value) -> MaindataTorrentRow {
    match serde_json::from_value(val.clone()) {
        Ok(row) => row,
        Err(_) => {
            let mut unknown = BTreeMap::new();
            if let Some(obj) = val.as_object() {
                for (k, v) in obj {
                    unknown.insert(k.clone(), v.clone());
                }
            }
            MaindataTorrentRow {
                unknown,
                ..Default::default()
            }
        }
    }
}

/// Tolerant deserialization of a category row. On failure, captures all fields in `unknown`.
fn try_deserialize_category_row(val: &serde_json::Value) -> MaindataCategoryRow {
    match serde_json::from_value(val.clone()) {
        Ok(row) => row,
        Err(_) => {
            let mut unknown = BTreeMap::new();
            if let Some(obj) = val.as_object() {
                for (k, v) in obj {
                    unknown.insert(k.clone(), v.clone());
                }
            }
            MaindataCategoryRow {
                unknown,
                ..Default::default()
            }
        }
    }
}

/// Tolerant deserialization of server state. On failure, captures all fields in `unknown`.
fn try_deserialize_server_state(val: &serde_json::Value) -> MaindataServerState {
    match serde_json::from_value(val.clone()) {
        Ok(state) => state,
        Err(_) => {
            let mut unknown = BTreeMap::new();
            if let Some(obj) = val.as_object() {
                for (k, v) in obj {
                    unknown.insert(k.clone(), v.clone());
                }
            }
            MaindataServerState {
                unknown,
                ..Default::default()
            }
        }
    }
}

/// Validate and extract an array-of-strings sync delta field.
///
/// Returns `Ok(Vec::new())` when the field is absent, `Ok(values)` when
/// the field is an array whose entries are all strings, and `Err` when
/// the field is present but not an array of strings. Non-string entries
/// (including the field being a non-array JSON value) are treated as
/// boundary failures rather than silently filtered out.
fn require_string_array(
    obj: &serde_json::Map<String, serde_json::Value>,
    field: &'static str,
) -> Result<Vec<String>, &'static str> {
    let err = match field {
        "torrents_removed" => "torrents_removed must be an array of strings when present",
        "categories_removed" => "categories_removed must be an array of strings when present",
        "tags" => "tags must be an array of strings when present",
        "tags_removed" => "tags_removed must be an array of strings when present",
        _ => "sync delta field must be an array of strings when present",
    };
    let Some(value) = obj.get(field) else {
        return Ok(Vec::new());
    };
    let arr = value.as_array().ok_or(err)?;
    let mut out = Vec::with_capacity(arr.len());
    for v in arr {
        let s = v.as_str().ok_or(err)?;
        out.push(s.to_string());
    }
    Ok(out)
}

/// `MaindataAccumulator` — applies `SyncDelta` payloads onto an accumulated
/// `MaindataSnapshot`.
///
/// Thread-safe to clone (uses internal write-once state for merge results).
#[derive(Debug, Default, Clone)]
pub struct MaindataAccumulator {
    snap: MaindataSnapshot,
    last_had_changes: bool,
}

impl MaindataAccumulator {
    /// Create a new empty accumulator.
    pub fn new() -> Self {
        Self::default()
    }

    /// Apply a raw JSON delta onto the accumulated snapshot.
    ///
    /// Returns `Err` if the delta is malformed or missing the required `rid` field.
    pub fn apply(&mut self, delta: &serde_json::Value) -> Result<(), &'static str> {
        let d = SyncDelta::parse(delta)?;
        self.apply_delta(d);
        Ok(())
    }

    /// Apply a parsed `SyncDelta` onto the accumulated snapshot.
    pub fn apply_delta(&mut self, delta: SyncDelta) {
        if delta.full_update || self.snap.rid == 0 {
            self.apply_full(delta);
        } else if delta.rid <= self.snap.rid {
            // Stale or duplicate delta — silently discard to prevent
            // state corruption from network-reordered responses.
            self.last_had_changes = false;
        } else {
            self.apply_incremental(delta);
        }
    }

    fn apply_full(&mut self, delta: SyncDelta) {
        let mut snap = MaindataSnapshot {
            rid: delta.rid,
            torrents: BTreeMap::new(),
            categories: BTreeMap::new(),
            tags: Vec::new(),
            server_state: None,
        };

        if let Some(torrents_map) = delta.torrents {
            snap.torrents = torrents_map;
        }

        if let Some(categories_map) = delta.categories {
            snap.categories = categories_map;
        }

        // Tags: collect and sort
        let mut tag_set: Vec<String> = delta.tags;
        tag_set.sort();
        snap.tags = tag_set;

        snap.server_state = delta.server_state;

        self.snap = snap;
        self.last_had_changes = true;
    }

    fn apply_incremental(&mut self, delta: SyncDelta) {
        // Update RID
        self.snap.rid = delta.rid;

        // --- Torrents ---
        let mut has_torrent_change = !delta.torrents_removed.is_empty();

        if !has_torrent_change {
            if let Some(ref new_torrents) = delta.torrents {
                for (hash, changed) in new_torrents {
                    if let Some(existing) = self.snap.torrents.get(hash) {
                        if !torrent_row_is_noop(existing, changed) {
                            has_torrent_change = true;
                            break;
                        }
                    } else {
                        has_torrent_change = true;
                        break;
                    }
                }
            }
        }

        if has_torrent_change {
            let mut new_torrents = self.snap.torrents.clone();

            if let Some(ref new_torrents_map) = delta.torrents {
                for (hash, changed) in new_torrents_map {
                    if let Some(existing) = self.snap.torrents.get(hash) {
                        if torrent_row_is_noop(existing, changed) {
                            // No-op: preserve existing reference
                            new_torrents.insert(hash.clone(), existing.clone());
                        } else {
                            // Real change: merge
                            let merged = merge_torrent_rows(existing, changed);
                            new_torrents.insert(hash.clone(), merged);
                        }
                    } else {
                        // New torrent: start with hash, then merge delta
                        let base = MaindataTorrentRow {
                            hash: Some(hash.clone()),
                            ..Default::default()
                        };
                        let merged = merge_torrent_rows(&base, changed);
                        new_torrents.insert(hash.clone(), merged);
                    }
                }
            }

            for hash in &delta.torrents_removed {
                new_torrents.remove(hash);
            }

            self.snap.torrents = new_torrents;
        }

        // --- Categories ---
        if delta.categories.is_some() || !delta.categories_removed.is_empty() {
            let mut new_categories = self.snap.categories.clone();

            if let Some(ref cats_map) = delta.categories {
                for (name, cat) in cats_map {
                    new_categories.insert(name.clone(), cat.clone());
                }
            }

            for name in &delta.categories_removed {
                new_categories.remove(name);
            }

            self.snap.categories = new_categories;
        }

        // --- Tags ---
        if !delta.tags.is_empty() || !delta.tags_removed.is_empty() {
            let mut tag_set: std::collections::HashSet<String> =
                self.snap.tags.iter().cloned().collect();

            for t in &delta.tags {
                tag_set.insert(t.clone());
            }
            for t in &delta.tags_removed {
                tag_set.remove(t);
            }

            let mut sorted: Vec<String> = tag_set.into_iter().collect();
            sorted.sort();
            self.snap.tags = sorted;
        }

        // --- Server state ---
        let mut has_server_state_change = false;
        if let Some(state_delta) = delta.server_state {
            if let Some(ref current) = self.snap.server_state {
                if !server_state_is_noop(current, &state_delta) {
                    self.snap.server_state = Some(merge_server_states(current, &state_delta));
                    has_server_state_change = true;
                }
                // else: no-op, keep existing reference
            } else {
                // No previous server state — adopt the delta
                self.snap.server_state = Some(state_delta);
                has_server_state_change = true;
            }
        }

        self.last_had_changes = has_torrent_change
            || delta.categories.is_some()
            || !delta.categories_removed.is_empty()
            || !delta.tags.is_empty()
            || !delta.tags_removed.is_empty()
            || has_server_state_change;
    }

    /// Returns the current accumulated snapshot.
    ///
    /// The returned snapshot is a clone; the accumulator retains its internal state.
    pub fn snapshot(&self) -> MaindataSnapshot {
        self.snap.clone()
    }

    /// Returns the current RID.
    pub fn rid(&self) -> u64 {
        self.snap.rid
    }

    /// Returns whether the last `apply_delta()` call produced effective changes.
    pub fn has_changes(&self) -> bool {
        self.last_had_changes
    }

    /// Reset the accumulator to empty state.
    pub fn reset(&mut self) {
        self.snap = MaindataSnapshot::default();
        self.last_had_changes = false;
    }
}

/// Returns true when applying `delta` to `baseline` would produce no effective change.
///
/// Only checks `Some` fields on `delta`; `None` delta fields and the `unknown`
/// catch-all are ignored.
fn torrent_row_is_noop(baseline: &MaindataTorrentRow, delta: &MaindataTorrentRow) -> bool {
    fn opt_eq<T: PartialEq>(a: &Option<T>, b: &Option<T>) -> bool {
        match (a, b) {
            (_, None) => true,
            (Some(aa), Some(bb)) => aa == bb,
            (None, Some(_)) => false,
        }
    }
    opt_eq(&baseline.hash, &delta.hash)
        && opt_eq(&baseline.name, &delta.name)
        && opt_eq(&baseline.state, &delta.state)
        && opt_eq(&baseline.progress, &delta.progress)
        && opt_eq(&baseline.dlspeed, &delta.dlspeed)
        && opt_eq(&baseline.upspeed, &delta.upspeed)
        && opt_eq(&baseline.priority, &delta.priority)
        && opt_eq(&baseline.num_leechs, &delta.num_leechs)
        && opt_eq(&baseline.num_seeds, &delta.num_seeds)
        && opt_eq(&baseline.size, &delta.size)
        && opt_eq(&baseline.total_size, &delta.total_size)
        && opt_eq(&baseline.category, &delta.category)
        && opt_eq(&baseline.tags, &delta.tags)
        && opt_eq(&baseline.added_on, &delta.added_on)
        && opt_eq(&baseline.completion_on, &delta.completion_on)
        && opt_eq(&baseline.tracker, &delta.tracker)
        && opt_eq(&baseline.ratio, &delta.ratio)
        && opt_eq(&baseline.ratio_limit, &delta.ratio_limit)
        && opt_eq(&baseline.save_path, &delta.save_path)
        && opt_eq(&baseline.content_path, &delta.content_path)
        && opt_eq(&baseline.auto_tmm, &delta.auto_tmm)
        && opt_eq(&baseline.super_seeding, &delta.super_seeding)
        && opt_eq(&baseline.force_start, &delta.force_start)
        && opt_eq(&baseline.last_activity, &delta.last_activity)
        && opt_eq(&baseline.availability, &delta.availability)
        && opt_eq(&baseline.seen_complete, &delta.seen_complete)
        && opt_eq(&baseline.time_active, &delta.time_active)
        && opt_eq(&baseline.eta, &delta.eta)
        && opt_eq(&baseline.f_l_piece_prio, &delta.f_l_piece_prio)
        && opt_eq(&baseline.max_ratio, &delta.max_ratio)
        && opt_eq(&baseline.max_seeding_time, &delta.max_seeding_time)
        && opt_eq(&baseline.num_complete, &delta.num_complete)
        && opt_eq(&baseline.num_incomplete, &delta.num_incomplete)
        && opt_eq(&baseline.seeding_time, &delta.seeding_time)
        && opt_eq(&baseline.seeding_time_limit, &delta.seeding_time_limit)
        && opt_eq(&baseline.amount_left, &delta.amount_left)
        && opt_eq(&baseline.completed, &delta.completed)
        && opt_eq(&baseline.dl_limit, &delta.dl_limit)
        && opt_eq(&baseline.up_limit, &delta.up_limit)
        && opt_eq(&baseline.uploaded, &delta.uploaded)
        && opt_eq(&baseline.uploaded_session, &delta.uploaded_session)
        && opt_eq(&baseline.downloaded, &delta.downloaded)
        && opt_eq(&baseline.downloaded_session, &delta.downloaded_session)
        && opt_eq(&baseline.magnet_uri, &delta.magnet_uri)
        && opt_eq(&baseline.seq_dl, &delta.seq_dl)
        && opt_eq(
            &baseline.inactive_seeding_time,
            &delta.inactive_seeding_time,
        )
        && opt_eq(&baseline.download_path, &delta.download_path)
        && opt_eq(&baseline.infohash_v1, &delta.infohash_v1)
        && opt_eq(&baseline.infohash_v2, &delta.infohash_v2)
        && opt_eq(&baseline.trackers_count, &delta.trackers_count)
        && opt_eq(&baseline.reannounce, &delta.reannounce)
        && opt_eq(&baseline.popularity, &delta.popularity)
        && opt_eq(&baseline.is_private, &delta.is_private)
}

/// Merge `baseline` into `delta` for torrent rows (delta `Some` fields win).
///
/// Clones `baseline`, overwrites fields where `delta` has `Some`, and merges
/// the `unknown` catch-all maps (delta entries win on key collision).
fn merge_torrent_rows(
    baseline: &MaindataTorrentRow,
    delta: &MaindataTorrentRow,
) -> MaindataTorrentRow {
    let mut result = baseline.clone();
    if let Some(ref v) = delta.hash {
        result.hash = Some(v.clone());
    }
    if let Some(ref v) = delta.name {
        result.name = Some(v.clone());
    }
    if let Some(ref v) = delta.state {
        result.state = Some(v.clone());
    }
    if let Some(ref v) = delta.progress {
        result.progress = Some(*v);
    }
    if let Some(ref v) = delta.dlspeed {
        result.dlspeed = Some(*v);
    }
    if let Some(ref v) = delta.upspeed {
        result.upspeed = Some(*v);
    }
    if let Some(ref v) = delta.priority {
        result.priority = Some(*v);
    }
    if let Some(ref v) = delta.num_leechs {
        result.num_leechs = Some(*v);
    }
    if let Some(ref v) = delta.num_seeds {
        result.num_seeds = Some(*v);
    }
    if let Some(ref v) = delta.size {
        result.size = Some(*v);
    }
    if let Some(ref v) = delta.total_size {
        result.total_size = Some(*v);
    }
    if let Some(ref v) = delta.category {
        result.category = Some(v.clone());
    }
    if let Some(ref v) = delta.tags {
        result.tags = Some(v.clone());
    }
    if let Some(ref v) = delta.added_on {
        result.added_on = Some(*v);
    }
    if let Some(ref v) = delta.completion_on {
        result.completion_on = Some(*v);
    }
    if let Some(ref v) = delta.tracker {
        result.tracker = Some(v.clone());
    }
    if let Some(ref v) = delta.ratio {
        result.ratio = Some(*v);
    }
    if let Some(ref v) = delta.ratio_limit {
        result.ratio_limit = Some(*v);
    }
    if let Some(ref v) = delta.save_path {
        result.save_path = Some(v.clone());
    }
    if let Some(ref v) = delta.content_path {
        result.content_path = Some(v.clone());
    }
    if let Some(ref v) = delta.auto_tmm {
        result.auto_tmm = Some(*v);
    }
    if let Some(ref v) = delta.super_seeding {
        result.super_seeding = Some(*v);
    }
    if let Some(ref v) = delta.force_start {
        result.force_start = Some(*v);
    }
    if let Some(ref v) = delta.last_activity {
        result.last_activity = Some(*v);
    }
    if let Some(ref v) = delta.availability {
        result.availability = Some(*v);
    }
    if let Some(ref v) = delta.seen_complete {
        result.seen_complete = Some(*v);
    }
    if let Some(ref v) = delta.time_active {
        result.time_active = Some(*v);
    }
    if let Some(ref v) = delta.eta {
        result.eta = Some(*v);
    }
    if let Some(ref v) = delta.f_l_piece_prio {
        result.f_l_piece_prio = Some(*v);
    }
    if let Some(ref v) = delta.max_ratio {
        result.max_ratio = Some(*v);
    }
    if let Some(ref v) = delta.max_seeding_time {
        result.max_seeding_time = Some(*v);
    }
    if let Some(ref v) = delta.num_complete {
        result.num_complete = Some(*v);
    }
    if let Some(ref v) = delta.num_incomplete {
        result.num_incomplete = Some(*v);
    }
    if let Some(ref v) = delta.seeding_time {
        result.seeding_time = Some(*v);
    }
    if let Some(ref v) = delta.seeding_time_limit {
        result.seeding_time_limit = Some(*v);
    }
    if let Some(ref v) = delta.amount_left {
        result.amount_left = Some(*v);
    }
    if let Some(ref v) = delta.completed {
        result.completed = Some(*v);
    }
    if let Some(ref v) = delta.dl_limit {
        result.dl_limit = Some(*v);
    }
    if let Some(ref v) = delta.up_limit {
        result.up_limit = Some(*v);
    }
    if let Some(ref v) = delta.uploaded {
        result.uploaded = Some(*v);
    }
    if let Some(ref v) = delta.uploaded_session {
        result.uploaded_session = Some(*v);
    }
    if let Some(ref v) = delta.downloaded {
        result.downloaded = Some(*v);
    }
    if let Some(ref v) = delta.downloaded_session {
        result.downloaded_session = Some(*v);
    }
    if let Some(ref v) = delta.magnet_uri {
        result.magnet_uri = Some(v.clone());
    }
    if let Some(ref v) = delta.seq_dl {
        result.seq_dl = Some(*v);
    }
    if let Some(ref v) = delta.inactive_seeding_time {
        result.inactive_seeding_time = Some(*v);
    }
    if let Some(ref v) = delta.download_path {
        result.download_path = Some(v.clone());
    }
    if let Some(ref v) = delta.infohash_v1 {
        result.infohash_v1 = Some(v.clone());
    }
    if let Some(ref v) = delta.infohash_v2 {
        result.infohash_v2 = Some(v.clone());
    }
    if let Some(ref v) = delta.trackers_count {
        result.trackers_count = Some(*v);
    }
    if let Some(ref v) = delta.reannounce {
        result.reannounce = Some(*v);
    }
    if let Some(ref v) = delta.popularity {
        result.popularity = Some(*v);
    }
    if let Some(ref v) = delta.is_private {
        result.is_private = Some(*v);
    }
    // Merge unknown catch-all (delta wins)
    for (k, v) in &delta.unknown {
        result.unknown.insert(k.clone(), v.clone());
    }
    result
}

/// Returns true when `delta` introduces no effective change to `current` server_state.
///
/// Only checks `Some` fields on `delta`; `None` delta fields and the `unknown`
/// catch-all are ignored.
fn server_state_is_noop(current: &MaindataServerState, delta: &MaindataServerState) -> bool {
    fn opt_eq<T: PartialEq>(a: &Option<T>, b: &Option<T>) -> bool {
        match (a, b) {
            (_, None) => true,
            (Some(aa), Some(bb)) => aa == bb,
            (None, Some(_)) => false,
        }
    }
    opt_eq(&current.dl_info_speed, &delta.dl_info_speed)
        && opt_eq(&current.dl_info_data, &delta.dl_info_data)
        && opt_eq(&current.up_info_speed, &delta.up_info_speed)
        && opt_eq(&current.up_info_data, &delta.up_info_data)
        && opt_eq(&current.dl_rate_limit, &delta.dl_rate_limit)
        && opt_eq(&current.up_rate_limit, &delta.up_rate_limit)
        && opt_eq(&current.dht_nodes, &delta.dht_nodes)
        && opt_eq(&current.connection_status, &delta.connection_status)
        && opt_eq(&current.queueing, &delta.queueing)
        && opt_eq(&current.use_alt_speed_limits, &delta.use_alt_speed_limits)
        && opt_eq(&current.refresh_interval, &delta.refresh_interval)
        && opt_eq(&current.free_space_on_disk, &delta.free_space_on_disk)
        && opt_eq(&current.alltime_dl, &delta.alltime_dl)
        && opt_eq(&current.alltime_ul, &delta.alltime_ul)
        && opt_eq(&current.average_time_queue, &delta.average_time_queue)
        && opt_eq(&current.global_ratio, &delta.global_ratio)
        && opt_eq(&current.queued_io_jobs, &delta.queued_io_jobs)
        && opt_eq(&current.read_cache_hits, &delta.read_cache_hits)
        && opt_eq(&current.read_cache_overload, &delta.read_cache_overload)
        && opt_eq(&current.total_buffers_size, &delta.total_buffers_size)
        && opt_eq(
            &current.total_peer_connections,
            &delta.total_peer_connections,
        )
        && opt_eq(&current.total_queued_size, &delta.total_queued_size)
        && opt_eq(&current.total_wasted_session, &delta.total_wasted_session)
        && opt_eq(&current.write_cache_overload, &delta.write_cache_overload)
}

/// Merge `delta` into `current` for server_state (delta `Some` fields win).
///
/// Clones `current`, overwrites fields where `delta` has `Some`, and merges
/// the `unknown` catch-all maps.
fn merge_server_states(
    current: &MaindataServerState,
    delta: &MaindataServerState,
) -> MaindataServerState {
    let mut result = current.clone();
    if let Some(ref v) = delta.dl_info_speed {
        result.dl_info_speed = Some(*v);
    }
    if let Some(ref v) = delta.dl_info_data {
        result.dl_info_data = Some(*v);
    }
    if let Some(ref v) = delta.up_info_speed {
        result.up_info_speed = Some(*v);
    }
    if let Some(ref v) = delta.up_info_data {
        result.up_info_data = Some(*v);
    }
    if let Some(ref v) = delta.dl_rate_limit {
        result.dl_rate_limit = Some(*v);
    }
    if let Some(ref v) = delta.up_rate_limit {
        result.up_rate_limit = Some(*v);
    }
    if let Some(ref v) = delta.dht_nodes {
        result.dht_nodes = Some(*v);
    }
    if let Some(ref v) = delta.connection_status {
        result.connection_status = Some(v.clone());
    }
    if let Some(ref v) = delta.queueing {
        result.queueing = Some(*v);
    }
    if let Some(ref v) = delta.use_alt_speed_limits {
        result.use_alt_speed_limits = Some(*v);
    }
    if let Some(ref v) = delta.refresh_interval {
        result.refresh_interval = Some(*v);
    }
    if let Some(ref v) = delta.free_space_on_disk {
        result.free_space_on_disk = Some(*v);
    }
    if let Some(ref v) = delta.alltime_dl {
        result.alltime_dl = Some(*v);
    }
    if let Some(ref v) = delta.alltime_ul {
        result.alltime_ul = Some(*v);
    }
    if let Some(ref v) = delta.average_time_queue {
        result.average_time_queue = Some(*v);
    }
    if let Some(ref v) = delta.global_ratio {
        result.global_ratio = Some(v.clone());
    }
    if let Some(ref v) = delta.queued_io_jobs {
        result.queued_io_jobs = Some(*v);
    }
    if let Some(ref v) = delta.read_cache_hits {
        result.read_cache_hits = Some(*v);
    }
    if let Some(ref v) = delta.read_cache_overload {
        result.read_cache_overload = Some(v.clone());
    }
    if let Some(ref v) = delta.total_buffers_size {
        result.total_buffers_size = Some(*v);
    }
    if let Some(ref v) = delta.total_peer_connections {
        result.total_peer_connections = Some(*v);
    }
    if let Some(ref v) = delta.total_queued_size {
        result.total_queued_size = Some(*v);
    }
    if let Some(ref v) = delta.total_wasted_session {
        result.total_wasted_session = Some(*v);
    }
    if let Some(ref v) = delta.write_cache_overload {
        result.write_cache_overload = Some(v.clone());
    }
    // Merge unknown catch-all (delta wins)
    for (k, v) in &delta.unknown {
        result.unknown.insert(k.clone(), v.clone());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_update_replaces_everything() {
        let mut acc = MaindataAccumulator::new();

        let delta = serde_json::json!({
            "rid": 5,
            "full_update": true,
            "torrents": {
                "abc": { "hash": "abc", "name": "Torrent A", "state": "downloading" }
            },
            "categories": {
                " videos": { "name": "videos", "savePath": "/data/videos" }
            },
            "tags": ["tag1", "tag2"],
            "server_state": {
                "dl_info_speed": 1000000,
                "connection_status": "connected"
            }
        });

        acc.apply(&delta).unwrap();
        let snap = acc.snapshot();

        assert_eq!(snap.rid, 5);
        assert_eq!(snap.torrents.len(), 1);
        assert!(snap.torrents.contains_key("abc"));
        assert_eq!(snap.categories.len(), 1);
        assert!(snap.categories.contains_key(" videos"));
        assert_eq!(snap.tags, vec!["tag1", "tag2"]);
        assert!(snap.server_state.is_some());
    }

    #[test]
    fn test_incremental_torrent_field_merge() {
        let mut acc = MaindataAccumulator::new();

        // First: full snapshot
        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": {
                "abc": { "hash": "abc", "name": "Torrent A", "state": "downloading", "progress": 0.1 }
            }
        });
        acc.apply(&full).unwrap();

        // Incremental: update progress, leave name/state unchanged
        let incr = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "torrents": {
                "abc": { "hash": "abc", "progress": 0.9 }
            }
        });
        acc.apply(&incr).unwrap();

        let snap = acc.snapshot();
        assert_eq!(snap.rid, 2);

        let t = snap.torrents.get("abc").unwrap();
        // name should be preserved from full snapshot
        assert_eq!(t.name.as_ref().unwrap(), "Torrent A");
        // progress should be updated
        assert!((t.progress.unwrap() - 0.9).abs() < 1e-10);
        // state should be preserved
        assert_eq!(t.state.as_ref().unwrap(), "downloading");
    }

    #[test]
    fn test_torrent_noop_delta_preserves_reference() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": {
                "abc": { "hash": "abc", "name": "Torrent A", "progress": 0.5 }
            }
        });
        acc.apply(&full).unwrap();

        // Send a delta that changes nothing
        let noop = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "torrents": {
                "abc": { "hash": "abc", "progress": 0.5 }
            }
        });
        acc.apply(&noop).unwrap();

        let snap = acc.snapshot();
        // Reference should be preserved when delta is a no-op
        assert_eq!(
            snap.torrents.get("abc").unwrap().name.as_ref().unwrap(),
            "Torrent A"
        );
    }

    #[test]
    fn test_torrents_removed() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": {
                "abc": { "hash": "abc", "name": "A" },
                "def": { "hash": "def", "name": "B" }
            }
        });
        acc.apply(&full).unwrap();
        assert_eq!(acc.snapshot().torrents.len(), 2);

        let incr = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "torrents_removed": ["abc"]
        });
        acc.apply(&incr).unwrap();

        let snap = acc.snapshot();
        assert_eq!(snap.torrents.len(), 1);
        assert!(snap.torrents.contains_key("def"));
        assert!(!snap.torrents.contains_key("abc"));
    }

    #[test]
    fn test_categories_add_update_remove() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "categories": {
                "docs": { "name": "docs", "savePath": "/docs" }
            }
        });
        acc.apply(&full).unwrap();

        // Update docs, add videos
        let incr = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "categories": {
                "videos": { "name": "videos", "savePath": "/videos" }
            },
            "categories_removed": ["docs"]
        });
        acc.apply(&incr).unwrap();

        let snap = acc.snapshot();
        assert!(snap.categories.contains_key("videos"));
        assert!(!snap.categories.contains_key("docs"));
    }

    #[test]
    fn test_tags_sorted_and_removed() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "tags": ["zebra", "apple"]
        });
        acc.apply(&full).unwrap();
        assert_eq!(acc.snapshot().tags, vec!["apple", "zebra"]);

        // Add a tag, remove another
        let incr = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "tags": ["banana"],
            "tags_removed": ["zebra"]
        });
        acc.apply(&incr).unwrap();

        assert_eq!(acc.snapshot().tags, vec!["apple", "banana"]);
    }

    #[test]
    fn test_server_state_partial_merge() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "server_state": {
                "dl_info_speed": 1000000,
                "up_info_speed": 500000,
                "connection_status": "connected"
            }
        });
        acc.apply(&full).unwrap();

        // Partial update: change only dl_info_speed
        let incr = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "server_state": {
                "dl_info_speed": 2000000
            }
        });
        acc.apply(&incr).unwrap();

        let snap = acc.snapshot();
        let ss = snap.server_state.unwrap();
        assert_eq!(ss.dl_info_speed.unwrap(), 2000000);
        // up_info_speed should be preserved
        assert_eq!(ss.up_info_speed.unwrap(), 500000);
        // connection_status should be preserved
        assert_eq!(ss.connection_status.as_ref().unwrap(), "connected");
    }

    #[test]
    fn test_rid_advancement() {
        let mut acc = MaindataAccumulator::new();

        let d1 = serde_json::json!({ "rid": 10, "full_update": true });
        acc.apply(&d1).unwrap();
        assert_eq!(acc.rid(), 10);

        let d2 = serde_json::json!({ "rid": 11, "full_update": false });
        acc.apply(&d2).unwrap();
        assert_eq!(acc.rid(), 11);
    }

    #[test]
    fn test_reset() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 5,
            "full_update": true,
            "torrents": { "abc": { "hash": "abc" } }
        });
        acc.apply(&full).unwrap();
        assert_eq!(acc.rid(), 5);

        acc.reset();
        assert_eq!(acc.rid(), 0);
        assert!(acc.snapshot().is_empty());
    }

    #[test]
    fn test_malformed_delta_rejected() {
        let mut acc = MaindataAccumulator::new();

        // Missing rid
        let r = acc.apply(&serde_json::json!({ "full_update": true }));
        assert!(r.is_err());

        // Not an object
        let r = acc.apply(&serde_json::json!([1, 2, 3]));
        assert!(r.is_err());
    }

    #[test]
    fn test_full_update_can_start_without_prior_state() {
        let mut acc = MaindataAccumulator::new();
        let delta = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": { "abc": { "hash": "abc", "name": "A" } }
        });
        acc.apply(&delta).unwrap();
        assert_eq!(acc.rid(), 1);
        assert_eq!(acc.snapshot().torrents.len(), 1);
    }

    #[test]
    fn test_first_full_update_after_incremental_resets() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": { "abc": { "hash": "abc" } }
        });
        acc.apply(&full).unwrap();

        let incr = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "torrents": { "abc": { "progress": 0.5 } }
        });
        acc.apply(&incr).unwrap();
        assert_eq!(acc.snapshot().torrents.len(), 1);

        // A subsequent full_update replaces everything
        let full2 = serde_json::json!({
            "rid": 3,
            "full_update": true,
            "torrents": { "xyz": { "hash": "xyz" } }
        });
        acc.apply(&full2).unwrap();
        assert_eq!(acc.snapshot().torrents.len(), 1);
        assert!(acc.snapshot().torrents.contains_key("xyz"));
        assert!(!acc.snapshot().torrents.contains_key("abc"));
    }

    #[test]
    fn test_sync_delta_parse() {
        let delta = serde_json::json!({
            "rid": 5,
            "full_update": true,
            "torrents": { "abc": {} },
            "categories": { "cats": {} },
            "tags": ["a", "b"],
            "tags_removed": ["c"],
            "server_state": { "dl_info_speed": 100 }
        });

        let parsed = SyncDelta::parse(&delta).unwrap();
        assert_eq!(parsed.rid, 5);
        assert!(parsed.full_update);
        assert!(parsed.torrents.is_some());
        assert!(parsed.categories.is_some());
        assert_eq!(parsed.tags, vec!["a", "b"]);
        assert_eq!(parsed.tags_removed, vec!["c"]);
        assert!(parsed.server_state.is_some());
    }

    #[test]
    fn test_sync_delta_parse_missing_rid() {
        let delta = serde_json::json!({ "full_update": false });
        let r = SyncDelta::parse(&delta);
        assert!(r.is_err());
    }

    #[test]
    fn test_server_state_noop_preserves_reference() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "server_state": { "dl_info_speed": 1000 }
        });
        acc.apply(&full).unwrap();

        // Send a no-op server_state delta
        let noop = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "server_state": { "dl_info_speed": 1000 }
        });
        acc.apply(&noop).unwrap();

        // Reference should be preserved (server_state unchanged)
        let snap = acc.snapshot();
        let current = snap.server_state.unwrap();
        assert_eq!(current.dl_info_speed.unwrap(), 1000);
    }

    #[test]
    fn test_empty_torrents_removed_array_noop() {
        let mut acc = MaindataAccumulator::new();

        let full = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": { "abc": { "hash": "abc" } }
        });
        acc.apply(&full).unwrap();

        // Empty torrents_removed should be a no-op
        let incr = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "torrents_removed": []
        });
        acc.apply(&incr).unwrap();
        assert_eq!(acc.snapshot().torrents.len(), 1);
    }

    #[test]
    fn test_normalize_injects_hash_into_torrent_values() {
        let mut snap = MaindataSnapshot::default();
        snap.torrents.insert(
            "abc123".to_string(),
            MaindataTorrentRow {
                name: Some("Torrent A".to_string()),
                progress: Some(0.5),
                ..Default::default()
            },
        );
        snap.torrents.insert(
            "def456".to_string(),
            MaindataTorrentRow {
                hash: Some("def456".to_string()),
                name: Some("Torrent B".to_string()),
                ..Default::default()
            },
        );

        let normalized = snap.normalize();

        // Torrent missing hash gets it injected from map key
        let a = normalized.torrents.get("abc123").unwrap();
        assert_eq!(a.hash.as_ref().unwrap(), "abc123");
        assert_eq!(a.name.as_ref().unwrap(), "Torrent A");

        // Torrent with existing hash is left unchanged
        let b = normalized.torrents.get("def456").unwrap();
        assert_eq!(b.hash.as_ref().unwrap(), "def456");
    }

    #[test]
    fn test_normalize_preserves_other_fields() {
        let mut snap = MaindataSnapshot::default();
        snap.torrents.insert(
            "xyz".to_string(),
            MaindataTorrentRow {
                name: Some("X".to_string()),
                state: Some("downloading".to_string()),
                progress: Some(0.75),
                ..Default::default()
            },
        );

        let normalized = snap.normalize();

        let t = normalized.torrents.get("xyz").unwrap();
        assert_eq!(t.hash.as_ref().unwrap(), "xyz");
        assert_eq!(t.name.as_ref().unwrap(), "X");
        assert_eq!(t.state.as_ref().unwrap(), "downloading");
        assert!((t.progress.unwrap() - 0.75).abs() < 1e-10);
    }

    #[test]
    fn test_parse_empty_tags_and_removed() {
        let delta = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "tags": [],
            "tags_removed": []
        });
        let parsed = SyncDelta::parse(&delta).unwrap();
        assert!(parsed.tags.is_empty());
        assert!(parsed.tags_removed.is_empty());
    }

    // --- T144.1: hardened full_update parsing ---

    #[test]
    fn test_parse_full_update_bool_true_and_false() {
        let d_true = serde_json::json!({ "rid": 1, "full_update": true });
        let d_false = serde_json::json!({ "rid": 1, "full_update": false });
        assert!(SyncDelta::parse(&d_true).unwrap().full_update);
        assert!(!SyncDelta::parse(&d_false).unwrap().full_update);
    }

    #[test]
    fn test_parse_full_update_numbers_zero_and_one() {
        let d_one = serde_json::json!({ "rid": 1, "full_update": 1 });
        let d_zero = serde_json::json!({ "rid": 1, "full_update": 0 });
        let d_two = serde_json::json!({ "rid": 1, "full_update": 2 });
        let d_neg = serde_json::json!({ "rid": 1, "full_update": -1 });
        let d_float = serde_json::json!({ "rid": 1, "full_update": 0.5 });
        assert!(SyncDelta::parse(&d_one).unwrap().full_update);
        assert!(!SyncDelta::parse(&d_zero).unwrap().full_update);
        // Numbers other than 0/1 collapse to false
        assert!(!SyncDelta::parse(&d_two).unwrap().full_update);
        assert!(!SyncDelta::parse(&d_neg).unwrap().full_update);
        assert!(!SyncDelta::parse(&d_float).unwrap().full_update);
    }

    #[test]
    fn test_parse_full_update_strings_one_zero_true_false() {
        let d_one = serde_json::json!({ "rid": 1, "full_update": "1" });
        let d_zero = serde_json::json!({ "rid": 1, "full_update": "0" });
        let d_true = serde_json::json!({ "rid": 1, "full_update": "true" });
        let d_false = serde_json::json!({ "rid": 1, "full_update": "false" });
        let d_title = serde_json::json!({ "rid": 1, "full_update": "True" });
        let d_upper = serde_json::json!({ "rid": 1, "full_update": "TRUE" });
        let d_yes = serde_json::json!({ "rid": 1, "full_update": "yes" });
        assert!(SyncDelta::parse(&d_one).unwrap().full_update);
        assert!(!SyncDelta::parse(&d_zero).unwrap().full_update);
        assert!(SyncDelta::parse(&d_true).unwrap().full_update);
        assert!(!SyncDelta::parse(&d_false).unwrap().full_update);
        assert!(SyncDelta::parse(&d_title).unwrap().full_update);
        // Case-sensitive for the boolean word: "TRUE" maps to false
        assert!(!SyncDelta::parse(&d_upper).unwrap().full_update);
        assert!(!SyncDelta::parse(&d_yes).unwrap().full_update);
    }

    #[test]
    fn test_parse_full_update_absent_or_null_or_other() {
        // Absent field defaults to false
        let absent = serde_json::json!({ "rid": 1 });
        assert!(!SyncDelta::parse(&absent).unwrap().full_update);
        // null, array, and object collapse to false
        let null_v = serde_json::json!({ "rid": 1, "full_update": null });
        let arr_v = serde_json::json!({ "rid": 1, "full_update": [true] });
        let obj_v = serde_json::json!({ "rid": 1, "full_update": { "v": true } });
        assert!(!SyncDelta::parse(&null_v).unwrap().full_update);
        assert!(!SyncDelta::parse(&arr_v).unwrap().full_update);
        assert!(!SyncDelta::parse(&obj_v).unwrap().full_update);
    }

    // --- T144.1: malformed container rejection ---

    #[test]
    fn test_parse_rejects_torrents_not_object() {
        for bad in [
            serde_json::json!([]),
            serde_json::json!("torrents"),
            serde_json::json!(5),
            serde_json::json!(true),
            serde_json::json!(null),
        ] {
            let delta = serde_json::json!({ "rid": 1, "torrents": bad });
            let err = SyncDelta::parse(&delta).expect_err("non-object torrents must fail");
            assert!(
                err.contains("torrents"),
                "error should name the field: {err}"
            );
            assert!(
                err.contains("JSON object"),
                "error should describe the expected shape: {err}"
            );
        }
    }

    #[test]
    fn test_parse_rejects_categories_not_object() {
        for bad in [
            serde_json::json!([]),
            serde_json::json!("cats"),
            serde_json::json!(0),
        ] {
            let delta = serde_json::json!({ "rid": 1, "categories": bad });
            let err = SyncDelta::parse(&delta).expect_err("non-object categories must fail");
            assert!(
                err.contains("categories"),
                "error should name the field: {err}"
            );
        }
    }

    #[test]
    fn test_parse_rejects_server_state_not_object() {
        for bad in [
            serde_json::json!([]),
            serde_json::json!("state"),
            serde_json::json!(7),
        ] {
            let delta = serde_json::json!({ "rid": 1, "server_state": bad });
            let err = SyncDelta::parse(&delta).expect_err("non-object server_state must fail");
            assert!(
                err.contains("server_state"),
                "error should name the field: {err}"
            );
        }
    }

    // --- T144.1: removal/tag array shape rejection ---

    #[test]
    fn test_parse_rejects_torrents_removed_not_string_array() {
        for bad in [
            serde_json::json!("abc"),
            serde_json::json!({ "abc": 1 }),
            serde_json::json!(7),
        ] {
            let delta = serde_json::json!({ "rid": 1, "torrents_removed": bad });
            let err = SyncDelta::parse(&delta).expect_err("non-array torrents_removed must fail");
            assert!(
                err.contains("torrents_removed"),
                "error should name the field: {err}"
            );
        }
        // Mixed array with non-string entry must fail
        let mixed = serde_json::json!({ "rid": 1, "torrents_removed": ["abc", 5] });
        let err = SyncDelta::parse(&mixed).expect_err("mixed-type entry must fail");
        assert!(
            err.contains("torrents_removed"),
            "error should name the field: {err}"
        );
    }

    #[test]
    fn test_parse_rejects_categories_removed_not_string_array() {
        let bad = serde_json::json!({ "rid": 1, "categories_removed": "docs" });
        let err = SyncDelta::parse(&bad).expect_err("non-array categories_removed must fail");
        assert!(
            err.contains("categories_removed"),
            "error should name the field: {err}"
        );
        let mixed = serde_json::json!({ "rid": 1, "categories_removed": [true, false] });
        let err = SyncDelta::parse(&mixed).expect_err("non-string entry must fail");
        assert!(err.contains("categories_removed"));
    }

    #[test]
    fn test_parse_rejects_tags_not_string_array() {
        let not_array = serde_json::json!({ "rid": 1, "tags": "tag1" });
        let err = SyncDelta::parse(&not_array).expect_err("non-array tags must fail");
        assert!(err.contains("tags"), "error should name the field: {err}");
        let mixed = serde_json::json!({ "rid": 1, "tags": ["ok", 9] });
        let err = SyncDelta::parse(&mixed).expect_err("non-string tag entry must fail");
        assert!(err.contains("tags"));
    }

    #[test]
    fn test_parse_rejects_tags_removed_not_string_array() {
        let not_array = serde_json::json!({ "rid": 1, "tags_removed": { "x": 1 } });
        let err = SyncDelta::parse(&not_array).expect_err("non-array tags_removed must fail");
        assert!(
            err.contains("tags_removed"),
            "error should name the field: {err}"
        );
        let mixed = serde_json::json!({ "rid": 1, "tags_removed": ["z", null] });
        let err = SyncDelta::parse(&mixed).expect_err("non-string tag entry must fail");
        assert!(err.contains("tags_removed"));
    }

    // --- T144.1: absent optional containers are still accepted ---

    #[test]
    fn test_parse_accepts_absent_optional_containers() {
        // Only `rid` and `full_update` set; every other field absent.
        let delta = serde_json::json!({ "rid": 1, "full_update": true });
        let parsed = SyncDelta::parse(&delta).expect("absent containers must be accepted");
        assert!(parsed.torrents.is_none());
        assert!(parsed.categories.is_none());
        assert!(parsed.server_state.is_none());
        assert!(parsed.torrents_removed.is_empty());
        assert!(parsed.categories_removed.is_empty());
        assert!(parsed.tags.is_empty());
        assert!(parsed.tags_removed.is_empty());
    }

    // --- T144.1: unknown row fields preserved via catch-all ---

    #[test]
    fn test_parse_preserves_unknown_torrent_row_fields_in_unknown_map() {
        // qBittorrent may emit fields we do not model; those fields must
        // be captured in the `unknown` catch-all map.
        let delta = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": {
                "abc": {
                    "hash": "abc",
                    "name": "X",
                    "future_field": { "nested": [1, 2, 3] },
                    "weird_array": ["a", 1, true, null]
                }
            }
        });
        let parsed = SyncDelta::parse(&delta).expect("unknown row fields must parse");
        let torrents_map = parsed.torrents.expect("torrents should be Some");
        let row = &torrents_map["abc"];
        assert_eq!(row.hash.as_ref().unwrap(), "abc");
        assert_eq!(row.name.as_ref().unwrap(), "X");
        // Unknown field captured in catch-all
        assert!(row.unknown.contains_key("future_field"));
        assert!(row.unknown.contains_key("weird_array"));
    }

    #[test]
    fn test_parse_preserves_unknown_server_state_fields_in_unknown_map() {
        let delta = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "server_state": {
                "dl_info_speed": 1000,
                "future_metric": "ok"
            }
        });
        let parsed = SyncDelta::parse(&delta).expect("unknown server_state fields must parse");
        let state = parsed.server_state.unwrap();
        assert_eq!(state.dl_info_speed.unwrap(), 1000);
        assert_eq!(
            state
                .unknown
                .get("future_metric")
                .unwrap()
                .as_str()
                .unwrap(),
            "ok"
        );
    }

    // --- T144.1: apply-level rejection for malformed deltas ---

    #[test]
    fn test_apply_rejects_malformed_torrents_container() {
        let mut acc = MaindataAccumulator::new();
        // First, a valid full update establishes state
        let good = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "torrents": { "abc": { "hash": "abc" } }
        });
        acc.apply(&good).unwrap();
        assert_eq!(acc.snapshot().torrents.len(), 1);

        // Now a malformed incremental delta with `torrents` as a string
        // must be rejected at the boundary without mutating state.
        let bad = serde_json::json!({
            "rid": 2,
            "full_update": false,
            "torrents": "not an object"
        });
        let err = acc.apply(&bad).expect_err("malformed torrents must fail");
        assert!(err.contains("torrents"));
        // State is preserved — rid did not advance and torrents untouched
        assert_eq!(acc.rid(), 1);
        assert_eq!(acc.snapshot().torrents.len(), 1);
        assert!(acc.snapshot().torrents.contains_key("abc"));
    }

    #[test]
    fn test_apply_rejects_malformed_tags_array() {
        let mut acc = MaindataAccumulator::new();
        let bad = serde_json::json!({
            "rid": 1,
            "full_update": true,
            "tags": ["ok", 42]
        });
        let err = acc.apply(&bad).expect_err("non-string tag entry must fail");
        assert!(err.contains("tags"));
    }
}
