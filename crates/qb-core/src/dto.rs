//! qBittorrent response DTO parsing — no Tauri dependencies.
//!
//! Provides typed parsers for categories, tags, and peer sync responses from the
//! qBittorrent Web API. All parsers return `BackendError::InvalidResponse` for
//! structural violations and `BackendError::Parse` for JSON decode errors.

use std::collections::BTreeMap;

use serde::de::Visitor;
use serde::{Deserialize, Deserializer, Serialize};

use crate::BackendError;

// ============================================================================
// Category DTOs
// ============================================================================

/// Single category object returned by `GET /api/v2/torrents/categories`.
///
/// The qBittorrent API returns the category name as both the map key and the
/// `name` field inside the value object. `savePath` maps to `save_path`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryDto {
    pub name: String,
    #[serde(rename = "savePath")]
    pub save_path: String,
}

/// Category map: keyed by category name. Parsed strictly — each entry must
/// have a valid `name` and `save_path` field or the whole map is rejected.
pub type Categories = BTreeMap<String, CategoryDto>;

/// Parse a raw JSON value into a [`Categories`] map.
///
/// Returns `InvalidResponse` if the JSON is not an object, if any category
/// entry is missing required fields, or if a field has the wrong type.
pub fn parse_categories(raw: &serde_json::Value) -> Result<Categories, BackendError> {
    let obj = raw
        .as_object()
        .ok_or_else(|| BackendError::invalid_response("categories must be a JSON object"))?;

    let mut cats = Categories::new();
    for (key, value) in obj {
        let dto: CategoryDto = serde_json::value::from_value(value.clone()).map_err(|e| {
            BackendError::invalid_response(format!(
                "category '{}' has malformed structure: {}",
                key, e
            ))
        })?;
        cats.insert(key.clone(), dto);
    }
    Ok(cats)
}

// ============================================================================
// Torrent properties DTOs
// ============================================================================

/// Torrent generic properties returned by `GET /api/v2/torrents/properties`.
///
/// Most fields are required. `isPrivate` is the only camelCase wire key in the
/// response and is **optional** — older qBittorrent versions may omit it.
/// It maps to `is_private` in Rust and serializes back to `isPrivate` in JSON
/// to match the shared TypeScript `TorrentProperties` interface.
///
/// Unknown top-level fields are silently ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentPropertiesDto {
    pub save_path: String,
    pub creation_date: i64,
    pub piece_size: i64,
    pub comment: String,
    pub total_wasted: i64,
    pub total_uploaded: i64,
    pub total_uploaded_session: i64,
    pub total_downloaded: i64,
    pub total_downloaded_session: i64,
    pub up_limit: i64,
    pub dl_limit: i64,
    pub time_elapsed: i64,
    pub seeding_time: i64,
    pub nb_connections: i64,
    pub nb_connections_limit: i64,
    pub share_ratio: f64,
    pub addition_date: i64,
    pub completion_date: i64,
    pub created_by: String,
    pub dl_speed_avg: i64,
    pub dl_speed: i64,
    pub eta: i64,
    pub last_seen: i64,
    pub peers: i64,
    pub peers_total: i64,
    pub pieces_have: i64,
    pub pieces_num: i64,
    pub reannounce: i64,
    pub seeds: i64,
    pub seeds_total: i64,
    pub total_size: i64,
    pub up_speed_avg: i64,
    pub up_speed: i64,
    #[serde(default)]
    #[serde(rename = "isPrivate")]
    pub is_private: Option<bool>,
}

/// Parse a raw JSON value into a strict [`TorrentPropertiesDto`].
///
/// Returns `InvalidResponse` if the JSON is not an object, or if any required
/// field is missing or has the wrong type.
pub fn parse_torrent_properties(
    raw: &serde_json::Value,
) -> Result<TorrentPropertiesDto, BackendError> {
    if !raw.is_object() {
        return Err(BackendError::invalid_response(
            "torrent properties must be a JSON object",
        ));
    }
    serde_json::value::from_value(raw.clone()).map_err(|e| {
        BackendError::invalid_response(format!(
            "torrent properties have malformed structure: {}",
            e
        ))
    })
}

// ============================================================================
// Tracker DTOs
// ============================================================================

/// Single tracker object returned by `GET /api/v2/torrents/trackers`.
///
/// All fields are required; missing fields or wrong types cause the parser
/// to reject the entire trackers array. Status values are 0..4 matching the
/// `TrackerStatus` enum in shared types.
///
/// Unknown fields on individual tracker entries are silently ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerDto {
    pub url: String,
    pub status: i32,
    pub tier: i32,
    pub num_peers: i32,
    pub num_seeds: i32,
    pub num_leeches: i32,
    pub num_downloaded: i32,
    pub msg: String,
}

/// Parse a raw JSON value into a strict `Vec<TrackerDto>` of trackers.
///
/// Returns `InvalidResponse` if the JSON is not an array, or if any tracker
/// entry is missing a required field or has the wrong type.
pub fn parse_torrent_trackers(raw: &serde_json::Value) -> Result<Vec<TrackerDto>, BackendError> {
    let arr = raw
        .as_array()
        .ok_or_else(|| BackendError::invalid_response("torrent trackers must be a JSON array"))?;

    let mut trackers = Vec::with_capacity(arr.len());
    for (i, item) in arr.iter().enumerate() {
        let dto: TrackerDto = serde_json::value::from_value(item.clone()).map_err(|e| {
            BackendError::invalid_response(format!(
                "torrent trackers[{}] has malformed structure: {}",
                i, e
            ))
        })?;
        trackers.push(dto);
    }
    Ok(trackers)
}

// ============================================================================
// Torrent file DTOs
// ============================================================================

/// Single torrent file object returned by `GET /api/v2/torrents/files`.
///
/// `piece_range` is a 2-element array `[start, end]` of piece indices.
/// Missing fields, wrong types, or a `piece_range` array of any length
/// other than 2 cause the parser to reject the payload.
///
/// `is_seed` defaults to `false` when absent — older qBittorrent versions
/// omit this field. Unknown fields on individual file entries are silently
/// ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentFileDto {
    pub index: i32,
    pub name: String,
    pub size: i64,
    pub progress: f64,
    pub priority: i32,
    #[serde(default)]
    pub is_seed: bool,
    pub piece_range: [i64; 2],
    pub availability: f64,
}

/// Parse a raw JSON value into a strict `Vec<TorrentFileDto>` of files.
///
/// Returns `InvalidResponse` if the JSON is not an array, or if any file
/// entry is missing a required field, has the wrong type, or has a
/// `piece_range` that is not a 2-element array.
pub fn parse_torrent_files(raw: &serde_json::Value) -> Result<Vec<TorrentFileDto>, BackendError> {
    let arr = raw
        .as_array()
        .ok_or_else(|| BackendError::invalid_response("torrent files must be a JSON array"))?;

    let mut files = Vec::with_capacity(arr.len());
    for (i, item) in arr.iter().enumerate() {
        let dto: TorrentFileDto = serde_json::value::from_value(item.clone()).map_err(|e| {
            BackendError::invalid_response(format!(
                "torrent files[{}] has malformed structure: {}",
                i, e
            ))
        })?;
        files.push(dto);
    }
    Ok(files)
}

// ============================================================================
// Torrent list DTOs
// ============================================================================
//
// qBittorrent `/api/v2/torrents/info` returns a JSON array of torrent rows.
// This module owns the Rust-side parser for that array.
//
// Required fields mirror `TorrentSchema` in
// `packages/shared/src/schemas/qbittorrent.ts` and the `Torrent` interface in
// `packages/shared/src/types/qbittorrent.ts`. Drift fields that the existing
// TypeScript schema already tolerates are modeled as `Option<T>`:
//
//   - `download_path` (added in newer qB versions; older builds omit it)
//   - `infohash_v1`    (optional in qB 4.6+)
//   - `infohash_v2`    (optional in qB 4.6+)
//   - `trackers_count` (added in API v2.x)
//   - `reannounce`     (added in API v2.9.3)
//   - `popularity`     (added in API v2.x)
//
// `state` is a `String`, not a narrow enum: qBittorrent state names vary
// across API versions and UI state grouping is the responsibility of the
// shared TypeScript helpers. `tags` is preserved as qBittorrent's
// comma-separated string (UI consumers call `parseTorrentTags` from
// `@taurent/shared` for membership checks).
//
// Unknown fields on individual rows are silently ignored (serde default).

/// Single torrent row returned by `GET /api/v2/torrents/info`.
///
/// Wire field names are snake_case to match qBittorrent's response and the
/// `Torrent` interface in `@taurent/shared`. All fields except the documented
/// drift fields (`download_path`, `infohash_v1`, `infohash_v2`,
/// `trackers_count`, `reannounce`, `popularity`) are required — the parser
/// rejects any row that omits or mistypes a required field. Unknown
/// additional fields on the wire are ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentDto {
    pub added_on: i64,
    pub amount_left: i64,
    pub auto_tmm: bool,
    pub availability: f64,
    pub category: String,
    pub completed: i64,
    pub completion_on: i64,
    pub content_path: String,
    pub dl_limit: i64,
    pub dlspeed: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub download_path: Option<String>,
    pub downloaded: i64,
    pub downloaded_session: i64,
    pub eta: i64,
    pub f_l_piece_prio: bool,
    pub force_start: bool,
    pub hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub infohash_v1: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub infohash_v2: Option<String>,
    pub last_activity: i64,
    pub magnet_uri: String,
    pub max_ratio: f64,
    pub max_seeding_time: i64,
    pub name: String,
    pub num_complete: i64,
    pub num_incomplete: i64,
    pub num_leechs: i64,
    pub num_seeds: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub popularity: Option<f64>,
    pub priority: i32,
    pub progress: f64,
    pub ratio: f64,
    pub ratio_limit: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reannounce: Option<i64>,
    pub save_path: String,
    pub seeding_time: i64,
    pub seeding_time_limit: i64,
    pub seen_complete: i64,
    pub seq_dl: bool,
    pub size: i64,
    pub state: String,
    pub super_seeding: bool,
    pub tags: String,
    pub time_active: i64,
    pub total_size: i64,
    pub tracker: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trackers_count: Option<i64>,
    pub up_limit: i64,
    pub uploaded: i64,
    pub uploaded_session: i64,
    pub upspeed: i64,
}

/// Parse the response of `GET /api/v2/torrents/info` into a strict
/// `Vec<TorrentDto>`.
///
/// Returns `InvalidResponse` if the JSON is not an array, or if any row is
/// missing a required field or has the wrong type. Returns `Ok(vec![])` for
/// an empty array. Drift fields that qBittorrent may omit are tolerated; any
/// unknown fields on individual rows are ignored.
pub fn parse_torrent_list(raw: &serde_json::Value) -> Result<Vec<TorrentDto>, BackendError> {
    let arr = raw
        .as_array()
        .ok_or_else(|| BackendError::invalid_response("torrent list must be a JSON array"))?;

    let mut torrents = Vec::with_capacity(arr.len());
    for (i, item) in arr.iter().enumerate() {
        let dto: TorrentDto = serde_json::value::from_value(item.clone()).map_err(|e| {
            BackendError::invalid_response(format!(
                "torrent list[{}] has malformed structure: {}",
                i, e
            ))
        })?;
        torrents.push(dto);
    }
    Ok(torrents)
}

// ============================================================================
// Tags DTOs
// ============================================================================

/// Parse a raw JSON value into a strict `Vec<String>` of tags.
///
/// Returns `InvalidResponse` if the JSON is not an array or if any array entry
/// is not a string. Rejects null, numbers, booleans, and objects — unlike the
/// prior art that silently dropped non-string entries.
pub fn parse_tags(raw: &serde_json::Value) -> Result<Vec<String>, BackendError> {
    let arr = raw
        .as_array()
        .ok_or_else(|| BackendError::invalid_response("tags must be a JSON array"))?;

    let mut tags = Vec::with_capacity(arr.len());
    for (i, item) in arr.iter().enumerate() {
        let s = item.as_str().ok_or_else(|| {
            BackendError::invalid_response(format!(
                "tags[{}] is not a string (type: {})",
                i,
                match item {
                    serde_json::Value::Null => "null",
                    serde_json::Value::Bool(_) => "bool",
                    serde_json::Value::Number(_) => "number",
                    serde_json::Value::String(_) => "string",
                    serde_json::Value::Array(_) => "array",
                    serde_json::Value::Object(_) => "object",
                }
            ))
        })?;
        tags.push(s.to_string());
    }
    Ok(tags)
}

// ============================================================================
// Peer sync DTOs
// ============================================================================

/// Peer data for a single remote peer in a [`SyncTorrentPeers`] delta.
///
/// All fields are optional — qBittorrent sends partial rows in incremental
/// deltas. Unknown fields in the incoming JSON are ignored.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncTorrentPeersPeerData {
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub client: Option<String>,
    #[serde(default)]
    pub progress: Option<f64>,
    #[serde(default, alias = "dlSpeed")]
    pub dl_speed: Option<i64>,
    #[serde(default, alias = "upSpeed")]
    pub up_speed: Option<i64>,
    #[serde(default)]
    pub downloaded: Option<i64>,
    #[serde(default)]
    pub uploaded: Option<i64>,
    #[serde(default)]
    pub connection: Option<String>,
    #[serde(default)]
    pub flags: Option<String>,
    #[serde(default, alias = "flagsDesc")]
    pub flags_desc: Option<String>,
    #[serde(default)]
    pub relevance: Option<f64>,
    #[serde(default)]
    pub files: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default, alias = "countryCode")]
    pub country_code: Option<String>,
}

/// Deserializer that normalizes qBittorrent's inconsistent `full_update` field
/// into a strict boolean.
///
/// Accepted truthy forms: `true`, `1`, `"1"`, `"true"` (case-insensitive).
/// All other values (including absent, `false`, `0`, `"0"`, `"false"`,
/// arbitrary strings) map to `false`.
fn deserialize_full_update<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum RawFullUpdate {
        Bool(bool),
        Number(serde_json::Number),
        String(String),
        Null,
    }

    let raw = RawFullUpdate::deserialize(deserializer)?;
    let is_true = match raw {
        RawFullUpdate::Bool(b) => b,
        RawFullUpdate::Number(n) => n.is_i64() && n.as_i64().unwrap() == 1,
        RawFullUpdate::String(s) => {
            let lower = s.to_lowercase();
            lower == "true" || lower == "1"
        }
        RawFullUpdate::Null => false,
    };
    Ok(is_true)
}

/// qBittorrent `/sync/torrentPeers` response delta.
///
/// `rid` is required; missing or non-numeric `rid` returns `InvalidResponse`.
/// `full_update` is tolerant (see [`deserialize_full_update`]).
/// `peers` and `peers_removed` are optional.
/// Unknown top-level fields are ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncTorrentPeers {
    /// Required revision ID. Must be a number.
    pub rid: i64,

    /// True for full deltas, false for incremental. Accepts boolean, number 0/1,
    /// string "0"/"1"/"true"/"false", or absent.
    #[serde(default, deserialize_with = "deserialize_full_update")]
    pub full_update: bool,

    /// Map of peer address → peer data. Optional.
    #[serde(default, rename = "peers")]
    pub peers: Option<BTreeMap<String, SyncTorrentPeersPeerData>>,

    /// List of peer addresses that have been removed. Optional.
    #[serde(default, rename = "peers_removed")]
    pub peers_removed: Option<Vec<String>>,
}

/// Parse a raw JSON value into a [`SyncTorrentPeers`] struct.
///
/// Returns `InvalidResponse` if `rid` is missing or not a number.
/// Returns `Parse` if the JSON itself is malformed.
pub fn parse_sync_torrent_peers(raw: &serde_json::Value) -> Result<SyncTorrentPeers, BackendError> {
    // First check rid exists and is a number before delegating to serde
    let rid = raw
        .get("rid")
        .ok_or_else(|| BackendError::invalid_response("sync_torrent_peers missing 'rid' field"))?;
    if !rid.is_i64() {
        return Err(BackendError::invalid_response(
            "sync_torrent_peers 'rid' must be a number",
        ));
    }

    serde_json::value::from_value(raw.clone())
        .map_err(|e| BackendError::parse(format!("sync_torrent_peers parse error: {}", e), None))
}

// ============================================================================
// WebSeed DTOs
// ============================================================================

/// Single web seed object returned by `GET /api/v2/torrents/webseeds`.
///
/// `url` is required. Unknown fields on individual entries are silently
/// ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSeedDto {
    pub url: String,
}

/// Parse a raw JSON value into a strict `Vec<WebSeedDto>` of web seeds.
///
/// Returns `InvalidResponse` if the JSON is not an array, or if any entry
/// is missing the required `url` field or has the wrong type.
pub fn parse_webseeds(raw: &serde_json::Value) -> Result<Vec<WebSeedDto>, BackendError> {
    let arr = raw
        .as_array()
        .ok_or_else(|| BackendError::invalid_response("webseeds must be a JSON array"))?;

    let mut seeds = Vec::with_capacity(arr.len());
    for (i, item) in arr.iter().enumerate() {
        let dto: WebSeedDto = serde_json::value::from_value(item.clone()).map_err(|e| {
            BackendError::invalid_response(format!(
                "webseeds[{}] has malformed structure: {}",
                i, e
            ))
        })?;
        seeds.push(dto);
    }
    Ok(seeds)
}

// ============================================================================
// Transfer info DTOs
// ============================================================================

/// Transfer info returned by `GET /api/v2/transfer/info`.
///
/// Core fields are required. `free_space_on_disk` is optional — qBittorrent
/// added it in a later API version and it may be absent on older builds.
/// Unknown fields are silently ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferInfoDto {
    pub dl_info_speed: i64,
    pub dl_info_data: i64,
    pub up_info_speed: i64,
    pub up_info_data: i64,
    pub dl_rate_limit: i64,
    pub up_rate_limit: i64,
    pub dht_nodes: i64,
    pub connection_status: String,
    pub queueing: bool,
    pub use_alt_speed_limits: bool,
    pub refresh_interval: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub free_space_on_disk: Option<i64>,
}

/// Parse a raw JSON value into a [`TransferInfoDto`].
///
/// Returns `InvalidResponse` if the JSON is not an object, or if any required
/// field is missing or has the wrong type.
pub fn parse_transfer_info(raw: &serde_json::Value) -> Result<TransferInfoDto, BackendError> {
    if !raw.is_object() {
        return Err(BackendError::invalid_response(
            "transfer info must be a JSON object",
        ));
    }
    serde_json::value::from_value(raw.clone()).map_err(|e| {
        BackendError::invalid_response(format!("transfer info has malformed structure: {}", e))
    })
}

// ============================================================================
// Build info DTOs
// ============================================================================

/// Build info returned by `GET /api/v2/app/buildInfo` (added in Web API v2.3.0).
///
/// The five long-standing documented fields (`qt`, `libtorrent`, `boost`,
/// `openssl`, `bitness`) are required. `zlib` and `platform` are optional
/// typed extras that newer qBittorrent builds include. Unknown fields are
/// silently ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildInfoDto {
    pub qt: String,
    pub libtorrent: String,
    pub boost: String,
    pub openssl: String,
    pub bitness: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub zlib: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
}

/// Parse a raw JSON value into a [`BuildInfoDto`].
///
/// Returns `InvalidResponse` if the JSON is not an object, or if any required
/// field is missing or has the wrong type.
pub fn parse_build_info(raw: &serde_json::Value) -> Result<BuildInfoDto, BackendError> {
    if !raw.is_object() {
        return Err(BackendError::invalid_response(
            "build info must be a JSON object",
        ));
    }
    serde_json::value::from_value(raw.clone()).map_err(|e| {
        BackendError::invalid_response(format!("build info has malformed structure: {}", e))
    })
}

// ============================================================================
// Maindata Row DTOs
// ============================================================================

fn deserialize_option_string_or_number<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        None | Some(serde_json::Value::Null) => None,
        Some(serde_json::Value::String(s)) => Some(s),
        Some(serde_json::Value::Number(n)) => Some(n.to_string()),
        Some(other) => Some(other.to_string()),
    })
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct MaindataTorrentRow {
    #[serde(default)]
    pub hash: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub progress: Option<f64>,
    #[serde(default)]
    pub dlspeed: Option<i64>,
    #[serde(default)]
    pub upspeed: Option<i64>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub num_leechs: Option<i64>,
    #[serde(default)]
    pub num_seeds: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub total_size: Option<i64>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
    #[serde(default)]
    pub added_on: Option<i64>,
    #[serde(default)]
    pub completion_on: Option<i64>,
    #[serde(default)]
    pub tracker: Option<String>,
    #[serde(default)]
    pub ratio: Option<f64>,
    #[serde(default)]
    pub ratio_limit: Option<f64>,
    #[serde(default)]
    pub save_path: Option<String>,
    #[serde(default)]
    pub content_path: Option<String>,
    #[serde(default)]
    pub auto_tmm: Option<bool>,
    #[serde(default)]
    pub super_seeding: Option<bool>,
    #[serde(default)]
    pub force_start: Option<bool>,
    #[serde(default)]
    pub last_activity: Option<i64>,
    #[serde(default)]
    pub availability: Option<f64>,
    #[serde(default)]
    pub seen_complete: Option<i64>,
    #[serde(default)]
    pub time_active: Option<i64>,
    #[serde(default)]
    pub eta: Option<i64>,
    #[serde(default)]
    pub f_l_piece_prio: Option<bool>,
    #[serde(default)]
    pub max_ratio: Option<f64>,
    #[serde(default)]
    pub max_seeding_time: Option<i64>,
    #[serde(default)]
    pub num_complete: Option<i64>,
    #[serde(default)]
    pub num_incomplete: Option<i64>,
    #[serde(default)]
    pub seeding_time: Option<i64>,
    #[serde(default)]
    pub seeding_time_limit: Option<i64>,
    #[serde(default)]
    pub amount_left: Option<i64>,
    #[serde(default)]
    pub completed: Option<i64>,
    #[serde(default)]
    pub dl_limit: Option<i64>,
    #[serde(default)]
    pub up_limit: Option<i64>,
    #[serde(default)]
    pub uploaded: Option<i64>,
    #[serde(default)]
    pub uploaded_session: Option<i64>,
    #[serde(default)]
    pub downloaded: Option<i64>,
    #[serde(default)]
    pub downloaded_session: Option<i64>,
    #[serde(default)]
    pub magnet_uri: Option<String>,
    #[serde(default)]
    pub seq_dl: Option<bool>,
    #[serde(default)]
    pub inactive_seeding_time: Option<i64>,
    #[serde(default)]
    pub download_path: Option<String>,
    #[serde(default)]
    pub infohash_v1: Option<String>,
    #[serde(default)]
    pub infohash_v2: Option<String>,
    #[serde(default)]
    pub trackers_count: Option<i64>,
    #[serde(default)]
    pub reannounce: Option<i64>,
    #[serde(default)]
    pub popularity: Option<f64>,
    #[serde(default, rename = "isPrivate")]
    pub is_private: Option<bool>,
    #[serde(flatten)]
    pub unknown: BTreeMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct MaindataCategoryRow {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, rename = "savePath")]
    pub save_path: Option<String>,
    #[serde(flatten)]
    pub unknown: BTreeMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct MaindataServerState {
    #[serde(default)]
    pub dl_info_speed: Option<i64>,
    #[serde(default)]
    pub dl_info_data: Option<i64>,
    #[serde(default)]
    pub up_info_speed: Option<i64>,
    #[serde(default)]
    pub up_info_data: Option<i64>,
    #[serde(default)]
    pub dl_rate_limit: Option<i64>,
    #[serde(default)]
    pub up_rate_limit: Option<i64>,
    #[serde(default)]
    pub dht_nodes: Option<i64>,
    #[serde(default)]
    pub connection_status: Option<String>,
    #[serde(default)]
    pub queueing: Option<bool>,
    #[serde(default)]
    pub use_alt_speed_limits: Option<bool>,
    #[serde(default)]
    pub refresh_interval: Option<i64>,
    #[serde(default)]
    pub free_space_on_disk: Option<i64>,
    #[serde(default)]
    pub alltime_dl: Option<i64>,
    #[serde(default)]
    pub alltime_ul: Option<i64>,
    #[serde(default)]
    pub average_time_queue: Option<i64>,
    #[serde(default)]
    pub global_ratio: Option<String>,
    #[serde(default)]
    pub queued_io_jobs: Option<i64>,
    #[serde(default)]
    pub read_cache_hits: Option<f64>,
    #[serde(default, deserialize_with = "deserialize_option_string_or_number")]
    pub read_cache_overload: Option<String>,
    #[serde(default)]
    pub total_buffers_size: Option<i64>,
    #[serde(default)]
    pub total_peer_connections: Option<i64>,
    #[serde(default)]
    pub total_queued_size: Option<i64>,
    #[serde(default)]
    pub total_wasted_session: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_option_string_or_number")]
    pub write_cache_overload: Option<String>,
    #[serde(flatten)]
    pub unknown: BTreeMap<String, serde_json::Value>,
}

// ============================================================================
// Search DTOs
// ============================================================================

/// Single search status object returned by `GET /api/v2/search/status`.
///
/// Wire field names use snake_case. `status` is a free-form string
/// (`"Running"`, `"Paused"`, `"Stopped"`, `"Error"`, …) — the controller
/// normalizes the string to a closed UI enum. `error` is only present when
/// the search engine reported a failure. Unknown fields are silently
/// ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchStatusDto {
    pub id: i32,
    pub status: String,
    pub total: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Single search result row returned by `GET /api/v2/search/results`.
///
/// All fields are required. Numeric fields (`file_size`, `nb_leechers`,
/// `nb_seeders`) must be JSON numbers; string-encoded numbers are rejected
/// to keep the validation boundary strict. Unknown fields are silently
/// ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultDto {
    #[serde(rename = "descrLink")]
    pub descr_link: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "fileSize")]
    pub file_size: i64,
    #[serde(rename = "fileUrl")]
    pub file_url: String,
    #[serde(rename = "nbLeechers")]
    pub nb_leechers: i32,
    #[serde(rename = "nbSeeders")]
    pub nb_seeders: i32,
    #[serde(rename = "siteUrl")]
    pub site_url: String,
}

/// Wrapper response for `GET /api/v2/search/results`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultsDto {
    pub results: Vec<SearchResultDto>,
    pub total: i32,
}

/// Single supported category of a search plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPluginCategoryDto {
    pub id: String,
    pub name: String,
}

/// Single plugin object returned by `GET /api/v2/search/plugins`.
///
/// All required fields must be present. `supportedCategories` defaults to
/// an empty list when absent or omitted. Unknown fields are silently
/// ignored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPluginDto {
    pub name: String,
    #[serde(rename = "fullName")]
    pub full_name: String,
    pub version: String,
    pub enabled: bool,
    pub url: String,
    #[serde(
        rename = "supportedCategories",
        default,
        skip_serializing_if = "Vec::is_empty"
    )]
    pub supported_categories: Vec<SearchPluginCategoryDto>,
}

// ----------------------------------------------------------------------------
// Search parsers
// ----------------------------------------------------------------------------

/// Parse the response of `POST /api/v2/search/start` into an `i32` search ID.
///
/// qBittorrent has historically returned the search ID in any of these
/// shapes:
///
/// - a JSON string that parses as `i32` (e.g. `"0"`),
/// - a JSON integer that fits in `i32`,
/// - a JSON object with an `id` field whose value is either a number or a
///   string.
///
/// Returns `InvalidResponse` for any other shape, for non-integer numbers,
/// for string values that don't parse as `i32`, or for numbers outside the
/// `i32` range.
pub fn parse_search_start_id(raw: &serde_json::Value) -> Result<i32, BackendError> {
    match raw {
        serde_json::Value::String(s) => s.parse::<i32>().map_err(|e| {
            BackendError::invalid_response(format!(
                "start_search returned an unparseable string '{}': {}",
                s, e
            ))
        }),
        serde_json::Value::Number(n) => {
            let as_i64 = n.as_i64().ok_or_else(|| {
                BackendError::invalid_response(format!(
                    "start_search returned a non-integer number: {}",
                    n
                ))
            })?;
            i32::try_from(as_i64).map_err(|_| {
                BackendError::invalid_response(format!(
                    "start_search returned a number out of i32 range: {}",
                    as_i64
                ))
            })
        }
        serde_json::Value::Object(obj) => {
            let id_val = obj.get("id").ok_or_else(|| {
                BackendError::invalid_response("start_search response missing 'id' field")
            })?;
            match id_val {
                serde_json::Value::Number(n) => {
                    let as_i64 = n.as_i64().ok_or_else(|| {
                        BackendError::invalid_response(format!(
                            "start_search 'id' is a non-integer number: {}",
                            n
                        ))
                    })?;
                    i32::try_from(as_i64).map_err(|_| {
                        BackendError::invalid_response(format!(
                            "start_search 'id' is out of i32 range: {}",
                            as_i64
                        ))
                    })
                }
                serde_json::Value::String(s) => s.parse::<i32>().map_err(|e| {
                    BackendError::invalid_response(format!(
                        "start_search 'id' string '{}' is not a valid i32: {}",
                        s, e
                    ))
                }),
                _ => Err(BackendError::invalid_response(format!(
                    "start_search 'id' field has unexpected JSON type: {}",
                    id_val
                ))),
            }
        }
        _ => Err(BackendError::invalid_response(format!(
            "start_search returned an unexpected JSON type: {}",
            raw
        ))),
    }
}

/// Parse the response of `GET /api/v2/search/status` into a list of statuses.
///
/// The endpoint returns either a single status object (when called with an
/// explicit `id` query parameter) or an array of status objects (when
/// called without one). A `null` payload yields an empty list. Any other
/// top-level shape, or a malformed status entry, is rejected.
pub fn parse_search_statuses(
    raw: &serde_json::Value,
) -> Result<Vec<SearchStatusDto>, BackendError> {
    if raw.is_null() {
        return Ok(Vec::new());
    }
    if let serde_json::Value::Array(arr) = raw {
        let mut out = Vec::with_capacity(arr.len());
        for (i, item) in arr.iter().enumerate() {
            let dto: SearchStatusDto =
                serde_json::value::from_value(item.clone()).map_err(|e| {
                    BackendError::invalid_response(format!(
                        "search status[{}] has malformed structure: {}",
                        i, e
                    ))
                })?;
            out.push(dto);
        }
        return Ok(out);
    }
    // Treat a single object as a one-element list.
    let dto: SearchStatusDto = serde_json::value::from_value(raw.clone()).map_err(|e| {
        BackendError::invalid_response(format!("search status has malformed structure: {}", e))
    })?;
    Ok(vec![dto])
}

/// Parse the wrapper response of `GET /api/v2/search/results` into a
/// [`SearchResultsDto`].
pub fn parse_search_results(raw: &serde_json::Value) -> Result<SearchResultsDto, BackendError> {
    if !raw.is_object() {
        return Err(BackendError::invalid_response(
            "search results must be a JSON object",
        ));
    }
    serde_json::value::from_value::<SearchResultsDto>(raw.clone()).map_err(|e| {
        BackendError::invalid_response(format!("search results have malformed structure: {}", e))
    })
}

/// Parse the response of `GET /api/v2/search/plugins` into a list of
/// [`SearchPluginDto`].
pub fn parse_search_plugins(raw: &serde_json::Value) -> Result<Vec<SearchPluginDto>, BackendError> {
    let arr = raw
        .as_array()
        .ok_or_else(|| BackendError::invalid_response("search plugins must be a JSON array"))?;

    let mut plugins = Vec::with_capacity(arr.len());
    for (i, item) in arr.iter().enumerate() {
        let dto: SearchPluginDto = serde_json::value::from_value(item.clone()).map_err(|e| {
            BackendError::invalid_response(format!(
                "search plugin[{}] has malformed structure: {}",
                i, e
            ))
        })?;
        plugins.push(dto);
    }
    Ok(plugins)
}

// ============================================================================
// RSS DTOs
// ============================================================================
//
// qBittorrent returns RSS items and rules in three legacy shapes. The renderer
// previously normalized these shapes in TypeScript (`normalizeRSSItems` /
// `normalizeRSSRules` in `packages/web-core/src/rss/useRssController.ts`).
// This module moves the normalization behind the Rust boundary so the wire
// shape sent to the renderer is a flat array of `RssItemDto` / `RssRuleDto`,
// preserving the field names and semantics the UI already consumes.
//
// The three accepted input shapes for items are:
//
// 1. Keyed tree (qB's standard `/rss/items` response):
//      { "Feed Name": "https://...", "Folder": { "Nested": "https://..." } }
//    Object keys are feed/folder names. String values are feed URLs (leaves).
//    Object values are sub-folders (recurse). Canonical paths accumulate
//    parent keys joined with `\\` (qB's RSS path separator). Empty/whitespace
//    string leaves and `null` leaves are skipped. Non-string, non-object
//    leaves are ignored. The flattener does NOT emit folder rows; only feed
//    leaves produce items. Top-level metadata keys (`session_generation`,
//    `server_id`) are skipped.
//
// 2. Array of simple items:
//      [ { "name": "...", "url": "...", "path": "..." }, ... ]
//
// 3. Legacy `{ feeds, folders }` shape:
//      { "feeds": [ { "name", "url" } ], "folders": [ { "name" } ] }
//
// Rules are accepted as either:
//
// - Object keyed by rule name (qB's standard):
//     { "Rule 1": { "enabled": true, ... }, "Rule 2": { ... } }
//
// - Object with a `rules` array wrapper:
//     { "rules": [ { "name": "Rule 1", "enabled": true, ... } ] }
//
// Both camelCase and snake_case aliases are accepted on rule fields to keep
// compatibility with qBittorrent versions that emit either form.

/// qBittorrent RSS path separator used when flattening keyed trees.
const RSS_PATH_SEP: &str = "\\";

/// Top-level metadata keys that should be skipped when walking an RSS keyed
/// tree. These are the keys `sharedBridge` injects into command envelopes and
/// should never be treated as feed/folder names.
const RSS_METADATA_KEYS: &[&str] = &["session_generation", "server_id"];

/// Render-facing RSS item row returned to the renderer.
///
/// Wire field names mirror the TypeScript `NormalizedRSSItem` shape so the
/// renderer code does not need to change when the response source moves from
/// the legacy `useRssController` normalizer to `qb-core::dto`. `url` and `uid`
/// are optional so the keyed-tree flattener can emit feed leaves without a
/// URL (which qBittorrent never produces) and the legacy-array/folder
/// normalizer can emit folder rows without a URL.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RssItemDto {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
}

/// Deserializer that accepts number, boolean, string, or null and normalizes
/// to an `i64`. This handles qBittorrent version type inconsistencies where
/// some preference fields (especially select/enum fields) may arrive as
/// booleans (v5.x) or numbers (v4.x).
///
/// - Number → used as-is
/// - Boolean → 0 or 1
/// - String → parsed as i64 (default 0 on parse failure)
/// - Null → 0
fn deserialize_loose_number<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Loose {
        Int(i64),
        Bool(bool),
        String(String),
        Null,
    }

    match Loose::deserialize(deserializer)? {
        Loose::Int(n) => Ok(n),
        Loose::Bool(b) => Ok(if b { 1 } else { 0 }),
        Loose::String(s) => Ok(s.parse().unwrap_or(0)),
        Loose::Null => Ok(0),
    }
}

/// Like [`deserialize_loose_number`] but returns `Option<i64>` for use with
/// the [`PreferencesUpdateDto`] struct. `null` deserializes to `None`, and
/// all accepted loose-number values are wrapped in `Some`.
fn deserialize_loose_number_option<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    struct LooseNumberOptionVisitor;

    impl<'de> Visitor<'de> for LooseNumberOptionVisitor {
        type Value = Option<i64>;

        fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "a loose number or null")
        }

        fn visit_none<E>(self) -> Result<Option<i64>, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }

        fn visit_some<D>(self, deserializer: D) -> Result<Option<i64>, D::Error>
        where
            D: Deserializer<'de>,
        {
            deserialize_loose_number(deserializer).map(Some)
        }

        fn visit_unit<E>(self) -> Result<Option<i64>, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
    }

    deserializer.deserialize_option(LooseNumberOptionVisitor)
}

/// Newtype wrapper around `i64` for map values that accept the same
/// loose-number inputs as [`deserialize_loose_number`] — numbers, booleans,
/// parseable strings, and null — but works as a map value type for
/// `BTreeMap<String, LooseNumberMapValue>`.
///
/// Serializes transparently as `i64`.
#[derive(Debug, Clone, Copy)]
pub struct LooseNumberMapValue(pub i64);

impl Serialize for LooseNumberMapValue {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.0.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for LooseNumberMapValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserialize_loose_number(deserializer).map(LooseNumberMapValue)
    }
}

/// Loose boolean deserializer matching JavaScript `Boolean(value)` semantics
/// for the qB RSS boolean fields.
///
/// Truthy values: `true`, any non-zero number, any non-empty string, any
/// object, any array. Falsy values: `false`, `0`, `""`, `null`. This is
/// intentionally permissive because the TypeScript normalizer used
/// `Boolean(r.enabled)` and similar coercions, and the compatibility target
/// is current behavior.
fn deserialize_rss_loose_bool<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(match value {
        serde_json::Value::Null => false,
        serde_json::Value::Bool(b) => b,
        serde_json::Value::Number(n) => n.as_f64().map(|f| f != 0.0).unwrap_or(false),
        serde_json::Value::String(s) => !s.is_empty(),
        // JavaScript Boolean() coerces objects and arrays to true.
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => true,
    })
}

/// Render-facing RSS rule row returned to the renderer.
///
/// All fields except `name`, `enabled`, and the boolean flags default to
/// safe values (empty string / empty array / 0) when the upstream payload
/// omits them. Field names serialize back to camelCase to match the wire
/// contract. Input parsing accepts both camelCase and snake_case aliases so
/// the parser handles qBittorrent versions that emit either form.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RssRuleDto {
    pub name: String,
    #[serde(deserialize_with = "deserialize_rss_loose_bool", default)]
    pub enabled: bool,
    #[serde(rename = "mustContain", alias = "must_contain", default)]
    pub must_contain: String,
    #[serde(rename = "mustNotContain", alias = "must_not_contain", default)]
    pub must_not_contain: String,
    #[serde(
        rename = "useRegex",
        alias = "use_regex",
        default,
        deserialize_with = "deserialize_rss_loose_bool"
    )]
    pub use_regex: bool,
    #[serde(rename = "episodeFilter", alias = "episode_filter", default)]
    pub episode_filter: String,
    #[serde(
        rename = "smartFilter",
        alias = "smart_filter",
        default,
        deserialize_with = "deserialize_rss_loose_bool"
    )]
    pub smart_filter: bool,
    #[serde(
        rename = "affectedFeeds",
        alias = "affected_feeds",
        alias = "feeds",
        default
    )]
    pub affected_feeds: Vec<String>,
    #[serde(rename = "ignoreDays", alias = "ignore_days", default)]
    pub ignore_days: i64,
    #[serde(rename = "lastMatch", alias = "last_match", default)]
    pub last_match: String,
    #[serde(
        rename = "addPaused",
        alias = "add_paused",
        default,
        deserialize_with = "deserialize_rss_loose_bool"
    )]
    pub add_paused: bool,
    #[serde(rename = "assignedCategory", alias = "assigned_category", default)]
    pub assigned_category: String,
    #[serde(rename = "savePath", alias = "save_path", default)]
    pub save_path: String,
}

// ----------------------------------------------------------------------------
// RSS item parsing
// ----------------------------------------------------------------------------

/// Recursive helper that flattens a qBittorrent keyed RSS tree into feed
/// leaves. Skips metadata keys, skips empty/whitespace string leaves, skips
/// `null` leaves, recurses into object values (folders), and ignores any
/// other leaf shape. Does NOT emit folder rows.
fn flatten_rss_keyed_tree(
    obj: &serde_json::Map<String, serde_json::Value>,
    path: &mut Vec<String>,
    out: &mut Vec<RssItemDto>,
) {
    for (key, value) in obj {
        if RSS_METADATA_KEYS.contains(&key.as_str()) {
            continue;
        }

        if let Some(s) = value.as_str() {
            // Empty/whitespace leaves are skipped (matches TS behavior).
            if s.trim().is_empty() {
                continue;
            }
            let canonical_path = if path.is_empty() {
                key.clone()
            } else {
                let mut joined = path.join(RSS_PATH_SEP);
                joined.push_str(RSS_PATH_SEP);
                joined.push_str(key);
                joined
            };
            out.push(RssItemDto {
                name: key.clone(),
                url: Some(s.to_string()),
                is_folder: false,
                path: canonical_path,
                uid: None,
            });
        } else if let Some(nested) = value.as_object() {
            path.push(key.clone());
            flatten_rss_keyed_tree(nested, path, out);
            path.pop();
        }
        // null, numbers, booleans, arrays: skipped silently, matching the
        // TypeScript implementation which only handles string and object
        // leaves and otherwise drops the entry.
    }
}

/// Normalize a single legacy RSS item (from an array element or a
/// `{ feeds, folders }` payload). Returns the normalized DTO with `isFolder`
/// inferred from the presence of a usable URL.
fn normalize_rss_item_simple(raw: &serde_json::Value) -> RssItemDto {
    let obj = match raw.as_object() {
        Some(o) => o,
        None => {
            return RssItemDto {
                name: String::new(),
                url: None,
                is_folder: false,
                path: String::new(),
                uid: None,
            };
        }
    };

    let name = obj
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let url = obj
        .get("url")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let path = obj
        .get("path")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| name.clone());
    let uid = obj.get("uid").and_then(|v| match v {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    });

    RssItemDto {
        is_folder: url.is_none(),
        name,
        url,
        path,
        uid,
    }
}

/// Parse a raw RSS items response into a flat `Vec<RssItemDto>`.
///
/// Accepts the three legacy qBittorrent payload shapes documented at the
/// top of this section. Returns `Ok(vec![])` for null, missing, or empty
/// inputs so the renderer can render an empty list. Returns
/// `BackendError::InvalidResponse` when the top-level shape cannot be safely
/// interpreted (e.g. a JSON number or boolean at the root).
pub fn parse_rss_items(raw: &serde_json::Value) -> Result<Vec<RssItemDto>, BackendError> {
    if raw.is_null() {
        return Ok(Vec::new());
    }

    if let Some(arr) = raw.as_array() {
        let mut out = Vec::new();
        for item in arr {
            let normalized = normalize_rss_item_simple(item);
            // Legacy array shape: skip rows missing both name and url.
            if !normalized.name.is_empty() && normalized.url.is_some() {
                out.push(normalized);
            }
        }
        return Ok(out);
    }

    if let Some(obj) = raw.as_object() {
        // Legacy { feeds, folders } shape — must be detected before keyed
        // tree because feeds/folders entries are objects.
        if obj.get("feeds").map(|v| v.is_array()).unwrap_or(false)
            || obj.get("folders").map(|v| v.is_array()).unwrap_or(false)
        {
            let mut out = Vec::new();
            if let Some(feeds) = obj.get("feeds").and_then(|v| v.as_array()) {
                for f in feeds {
                    let normalized = normalize_rss_item_simple(f);
                    if !normalized.name.is_empty() && normalized.url.is_some() {
                        out.push(normalized);
                    }
                }
            }
            if let Some(folders) = obj.get("folders").and_then(|v| v.as_array()) {
                for f in folders {
                    let normalized = normalize_rss_item_simple(f);
                    if !normalized.name.is_empty() {
                        // Folder rows have no url; isFolder is already true.
                        out.push(normalized);
                    }
                }
            }
            return Ok(out);
        }

        // Keyed tree shape: recurse and flatten.
        let mut out = Vec::new();
        let mut path: Vec<String> = Vec::new();
        flatten_rss_keyed_tree(obj, &mut path, &mut out);
        return Ok(out);
    }

    Err(BackendError::invalid_response(
        "rss items must be a JSON object or array",
    ))
}

// ----------------------------------------------------------------------------
// RSS rule parsing
// ----------------------------------------------------------------------------

/// Extract an `affectedFeeds` value from a rule object, accepting the three
/// known aliases and tolerating both array and comma-separated string
/// encodings (matching the TypeScript normalizer).
fn extract_rss_affected_feeds(obj: &serde_json::Map<String, serde_json::Value>) -> Vec<String> {
    let raw = obj
        .get("affectedFeeds")
        .or_else(|| obj.get("affected_feeds"))
        .or_else(|| obj.get("feeds"));
    match raw {
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        Some(serde_json::Value::String(s)) => s
            .split(',')
            .map(|part| part.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        _ => Vec::new(),
    }
}

/// Extract a strictly-numeric integer field, accepting the camelCase and
/// snake_case aliases. Non-numeric values fall back to the default.
fn extract_rss_int_field(
    obj: &serde_json::Map<String, serde_json::Value>,
    camel: &str,
    snake: &str,
) -> i64 {
    let raw = obj.get(camel).or_else(|| obj.get(snake));
    match raw {
        Some(serde_json::Value::Number(n)) => n.as_i64().unwrap_or(0),
        _ => 0,
    }
}

/// Extract a strictly-string field, accepting the camelCase and snake_case
/// aliases. Non-string values fall back to the empty string default.
fn extract_rss_string_field(
    obj: &serde_json::Map<String, serde_json::Value>,
    camel: &str,
    snake: &str,
) -> String {
    let raw = obj.get(camel).or_else(|| obj.get(snake));
    match raw {
        Some(serde_json::Value::String(s)) => s.clone(),
        _ => String::new(),
    }
}

/// Parse a raw RSS rules response into a flat `Vec<RssRuleDto>`.
///
/// Accepts the keyed (`{ "Rule 1": {...}, ... }`) and wrapped array
/// (`{ "rules": [...] }`) shapes documented above. Returns `Ok(vec![])` for
/// null, missing, or empty inputs. Returns `BackendError::InvalidResponse`
/// when the top-level shape cannot be safely interpreted.
///
/// The `name` field is taken from the top-level key in the keyed shape or
/// from the `name` / `ruleName` field in the array shape. Rules with an
/// empty name are skipped in the array shape (matching the TypeScript
/// normalizer) and the keyed shape treats the key as authoritative (it
/// cannot be empty because it IS the key).
pub fn parse_rss_rules(raw: &serde_json::Value) -> Result<Vec<RssRuleDto>, BackendError> {
    if raw.is_null() {
        return Ok(Vec::new());
    }

    let obj = match raw.as_object() {
        Some(o) => o,
        None => {
            return Err(BackendError::invalid_response(
                "rss rules must be a JSON object or array",
            ));
        }
    };

    // Wrapped array shape: { "rules": [...] }
    if let Some(rules_arr) = obj.get("rules").and_then(|v| v.as_array()) {
        let mut out = Vec::new();
        for raw_rule in rules_arr {
            // Tolerate a bare string rule (treat as empty rule data).
            let rule_obj = match raw_rule {
                serde_json::Value::Object(o) => o,
                serde_json::Value::String(s) => {
                    out.push(RssRuleDto {
                        name: s.clone(),
                        ..default_rss_rule()
                    });
                    continue;
                }
                _ => continue,
            };
            let name = rule_obj
                .get("name")
                .and_then(|v| v.as_str())
                .or_else(|| rule_obj.get("ruleName").and_then(|v| v.as_str()))
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }
            out.push(RssRuleDto {
                name,
                enabled: rule_obj
                    .get("enabled")
                    .map(loose_bool_from_value)
                    .unwrap_or(false),
                must_contain: extract_rss_string_field(rule_obj, "mustContain", "must_contain"),
                must_not_contain: extract_rss_string_field(
                    rule_obj,
                    "mustNotContain",
                    "must_not_contain",
                ),
                use_regex: rule_obj
                    .get("useRegex")
                    .or_else(|| rule_obj.get("use_regex"))
                    .map(loose_bool_from_value)
                    .unwrap_or(false),
                episode_filter: extract_rss_string_field(
                    rule_obj,
                    "episodeFilter",
                    "episode_filter",
                ),
                smart_filter: rule_obj
                    .get("smartFilter")
                    .or_else(|| rule_obj.get("smart_filter"))
                    .map(loose_bool_from_value)
                    .unwrap_or(false),
                affected_feeds: extract_rss_affected_feeds(rule_obj),
                ignore_days: extract_rss_int_field(rule_obj, "ignoreDays", "ignore_days"),
                last_match: extract_rss_string_field(rule_obj, "lastMatch", "last_match"),
                add_paused: rule_obj
                    .get("addPaused")
                    .or_else(|| rule_obj.get("add_paused"))
                    .map(loose_bool_from_value)
                    .unwrap_or(false),
                assigned_category: extract_rss_string_field(
                    rule_obj,
                    "assignedCategory",
                    "assigned_category",
                ),
                save_path: extract_rss_string_field(rule_obj, "savePath", "save_path"),
            });
        }
        return Ok(out);
    }

    // Keyed shape: top-level keys are rule names. Skip metadata keys.
    let mut out = Vec::new();
    for (key, value) in obj {
        if RSS_METADATA_KEYS.contains(&key.as_str()) {
            continue;
        }
        if key == "rules" {
            // Already handled above; defensive skip in case it's a non-array.
            continue;
        }
        let rule_obj = match value.as_object() {
            Some(o) => o,
            None => continue,
        };
        // For the keyed shape, the top-level key is the authoritative name.
        // Pre-merge so a `name` field inside the value object can override
        // the key (preserves the existing TS behavior of `normalizeRSSRule`
        // re-running with `{ name: key, ...value }`).
        let name_from_obj = rule_obj
            .get("name")
            .and_then(|v| v.as_str())
            .or_else(|| rule_obj.get("ruleName").and_then(|v| v.as_str()))
            .unwrap_or(key.as_str())
            .to_string();
        out.push(RssRuleDto {
            name: name_from_obj,
            enabled: rule_obj
                .get("enabled")
                .map(loose_bool_from_value)
                .unwrap_or(false),
            must_contain: extract_rss_string_field(rule_obj, "mustContain", "must_contain"),
            must_not_contain: extract_rss_string_field(
                rule_obj,
                "mustNotContain",
                "must_not_contain",
            ),
            use_regex: rule_obj
                .get("useRegex")
                .or_else(|| rule_obj.get("use_regex"))
                .map(loose_bool_from_value)
                .unwrap_or(false),
            episode_filter: extract_rss_string_field(rule_obj, "episodeFilter", "episode_filter"),
            smart_filter: rule_obj
                .get("smartFilter")
                .or_else(|| rule_obj.get("smart_filter"))
                .map(loose_bool_from_value)
                .unwrap_or(false),
            affected_feeds: extract_rss_affected_feeds(rule_obj),
            ignore_days: extract_rss_int_field(rule_obj, "ignoreDays", "ignore_days"),
            last_match: extract_rss_string_field(rule_obj, "lastMatch", "last_match"),
            add_paused: rule_obj
                .get("addPaused")
                .or_else(|| rule_obj.get("add_paused"))
                .map(loose_bool_from_value)
                .unwrap_or(false),
            assigned_category: extract_rss_string_field(
                rule_obj,
                "assignedCategory",
                "assigned_category",
            ),
            save_path: extract_rss_string_field(rule_obj, "savePath", "save_path"),
        });
    }

    Ok(out)
}

/// Compute a loose-boolean interpretation of a `serde_json::Value`, matching
/// JavaScript `Boolean(value)` semantics. Mirrors `deserialize_rss_loose_bool`
/// but operates on an already-parsed value so rule helpers can apply it
/// uniformly regardless of whether the source key was camelCase or snake_case.
fn loose_bool_from_value(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Null => false,
        serde_json::Value::Bool(b) => *b,
        serde_json::Value::Number(n) => n.as_f64().map(|f| f != 0.0).unwrap_or(false),
        serde_json::Value::String(s) => !s.is_empty(),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => true,
    }
}

/// Construct a default `RssRuleDto` with the empty-name default. Used when a
/// bare-string rule appears in the array shape.
fn default_rss_rule() -> RssRuleDto {
    RssRuleDto {
        name: String::new(),
        enabled: false,
        must_contain: String::new(),
        must_not_contain: String::new(),
        use_regex: false,
        episode_filter: String::new(),
        smart_filter: false,
        affected_feeds: Vec::new(),
        ignore_days: 0,
        last_match: String::new(),
        add_paused: false,
        assigned_category: String::new(),
        save_path: String::new(),
    }
}

// ============================================================================
// Preferences DTO
// ============================================================================
//
// qBittorrent `/api/v2/app/preferences` returns a flat JSON object with ~170
// preference fields. This DTO mirrors the TypeScript `Preferences` interface
// in `packages/shared/src/types/qbittorrent.ts`.
//
// All fields carry `#[serde(default)]` because qBittorrent may omit any field
// from the response (the API guarantees no particular field set). Fields with
// known type inconsistencies across qBittorrent versions (v4 vs v5) use the
// `deserialize_loose_number` custom deserializer, which accepts numbers,
// booleans, strings, and null — normalizing to an `i64`.
//
// Unknown top-level fields are silently ignored (no `deny_unknown_fields`).

/// Preferences snapshot returned by `GET /api/v2/app/preferences`.
///
/// Wire field names match the qBittorrent Web API snake_case convention,
/// which aligns with Rust's default field naming — no `#[serde(rename)]`
/// attributes are needed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreferencesDto {
    // -- General --
    #[serde(default)]
    pub locale: String,
    #[serde(default)]
    pub create_subfolder_enabled: bool,
    #[serde(default)]
    pub start_paused_enabled: bool,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub auto_delete_mode: i64,
    #[serde(default)]
    pub preallocate_all: bool,
    #[serde(default)]
    pub incomplete_files_ext: bool,
    // -- TMM (Torrent Management Mode) --
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub auto_tmm_enabled: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub torrent_changed_tmm_enabled: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub save_path_changed_tmm_enabled: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub category_changed_tmm_enabled: i64,
    // -- Paths --
    #[serde(default)]
    pub save_path: String,
    #[serde(default)]
    pub temp_path_enabled: bool,
    #[serde(default)]
    pub temp_path: String,
    // -- Scan dirs --
    #[serde(default)]
    pub scan_dirs: BTreeMap<String, LooseNumberMapValue>,
    // -- Export --
    #[serde(default)]
    pub export_dir: String,
    #[serde(default)]
    pub export_dir_fin: String,
    // -- Mail notification --
    #[serde(default)]
    pub mail_notification_enabled: bool,
    #[serde(default)]
    pub mail_notification_sender: String,
    #[serde(default)]
    pub mail_notification_email: String,
    #[serde(default)]
    pub mail_notification_smtp: String,
    #[serde(default)]
    pub mail_notification_ssl_enabled: bool,
    #[serde(default)]
    pub mail_notification_auth_enabled: bool,
    #[serde(default)]
    pub mail_notification_username: String,
    #[serde(default)]
    pub mail_notification_password: String,
    // -- Autorun --
    #[serde(default)]
    pub autorun_enabled: bool,
    #[serde(default)]
    pub autorun_program: String,
    // -- Queueing --
    #[serde(default)]
    pub queueing_enabled: bool,
    #[serde(default)]
    pub max_active_downloads: i64,
    #[serde(default)]
    pub max_active_torrents: i64,
    #[serde(default)]
    pub max_active_uploads: i64,
    #[serde(default)]
    pub dont_count_slow_torrents: bool,
    #[serde(default)]
    pub slow_torrent_dl_rate_threshold: i64,
    #[serde(default)]
    pub slow_torrent_ul_rate_threshold: i64,
    #[serde(default)]
    pub slow_torrent_inactive_timer: i64,
    // -- Share ratio --
    #[serde(default)]
    pub max_ratio_enabled: bool,
    #[serde(default)]
    pub max_ratio: f64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub max_ratio_act: i64,
    // -- Connection --
    #[serde(default)]
    pub listen_port: i64,
    #[serde(default)]
    pub upnp: bool,
    #[serde(default)]
    pub random_port: bool,
    #[serde(default)]
    pub dl_limit: i64,
    #[serde(default)]
    pub up_limit: i64,
    #[serde(default)]
    pub alt_dl_limit: i64,
    #[serde(default)]
    pub alt_up_limit: i64,
    #[serde(default)]
    pub max_connec: i64,
    #[serde(default)]
    pub max_connec_per_torrent: i64,
    #[serde(default)]
    pub max_uploads: i64,
    #[serde(default)]
    pub max_uploads_per_torrent: i64,
    #[serde(default)]
    pub enable_piece_extent_affinity: bool,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub bittorrent_protocol: i64,
    #[serde(default)]
    pub limit_utp_rate: bool,
    #[serde(default)]
    pub limit_tcp_overhead: bool,
    #[serde(default)]
    pub limit_lan_peers: bool,
    // -- Scheduler --
    #[serde(default)]
    pub scheduler_enabled: bool,
    #[serde(default)]
    pub use_alt_speed_limits: bool,
    #[serde(default)]
    pub schedule_from_hour: i64,
    #[serde(default)]
    pub schedule_from_min: i64,
    #[serde(default)]
    pub schedule_to_hour: i64,
    #[serde(default)]
    pub schedule_to_min: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub scheduler_days: i64,
    // -- DHT / PEX / LSD --
    #[serde(default)]
    pub dht: bool,
    #[serde(default)]
    pub pex: bool,
    #[serde(default)]
    pub lsd: bool,
    // -- Encryption --
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub encryption: i64,
    #[serde(default)]
    pub anonymous_mode: bool,
    // -- Proxy --
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub proxy_type: i64,
    #[serde(default)]
    pub proxy_ip: String,
    #[serde(default)]
    pub proxy_port: i64,
    #[serde(default)]
    pub proxy_peer_connections: bool,
    #[serde(default)]
    pub proxy_auth_enabled: bool,
    #[serde(default)]
    pub proxy_username: String,
    #[serde(default)]
    pub proxy_password: String,
    #[serde(default)]
    pub proxy_torrents_only: bool,
    // -- IP Filter --
    #[serde(default)]
    pub ip_filter_enabled: bool,
    #[serde(default)]
    pub ip_filter_path: String,
    #[serde(default)]
    pub ip_filter_trackers: bool,
    // -- Web UI --
    #[serde(default)]
    pub web_ui_domain_list: String,
    #[serde(default)]
    pub web_ui_address: String,
    #[serde(default)]
    pub web_ui_port: i64,
    #[serde(default)]
    pub web_ui_upnp: bool,
    #[serde(default)]
    pub web_ui_username: String,
    #[serde(default)]
    pub web_ui_password: String,
    #[serde(default)]
    pub web_ui_csrf_protection_enabled: bool,
    #[serde(default)]
    pub web_ui_clickjacking_protection_enabled: bool,
    #[serde(default)]
    pub web_ui_secure_cookie_enabled: bool,
    #[serde(default)]
    pub web_ui_max_auth_fail_count: i64,
    #[serde(default)]
    pub web_ui_ban_duration: i64,
    #[serde(default)]
    pub web_ui_session_timeout: i64,
    #[serde(default)]
    pub web_ui_host_header_validation_enabled: bool,
    #[serde(default)]
    pub bypass_local_auth: bool,
    #[serde(default)]
    pub bypass_auth_subnet_whitelist_enabled: bool,
    #[serde(default)]
    pub bypass_auth_subnet_whitelist: String,
    #[serde(default)]
    pub alternative_webui_enabled: bool,
    #[serde(default)]
    pub alternative_webui_path: String,
    // -- SSL / HTTPS --
    #[serde(default)]
    pub use_https: bool,
    #[serde(default)]
    pub ssl_key: String,
    #[serde(default)]
    pub ssl_cert: String,
    #[serde(default)]
    pub web_ui_https_key: String,
    #[serde(default)]
    pub web_ui_https_cert: String,
    // -- Dynamic DNS --
    #[serde(default)]
    pub dyndns_enabled: bool,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub dyndns_service: i64,
    #[serde(default)]
    pub dyndns_username: String,
    #[serde(default)]
    pub dyndns_password: String,
    #[serde(default)]
    pub dyndns_domain: String,
    // -- RSS --
    #[serde(default)]
    pub rss_refresh_interval: i64,
    #[serde(default)]
    pub rss_max_articles_per_feed: i64,
    #[serde(default)]
    pub rss_processing_enabled: bool,
    #[serde(default)]
    pub rss_auto_downloading_enabled: bool,
    #[serde(default)]
    pub rss_download_repack_proper_episodes: bool,
    #[serde(default)]
    pub rss_smart_episode_filters: String,
    // -- Trackers --
    #[serde(default)]
    pub add_trackers_enabled: bool,
    #[serde(default)]
    pub add_trackers: String,
    // -- Web UI custom HTTP headers --
    #[serde(default)]
    pub web_ui_use_custom_http_headers_enabled: bool,
    #[serde(default)]
    pub web_ui_custom_http_headers: String,
    // -- Seeding limits --
    #[serde(default)]
    pub max_seeding_time_enabled: bool,
    #[serde(default)]
    pub max_seeding_time: i64,
    #[serde(default)]
    pub announce_to_all_tiers: bool,
    #[serde(default)]
    pub announce_to_all_trackers: bool,
    // -- Advanced / libtorrent settings --
    #[serde(default)]
    pub async_io_threads: i64,
    #[serde(default)]
    pub hashing_threads: i64,
    #[serde(default)]
    pub file_pool_size: i64,
    #[serde(default)]
    pub checking_memory_use: i64,
    #[serde(default)]
    pub disk_cache: i64,
    #[serde(default)]
    pub disk_cache_ttl: i64,
    #[serde(default)]
    pub enable_upload_suggestions: bool,
    #[serde(default)]
    pub upload_suggestions_interval: i64,
    #[serde(default)]
    pub send_buffer_watermark: i64,
    #[serde(default)]
    pub send_buffer_low_watermark: i64,
    #[serde(default)]
    pub send_buffer_watermark_factor: i64,
    #[serde(default)]
    pub connection_speed: i64,
    #[serde(default)]
    pub socket_backlog_size: i64,
    #[serde(default)]
    pub outgoing_ports_min: i64,
    #[serde(default)]
    pub outgoing_ports_max: i64,
    #[serde(default)]
    pub upnp_lease_duration: i64,
    #[serde(default)]
    pub peer_tos: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub utp_tcp_mixed_mode: i64,
    #[serde(default)]
    pub idn_support_enabled: bool,
    #[serde(default)]
    pub enable_multi_connections_from_same_ip: bool,
    #[serde(default)]
    pub validate_https_tracker_certificate: bool,
    #[serde(default)]
    pub ssrf_mitigation: bool,
    #[serde(default)]
    pub block_peers_on_privileged_ports: bool,
    // -- Embedded tracker --
    #[serde(default)]
    pub enable_embedded_tracker: bool,
    #[serde(default)]
    pub embedded_tracker_port: i64,
    // -- Misc --
    #[serde(default)]
    pub mark_of_the_web: bool,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub upload_slots_behavior: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub upload_choking_algorithm: i64,
    #[serde(default)]
    pub announce_ip: String,
    #[serde(default)]
    pub max_concurrent_http_announces: i64,
    #[serde(default)]
    pub stop_tracker_timeout: i64,
    // -- Peer turnover --
    #[serde(default)]
    pub peer_turnover: f64,
    #[serde(default)]
    pub peer_turnover_cutoff: f64,
    #[serde(default)]
    pub peer_turnover_interval: i64,
    #[serde(default)]
    pub request_queue_size: i64,
    // -- I2P --
    #[serde(default)]
    pub dht_bootstrap_nodes: String,
    #[serde(default)]
    pub i2p_enabled: bool,
    #[serde(default)]
    pub i2p_address: String,
    #[serde(default)]
    pub i2p_port: i64,
    #[serde(default)]
    pub i2p_mixed_mode: bool,
    #[serde(default)]
    pub i2p_inbound_quantity: i64,
    #[serde(default)]
    pub i2p_outbound_quantity: i64,
    #[serde(default)]
    pub i2p_inbound_length: i64,
    #[serde(default)]
    pub i2p_outbound_length: i64,
    // -- Torrent content --
    #[serde(default)]
    pub torrent_content_layout: String,
    #[serde(default)]
    pub add_to_top_of_queue: bool,
    #[serde(default)]
    pub torrent_stop_condition: String,
    #[serde(default)]
    pub merge_trackers: bool,
    // -- Excluded file names --
    #[serde(default)]
    pub excluded_file_names_enabled: bool,
    #[serde(default)]
    pub excluded_file_names: String,
    // -- Autorun on torrent added --
    #[serde(default)]
    pub autorun_on_torrent_added_enabled: bool,
    #[serde(default)]
    pub autorun_on_torrent_added_program: String,
    // -- Recheck / resolve --
    #[serde(default)]
    pub recheck_completed_torrents: bool,
    #[serde(default)]
    pub resolve_peer_countries: bool,
    #[serde(default)]
    pub reannounce_when_address_changed: bool,
    #[serde(default)]
    pub max_active_checking_torrents: i64,
    // -- Inactive seeding --
    #[serde(default)]
    pub max_inactive_seeding_time_enabled: bool,
    #[serde(default)]
    pub max_inactive_seeding_time: i64,
    // -- Resume data --
    #[serde(default)]
    pub resume_data_storage_type: String,
    #[serde(default)]
    pub torrent_file_size_limit: i64,
    #[serde(default)]
    pub save_resume_data_interval: i64,
    #[serde(default)]
    pub save_statistics_interval: i64,
    #[serde(default)]
    pub confirm_torrent_recheck: bool,
    #[serde(default)]
    pub refresh_interval: i64,
    #[serde(default)]
    pub customize_application_instance_name: String,
    #[serde(default)]
    pub python_executable_path: String,
    #[serde(default)]
    pub torrent_content_removing_mode: String,
    #[serde(default)]
    pub memory_working_set_limit: i64,
    // -- Network interface --
    #[serde(default)]
    pub current_network_interface: String,
    #[serde(default)]
    pub current_ip_address: String,
    // -- Disk / I/O --
    #[serde(default)]
    pub disk_queue_size: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub disk_io_type: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub disk_io_read_mode: i64,
    #[serde(default, deserialize_with = "deserialize_loose_number")]
    pub disk_io_write_mode: i64,
    #[serde(default)]
    pub bdecode_depth_limit: i64,
    #[serde(default)]
    pub bdecode_token_limit: i64,
    #[serde(default)]
    pub socket_send_buffer_size: i64,
    #[serde(default)]
    pub socket_receive_buffer_size: i64,
    // -- Tracker announce --
    #[serde(default)]
    pub announce_to_all_trackers_in_tier: bool,
    #[serde(default)]
    pub announce_port: i64,
    #[serde(default)]
    pub add_trackers_url: String,
    // -- Web UI reverse proxy --
    #[serde(default)]
    pub web_ui_reverse_proxy_enabled: bool,
    #[serde(default)]
    pub web_ui_reverse_proxies_list: String,
    // -- SSL / security --
    #[serde(default)]
    pub ignore_ssl_errors: bool,
    #[serde(default)]
    pub enable_port_forwarding_for_embedded_tracker: bool,
    // -- Categories --
    #[serde(default)]
    pub use_subcategories: bool,
    #[serde(default)]
    pub use_category_paths_in_manual_mode: bool,
    #[serde(default)]
    pub delete_torrent_files_afterwards: bool,
}

/// Preferences update payload for `POST /api/v2/app/setPreferences`.
///
/// All fields are `Option<T>` — absent (`None`) fields are omitted from
/// serialization via `skip_serializing_if = "Option::is_none"`, so they are
/// not sent to qBittorrent (preventing unintended resets to default).
/// Present fields are validated and type-coerced by serde (including
/// `deserialize_loose_number` for v4/v5 compatibility fields).
///
/// Wire field names are snake_case, matching the qBittorrent Web API.
/// Unknown top-level fields are silently ignored.
///
/// **Must be kept in sync with [`PreferencesDto`]** — every field in
/// `PreferencesDto` must have a corresponding `Option<T>` field here.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct PreferencesUpdateDto {
    // -- General --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub create_subfolder_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_paused_enabled: Option<bool>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub auto_delete_mode: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preallocate_all: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub incomplete_files_ext: Option<bool>,
    // -- TMM (Torrent Management Mode) --
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub auto_tmm_enabled: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub torrent_changed_tmm_enabled: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub save_path_changed_tmm_enabled: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub category_changed_tmm_enabled: Option<i64>,
    // -- Paths --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub save_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temp_path_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temp_path: Option<String>,
    // -- Scan dirs --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scan_dirs: Option<BTreeMap<String, LooseNumberMapValue>>,
    // -- Export --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub export_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub export_dir_fin: Option<String>,
    // -- Mail notification --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mail_notification_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mail_notification_sender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mail_notification_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mail_notification_smtp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mail_notification_ssl_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mail_notification_auth_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mail_notification_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mail_notification_password: Option<String>,
    // -- Autorun --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autorun_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autorun_program: Option<String>,
    // -- Queueing --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub queueing_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_active_downloads: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_active_torrents: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_active_uploads: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dont_count_slow_torrents: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slow_torrent_dl_rate_threshold: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slow_torrent_ul_rate_threshold: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slow_torrent_inactive_timer: Option<i64>,
    // -- Share ratio --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_ratio_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_ratio: Option<f64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub max_ratio_act: Option<i64>,
    // -- Connection --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub listen_port: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upnp: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub random_port: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dl_limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub up_limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alt_dl_limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alt_up_limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_connec: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_connec_per_torrent: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_uploads: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_uploads_per_torrent: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_piece_extent_affinity: Option<bool>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub bittorrent_protocol: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit_utp_rate: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit_tcp_overhead: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit_lan_peers: Option<bool>,
    // -- Scheduler --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduler_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_alt_speed_limits: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule_from_hour: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule_from_min: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule_to_hour: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule_to_min: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub scheduler_days: Option<i64>,
    // -- DHT / PEX / LSD --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dht: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pex: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lsd: Option<bool>,
    // -- Encryption --
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub encryption: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_mode: Option<bool>,
    // -- Proxy --
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub proxy_type: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_port: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_peer_connections: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_auth_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_torrents_only: Option<bool>,
    // -- IP Filter --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_filter_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_filter_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_filter_trackers: Option<bool>,
    // -- Web UI --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_domain_list: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_port: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_upnp: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_csrf_protection_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_clickjacking_protection_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_secure_cookie_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_max_auth_fail_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_ban_duration: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_session_timeout: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_host_header_validation_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bypass_local_auth: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bypass_auth_subnet_whitelist_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bypass_auth_subnet_whitelist: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alternative_webui_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alternative_webui_path: Option<String>,
    // -- SSL / HTTPS --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_https: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssl_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssl_cert: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_https_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_https_cert: Option<String>,
    // -- Dynamic DNS --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dyndns_enabled: Option<bool>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub dyndns_service: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dyndns_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dyndns_password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dyndns_domain: Option<String>,
    // -- RSS --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rss_refresh_interval: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rss_max_articles_per_feed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rss_processing_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rss_auto_downloading_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rss_download_repack_proper_episodes: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rss_smart_episode_filters: Option<String>,
    // -- Trackers --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub add_trackers_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub add_trackers: Option<String>,
    // -- Web UI custom HTTP headers --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_use_custom_http_headers_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_custom_http_headers: Option<String>,
    // -- Seeding limits --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_seeding_time_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_seeding_time: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub announce_to_all_tiers: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub announce_to_all_trackers: Option<bool>,
    // -- Advanced / libtorrent settings --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub async_io_threads: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hashing_threads: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_pool_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checking_memory_use: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_cache: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_cache_ttl: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_upload_suggestions: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upload_suggestions_interval: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub send_buffer_watermark: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub send_buffer_low_watermark: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub send_buffer_watermark_factor: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_speed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub socket_backlog_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outgoing_ports_min: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outgoing_ports_max: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upnp_lease_duration: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer_tos: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub utp_tcp_mixed_mode: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub idn_support_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_multi_connections_from_same_ip: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validate_https_tracker_certificate: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssrf_mitigation: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_peers_on_privileged_ports: Option<bool>,
    // -- Embedded tracker --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_embedded_tracker: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedded_tracker_port: Option<i64>,
    // -- Misc --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mark_of_the_web: Option<bool>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub upload_slots_behavior: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub upload_choking_algorithm: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub announce_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_concurrent_http_announces: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_tracker_timeout: Option<i64>,
    // -- Peer turnover --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer_turnover: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer_turnover_cutoff: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer_turnover_interval: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_queue_size: Option<i64>,
    // -- I2P --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dht_bootstrap_nodes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i2p_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i2p_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i2p_port: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i2p_mixed_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i2p_inbound_quantity: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i2p_outbound_quantity: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i2p_inbound_length: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i2p_outbound_length: Option<i64>,
    // -- Torrent content --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub torrent_content_layout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub add_to_top_of_queue: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub torrent_stop_condition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merge_trackers: Option<bool>,
    // -- Excluded file names --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excluded_file_names_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excluded_file_names: Option<String>,
    // -- Autorun on torrent added --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autorun_on_torrent_added_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autorun_on_torrent_added_program: Option<String>,
    // -- Recheck / resolve --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recheck_completed_torrents: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolve_peer_countries: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reannounce_when_address_changed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_active_checking_torrents: Option<i64>,
    // -- Inactive seeding --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_inactive_seeding_time_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_inactive_seeding_time: Option<i64>,
    // -- Resume data --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_data_storage_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub torrent_file_size_limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub save_resume_data_interval: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub save_statistics_interval: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirm_torrent_recheck: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_interval: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customize_application_instance_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub python_executable_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub torrent_content_removing_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_working_set_limit: Option<i64>,
    // -- Network interface --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_network_interface: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_ip_address: Option<String>,
    // -- Disk / I/O --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_queue_size: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub disk_io_type: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub disk_io_read_mode: Option<i64>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_loose_number_option"
    )]
    pub disk_io_write_mode: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bdecode_depth_limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bdecode_token_limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub socket_send_buffer_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub socket_receive_buffer_size: Option<i64>,
    // -- Tracker announce --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub announce_to_all_trackers_in_tier: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub announce_port: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub add_trackers_url: Option<String>,
    // -- Web UI reverse proxy --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_reverse_proxy_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub web_ui_reverse_proxies_list: Option<String>,
    // -- SSL / security --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ignore_ssl_errors: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_port_forwarding_for_embedded_tracker: Option<bool>,
    // -- Categories --
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_subcategories: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_category_paths_in_manual_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete_torrent_files_afterwards: Option<bool>,
}

/// Parse the response of `GET /api/v2/app/preferences` into a [`PreferencesDto`].
///
/// Returns `InvalidResponse` if the JSON is not an object, or if any field
/// has an unsupported type that cannot be coerced by the custom deserializers.
/// Unknown top-level fields are silently ignored.
pub fn parse_preferences(raw: &serde_json::Value) -> Result<PreferencesDto, BackendError> {
    if !raw.is_object() {
        return Err(BackendError::invalid_response(
            "preferences must be a JSON object",
        ));
    }
    serde_json::value::from_value(raw.clone()).map_err(|e| {
        BackendError::invalid_response(format!("preferences have malformed structure: {}", e))
    })
}

/// Field count consts for drift detection between [`PreferencesDto`] and
/// [`PreferencesUpdateDto`]. These must be updated when adding/removing fields
/// in either struct — the [`tests::preferences_dto_and_update_dto_have_same_field_count`]
/// test asserts they are equal.
#[cfg(test)]
mod preferences_field_counts {
    /// Number of fields in `PreferencesDto` — update when adding/removing fields.
    pub(super) const PREFERENCES_DTO_FIELD_COUNT: usize = 207;
    /// Number of fields in `PreferencesUpdateDto` — must equal `PREFERENCES_DTO_FIELD_COUNT`.
    pub(super) const PREFERENCES_UPDATE_DTO_FIELD_COUNT: usize = 207;
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // Categories
    // -------------------------------------------------------------------------

    #[test]
    fn parse_categories_valid() {
        let json = serde_json::json!({
            "Videos": { "name": "Videos", "savePath": "/mnt/videos" },
            "Downloads": { "name": "Downloads", "savePath": "/home/downloads" }
        });
        let cats = parse_categories(&json).unwrap();
        assert_eq!(cats.len(), 2);
        assert_eq!(cats["Videos"].save_path, "/mnt/videos");
        assert_eq!(cats["Downloads"].save_path, "/home/downloads");
    }

    #[test]
    fn parse_categories_empty() {
        let json = serde_json::json!({});
        let cats = parse_categories(&json).unwrap();
        assert!(cats.is_empty());
    }

    #[test]
    fn parse_categories_not_an_object() {
        let json = serde_json::json!(["Videos", "Downloads"]);
        assert!(parse_categories(&json).is_err());
    }

    #[test]
    fn parse_categories_missing_name_field() {
        let json = serde_json::json!({
            "Videos": { "savePath": "/mnt/videos" }
        });
        let err = parse_categories(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_categories_missing_save_path_field() {
        let json = serde_json::json!({
            "Videos": { "name": "Videos" }
        });
        let err = parse_categories(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_categories_wrong_field_type() {
        let json = serde_json::json!({
            "Videos": { "name": "Videos", "savePath": 123 }
        });
        let err = parse_categories(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_categories_camel_case_save_path() {
        // qBittorrent sends savePath (camelCase)
        let json = serde_json::json!({
            "Videos": { "name": "Videos", "savePath": "/path" }
        });
        let cats = parse_categories(&json).unwrap();
        assert_eq!(cats["Videos"].save_path, "/path");
    }

    // -------------------------------------------------------------------------
    // Tags
    // -------------------------------------------------------------------------

    #[test]
    fn parse_tags_valid() {
        let json = serde_json::json!(["tag1", "tag2", "tag3"]);
        let tags = parse_tags(&json).unwrap();
        assert_eq!(tags, vec!["tag1", "tag2", "tag3"]);
    }

    #[test]
    fn parse_tags_empty() {
        let json = serde_json::json!([]);
        let tags = parse_tags(&json).unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn parse_tags_not_an_array() {
        let json = serde_json::json!({ "tags": [] });
        assert!(parse_tags(&json).is_err());
    }

    #[test]
    fn parse_tags_non_string_entry() {
        let json = serde_json::json!(["tag1", 42, "tag3"]);
        let err = parse_tags(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_tags_null_entry() {
        let json = serde_json::json!(["tag1", null]);
        let err = parse_tags(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_tags_object_entry() {
        let json = serde_json::json!(["tag1", { "foo": "bar" }]);
        let err = parse_tags(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_tags_boolean_entry() {
        let json = serde_json::json!(["tag1", true]);
        let err = parse_tags(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    // -------------------------------------------------------------------------
    // SyncTorrentPeers
    // -------------------------------------------------------------------------

    #[test]
    fn parse_sync_torrent_peers_full_update_true_bool() {
        let json = serde_json::json!({
            "rid": 42,
            "full_update": true,
            "peers": {}
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        assert_eq!(result.rid, 42);
        assert!(result.full_update);
    }

    #[test]
    fn parse_sync_torrent_peers_full_update_false_bool() {
        let json = serde_json::json!({
            "rid": 1,
            "full_update": false
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        assert_eq!(result.rid, 1);
        assert!(!result.full_update);
    }

    #[test]
    fn parse_sync_torrent_peers_full_update_number_1() {
        let json = serde_json::json!({
            "rid": 5,
            "full_update": 1
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        assert!(result.full_update);
    }

    #[test]
    fn parse_sync_torrent_peers_full_update_number_0() {
        let json = serde_json::json!({
            "rid": 5,
            "full_update": 0
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        assert!(!result.full_update);
    }

    #[test]
    fn parse_sync_torrent_peers_full_update_string_true() {
        for val in &["true", "True", "TRUE", "1"] {
            let json = serde_json::json!({
                "rid": 1,
                "full_update": val
            });
            let result = parse_sync_torrent_peers(&json).unwrap();
            assert!(result.full_update, "full_update = {:?} should be true", val);
        }
        // "01" is NOT a recognized truthy form (only "1" is)
        for val in &["01", "false", "0", "abc"] {
            let json = serde_json::json!({
                "rid": 1,
                "full_update": val
            });
            let result = parse_sync_torrent_peers(&json).unwrap();
            assert!(
                !result.full_update,
                "full_update = {:?} should be false",
                val
            );
        }
    }

    #[test]
    fn parse_sync_torrent_peers_full_update_string_false() {
        for val in &["false", "False", "FALSE", "0", "abc"] {
            let json = serde_json::json!({
                "rid": 1,
                "full_update": val
            });
            let result = parse_sync_torrent_peers(&json).unwrap();
            assert!(
                !result.full_update,
                "full_update = {:?} should be false",
                val
            );
        }
    }

    #[test]
    fn parse_sync_torrent_peers_full_update_absent() {
        let json = serde_json::json!({
            "rid": 1
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        assert!(!result.full_update);
    }

    #[test]
    fn parse_sync_torrent_peers_with_peers() {
        let json = serde_json::json!({
            "rid": 10,
            "full_update": false,
            "peers": {
                "192.168.1.1:12345": {
                    "ip": "192.168.1.1",
                    "port": 12345,
                    "client": "qBittorrent/4.5",
                    "progress": 0.75,
                    "dlSpeed": 1024000,
                    "upSpeed": 512000
                }
            }
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        assert_eq!(result.rid, 10);
        assert!(!result.full_update);
        let peers = result.peers.unwrap();
        assert_eq!(peers.len(), 1);
        let peer = peers.get("192.168.1.1:12345").unwrap();
        assert_eq!(peer.ip.as_deref(), Some("192.168.1.1"));
        assert_eq!(peer.port, Some(12345));
        assert!((peer.progress.unwrap() - 0.75).abs() < f64::EPSILON);
    }

    #[test]
    fn parse_sync_torrent_peers_partial_peer_row() {
        // qBittorrent sends only changed fields in incremental deltas
        let json = serde_json::json!({
            "rid": 11,
            "full_update": false,
            "peers": {
                "10.0.0.1:5000": {
                    "dlSpeed": 1000
                }
            }
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        let peers = result.peers.unwrap();
        let peer = peers.get("10.0.0.1:5000").unwrap();
        assert_eq!(peer.dl_speed, Some(1000));
        assert!(peer.ip.is_none());
        assert!(peer.port.is_none());
    }

    #[test]
    fn parse_sync_torrent_peers_with_peers_removed() {
        let json = serde_json::json!({
            "rid": 12,
            "full_update": false,
            "peers_removed": ["192.168.1.1:12345", "10.0.0.1:5000"]
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        let removed = result.peers_removed.unwrap();
        assert_eq!(removed.len(), 2);
        assert_eq!(removed[0], "192.168.1.1:12345");
    }

    #[test]
    fn parse_sync_torrent_peers_unknown_fields_ignored() {
        let json = serde_json::json!({
            "rid": 1,
            "full_update": false,
            "unknown_field": "should be ignored",
            "another_bad_field": 999,
            "peers": {}
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        assert_eq!(result.rid, 1);
    }

    #[test]
    fn parse_sync_torrent_peers_unknown_peer_fields_ignored() {
        let json = serde_json::json!({
            "rid": 1,
            "full_update": false,
            "peers": {
                "1.2.3.4:5555": {
                    "ip": "1.2.3.4",
                    "port": 5555,
                    "totally_unknown_peer_field": "ignored"
                }
            }
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        let peers_map = result.peers.unwrap();
        let peer = peers_map.get("1.2.3.4:5555").unwrap();
        assert_eq!(peer.ip.as_deref(), Some("1.2.3.4"));
        // unknown field did not cause an error
    }

    #[test]
    fn parse_sync_torrent_peers_missing_rid() {
        let json = serde_json::json!({
            "full_update": false,
            "peers": {}
        });
        let err = parse_sync_torrent_peers(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("rid"));
    }

    #[test]
    fn parse_sync_torrent_peers_invalid_rid_type() {
        let json = serde_json::json!({
            "rid": "not-a-number",
            "full_update": false
        });
        let err = parse_sync_torrent_peers(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("rid"));
    }

    #[test]
    fn parse_sync_torrent_peers_rid_zero() {
        // Initial sync sends rid=0
        let json = serde_json::json!({
            "rid": 0,
            "full_update": true,
            "peers": {}
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        assert_eq!(result.rid, 0);
        assert!(result.full_update);
    }

    #[test]
    fn parse_sync_torrent_peers_camelcase_input_serializes_to_snakecase() {
        // qBittorrent sends camelCase peer fields; after parsing, serialization
        // must produce snake_case to match the TypeScript bridge contract.
        let json = serde_json::json!({
            "rid": 7,
            "full_update": false,
            "peers": {
                "192.168.1.1:12345": {
                    "ip": "192.168.1.1",
                    "port": 12345,
                    "client": "qBittorrent/4.5",
                    "progress": 0.5,
                    "dlSpeed": 1024000,
                    "upSpeed": 512000,
                    "downloaded": 12345678,
                    "uploaded": 8765432,
                    "connection": "EC",
                    "flags": "IP",
                    "flagsDesc": "Encrypted",
                    "relevance": 0.95,
                    "files": "some files",
                    "country": "United States",
                    "countryCode": "US"
                }
            }
        });
        let result = parse_sync_torrent_peers(&json).unwrap();
        let peers = result.peers.as_ref().unwrap();
        let peer = peers.get("192.168.1.1:12345").unwrap();

        // Verify deserialized values
        assert_eq!(peer.dl_speed, Some(1024000));
        assert_eq!(peer.up_speed, Some(512000));
        assert_eq!(peer.flags_desc.as_deref(), Some("Encrypted"));
        assert_eq!(peer.country_code.as_deref(), Some("US"));

        // Serialize back — field names must be snake_case (bridge contract)
        let serialized = serde_json::to_value(&result).unwrap();
        let peer_row = &serialized["peers"]["192.168.1.1:12345"];

        assert!(
            peer_row.get("dlSpeed").is_none(),
            "serialized peer must NOT contain camelCase dlSpeed"
        );
        assert!(
            peer_row.get("upSpeed").is_none(),
            "serialized peer must NOT contain camelCase upSpeed"
        );
        assert!(
            peer_row.get("flagsDesc").is_none(),
            "serialized peer must NOT contain camelCase flagsDesc"
        );
        assert!(
            peer_row.get("countryCode").is_none(),
            "serialized peer must NOT contain camelCase countryCode"
        );

        assert_eq!(
            peer_row.get("dl_speed").and_then(|v| v.as_i64()),
            Some(1024000),
            "dl_speed must be snake_case"
        );
        assert_eq!(
            peer_row.get("up_speed").and_then(|v| v.as_i64()),
            Some(512000),
            "up_speed must be snake_case"
        );
        assert_eq!(
            peer_row.get("flags_desc").and_then(|v| v.as_str()),
            Some("Encrypted"),
            "flags_desc must be snake_case"
        );
        assert_eq!(
            peer_row.get("country_code").and_then(|v| v.as_str()),
            Some("US"),
            "country_code must be snake_case"
        );
    }

    // -------------------------------------------------------------------------
    // TorrentProperties
    // -------------------------------------------------------------------------

    fn valid_torrent_properties_json() -> serde_json::Value {
        serde_json::json!({
            "save_path": "/downloads",
            "creation_date": 1654022838_i64,
            "piece_size": 16384_i64,
            "comment": "test torrent",
            "total_wasted": 0_i64,
            "total_uploaded": 1024_i64,
            "total_uploaded_session": 512_i64,
            "total_downloaded": 2048_i64,
            "total_downloaded_session": 1024_i64,
            "up_limit": -1_i64,
            "dl_limit": -1_i64,
            "time_elapsed": 1234_i64,
            "seeding_time": 567_i64,
            "nb_connections": 5_i64,
            "nb_connections_limit": 100_i64,
            "share_ratio": 0.5_f64,
            "addition_date": 1654022800_i64,
            "completion_date": -1_i64,
            "created_by": "qBittorrent v4.4.0",
            "dl_speed_avg": 1000_i64,
            "dl_speed": 2000_i64,
            "eta": 8640000_i64,
            "last_seen": 1654022900_i64,
            "peers": 5_i64,
            "peers_total": 10_i64,
            "pieces_have": 0_i64,
            "pieces_num": 1_i64,
            "reannounce": 0_i64,
            "seeds": 3_i64,
            "seeds_total": 5_i64,
            "total_size": 2048_i64,
            "up_speed_avg": 500_i64,
            "up_speed": 1000_i64,
            "isPrivate": false
        })
    }

    #[test]
    fn parse_torrent_properties_valid() {
        let json = valid_torrent_properties_json();
        let result = parse_torrent_properties(&json).unwrap();
        assert_eq!(result.save_path, "/downloads");
        assert_eq!(result.creation_date, 1654022838);
        assert_eq!(result.piece_size, 16384);
        assert_eq!(result.comment, "test torrent");
        assert_eq!(result.total_uploaded, 1024);
        assert_eq!(result.total_uploaded_session, 512);
        assert_eq!(result.share_ratio, 0.5);
        assert_eq!(result.created_by, "qBittorrent v4.4.0");
        assert_eq!(result.dl_speed, 2000);
        assert_eq!(result.eta, 8640000);
        assert_eq!(result.total_size, 2048);
        assert_eq!(result.is_private, Some(false));
    }

    #[test]
    fn parse_torrent_properties_isprivate_camelcase() {
        // qB API sends isPrivate (camelCase) — verify it maps to is_private.
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut()
            .unwrap()
            .insert("isPrivate".to_string(), serde_json::json!(true));
        let result = parse_torrent_properties(&obj).unwrap();
        assert_eq!(result.is_private, Some(true));
    }

    #[test]
    fn parse_torrent_properties_isprivate_optional() {
        // `isPrivate` may be absent — it should deserialize to `None`.
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut().unwrap().remove("isPrivate");
        let result = parse_torrent_properties(&obj).unwrap();
        assert_eq!(result.is_private, None);
    }

    #[test]
    fn parse_torrent_properties_not_an_object() {
        let json = serde_json::json!(["not", "an", "object"]);
        let err = parse_torrent_properties(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("object"));
    }

    #[test]
    fn parse_torrent_properties_null_input() {
        let json = serde_json::json!(null);
        let err = parse_torrent_properties(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_string_input() {
        let json = serde_json::json!("not an object");
        let err = parse_torrent_properties(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_number_input() {
        let json = serde_json::json!(42);
        let err = parse_torrent_properties(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_array_input() {
        let json = serde_json::json!([1, 2, 3]);
        let err = parse_torrent_properties(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_missing_save_path() {
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut().unwrap().remove("save_path");
        let err = parse_torrent_properties(&obj).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(
            err.message().contains("save_path") || err.message().contains("missing"),
            "expected error to mention save_path or missing, got: {}",
            err.message()
        );
    }

    #[test]
    fn parse_torrent_properties_missing_share_ratio() {
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut().unwrap().remove("share_ratio");
        let err = parse_torrent_properties(&obj).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_empty_object() {
        let json = serde_json::json!({});
        let err = parse_torrent_properties(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_wrong_save_path_type() {
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut()
            .unwrap()
            .insert("save_path".to_string(), serde_json::json!(12345));
        let err = parse_torrent_properties(&obj).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_wrong_isprivate_type() {
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut()
            .unwrap()
            .insert("isPrivate".to_string(), serde_json::json!("not a bool"));
        let err = parse_torrent_properties(&obj).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_wrong_share_ratio_type() {
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut()
            .unwrap()
            .insert("share_ratio".to_string(), serde_json::json!("half"));
        let err = parse_torrent_properties(&obj).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_properties_unknown_fields_ignored() {
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut().unwrap().insert(
            "unknown_extra_field".to_string(),
            serde_json::json!("should be silently dropped"),
        );
        obj.as_object_mut().unwrap().insert(
            "future_qbittorrent_field".to_string(),
            serde_json::json!(999),
        );
        let result = parse_torrent_properties(&obj).unwrap();
        assert_eq!(result.save_path, "/downloads");
        assert_eq!(result.is_private, Some(false));
    }

    #[test]
    fn parse_torrent_properties_serializes_to_camelcase_isprivate() {
        // After parsing, serialization must produce isPrivate (camelCase)
        // to match the TypeScript bridge contract.
        let mut obj = valid_torrent_properties_json();
        obj.as_object_mut()
            .unwrap()
            .insert("isPrivate".to_string(), serde_json::json!(true));
        let result = parse_torrent_properties(&obj).unwrap();
        let serialized = serde_json::to_value(&result).unwrap();
        assert_eq!(serialized["isPrivate"].as_bool(), Some(true));
        assert!(
            serialized.get("is_private").is_none(),
            "serialized output must NOT contain snake_case is_private"
        );
    }

    #[test]
    fn parse_torrent_properties_serializes_snake_case_fields() {
        // All non-isPrivate fields must serialize to snake_case (TypeScript-facing).
        let result = parse_torrent_properties(&valid_torrent_properties_json()).unwrap();
        let serialized = serde_json::to_value(&result).unwrap();
        let s = serialized.as_object().unwrap();
        // Snake_case keys must be present
        assert!(s.contains_key("save_path"));
        assert!(s.contains_key("creation_date"));
        assert!(s.contains_key("total_uploaded"));
        assert!(s.contains_key("share_ratio"));
        // camelCase variants must NOT be present
        assert!(!s.contains_key("savePath"));
        assert!(!s.contains_key("creationDate"));
        assert!(!s.contains_key("totalUploaded"));
    }

    #[test]
    fn parse_torrent_properties_round_trip_preserves_values() {
        // parse → serialize → parse → values must match.
        let original = valid_torrent_properties_json();
        let parsed = parse_torrent_properties(&original).unwrap();
        let serialized = serde_json::to_value(&parsed).unwrap();
        let reparsed = parse_torrent_properties(&serialized).unwrap();
        assert_eq!(reparsed.save_path, parsed.save_path);
        assert_eq!(reparsed.creation_date, parsed.creation_date);
        assert_eq!(reparsed.share_ratio, parsed.share_ratio);
        assert_eq!(reparsed.is_private, parsed.is_private);
        assert_eq!(reparsed.total_size, parsed.total_size);
    }

    // -------------------------------------------------------------------------
    // Trackers
    // -------------------------------------------------------------------------

    fn valid_tracker_entry() -> serde_json::Value {
        serde_json::json!({
            "url": "http://tracker.example.com/announce",
            "status": 2_i64,
            "tier": 0_i64,
            "num_peers": 10_i64,
            "num_seeds": 5_i64,
            "num_leeches": 2_i64,
            "num_downloaded": 100_i64,
            "msg": ""
        })
    }

    #[test]
    fn parse_torrent_trackers_valid() {
        let json = serde_json::json!([valid_tracker_entry()]);
        let result = parse_torrent_trackers(&json).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].url, "http://tracker.example.com/announce");
        assert_eq!(result[0].status, 2);
        assert_eq!(result[0].tier, 0);
        assert_eq!(result[0].num_peers, 10);
        assert_eq!(result[0].num_seeds, 5);
        assert_eq!(result[0].num_leeches, 2);
        assert_eq!(result[0].num_downloaded, 100);
        assert_eq!(result[0].msg, "");
    }

    #[test]
    fn parse_torrent_trackers_empty() {
        let json = serde_json::json!([]);
        let result = parse_torrent_trackers(&json).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_torrent_trackers_multiple() {
        let json = serde_json::json!([
            valid_tracker_entry(),
            serde_json::json!({
                "url": "udp://tracker2.example.com",
                "status": 0_i64,
                "tier": 1_i64,
                "num_peers": 0_i64,
                "num_seeds": 0_i64,
                "num_leeches": 0_i64,
                "num_downloaded": 0_i64,
                "msg": "Disabled"
            })
        ]);
        let result = parse_torrent_trackers(&json).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[1].tier, 1);
        assert_eq!(result[1].msg, "Disabled");
        assert_eq!(result[1].url, "udp://tracker2.example.com");
    }

    #[test]
    fn parse_torrent_trackers_not_an_array() {
        let json = serde_json::json!({"url": "tracker"});
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("array"));
    }

    #[test]
    fn parse_torrent_trackers_null_input() {
        let json = serde_json::json!(null);
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_string_input() {
        let json = serde_json::json!("not an array");
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_object_input() {
        let json = serde_json::json!({});
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_missing_url() {
        let mut entry = valid_tracker_entry();
        entry.as_object_mut().unwrap().remove("url");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("url") || err.message().contains("missing"));
    }

    #[test]
    fn parse_torrent_trackers_missing_status() {
        let mut entry = valid_tracker_entry();
        entry.as_object_mut().unwrap().remove("status");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_wrong_status_type() {
        let mut entry = valid_tracker_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("status".to_string(), serde_json::json!("two"));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_wrong_url_type() {
        let mut entry = valid_tracker_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("url".to_string(), serde_json::json!(123));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_null_entry() {
        let json = serde_json::json!([null]);
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_array_entry() {
        // A tracker entry that is itself an array (not an object) is invalid
        let json = serde_json::json!([["url", "http://tracker"]]);
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_string_entry() {
        let json = serde_json::json!(["not a tracker object"]);
        let err = parse_torrent_trackers(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_trackers_unknown_fields_ignored() {
        let mut entry = valid_tracker_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("unknown_field".to_string(), serde_json::json!("ignored"));
        entry.as_object_mut().unwrap().insert(
            "future_qbittorrent_field".to_string(),
            serde_json::json!(42),
        );
        let json = serde_json::json!([entry]);
        let result = parse_torrent_trackers(&json).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].url, "http://tracker.example.com/announce");
    }

    #[test]
    fn parse_torrent_trackers_round_trip_preserves_values() {
        let json = serde_json::json!([valid_tracker_entry()]);
        let parsed = parse_torrent_trackers(&json).unwrap();
        let serialized = serde_json::to_value(&parsed).unwrap();
        let arr = serialized.as_array().unwrap();
        assert_eq!(
            arr[0]["url"].as_str(),
            Some("http://tracker.example.com/announce")
        );
        assert_eq!(arr[0]["status"].as_i64(), Some(2));
        assert_eq!(arr[0]["num_peers"].as_i64(), Some(10));
    }

    // -------------------------------------------------------------------------
    // Files
    // -------------------------------------------------------------------------

    fn valid_file_entry() -> serde_json::Value {
        serde_json::json!({
            "index": 0_i64,
            "name": "movie.mkv",
            "size": 1234567890_i64,
            "progress": 0.5_f64,
            "priority": 1_i64,
            "is_seed": false,
            "piece_range": [0_i64, 15_i64],
            "availability": 1.0_f64
        })
    }

    #[test]
    fn parse_torrent_files_valid() {
        let json = serde_json::json!([valid_file_entry()]);
        let result = parse_torrent_files(&json).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].index, 0);
        assert_eq!(result[0].name, "movie.mkv");
        assert_eq!(result[0].size, 1234567890);
        assert_eq!(result[0].progress, 0.5);
        assert_eq!(result[0].priority, 1);
        assert!(!result[0].is_seed);
        assert_eq!(result[0].piece_range, [0, 15]);
        assert_eq!(result[0].availability, 1.0);
    }

    #[test]
    fn parse_torrent_files_empty() {
        let json = serde_json::json!([]);
        let result = parse_torrent_files(&json).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_torrent_files_multiple() {
        // Mirror qBittorrent's real behavior: is_seed is only on file[0].
        let json = serde_json::json!([
            valid_file_entry(),
            serde_json::json!({
                "index": 1_i64,
                "name": "sample.mkv",
                "size": 12345_i64,
                "progress": 1.0_f64,
                "priority": 0_i64,
                // is_seed intentionally omitted — qBittorrent only sets it on file[0]
                "piece_range": [16_i64, 20_i64],
                "availability": 1.0_f64
            })
        ]);
        let result = parse_torrent_files(&json).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[1].name, "sample.mkv");
        assert_eq!(result[1].piece_range, [16, 20]);
        // file[0] has the explicit is_seed, file[1] defaults to false
        assert!(!result[1].is_seed);
    }

    #[test]
    fn parse_torrent_files_is_seed_defaults_to_false() {
        // qBittorrent attaches is_seed only to fileList[0] (torrent->isFinished()).
        // All other files omit the field. Our DTO must default to false.
        let json = serde_json::json!([
            {
                "index": 0_i64,
                "name": "file_a.txt",
                "size": 100_i64,
                "progress": 0.0_f64,
                "priority": 1_i64,
                "is_seed": true,
                "piece_range": [0_i64, 1_i64],
                "availability": 1.0_f64
            },
            {
                "index": 1_i64,
                "name": "file_b.txt",
                "size": 200_i64,
                "progress": 1.0_f64,
                "priority": 1_i64,
                // is_seed intentionally omitted — qBittorrent only sets it on file[0]
                "piece_range": [2_i64, 3_i64],
                "availability": 1.0_f64
            },
            {
                "index": 2_i64,
                "name": "file_c.txt",
                "size": 300_i64,
                "progress": 0.5_f64,
                "priority": 0_i64,
                // is_seed intentionally omitted
                "piece_range": [4_i64, 5_i64],
                "availability": 0.5_f64
            }
        ]);
        let result = parse_torrent_files(&json).unwrap();
        assert_eq!(result.len(), 3);
        assert!(result[0].is_seed, "file[0] has explicit is_seed=true");
        assert!(!result[1].is_seed, "file[1] defaults to false when omitted");
        assert!(!result[2].is_seed, "file[2] defaults to false when omitted");
    }

    #[test]
    fn parse_torrent_files_not_an_array() {
        let json = serde_json::json!({"name": "file.mkv"});
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("array"));
    }

    #[test]
    fn parse_torrent_files_null_input() {
        let json = serde_json::json!(null);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_string_input() {
        let json = serde_json::json!("not an array");
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_object_input() {
        let json = serde_json::json!({});
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_missing_index() {
        let mut entry = valid_file_entry();
        entry.as_object_mut().unwrap().remove("index");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_missing_name() {
        let mut entry = valid_file_entry();
        entry.as_object_mut().unwrap().remove("name");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_wrong_size_type() {
        let mut entry = valid_file_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("size".to_string(), serde_json::json!("not a number"));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_wrong_is_seed_type() {
        let mut entry = valid_file_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("is_seed".to_string(), serde_json::json!("true"));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_wrong_piece_range_length() {
        let mut entry = valid_file_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("piece_range".to_string(), serde_json::json!([0, 1, 2]));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_piece_range_too_short() {
        let mut entry = valid_file_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("piece_range".to_string(), serde_json::json!([0]));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_piece_range_empty() {
        let mut entry = valid_file_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("piece_range".to_string(), serde_json::json!([]));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_piece_range_not_array() {
        let mut entry = valid_file_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("piece_range".to_string(), serde_json::json!(42));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_piece_range_strings_rejected() {
        let mut entry = valid_file_entry();
        entry.as_object_mut().unwrap().insert(
            "piece_range".to_string(),
            serde_json::json!(["zero", "fifteen"]),
        );
        let json = serde_json::json!([entry]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_null_entry() {
        let json = serde_json::json!([null]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_array_entry() {
        // A file entry that is itself an array (not an object) is invalid
        let json = serde_json::json!([["name", "file.mkv"]]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_string_entry() {
        let json = serde_json::json!(["not a file object"]);
        let err = parse_torrent_files(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_files_unknown_fields_ignored() {
        let mut entry = valid_file_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("unknown_field".to_string(), serde_json::json!("ignored"));
        entry.as_object_mut().unwrap().insert(
            "future_qbittorrent_field".to_string(),
            serde_json::json!(42),
        );
        let json = serde_json::json!([entry]);
        let result = parse_torrent_files(&json).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "movie.mkv");
    }

    #[test]
    fn parse_torrent_files_serialize_preserves_piece_range_as_array() {
        // piece_range must serialize as a JSON array to match [number, number] in TS.
        let json = serde_json::json!([valid_file_entry()]);
        let result = parse_torrent_files(&json).unwrap();
        let serialized = serde_json::to_value(&result).unwrap();
        let arr = serialized.as_array().unwrap();
        let pr = arr[0]["piece_range"]
            .as_array()
            .expect("piece_range must serialize as a JSON array");
        assert_eq!(pr.len(), 2);
        assert_eq!(pr[0].as_i64(), Some(0));
        assert_eq!(pr[1].as_i64(), Some(15));
    }

    #[test]
    fn parse_torrent_files_round_trip_preserves_values() {
        let json = serde_json::json!([valid_file_entry()]);
        let parsed = parse_torrent_files(&json).unwrap();
        let serialized = serde_json::to_value(&parsed).unwrap();
        let arr = serialized.as_array().unwrap();
        assert_eq!(arr[0]["name"].as_str(), Some("movie.mkv"));
        assert_eq!(arr[0]["size"].as_i64(), Some(1234567890));
        assert_eq!(arr[0]["progress"].as_f64(), Some(0.5));
        assert_eq!(arr[0]["is_seed"].as_bool(), Some(false));
        let pr = arr[0]["piece_range"].as_array().unwrap();
        assert_eq!(pr[0].as_i64(), Some(0));
        assert_eq!(pr[1].as_i64(), Some(15));
    }

    // -------------------------------------------------------------------------
    // Search start ID
    // -------------------------------------------------------------------------

    #[test]
    fn parse_search_start_id_string() {
        let json = serde_json::json!("42");
        let id = parse_search_start_id(&json).unwrap();
        assert_eq!(id, 42);
    }

    #[test]
    fn parse_search_start_id_string_zero() {
        let json = serde_json::json!("0");
        let id = parse_search_start_id(&json).unwrap();
        assert_eq!(id, 0);
    }

    #[test]
    fn parse_search_start_id_string_negative() {
        let json = serde_json::json!("-1");
        let id = parse_search_start_id(&json).unwrap();
        assert_eq!(id, -1);
    }

    #[test]
    fn parse_search_start_id_number() {
        let json = serde_json::json!(42);
        let id = parse_search_start_id(&json).unwrap();
        assert_eq!(id, 42);
    }

    #[test]
    fn parse_search_start_id_number_zero() {
        let json = serde_json::json!(0);
        let id = parse_search_start_id(&json).unwrap();
        assert_eq!(id, 0);
    }

    #[test]
    fn parse_search_start_id_object_with_number_id() {
        let json = serde_json::json!({ "id": 42 });
        let id = parse_search_start_id(&json).unwrap();
        assert_eq!(id, 42);
    }

    #[test]
    fn parse_search_start_id_object_with_string_id() {
        let json = serde_json::json!({ "id": "42" });
        let id = parse_search_start_id(&json).unwrap();
        assert_eq!(id, 42);
    }

    #[test]
    fn parse_search_start_id_object_with_extra_fields() {
        let json = serde_json::json!({ "id": 42, "extra": "ignored" });
        let id = parse_search_start_id(&json).unwrap();
        assert_eq!(id, 42);
    }

    #[test]
    fn parse_search_start_id_unparseable_string() {
        let json = serde_json::json!("not-a-number");
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_string_out_of_i32_range() {
        let json = serde_json::json!("99999999999999999999");
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_number_out_of_i32_range() {
        // Fits in i64 but not in i32 — try_from must reject it.
        let json = serde_json::json!(5_000_000_000_i64);
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_number_larger_than_i64() {
        // serde_json::Number with a value too large to fit in i64 — parse
        // through raw JSON to construct a Number the typed constructors
        // cannot represent.
        let json: serde_json::Value = serde_json::from_str("99999999999999999999").unwrap();
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_null() {
        let json = serde_json::json!(null);
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_boolean() {
        let json = serde_json::json!(true);
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_array() {
        let json = serde_json::json!([1, 2, 3]);
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_object_missing_id() {
        let json = serde_json::json!({ "foo": "bar" });
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("id"));
    }

    #[test]
    fn parse_search_start_id_object_id_null() {
        let json = serde_json::json!({ "id": null });
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_object_id_boolean() {
        let json = serde_json::json!({ "id": true });
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_object_id_array() {
        let json = serde_json::json!({ "id": [1, 2] });
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_object_id_invalid_string() {
        let json = serde_json::json!({ "id": "abc" });
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_start_id_object_id_out_of_i32_range() {
        let json = serde_json::json!({ "id": 5_000_000_000_i64 });
        let err = parse_search_start_id(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    // -------------------------------------------------------------------------
    // Search status
    // -------------------------------------------------------------------------

    #[test]
    fn parse_search_statuses_single_object() {
        let json = serde_json::json!({
            "id": 0,
            "status": "Running",
            "total": 100
        });
        let statuses = parse_search_statuses(&json).unwrap();
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].id, 0);
        assert_eq!(statuses[0].status, "Running");
        assert_eq!(statuses[0].total, 100);
        assert!(statuses[0].error.is_none());
    }

    #[test]
    fn parse_search_statuses_array() {
        let json = serde_json::json!([
            { "id": 0, "status": "Running", "total": 100 },
            { "id": 1, "status": "Stopped", "total": 50, "error": "canceled" }
        ]);
        let statuses = parse_search_statuses(&json).unwrap();
        assert_eq!(statuses.len(), 2);
        assert_eq!(statuses[0].status, "Running");
        assert_eq!(statuses[1].status, "Stopped");
        assert_eq!(statuses[1].total, 50);
        assert_eq!(statuses[1].error.as_deref(), Some("canceled"));
    }

    #[test]
    fn parse_search_statuses_empty_array() {
        let json = serde_json::json!([]);
        let statuses = parse_search_statuses(&json).unwrap();
        assert!(statuses.is_empty());
    }

    #[test]
    fn parse_search_statuses_null_returns_empty_list() {
        // Per the search controller, no active searches surfaces as a null
        // payload from some qBittorrent versions — treat it as empty.
        let json = serde_json::json!(null);
        let statuses = parse_search_statuses(&json).unwrap();
        assert!(statuses.is_empty());
    }

    #[test]
    fn parse_search_statuses_with_error_field() {
        let json = serde_json::json!({
            "id": 7,
            "status": "Error",
            "total": 0,
            "error": "Some failure"
        });
        let statuses = parse_search_statuses(&json).unwrap();
        assert_eq!(statuses[0].error.as_deref(), Some("Some failure"));
    }

    #[test]
    fn parse_search_statuses_missing_id() {
        let json = serde_json::json!({
            "status": "Running",
            "total": 100
        });
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_missing_status() {
        let json = serde_json::json!({
            "id": 0,
            "total": 100
        });
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_missing_total() {
        let json = serde_json::json!({
            "id": 0,
            "status": "Running"
        });
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_wrong_id_type() {
        let json = serde_json::json!({
            "id": "0",
            "status": "Running",
            "total": 100
        });
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_wrong_status_type() {
        let json = serde_json::json!({
            "id": 0,
            "status": 0,
            "total": 100
        });
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_wrong_total_type() {
        let json = serde_json::json!({
            "id": 0,
            "status": "Running",
            "total": "100"
        });
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_wrong_error_type() {
        let json = serde_json::json!({
            "id": 0,
            "status": "Error",
            "total": 0,
            "error": 123
        });
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_unknown_fields_ignored() {
        let json = serde_json::json!({
            "id": 0,
            "status": "Running",
            "total": 100,
            "unknown_field": "ignored"
        });
        let statuses = parse_search_statuses(&json).unwrap();
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].status, "Running");
    }

    #[test]
    fn parse_search_statuses_array_with_bad_item() {
        let json = serde_json::json!([
            { "id": 0, "status": "Running", "total": 100 },
            { "id": 1, "status": "Stopped" } // missing total
        ]);
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_boolean_top_level() {
        let json = serde_json::json!(true);
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_string_top_level() {
        let json = serde_json::json!("Running");
        let err = parse_search_statuses(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_statuses_serializes_to_snake_case_wire_format() {
        let json = serde_json::json!({
            "id": 0,
            "status": "Running",
            "total": 100
        });
        let statuses = parse_search_statuses(&json).unwrap();
        let serialized = serde_json::to_value(&statuses[0]).unwrap();
        assert_eq!(serialized["id"], 0);
        assert_eq!(serialized["status"], "Running");
        assert_eq!(serialized["total"], 100);
        // error must be omitted when None
        assert!(serialized.get("error").is_none());
    }

    #[test]
    fn parse_search_statuses_error_serialized_when_set() {
        let json = serde_json::json!({
            "id": 0,
            "status": "Error",
            "total": 0,
            "error": "Some failure"
        });
        let statuses = parse_search_statuses(&json).unwrap();
        let serialized = serde_json::to_value(&statuses[0]).unwrap();
        assert_eq!(serialized["error"], "Some failure");
    }

    #[test]
    fn parse_search_statuses_round_trip_preserves_values() {
        let json = serde_json::json!({
            "id": 7,
            "status": "Paused",
            "total": 42
        });
        let parsed = parse_search_statuses(&json).unwrap();
        let serialized = serde_json::to_value(&parsed[0]).unwrap();
        let reparsed_value = serde_json::value::from_value::<SearchStatusDto>(serialized).unwrap();
        assert_eq!(reparsed_value.id, 7);
        assert_eq!(reparsed_value.status, "Paused");
        assert_eq!(reparsed_value.total, 42);
    }

    // -------------------------------------------------------------------------
    // Search results
    // -------------------------------------------------------------------------

    fn valid_search_result_entry() -> serde_json::Value {
        serde_json::json!({
            "descrLink": "http://example.com/desc",
            "fileName": "ubuntu.iso",
            "fileSize": 1234567_i64,
            "fileUrl": "http://example.com/file",
            "nbLeechers": 10_i64,
            "nbSeeders": 5_i64,
            "siteUrl": "http://example.com"
        })
    }

    fn valid_search_results_payload() -> serde_json::Value {
        serde_json::json!({
            "results": [valid_search_result_entry()],
            "total": 1
        })
    }

    #[test]
    fn parse_search_results_valid() {
        let dto = parse_search_results(&valid_search_results_payload()).unwrap();
        assert_eq!(dto.total, 1);
        assert_eq!(dto.results.len(), 1);
        assert_eq!(dto.results[0].file_name, "ubuntu.iso");
        assert_eq!(dto.results[0].file_size, 1234567);
        assert_eq!(dto.results[0].nb_leechers, 10);
        assert_eq!(dto.results[0].nb_seeders, 5);
        assert_eq!(dto.results[0].descr_link, "http://example.com/desc");
        assert_eq!(dto.results[0].file_url, "http://example.com/file");
        assert_eq!(dto.results[0].site_url, "http://example.com");
    }

    #[test]
    fn parse_search_results_empty() {
        let json = serde_json::json!({ "results": [], "total": 0 });
        let dto = parse_search_results(&json).unwrap();
        assert_eq!(dto.total, 0);
        assert!(dto.results.is_empty());
    }

    #[test]
    fn parse_search_results_multiple() {
        let json = serde_json::json!({
            "results": [
                valid_search_result_entry(),
                serde_json::json!({
                    "descrLink": "http://b.com/desc",
                    "fileName": "b.iso",
                    "fileSize": 200_i64,
                    "fileUrl": "http://b.com/file",
                    "nbLeechers": 3_i64,
                    "nbSeeders": 4_i64,
                    "siteUrl": "http://b.com"
                })
            ],
            "total": 2
        });
        let dto = parse_search_results(&json).unwrap();
        assert_eq!(dto.total, 2);
        assert_eq!(dto.results.len(), 2);
        assert_eq!(dto.results[1].file_name, "b.iso");
    }

    #[test]
    fn parse_search_results_not_object() {
        let json = serde_json::json!([1, 2, 3]);
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_null() {
        let json = serde_json::json!(null);
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_missing_results() {
        let json = serde_json::json!({ "total": 0 });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_missing_total() {
        let json = serde_json::json!({ "results": [] });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_results_wrong_type() {
        let json = serde_json::json!({
            "results": "not an array",
            "total": 0
        });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_total_wrong_type() {
        let json = serde_json::json!({
            "results": [],
            "total": "0"
        });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_missing_file_name() {
        let mut entry = valid_search_result_entry();
        entry.as_object_mut().unwrap().remove("fileName");
        let json = serde_json::json!({ "results": [entry], "total": 1 });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_missing_file_size() {
        let mut entry = valid_search_result_entry();
        entry.as_object_mut().unwrap().remove("fileSize");
        let json = serde_json::json!({ "results": [entry], "total": 1 });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_string_file_size_rejected() {
        // Deliberate coercion choice: file_size must be a JSON number, not a
        // numeric string. The prior TS code parsed strings via parseInt, but
        // the Rust boundary enforces strict numeric typing.
        let mut entry = valid_search_result_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("fileSize".to_string(), serde_json::json!("1234567"));
        let json = serde_json::json!({ "results": [entry], "total": 1 });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_string_leechers_rejected() {
        let mut entry = valid_search_result_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("nbLeechers".to_string(), serde_json::json!("10"));
        let json = serde_json::json!({ "results": [entry], "total": 1 });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_string_seeders_rejected() {
        let mut entry = valid_search_result_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("nbSeeders".to_string(), serde_json::json!("5"));
        let json = serde_json::json!({ "results": [entry], "total": 1 });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_null_result_entry() {
        let json = serde_json::json!({ "results": [null], "total": 1 });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_string_result_entry() {
        let json = serde_json::json!({ "results": ["not a result object"], "total": 1 });
        let err = parse_search_results(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_results_unknown_top_level_fields_ignored() {
        let mut json = valid_search_results_payload();
        json.as_object_mut()
            .unwrap()
            .insert("unknown_field".to_string(), serde_json::json!("ignored"));
        let dto = parse_search_results(&json).unwrap();
        assert_eq!(dto.total, 1);
    }

    #[test]
    fn parse_search_results_unknown_result_fields_ignored() {
        let mut entry = valid_search_result_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("unknown_field".to_string(), serde_json::json!("ignored"));
        let json = serde_json::json!({ "results": [entry], "total": 1 });
        let dto = parse_search_results(&json).unwrap();
        assert_eq!(dto.results[0].file_name, "ubuntu.iso");
    }

    #[test]
    fn parse_search_results_serializes_to_camelcase_wire_format() {
        let dto = parse_search_results(&valid_search_results_payload()).unwrap();
        let serialized = serde_json::to_value(&dto).unwrap();
        let result = &serialized["results"][0];
        // camelCase keys must be present
        assert!(result.get("descrLink").is_some());
        assert!(result.get("fileName").is_some());
        assert!(result.get("fileSize").is_some());
        assert!(result.get("fileUrl").is_some());
        assert!(result.get("nbLeechers").is_some());
        assert!(result.get("nbSeeders").is_some());
        assert!(result.get("siteUrl").is_some());
        // snake_case keys must NOT be present
        assert!(result.get("descr_link").is_none());
        assert!(result.get("file_name").is_none());
        assert!(result.get("file_size").is_none());
        assert!(result.get("file_url").is_none());
        assert!(result.get("nb_leechers").is_none());
        assert!(result.get("nb_seeders").is_none());
        assert!(result.get("site_url").is_none());
    }

    #[test]
    fn parse_search_results_round_trip_preserves_values() {
        let parsed = parse_search_results(&valid_search_results_payload()).unwrap();
        let serialized = serde_json::to_value(&parsed).unwrap();
        let reparsed = parse_search_results(&serialized).unwrap();
        assert_eq!(reparsed.total, parsed.total);
        assert_eq!(reparsed.results.len(), parsed.results.len());
        assert_eq!(reparsed.results[0].file_name, parsed.results[0].file_name);
        assert_eq!(reparsed.results[0].file_size, parsed.results[0].file_size);
    }

    // -------------------------------------------------------------------------
    // Search plugins
    // -------------------------------------------------------------------------

    fn valid_search_plugin_entry() -> serde_json::Value {
        serde_json::json!({
            "name": "abc",
            "fullName": "ABC Plugin",
            "version": "1.0.0",
            "enabled": true,
            "url": "http://example.com/plugin",
            "supportedCategories": [
                { "id": "movies", "name": "Movies" }
            ]
        })
    }

    #[test]
    fn parse_search_plugins_valid() {
        let json = serde_json::json!([valid_search_plugin_entry()]);
        let plugins = parse_search_plugins(&json).unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].name, "abc");
        assert_eq!(plugins[0].full_name, "ABC Plugin");
        assert_eq!(plugins[0].version, "1.0.0");
        assert!(plugins[0].enabled);
        assert_eq!(plugins[0].url, "http://example.com/plugin");
        assert_eq!(plugins[0].supported_categories.len(), 1);
        assert_eq!(plugins[0].supported_categories[0].id, "movies");
        assert_eq!(plugins[0].supported_categories[0].name, "Movies");
    }

    #[test]
    fn parse_search_plugins_empty() {
        let json = serde_json::json!([]);
        let plugins = parse_search_plugins(&json).unwrap();
        assert!(plugins.is_empty());
    }

    #[test]
    fn parse_search_plugins_multiple() {
        let json = serde_json::json!([
            valid_search_plugin_entry(),
            serde_json::json!({
                "name": "xyz",
                "fullName": "XYZ Plugin",
                "version": "2.0.0",
                "enabled": false,
                "url": "http://b.com",
                "supportedCategories": [
                    { "id": "tv", "name": "TV Shows" },
                    { "id": "movies", "name": "Movies" }
                ]
            })
        ]);
        let plugins = parse_search_plugins(&json).unwrap();
        assert_eq!(plugins.len(), 2);
        assert!(!plugins[1].enabled);
        assert_eq!(plugins[1].supported_categories.len(), 2);
        assert_eq!(plugins[1].supported_categories[0].id, "tv");
    }

    #[test]
    fn parse_search_plugins_not_array() {
        let json = serde_json::json!({ "name": "abc" });
        let err = parse_search_plugins(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_null() {
        let json = serde_json::json!(null);
        let err = parse_search_plugins(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_missing_name() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().remove("name");
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_missing_full_name() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().remove("fullName");
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_missing_version() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().remove("version");
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_missing_enabled() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().remove("enabled");
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_missing_url() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().remove("url");
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_missing_supported_categories_defaults_empty() {
        // supportedCategories is the only optional field — missing it must
        // default to an empty list, not be treated as an error.
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().remove("supportedCategories");
        let plugins = parse_search_plugins(&serde_json::json!([entry])).unwrap();
        assert_eq!(plugins.len(), 1);
        assert!(plugins[0].supported_categories.is_empty());
    }

    #[test]
    fn parse_search_plugins_wrong_enabled_type() {
        let mut entry = valid_search_plugin_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("enabled".to_string(), serde_json::json!("true"));
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_wrong_name_type() {
        let mut entry = valid_search_plugin_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("name".to_string(), serde_json::json!(123));
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_wrong_category_id_type() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().insert(
            "supportedCategories".to_string(),
            serde_json::json!([{ "id": 123, "name": "Movies" }]),
        );
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_wrong_category_name_type() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().insert(
            "supportedCategories".to_string(),
            serde_json::json!([{ "id": "movies", "name": 123 }]),
        );
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_category_not_object() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().insert(
            "supportedCategories".to_string(),
            serde_json::json!(["movies"]),
        );
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_category_missing_id() {
        let mut entry = valid_search_plugin_entry();
        entry.as_object_mut().unwrap().insert(
            "supportedCategories".to_string(),
            serde_json::json!([{ "name": "Movies" }]),
        );
        let err = parse_search_plugins(&serde_json::json!([entry])).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_null_entry() {
        let json = serde_json::json!([null]);
        let err = parse_search_plugins(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_string_entry() {
        let json = serde_json::json!(["not a plugin object"]);
        let err = parse_search_plugins(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_unknown_fields_ignored() {
        let mut entry = valid_search_plugin_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("unknown_field".to_string(), serde_json::json!("ignored"));
        let plugins = parse_search_plugins(&serde_json::json!([entry])).unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].name, "abc");
    }

    #[test]
    fn parse_search_plugins_array_with_bad_item() {
        let mut bad = valid_search_plugin_entry();
        bad.as_object_mut().unwrap().remove("url");
        let json = serde_json::json!([valid_search_plugin_entry(), bad]);
        let err = parse_search_plugins(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_search_plugins_empty_supported_categories_serialized_as_omitted() {
        // Empty Vec is skipped on serialization to keep the wire payload
        // compact for plugins without categories.
        let json = serde_json::json!([{
            "name": "abc",
            "fullName": "ABC Plugin",
            "version": "1.0.0",
            "enabled": true,
            "url": "http://example.com"
        }]);
        let plugins = parse_search_plugins(&json).unwrap();
        let serialized = serde_json::to_value(&plugins[0]).unwrap();
        assert!(
            serialized.get("supportedCategories").is_none(),
            "empty supportedCategories must be omitted from serialized output"
        );
    }

    #[test]
    fn parse_search_plugins_serializes_to_camelcase_fullname() {
        let plugins =
            parse_search_plugins(&serde_json::json!([valid_search_plugin_entry()])).unwrap();
        let serialized = serde_json::to_value(&plugins[0]).unwrap();
        // snake_case-free keys must be present in their wire form
        assert_eq!(serialized["name"], "abc");
        assert_eq!(serialized["fullName"], "ABC Plugin");
        assert_eq!(serialized["version"], "1.0.0");
        assert_eq!(serialized["enabled"], true);
        assert_eq!(serialized["url"], "http://example.com/plugin");
        assert_eq!(serialized["supportedCategories"][0]["id"], "movies");
        assert_eq!(serialized["supportedCategories"][0]["name"], "Movies");
        // snake_case keys must NOT be present
        assert!(serialized.get("full_name").is_none());
        assert!(serialized.get("supported_categories").is_none());
    }

    #[test]
    fn parse_search_plugins_round_trip_preserves_values() {
        let parsed =
            parse_search_plugins(&serde_json::json!([valid_search_plugin_entry()])).unwrap();
        let serialized = serde_json::to_value(&parsed).unwrap();
        let reparsed = parse_search_plugins(&serialized).unwrap();
        assert_eq!(reparsed.len(), 1);
        assert_eq!(reparsed[0].name, parsed[0].name);
        assert_eq!(reparsed[0].full_name, parsed[0].full_name);
        assert_eq!(reparsed[0].version, parsed[0].version);
        assert_eq!(reparsed[0].enabled, parsed[0].enabled);
        assert_eq!(reparsed[0].url, parsed[0].url);
        assert_eq!(reparsed[0].supported_categories.len(), 1);
        assert_eq!(reparsed[0].supported_categories[0].id, "movies");
    }

    // -------------------------------------------------------------------------
    // RSS items — keyed tree
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_items_flat_keyed_tree() {
        let json = serde_json::json!({
            "Feed A": "https://a.example.com/feed",
            "Feed B": "https://b.example.com/feed"
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Feed A");
        assert_eq!(items[0].url.as_deref(), Some("https://a.example.com/feed"));
        assert!(!items[0].is_folder);
        assert_eq!(items[0].path, "Feed A");
        assert_eq!(items[1].name, "Feed B");
        assert_eq!(items[1].path, "Feed B");
    }

    #[test]
    fn parse_rss_items_nested_keyed_tree_joins_paths_with_backslash() {
        let json = serde_json::json!({
            "Folder": {
                "Nested": "https://nested.example.com/feed",
                "Deeper": {
                    "Leaf": "https://leaf.example.com/feed"
                }
            },
            "Top": "https://top.example.com/feed"
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 3);
        // The keyed-tree flattener does NOT emit folder rows; only feed leaves
        // appear, with canonical paths accumulating parent keys joined by \\.
        let names: Vec<&str> = items.iter().map(|i| i.name.as_str()).collect();
        assert!(names.contains(&"Nested"));
        assert!(names.contains(&"Leaf"));
        assert!(names.contains(&"Top"));

        let nested = items.iter().find(|i| i.name == "Nested").unwrap();
        assert_eq!(nested.path, "Folder\\Nested");
        let leaf = items.iter().find(|i| i.name == "Leaf").unwrap();
        assert_eq!(leaf.path, "Folder\\Deeper\\Leaf");
        let top = items.iter().find(|i| i.name == "Top").unwrap();
        assert_eq!(top.path, "Top");
    }

    #[test]
    fn parse_rss_items_keyed_tree_skips_empty_url_leaves() {
        // The TS normalizer logs a warning and drops empty/whitespace URL
        // leaves; the Rust parser does the same silently.
        let json = serde_json::json!({
            "Good": "https://good.example.com/feed",
            "Empty": "",
            "Whitespace": "   ",
            "Nulled": null,
            "NumericLeaf": 42
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Good");
        assert_eq!(items[0].path, "Good");
    }

    #[test]
    fn parse_rss_items_keyed_tree_skips_metadata_keys() {
        // sharedBridge-style envelope keys must be ignored by the flattener
        // so they don't appear as feed names.
        let json = serde_json::json!({
            "session_generation": 7_i64,
            "server_id": "srv-1",
            "Real Feed": "https://real.example.com/feed"
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Real Feed");
        assert_eq!(items[0].path, "Real Feed");
    }

    #[test]
    fn parse_rss_items_nested_keyed_tree_with_skipped_leaves() {
        let json = serde_json::json!({
            "Folder": {
                "OK": "https://ok.example.com/feed",
                "Empty": "",
                "Sub": {
                    "Leaf": "https://leaf.example.com/feed"
                }
            }
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 2);
        let ok = items.iter().find(|i| i.name == "OK").unwrap();
        assert_eq!(ok.path, "Folder\\OK");
        let leaf = items.iter().find(|i| i.name == "Leaf").unwrap();
        assert_eq!(leaf.path, "Folder\\Sub\\Leaf");
    }

    // -------------------------------------------------------------------------
    // RSS items — array
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_items_array_shape() {
        let json = serde_json::json!([
            { "name": "Feed A", "url": "https://a.example.com/feed" },
            { "name": "Feed B", "url": "https://b.example.com/feed", "path": "Custom\\Path" }
        ]);
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Feed A");
        assert_eq!(items[0].url.as_deref(), Some("https://a.example.com/feed"));
        assert_eq!(items[0].path, "Feed A");
        assert!(!items[0].is_folder);
        assert_eq!(items[1].name, "Feed B");
        assert_eq!(items[1].path, "Custom\\Path");
    }

    #[test]
    fn parse_rss_items_array_shape_with_uid() {
        let json = serde_json::json!([
            { "name": "Feed A", "url": "https://a.example.com/feed", "uid": "abc-123" }
        ]);
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].uid.as_deref(), Some("abc-123"));
    }

    #[test]
    fn parse_rss_items_array_shape_skips_rows_missing_name_or_url() {
        let json = serde_json::json!([
            { "name": "Good", "url": "https://good.example.com/feed" },
            { "url": "https://no-name.example.com/feed" },
            { "name": "NoUrl" },
            null,
            "not an object"
        ]);
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Good");
    }

    #[test]
    fn parse_rss_items_empty_array() {
        let json = serde_json::json!([]);
        let items = parse_rss_items(&json).unwrap();
        assert!(items.is_empty());
    }

    // -------------------------------------------------------------------------
    // RSS items — legacy { feeds, folders } shape
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_items_legacy_feeds_and_folders() {
        let json = serde_json::json!({
            "feeds": [
                { "name": "Feed A", "url": "https://a.example.com/feed" },
                { "name": "Feed B", "url": "https://b.example.com/feed" }
            ],
            "folders": [
                { "name": "Folder X" },
                { "name": "Folder Y" }
            ]
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 4);
        // Feed rows have URL and isFolder=false.
        let feed_a = items.iter().find(|i| i.name == "Feed A").unwrap();
        assert_eq!(feed_a.url.as_deref(), Some("https://a.example.com/feed"));
        assert!(!feed_a.is_folder);
        // Folder rows have no URL and isFolder=true.
        let folder_x = items.iter().find(|i| i.name == "Folder X").unwrap();
        assert!(folder_x.url.is_none());
        assert!(folder_x.is_folder);
        // Folder rows fall back to name as path.
        assert_eq!(folder_x.path, "Folder X");
    }

    #[test]
    fn parse_rss_items_legacy_feeds_only() {
        let json = serde_json::json!({
            "feeds": [
                { "name": "Feed A", "url": "https://a.example.com/feed" }
            ]
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Feed A");
    }

    #[test]
    fn parse_rss_items_legacy_folders_only() {
        let json = serde_json::json!({
            "folders": [
                { "name": "Folder X" }
            ]
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Folder X");
        assert!(items[0].is_folder);
        assert!(items[0].url.is_none());
    }

    #[test]
    fn parse_rss_items_legacy_uses_explicit_path() {
        let json = serde_json::json!({
            "feeds": [
                { "name": "Feed A", "url": "https://a.example.com/feed", "path": "Custom\\Path" }
            ]
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items[0].path, "Custom\\Path");
    }

    // -------------------------------------------------------------------------
    // RSS items — malformed input
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_items_null_returns_empty() {
        let json = serde_json::json!(null);
        let items = parse_rss_items(&json).unwrap();
        assert!(items.is_empty());
    }

    #[test]
    fn parse_rss_items_string_returns_error() {
        let json = serde_json::json!("not an object or array");
        let err = parse_rss_items(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_rss_items_number_returns_error() {
        let json = serde_json::json!(42);
        let err = parse_rss_items(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_rss_items_boolean_returns_error() {
        let json = serde_json::json!(true);
        let err = parse_rss_items(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    // -------------------------------------------------------------------------
    // RSS items — serialization field names
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_items_serializes_to_camelcase_wire_format() {
        // The DTO must serialize to the renderer-facing wire format so the
        // existing TS `NormalizedRSSItem` consumers keep working without
        // any change.
        let json = serde_json::json!({
            "Folder": { "Leaf": "https://leaf.example.com/feed" }
        });
        let items = parse_rss_items(&json).unwrap();
        let serialized = serde_json::to_value(&items[0]).unwrap();
        assert_eq!(serialized["name"], "Leaf");
        assert_eq!(serialized["url"], "https://leaf.example.com/feed");
        assert_eq!(serialized["isFolder"], false);
        assert_eq!(serialized["path"], "Folder\\Leaf");
        assert!(serialized.get("uid").is_none());
        // snake_case variant must NOT be present.
        assert!(serialized.get("is_folder").is_none());
    }

    #[test]
    fn parse_rss_items_legacy_serializes_with_uid_when_set() {
        let json = serde_json::json!([
            { "name": "Feed", "url": "https://example.com/feed", "uid": "u-1" }
        ]);
        let items = parse_rss_items(&json).unwrap();
        let serialized = serde_json::to_value(&items[0]).unwrap();
        assert_eq!(serialized["uid"], "u-1");
    }

    // -------------------------------------------------------------------------
    // RSS rules — keyed shape
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_rules_keyed_shape() {
        let json = serde_json::json!({
            "Rule 1": {
                "enabled": true,
                "mustContain": "linux",
                "mustNotContain": "windows",
                "useRegex": false,
                "episodeFilter": "ep >= 1",
                "smartFilter": true,
                "affectedFeeds": ["feed-a", "feed-b"],
                "ignoreDays": 7,
                "lastMatch": "2026-05-01",
                "addPaused": true,
                "assignedCategory": "movies",
                "savePath": "/downloads/movies"
            }
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        let r = &rules[0];
        assert_eq!(r.name, "Rule 1");
        assert!(r.enabled);
        assert_eq!(r.must_contain, "linux");
        assert_eq!(r.must_not_contain, "windows");
        assert!(!r.use_regex);
        assert_eq!(r.episode_filter, "ep >= 1");
        assert!(r.smart_filter);
        assert_eq!(r.affected_feeds, vec!["feed-a", "feed-b"]);
        assert_eq!(r.ignore_days, 7);
        assert_eq!(r.last_match, "2026-05-01");
        assert!(r.add_paused);
        assert_eq!(r.assigned_category, "movies");
        assert_eq!(r.save_path, "/downloads/movies");
    }

    #[test]
    fn parse_rss_rules_keyed_shape_multiple_rules() {
        let json = serde_json::json!({
            "Rule 1": { "enabled": true },
            "Rule 2": { "enabled": false, "mustContain": "music" }
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 2);
        assert_eq!(rules[0].name, "Rule 1");
        assert!(rules[0].enabled);
        assert_eq!(rules[1].name, "Rule 2");
        assert!(!rules[1].enabled);
        assert_eq!(rules[1].must_contain, "music");
    }

    #[test]
    fn parse_rss_rules_keyed_shape_skips_metadata_keys() {
        let json = serde_json::json!({
            "session_generation": 5_i64,
            "server_id": "srv-1",
            "Real Rule": { "enabled": true }
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].name, "Real Rule");
    }

    // -------------------------------------------------------------------------
    // RSS rules — array shape
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_rules_array_shape() {
        let json = serde_json::json!({
            "rules": [
                { "name": "Rule 1", "enabled": true, "mustContain": "linux" },
                { "name": "Rule 2", "enabled": false }
            ]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 2);
        assert_eq!(rules[0].name, "Rule 1");
        assert!(rules[0].enabled);
        assert_eq!(rules[0].must_contain, "linux");
        assert_eq!(rules[1].name, "Rule 2");
        assert!(!rules[1].enabled);
    }

    #[test]
    fn parse_rss_rules_array_shape_uses_rule_name_alias() {
        // `ruleName` is the alternate name used by some qBittorrent
        // versions; the parser must accept it in the array shape.
        let json = serde_json::json!({
            "rules": [
                { "ruleName": "Rule 1", "enabled": true }
            ]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].name, "Rule 1");
    }

    #[test]
    fn parse_rss_rules_array_shape_skips_empty_names() {
        let json = serde_json::json!({
            "rules": [
                { "name": "", "enabled": true },
                { "enabled": true },
                { "name": "Rule A", "enabled": true }
            ]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].name, "Rule A");
    }

    #[test]
    fn parse_rss_rules_array_shape_tolerates_bare_string_entries() {
        let json = serde_json::json!({
            "rules": ["Standalone Rule Name", { "name": "Rule A", "enabled": true }]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 2);
        assert_eq!(rules[0].name, "Standalone Rule Name");
        assert!(!rules[0].enabled);
        assert_eq!(rules[1].name, "Rule A");
        assert!(rules[1].enabled);
    }

    #[test]
    fn parse_rss_rules_array_empty() {
        let json = serde_json::json!({ "rules": [] });
        let rules = parse_rss_rules(&json).unwrap();
        assert!(rules.is_empty());
    }

    // -------------------------------------------------------------------------
    // RSS rules — aliases and defaults
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_rules_accepts_snake_case_aliases() {
        let json = serde_json::json!({
            "rules": [{
                "name": "Rule S",
                "enabled": true,
                "must_contain": "linux",
                "must_not_contain": "win",
                "use_regex": true,
                "episode_filter": "ep>=1",
                "smart_filter": true,
                "affected_feeds": ["f1", "f2"],
                "ignore_days": 3,
                "last_match": "2026-05-01",
                "add_paused": true,
                "assigned_category": "tv",
                "save_path": "/tv"
            }]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        let r = &rules[0];
        assert_eq!(r.must_contain, "linux");
        assert_eq!(r.must_not_contain, "win");
        assert!(r.use_regex);
        assert_eq!(r.episode_filter, "ep>=1");
        assert!(r.smart_filter);
        assert_eq!(r.affected_feeds, vec!["f1", "f2"]);
        assert_eq!(r.ignore_days, 3);
        assert_eq!(r.last_match, "2026-05-01");
        assert!(r.add_paused);
        assert_eq!(r.assigned_category, "tv");
        assert_eq!(r.save_path, "/tv");
    }

    #[test]
    fn parse_rss_rules_defaults_when_fields_missing() {
        // Only `name` is present; every other field must fall back to its
        // default (false/0/empty string/empty array).
        let json = serde_json::json!({
            "rules": [{ "name": "Minimal" }]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        let r = &rules[0];
        assert_eq!(r.name, "Minimal");
        assert!(!r.enabled);
        assert_eq!(r.must_contain, "");
        assert_eq!(r.must_not_contain, "");
        assert!(!r.use_regex);
        assert_eq!(r.episode_filter, "");
        assert!(!r.smart_filter);
        assert!(r.affected_feeds.is_empty());
        assert_eq!(r.ignore_days, 0);
        assert_eq!(r.last_match, "");
        assert!(!r.add_paused);
        assert_eq!(r.assigned_category, "");
        assert_eq!(r.save_path, "");
    }

    #[test]
    fn parse_rss_rules_affected_feeds_string_split_on_comma() {
        // Some qBittorrent versions encode the feed list as a single
        // comma-separated string. The TS normalizer splits it; the Rust
        // parser preserves that behavior.
        let json = serde_json::json!({
            "rules": [{
                "name": "Rule C",
                "affectedFeeds": "feed-a, feed-b,feed-c"
            }]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].affected_feeds, vec!["feed-a", "feed-b", "feed-c"]);
    }

    #[test]
    fn parse_rss_rules_affected_feeds_aliases() {
        // affectedFeeds / affected_feeds / feeds all map to the same field.
        let json = serde_json::json!({
            "rules": [
                { "name": "R1", "affectedFeeds": ["a"] },
                { "name": "R2", "affected_feeds": ["b"] },
                { "name": "R3", "feeds": ["c"] }
            ]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules[0].affected_feeds, vec!["a"]);
        assert_eq!(rules[1].affected_feeds, vec!["b"]);
        assert_eq!(rules[2].affected_feeds, vec!["c"]);
    }

    #[test]
    fn parse_rss_rules_loose_bool_enabled_coercion() {
        // JS `Boolean(value)` semantics: truthy non-empty strings,
        // non-zero numbers, objects, and arrays map to true; null, 0, "",
        // and false map to false.
        let json = serde_json::json!({
            "rules": [
                { "name": "A", "enabled": "yes" },
                { "name": "B", "enabled": "" },
                { "name": "C", "enabled": 1 },
                { "name": "D", "enabled": 0 },
                { "name": "E", "enabled": null },
                { "name": "F", "enabled": { "anything": true } }
            ]
        });
        let rules = parse_rss_rules(&json).unwrap();
        let by_name: std::collections::HashMap<&str, bool> =
            rules.iter().map(|r| (r.name.as_str(), r.enabled)).collect();
        assert!(by_name["A"]);
        assert!(!by_name["B"]);
        assert!(by_name["C"]);
        assert!(!by_name["D"]);
        assert!(!by_name["E"]);
        assert!(by_name["F"]);
    }

    #[test]
    fn parse_rss_rules_loose_bool_for_optional_flags() {
        // useRegex / smartFilter / addPaused all use the same loose
        // coercion. Cover them with a single mixed input.
        let json = serde_json::json!({
            "rules": [{
                "name": "Mixed",
                "useRegex": "true",
                "smartFilter": 1,
                "addPaused": "false"
            }]
        });
        let rules = parse_rss_rules(&json).unwrap();
        let r = &rules[0];
        assert!(r.use_regex, "non-empty string must be truthy");
        assert!(r.smart_filter, "non-zero number must be truthy");
        // Document the JS Boolean() quirk: the string "false" is non-empty
        // and therefore truthy. This is intentional and matches the TS
        // normalizer's `Boolean(r.addPaused)` behavior, so the Rust
        // boundary preserves it.
        assert!(
            r.add_paused,
            "non-empty string 'false' is truthy under JS Boolean() semantics"
        );
    }

    #[test]
    fn parse_rss_rules_ignore_days_only_accepts_numbers() {
        // ignoreDays must be a JSON number, not a numeric string. This
        // matches the strict typing used elsewhere in the DTO layer.
        let json = serde_json::json!({
            "rules": [
                { "name": "Numeric", "ignoreDays": 5 },
                { "name": "Stringy", "ignoreDays": "5" }
            ]
        });
        let rules = parse_rss_rules(&json).unwrap();
        let numeric = rules.iter().find(|r| r.name == "Numeric").unwrap();
        let stringy = rules.iter().find(|r| r.name == "Stringy").unwrap();
        assert_eq!(numeric.ignore_days, 5);
        assert_eq!(stringy.ignore_days, 0);
    }

    // -------------------------------------------------------------------------
    // RSS rules — malformed input
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_rules_null_returns_empty() {
        let json = serde_json::json!(null);
        let rules = parse_rss_rules(&json).unwrap();
        assert!(rules.is_empty());
    }

    #[test]
    fn parse_rss_rules_empty_object_returns_empty() {
        let json = serde_json::json!({});
        let rules = parse_rss_rules(&json).unwrap();
        assert!(rules.is_empty());
    }

    #[test]
    fn parse_rss_rules_array_top_level_returns_error() {
        // A bare top-level array is not a supported shape; only the
        // { "rules": [...] } wrapper form is accepted.
        let json = serde_json::json!([{ "name": "Rule 1" }]);
        let err = parse_rss_rules(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_rss_rules_string_top_level_returns_error() {
        let json = serde_json::json!("not an object");
        let err = parse_rss_rules(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_rss_rules_number_top_level_returns_error() {
        let json = serde_json::json!(42);
        let err = parse_rss_rules(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    // -------------------------------------------------------------------------
    // RSS rules — serialization field names
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_rules_serializes_to_camelcase_wire_format() {
        let json = serde_json::json!({
            "rules": [{
                "name": "R",
                "enabled": true,
                "mustContain": "linux",
                "mustNotContain": "win",
                "useRegex": true,
                "episodeFilter": "ep>=1",
                "smartFilter": true,
                "affectedFeeds": ["f"],
                "ignoreDays": 7,
                "lastMatch": "2026-05-01",
                "addPaused": true,
                "assignedCategory": "tv",
                "savePath": "/tv"
            }]
        });
        let rules = parse_rss_rules(&json).unwrap();
        let serialized = serde_json::to_value(&rules[0]).unwrap();
        // camelCase wire keys must be present.
        assert!(serialized.get("mustContain").is_some());
        assert!(serialized.get("mustNotContain").is_some());
        assert!(serialized.get("useRegex").is_some());
        assert!(serialized.get("episodeFilter").is_some());
        assert!(serialized.get("smartFilter").is_some());
        assert!(serialized.get("affectedFeeds").is_some());
        assert!(serialized.get("ignoreDays").is_some());
        assert!(serialized.get("lastMatch").is_some());
        assert!(serialized.get("addPaused").is_some());
        assert!(serialized.get("assignedCategory").is_some());
        assert!(serialized.get("savePath").is_some());
        // snake_case variants must NOT be present.
        assert!(serialized.get("must_contain").is_none());
        assert!(serialized.get("must_not_contain").is_none());
        assert!(serialized.get("use_regex").is_none());
        assert!(serialized.get("episode_filter").is_none());
        assert!(serialized.get("smart_filter").is_none());
        assert!(serialized.get("affected_feeds").is_none());
        assert!(serialized.get("ignore_days").is_none());
        assert!(serialized.get("last_match").is_none());
        assert!(serialized.get("add_paused").is_none());
        assert!(serialized.get("assigned_category").is_none());
        assert!(serialized.get("save_path").is_none());
    }

    #[test]
    fn parse_rss_rules_round_trip_preserves_values() {
        let json = serde_json::json!({
            "rules": [{
                "name": "Round",
                "enabled": true,
                "mustContain": "linux",
                "mustNotContain": "win",
                "useRegex": true,
                "episodeFilter": "ep>=1",
                "smartFilter": true,
                "affectedFeeds": ["f1", "f2"],
                "ignoreDays": 7,
                "lastMatch": "2026-05-01",
                "addPaused": true,
                "assignedCategory": "tv",
                "savePath": "/tv"
            }]
        });
        let rules = parse_rss_rules(&json).unwrap();
        let serialized = serde_json::to_value(&rules[0]).unwrap();
        let reparsed_json = serde_json::json!({ "rules": [serialized] });
        let reparsed = parse_rss_rules(&reparsed_json).unwrap();
        assert_eq!(reparsed.len(), 1);
        assert_eq!(reparsed[0].name, "Round");
        assert!(reparsed[0].enabled);
        assert_eq!(reparsed[0].must_contain, "linux");
        assert_eq!(reparsed[0].must_not_contain, "win");
        assert!(reparsed[0].use_regex);
        assert_eq!(reparsed[0].episode_filter, "ep>=1");
        assert!(reparsed[0].smart_filter);
        assert_eq!(reparsed[0].affected_feeds, vec!["f1", "f2"]);
        assert_eq!(reparsed[0].ignore_days, 7);
        assert_eq!(reparsed[0].last_match, "2026-05-01");
        assert!(reparsed[0].add_paused);
        assert_eq!(reparsed[0].assigned_category, "tv");
        assert_eq!(reparsed[0].save_path, "/tv");
    }

    // -------------------------------------------------------------------------
    // RSS — T142.4 compatibility verification additions
    //
    // These tests pin the additional compatibility edges that the spec and
    // T142.1 completion report called out as part of the migration closeout:
    //
    //   - empty keyed tree returns empty
    //   - legacy shape with both feeds and folders empty returns empty
    //   - legacy shape alongside metadata keys
    //   - deeply nested keyed trees (3+ levels)
    //   - keyed tree folder that contains no leaves
    //   - non-string / null `uid` in the array shape
    //   - whitespace-only `url` in the array shape is treated as missing
    //   - items round-trip preserves all field names and values
    //   - keyed rule shape with the inner `name` field overriding the key
    //   - rules with `affectedFeeds` array containing non-string entries
    // -------------------------------------------------------------------------

    #[test]
    fn parse_rss_items_empty_keyed_tree_returns_empty() {
        // An empty object should be treated like the keyed-tree shape with
        // no leaves, not as a malformed payload. Matches the null-input
        // behavior (returns empty rather than errors).
        let json = serde_json::json!({});
        let items = parse_rss_items(&json).unwrap();
        assert!(items.is_empty());
    }

    #[test]
    fn parse_rss_items_legacy_both_feeds_and_folders_empty() {
        // Both arrays present but empty → no items, no error.
        let json = serde_json::json!({
            "feeds": [],
            "folders": []
        });
        let items = parse_rss_items(&json).unwrap();
        assert!(items.is_empty());
    }

    #[test]
    fn parse_rss_items_legacy_coexists_with_metadata_keys() {
        // Metadata keys must not be treated as feed/folder names when the
        // legacy { feeds, folders } shape is detected. This pins that the
        // legacy detector only looks for `feeds` / `folders` array keys and
        // does not iterate the rest of the object.
        let json = serde_json::json!({
            "session_generation": 7_i64,
            "server_id": "srv-1",
            "feeds": [{ "name": "Feed A", "url": "https://a.example.com/feed" }],
            "folders": [{ "name": "Folder X" }]
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|i| i.name == "Feed A" && !i.is_folder));
        assert!(items.iter().any(|i| i.name == "Folder X" && i.is_folder));
    }

    #[test]
    fn parse_rss_items_keyed_tree_deeply_nested() {
        // 4-level deep nesting should still produce the correct
        // backslash-joined canonical path.
        let json = serde_json::json!({
            "L1": {
                "L2": {
                    "L3": {
                        "L4": "https://deep.example.com/feed"
                    }
                }
            }
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "L4");
        assert_eq!(items[0].path, "L1\\L2\\L3\\L4");
    }

    #[test]
    fn parse_rss_items_keyed_tree_empty_folder_yields_no_items() {
        // A folder that contains no leaves (empty object) must not produce
        // any items. Only feed leaves emit rows.
        let json = serde_json::json!({
            "EmptyFolder": {},
            "RealFeed": "https://real.example.com/feed"
        });
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "RealFeed");
    }

    #[test]
    fn parse_rss_items_array_shape_whitespace_url_treated_as_missing() {
        // Whitespace-only URLs in the array shape should be treated as
        // missing, mirroring the keyed-tree behavior. The legacy
        // `normalize_rss_item_simple` helper trims and filters them out.
        let json = serde_json::json!([
            { "name": "Good", "url": "https://good.example.com/feed" },
            { "name": "Whitespace", "url": "   " },
            { "name": "TabsAndNewline", "url": "\t\n  \r" }
        ]);
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Good");
    }

    #[test]
    fn parse_rss_items_array_shape_non_string_uid_preserved() {
        // The legacy array shape allows `uid` to be any scalar. Non-string
        // values are stringified via `Value::to_string()`, matching the
        // existing `normalize_rss_item_simple` behavior.
        let json = serde_json::json!([
            { "name": "Numeric", "url": "https://a.example.com/feed", "uid": 42 },
            { "name": "Stringy", "url": "https://b.example.com/feed", "uid": "abc" },
            { "name": "NoUid", "url": "https://c.example.com/feed" }
        ]);
        let items = parse_rss_items(&json).unwrap();
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].uid.as_deref(), Some("42"));
        assert_eq!(items[1].uid.as_deref(), Some("abc"));
        assert!(items[2].uid.is_none());
    }

    #[test]
    fn parse_rss_items_round_trip_preserves_values() {
        // Mirror of the rule round-trip: parse → serialize → reparse
        // should produce the same logical content. `uid` is omitted on
        // serialization when None, so the reparse should not see it.
        let json = serde_json::json!({
            "Folder": {
                "Nested": "https://nested.example.com/feed"
            },
            "Top": "https://top.example.com/feed"
        });
        let items = parse_rss_items(&json).unwrap();
        let serialized = serde_json::to_value(&items).unwrap();
        let reparsed = parse_rss_items(&serialized).unwrap();
        assert_eq!(reparsed.len(), items.len());
        for (orig, rep) in items.iter().zip(reparsed.iter()) {
            assert_eq!(orig.name, rep.name);
            assert_eq!(orig.url, rep.url);
            assert_eq!(orig.is_folder, rep.is_folder);
            assert_eq!(orig.path, rep.path);
            assert_eq!(orig.uid, rep.uid);
        }
    }

    #[test]
    fn parse_rss_rules_keyed_shape_inner_name_overrides_key() {
        // The keyed shape takes the top-level key as the authoritative
        // rule name, but the inner `name` field can override it (matching
        // the TS `normalizeRSSRule` `r.name ?? key` precedence).
        let json = serde_json::json!({
            "Key Name": {
                "name": "Inner Name",
                "enabled": true
            }
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].name, "Inner Name");
    }

    #[test]
    fn parse_rss_rules_affected_feeds_array_filters_non_string_entries() {
        // `affectedFeeds` / `affected_feeds` / `feeds` arrays may contain
        // non-string entries in real-world qB payloads. The parser must
        // silently filter them (matching the existing TS `Array.isArray`
        // + `typeof === 'string'` tolerance).
        let json = serde_json::json!({
            "rules": [{
                "name": "Mixed",
                "affectedFeeds": ["good", 42, null, "also-good", { "noise": true }]
            }]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].affected_feeds, vec!["good", "also-good"]);
    }

    #[test]
    fn parse_rss_rules_affected_feeds_empty_string_split_returns_empty() {
        // An empty / whitespace-only string for `affectedFeeds` should
        // produce an empty list, not a list with one empty string.
        let json = serde_json::json!({
            "rules": [
                { "name": "Empty", "affectedFeeds": "" },
                { "name": "Whitespace", "affectedFeeds": "   " },
                { "name": "Commas", "affectedFeeds": ",, ,," }
            ]
        });
        let rules = parse_rss_rules(&json).unwrap();
        assert_eq!(rules.len(), 3);
        assert!(rules[0].affected_feeds.is_empty());
        assert!(rules[1].affected_feeds.is_empty());
        assert!(rules[2].affected_feeds.is_empty());
    }

    // -------------------------------------------------------------------------
    // Torrent list — T143.1
    //
    // Parser covers the `/api/v2/torrents/info` array response and the
    // documented drift fields. Required fields match `TorrentSchema` and
    // `Torrent` in @taurent/shared. `state` is a free-form string and
    // `tags` is preserved as a comma-separated string.
    // -------------------------------------------------------------------------

    fn valid_torrent_entry() -> serde_json::Value {
        // Built via `Value::from_str` rather than `json!` to avoid hitting
        // the macro recursion limit on the large number of required fields.
        serde_json::from_str(
            r#"{
                "added_on": 1654022838,
                "amount_left": 0,
                "auto_tmm": false,
                "availability": 1.0,
                "category": "movies",
                "completed": 2048,
                "completion_on": 1654022840,
                "content_path": "/downloads/movie.mkv",
                "dl_limit": -1,
                "dlspeed": 0,
                "downloaded": 2048,
                "downloaded_session": 2048,
                "eta": 8640000,
                "f_l_piece_prio": false,
                "force_start": false,
                "hash": "8c7a1e3f5b9d2a6e4c8b1f3a5d7e9c2b4a6e8d0f3b5c7d9e1a3b5c7d9e1f3a5b",
                "last_activity": 1654022900,
                "magnet_uri": "magnet:?xt=urn:btih:8c7a1e3f5b9d2a6e4c8b1f3a5d7e9c2b4a6e8d0f3b5c7d9e1a3b5c7d9e1f3a5b",
                "max_ratio": -1.0,
                "max_seeding_time": -1,
                "name": "movie.mkv",
                "num_complete": 5,
                "num_incomplete": 1,
                "num_leechs": 1,
                "num_seeds": 5,
                "priority": 0,
                "progress": 1.0,
                "ratio": 0.5,
                "ratio_limit": -2.0,
                "save_path": "/downloads",
                "seeding_time": 600,
                "seeding_time_limit": -1,
                "seen_complete": 1654022840,
                "seq_dl": false,
                "size": 2048,
                "state": "uploading",
                "super_seeding": false,
                "tags": "action,hd",
                "time_active": 600,
                "total_size": 2048,
                "tracker": "http://tracker.example.com/announce",
                "up_limit": -1,
                "uploaded": 1024,
                "uploaded_session": 512,
                "upspeed": 0
            }"#,
        )
        .unwrap()
    }

    #[test]
    fn parse_torrent_list_valid_single_row() {
        let json = serde_json::json!([valid_torrent_entry()]);
        let result = parse_torrent_list(&json).unwrap();
        assert_eq!(result.len(), 1);
        let t = &result[0];
        assert_eq!(
            t.hash,
            "8c7a1e3f5b9d2a6e4c8b1f3a5d7e9c2b4a6e8d0f3b5c7d9e1a3b5c7d9e1f3a5b"
        );
        assert_eq!(t.name, "movie.mkv");
        assert_eq!(t.state, "uploading");
        assert_eq!(t.tags, "action,hd");
        assert_eq!(t.category, "movies");
        assert_eq!(t.total_size, 2048);
        assert_eq!(t.progress, 1.0);
        assert_eq!(t.ratio, 0.5);
        assert!(!t.auto_tmm);
        assert!(!t.force_start);
        assert!(!t.f_l_piece_prio);
        assert!(!t.seq_dl);
        assert!(!t.super_seeding);
    }

    #[test]
    fn parse_torrent_list_valid_multiple_rows() {
        // Build the second row via from_str to avoid the json! macro
        // recursion limit on this large field set.
        let second: serde_json::Value = serde_json::from_str(
            r#"{
                "added_on": 1654022900,
                "amount_left": 1024,
                "auto_tmm": true,
                "availability": 0.5,
                "category": "",
                "completed": 0,
                "completion_on": -1,
                "content_path": "/downloads/sample.mkv",
                "dl_limit": 100000,
                "dlspeed": 50000,
                "downloaded": 0,
                "downloaded_session": 0,
                "eta": 300,
                "f_l_piece_prio": true,
                "force_start": true,
                "hash": "abc123def456abc123def456abc123def456abcd",
                "last_activity": 1654022950,
                "magnet_uri": "magnet:?xt=urn:btih:abc",
                "max_ratio": 1.5,
                "max_seeding_time": 3600,
                "name": "sample.mkv",
                "num_complete": 10,
                "num_incomplete": 5,
                "num_leechs": 5,
                "num_seeds": 10,
                "priority": 1,
                "progress": 0.5,
                "ratio": 0.0,
                "ratio_limit": 1.5,
                "save_path": "/downloads",
                "seeding_time": 0,
                "seeding_time_limit": 3600,
                "seen_complete": -1,
                "seq_dl": true,
                "size": 2048,
                "state": "downloading",
                "super_seeding": true,
                "tags": "",
                "time_active": 100,
                "total_size": 2048,
                "tracker": "udp://tracker.example.com:1337",
                "up_limit": 50000,
                "uploaded": 0,
                "uploaded_session": 0,
                "upspeed": 0
            }"#,
        )
        .unwrap();
        let json = serde_json::Value::Array(vec![valid_torrent_entry(), second]);
        let result = parse_torrent_list(&json).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name, "movie.mkv");
        assert_eq!(result[0].state, "uploading");
        assert_eq!(result[1].name, "sample.mkv");
        assert_eq!(result[1].state, "downloading");
        assert!(result[1].auto_tmm);
        assert!(result[1].force_start);
        assert!(result[1].f_l_piece_prio);
        assert!(result[1].seq_dl);
        assert!(result[1].super_seeding);
    }

    #[test]
    fn parse_torrent_list_empty() {
        let json = serde_json::json!([]);
        let result = parse_torrent_list(&json).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_torrent_list_not_an_array() {
        let json = serde_json::json!({"hash": "abc"});
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("array"));
    }

    #[test]
    fn parse_torrent_list_null_input() {
        let json = serde_json::json!(null);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_string_input() {
        let json = serde_json::json!("not an array");
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_object_input() {
        let json = serde_json::json!({"torrents": []});
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_number_input() {
        let json = serde_json::json!(42);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_invalid_row_entry() {
        // A non-object entry (a number) must be rejected and the parser must
        // point at the offending index.
        let json = serde_json::json!([valid_torrent_entry(), 12345]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("[1]"));
    }

    #[test]
    fn parse_torrent_list_null_entry() {
        let json = serde_json::json!([valid_torrent_entry(), null]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("[1]"));
    }

    #[test]
    fn parse_torrent_list_string_entry() {
        let json = serde_json::json!(["not a torrent object"]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_missing_hash() {
        let mut entry = valid_torrent_entry();
        entry.as_object_mut().unwrap().remove("hash");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("hash") || err.message().contains("missing"));
    }

    #[test]
    fn parse_torrent_list_missing_name() {
        let mut entry = valid_torrent_entry();
        entry.as_object_mut().unwrap().remove("name");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_missing_state() {
        let mut entry = valid_torrent_entry();
        entry.as_object_mut().unwrap().remove("state");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_missing_tags() {
        let mut entry = valid_torrent_entry();
        entry.as_object_mut().unwrap().remove("tags");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_missing_time_active() {
        let mut entry = valid_torrent_entry();
        entry.as_object_mut().unwrap().remove("time_active");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_missing_progress() {
        let mut entry = valid_torrent_entry();
        entry.as_object_mut().unwrap().remove("progress");
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_wrong_hash_type() {
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("hash".to_string(), serde_json::json!(12345));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_wrong_name_type() {
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("name".to_string(), serde_json::json!(42));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_wrong_state_type() {
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("state".to_string(), serde_json::json!(0));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_wrong_auto_tmm_type() {
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("auto_tmm".to_string(), serde_json::json!("true"));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_wrong_tags_type() {
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("tags".to_string(), serde_json::json!(["a", "b"]));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_wrong_progress_type() {
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("progress".to_string(), serde_json::json!("0.5"));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_wrong_priority_type() {
        // priority must be a number; passing a string is rejected.
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("priority".to_string(), serde_json::json!("0"));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_optional_drift_fields_omitted() {
        // download_path, infohash_v1, infohash_v2, trackers_count, reannounce,
        // and popularity are all optional; omitting all of them must still
        // parse successfully.
        let mut entry = valid_torrent_entry();
        let obj = entry.as_object_mut().unwrap();
        obj.remove("download_path");
        obj.remove("infohash_v1");
        obj.remove("infohash_v2");
        obj.remove("trackers_count");
        obj.remove("reannounce");
        obj.remove("popularity");
        let json = serde_json::json!([entry]);
        let result = parse_torrent_list(&json).unwrap();
        assert_eq!(result.len(), 1);
        let t = &result[0];
        assert!(t.download_path.is_none());
        assert!(t.infohash_v1.is_none());
        assert!(t.infohash_v2.is_none());
        assert!(t.trackers_count.is_none());
        assert!(t.reannounce.is_none());
        assert!(t.popularity.is_none());
    }

    #[test]
    fn parse_torrent_list_optional_drift_fields_populated() {
        // When present, optional drift fields are parsed with the expected
        // types.
        let mut entry = valid_torrent_entry();
        let obj = entry.as_object_mut().unwrap();
        obj.insert("download_path".to_string(), serde_json::json!("/alt/path"));
        obj.insert("infohash_v1".to_string(), serde_json::json!("v1hash"));
        obj.insert("infohash_v2".to_string(), serde_json::json!("v2hash"));
        obj.insert("trackers_count".to_string(), serde_json::json!(3_i64));
        obj.insert("reannounce".to_string(), serde_json::json!(0_i64));
        obj.insert("popularity".to_string(), serde_json::json!(1234.5_f64));
        let json = serde_json::json!([entry]);
        let result = parse_torrent_list(&json).unwrap();
        let t = &result[0];
        assert_eq!(t.download_path.as_deref(), Some("/alt/path"));
        assert_eq!(t.infohash_v1.as_deref(), Some("v1hash"));
        assert_eq!(t.infohash_v2.as_deref(), Some("v2hash"));
        assert_eq!(t.trackers_count, Some(3));
        assert_eq!(t.reannounce, Some(0));
        assert_eq!(t.popularity, Some(1234.5));
    }

    #[test]
    fn parse_torrent_list_optional_drift_field_wrong_type() {
        // Optional fields with the wrong type still cause the row to be
        // rejected — strict typing at the Rust boundary.
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("download_path".to_string(), serde_json::json!(123));
        let json = serde_json::json!([entry]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_tags_string_preserved() {
        // tags is a comma-separated string in qBittorrent's wire format; the
        // parser must preserve it verbatim (no array splitting).
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("tags".to_string(), serde_json::json!("action,hd,4k, hdr"));
        let json = serde_json::json!([entry]);
        let result = parse_torrent_list(&json).unwrap();
        assert_eq!(result[0].tags, "action,hd,4k, hdr");
    }

    #[test]
    fn parse_torrent_list_tags_empty_string_preserved() {
        // An empty tag string is valid (torrent has no tags); it must NOT be
        // coerced to a missing field.
        let mut entry = valid_torrent_entry();
        entry
            .as_object_mut()
            .unwrap()
            .insert("tags".to_string(), serde_json::json!(""));
        let json = serde_json::json!([entry]);
        let result = parse_torrent_list(&json).unwrap();
        assert_eq!(result[0].tags, "");
    }

    #[test]
    fn parse_torrent_list_state_string_passthrough() {
        // state is a free-form string; exotic or future state names must
        // pass through unchanged rather than being rejected.
        for state in &[
            "downloading",
            "uploading",
            "stalledDL",
            "stalledUP",
            "pausedDL",
            "pausedUP",
            "error",
            "missingFiles",
            "unknown",
            "futureStateName",
            "CheckingUP",
            "ForcedDL",
        ] {
            let mut entry = valid_torrent_entry();
            entry
                .as_object_mut()
                .unwrap()
                .insert("state".to_string(), serde_json::json!(state));
            let json = serde_json::json!([entry]);
            let result = parse_torrent_list(&json).unwrap();
            assert_eq!(&result[0].state, state);
        }
    }

    #[test]
    fn parse_torrent_list_unknown_fields_ignored() {
        // Unknown upstream fields must be silently ignored.
        let mut entry = valid_torrent_entry();
        let obj = entry.as_object_mut().unwrap();
        obj.insert(
            "future_qbittorrent_field".to_string(),
            serde_json::json!(42),
        );
        obj.insert("isPrivate".to_string(), serde_json::json!(true));
        obj.insert("some_other_thing".to_string(), serde_json::json!("ignored"));
        let json = serde_json::json!([entry]);
        let result = parse_torrent_list(&json).unwrap();
        assert_eq!(result.len(), 1);
        // The known fields still parse correctly.
        assert_eq!(result[0].name, "movie.mkv");
        assert_eq!(
            result[0].hash,
            "8c7a1e3f5b9d2a6e4c8b1f3a5d7e9c2b4a6e8d0f3b5c7d9e1a3b5c7d9e1f3a5b"
        );
    }

    #[test]
    fn parse_torrent_list_array_with_one_bad_item_rejects_whole_list() {
        // Strict validation: a single bad row rejects the whole list (matches
        // the existing peer/trackers/file parser behavior).
        let mut bad = valid_torrent_entry();
        bad.as_object_mut().unwrap().remove("hash");
        let json = serde_json::json!([valid_torrent_entry(), bad]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
        assert!(err.message().contains("[1]"));
    }

    #[test]
    fn parse_torrent_list_empty_object_rejected() {
        // An empty object is not a valid torrent row.
        let json = serde_json::json!([{}]);
        let err = parse_torrent_list(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_torrent_list_serializes_with_snake_case_wire_format() {
        // After parsing, the DTO must serialize back to the snake_case wire
        // keys the TypeScript `Torrent` interface expects. The Optional drift
        // fields must be omitted when None.
        let mut entry = valid_torrent_entry();
        let obj = entry.as_object_mut().unwrap();
        obj.remove("download_path");
        obj.remove("infohash_v1");
        obj.remove("infohash_v2");
        obj.remove("trackers_count");
        obj.remove("reannounce");
        obj.remove("popularity");
        let json = serde_json::json!([entry]);
        let result = parse_torrent_list(&json).unwrap();
        let serialized = serde_json::to_value(&result[0]).unwrap();
        let obj = serialized.as_object().unwrap();
        // Required snake_case keys must be present.
        assert!(obj.contains_key("added_on"));
        assert!(obj.contains_key("amount_left"));
        assert!(obj.contains_key("auto_tmm"));
        assert!(obj.contains_key("f_l_piece_prio"));
        assert!(obj.contains_key("force_start"));
        assert!(obj.contains_key("dlspeed"));
        assert!(obj.contains_key("upspeed"));
        assert!(obj.contains_key("dl_limit"));
        assert!(obj.contains_key("up_limit"));
        assert!(obj.contains_key("max_ratio"));
        assert!(obj.contains_key("max_seeding_time"));
        assert!(obj.contains_key("num_complete"));
        assert!(obj.contains_key("num_incomplete"));
        assert!(obj.contains_key("num_leechs"));
        assert!(obj.contains_key("num_seeds"));
        assert!(obj.contains_key("ratio_limit"));
        assert!(obj.contains_key("save_path"));
        assert!(obj.contains_key("seeding_time"));
        assert!(obj.contains_key("seeding_time_limit"));
        assert!(obj.contains_key("seen_complete"));
        assert!(obj.contains_key("seq_dl"));
        assert!(obj.contains_key("super_seeding"));
        assert!(obj.contains_key("time_active"));
        assert!(obj.contains_key("total_size"));
        assert!(obj.contains_key("uploaded_session"));
        assert!(obj.contains_key("downloaded_session"));
        assert!(obj.contains_key("completion_on"));
        assert!(obj.contains_key("last_activity"));
        assert!(obj.contains_key("content_path"));
        // Optional drift fields must be omitted when None.
        assert!(!obj.contains_key("download_path"));
        assert!(!obj.contains_key("infohash_v1"));
        assert!(!obj.contains_key("infohash_v2"));
        assert!(!obj.contains_key("trackers_count"));
        assert!(!obj.contains_key("reannounce"));
        assert!(!obj.contains_key("popularity"));
    }

    #[test]
    fn parse_torrent_list_serializes_optional_drift_fields_when_set() {
        // When the optional drift fields are populated, they should appear
        // in the serialized output.
        let mut entry = valid_torrent_entry();
        let obj = entry.as_object_mut().unwrap();
        obj.insert("download_path".to_string(), serde_json::json!("/alt"));
        obj.insert("infohash_v1".to_string(), serde_json::json!("v1"));
        obj.insert("infohash_v2".to_string(), serde_json::json!("v2"));
        obj.insert("trackers_count".to_string(), serde_json::json!(2_i64));
        obj.insert("reannounce".to_string(), serde_json::json!(1_i64));
        obj.insert("popularity".to_string(), serde_json::json!(10.5_f64));
        let json = serde_json::json!([entry]);
        let result = parse_torrent_list(&json).unwrap();
        let serialized = serde_json::to_value(&result[0]).unwrap();
        let obj = serialized.as_object().unwrap();
        assert_eq!(serialized["download_path"], "/alt");
        assert_eq!(serialized["infohash_v1"], "v1");
        assert_eq!(serialized["infohash_v2"], "v2");
        assert_eq!(serialized["trackers_count"], 2_i64);
        assert_eq!(serialized["reannounce"], 1_i64);
        assert_eq!(serialized["popularity"], 10.5_f64);
        // Confirm the set keys are actually present (not just matching).
        assert!(obj.contains_key("download_path"));
        assert!(obj.contains_key("infohash_v1"));
        assert!(obj.contains_key("infohash_v2"));
        assert!(obj.contains_key("trackers_count"));
        assert!(obj.contains_key("reannounce"));
        assert!(obj.contains_key("popularity"));
    }

    #[test]
    fn parse_torrent_list_round_trip_preserves_values() {
        // parse → serialize → reparse must produce the same logical content.
        let json = serde_json::json!([valid_torrent_entry()]);
        let parsed = parse_torrent_list(&json).unwrap();
        let serialized = serde_json::to_value(&parsed[0]).unwrap();
        let reparsed = parse_torrent_list(&serde_json::json!([serialized])).unwrap();
        assert_eq!(reparsed.len(), 1);
        let a = &parsed[0];
        let b = &reparsed[0];
        assert_eq!(a.hash, b.hash);
        assert_eq!(a.name, b.name);
        assert_eq!(a.state, b.state);
        assert_eq!(a.tags, b.tags);
        assert_eq!(a.category, b.category);
        assert_eq!(a.total_size, b.total_size);
        assert_eq!(a.progress, b.progress);
        assert_eq!(a.ratio, b.ratio);
        assert_eq!(a.added_on, b.added_on);
        assert_eq!(a.amount_left, b.amount_left);
        assert_eq!(a.auto_tmm, b.auto_tmm);
        assert_eq!(a.availability, b.availability);
        assert_eq!(a.completed, b.completed);
        assert_eq!(a.completion_on, b.completion_on);
        assert_eq!(a.content_path, b.content_path);
        assert_eq!(a.dl_limit, b.dl_limit);
        assert_eq!(a.dlspeed, b.dlspeed);
        assert_eq!(a.downloaded, b.downloaded);
        assert_eq!(a.downloaded_session, b.downloaded_session);
        assert_eq!(a.eta, b.eta);
        assert_eq!(a.f_l_piece_prio, b.f_l_piece_prio);
        assert_eq!(a.force_start, b.force_start);
        assert_eq!(a.last_activity, b.last_activity);
        assert_eq!(a.magnet_uri, b.magnet_uri);
        assert_eq!(a.max_ratio, b.max_ratio);
        assert_eq!(a.max_seeding_time, b.max_seeding_time);
        assert_eq!(a.num_complete, b.num_complete);
        assert_eq!(a.num_incomplete, b.num_incomplete);
        assert_eq!(a.num_leechs, b.num_leechs);
        assert_eq!(a.num_seeds, b.num_seeds);
        assert_eq!(a.priority, b.priority);
        assert_eq!(a.ratio_limit, b.ratio_limit);
        assert_eq!(a.save_path, b.save_path);
        assert_eq!(a.seeding_time, b.seeding_time);
        assert_eq!(a.seeding_time_limit, b.seeding_time_limit);
        assert_eq!(a.seen_complete, b.seen_complete);
        assert_eq!(a.seq_dl, b.seq_dl);
        assert_eq!(a.size, b.size);
        assert_eq!(a.super_seeding, b.super_seeding);
        assert_eq!(a.time_active, b.time_active);
        assert_eq!(a.tracker, b.tracker);
        assert_eq!(a.up_limit, b.up_limit);
        assert_eq!(a.uploaded, b.uploaded);
        assert_eq!(a.uploaded_session, b.uploaded_session);
        assert_eq!(a.upspeed, b.upspeed);
    }

    // -------------------------------------------------------------------------
    // WebSeeds
    // -------------------------------------------------------------------------

    #[test]
    fn parse_webseeds_valid() {
        let json = serde_json::json!([
            { "url": "http://seed1.example.com/file.torrent" },
            { "url": "http://seed2.example.com/file.torrent" },
        ]);
        let seeds = parse_webseeds(&json).unwrap();
        assert_eq!(seeds.len(), 2);
        assert_eq!(seeds[0].url, "http://seed1.example.com/file.torrent");
        assert_eq!(seeds[1].url, "http://seed2.example.com/file.torrent");
    }

    #[test]
    fn parse_webseeds_empty() {
        let json = serde_json::json!([]);
        let seeds = parse_webseeds(&json).unwrap();
        assert!(seeds.is_empty());
    }

    #[test]
    fn parse_webseeds_not_an_array() {
        let json = serde_json::json!({ "url": "http://example.com/file" });
        let err = parse_webseeds(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_webseeds_missing_url() {
        let json = serde_json::json!([{ "url": "http://ok.com/file" }, {}]);
        let err = parse_webseeds(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_webseeds_wrong_url_type() {
        let json = serde_json::json!([{ "url": 123 }]);
        let err = parse_webseeds(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    // -------------------------------------------------------------------------
    // TransferInfo
    // -------------------------------------------------------------------------

    #[test]
    fn parse_transfer_info_valid() {
        let json = serde_json::json!({
            "dl_info_speed": 1024,
            "dl_info_data": 2048,
            "up_info_speed": 512,
            "up_info_data": 1024,
            "dl_rate_limit": 0,
            "up_rate_limit": 0,
            "dht_nodes": 42,
            "connection_status": "connected",
            "queueing": true,
            "use_alt_speed_limits": false,
            "refresh_interval": 1500,
        });
        let info = parse_transfer_info(&json).unwrap();
        assert_eq!(info.dl_info_speed, 1024);
        assert_eq!(info.dl_info_data, 2048);
        assert_eq!(info.up_info_speed, 512);
        assert_eq!(info.connection_status, "connected");
        assert!(info.queueing);
        assert!(!info.use_alt_speed_limits);
        assert_eq!(info.refresh_interval, 1500);
        assert!(info.free_space_on_disk.is_none());
    }

    #[test]
    fn parse_transfer_info_with_free_space() {
        let json = serde_json::json!({
            "dl_info_speed": 1024,
            "dl_info_data": 2048,
            "up_info_speed": 512,
            "up_info_data": 1024,
            "dl_rate_limit": 0,
            "up_rate_limit": 0,
            "dht_nodes": 42,
            "connection_status": "connected",
            "queueing": true,
            "use_alt_speed_limits": false,
            "refresh_interval": 1500,
            "free_space_on_disk": 999999999,
        });
        let info = parse_transfer_info(&json).unwrap();
        assert_eq!(info.free_space_on_disk, Some(999999999));
    }

    #[test]
    fn parse_transfer_info_not_an_object() {
        let json = serde_json::json!([1, 2, 3]);
        let err = parse_transfer_info(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_transfer_info_missing_required_field() {
        let json = serde_json::json!({
            "dl_info_speed": 1024,
            "dl_info_data": 2048,
        });
        let err = parse_transfer_info(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_transfer_info_wrong_field_type() {
        let json = serde_json::json!({
            "dl_info_speed": "not_a_number",
            "dl_info_data": 2048,
            "up_info_speed": 512,
            "up_info_data": 1024,
            "dl_rate_limit": 0,
            "up_rate_limit": 0,
            "dht_nodes": 42,
            "connection_status": "connected",
            "queueing": true,
            "use_alt_speed_limits": false,
            "refresh_interval": 1500,
        });
        let err = parse_transfer_info(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_transfer_info_ignores_unknown_fields() {
        let json = serde_json::json!({
            "dl_info_speed": 1024,
            "dl_info_data": 2048,
            "up_info_speed": 512,
            "up_info_data": 1024,
            "dl_rate_limit": 0,
            "up_rate_limit": 0,
            "dht_nodes": 42,
            "connection_status": "connected",
            "queueing": true,
            "use_alt_speed_limits": false,
            "refresh_interval": 1500,
            "some_unknown_field": "value",
        });
        let info = parse_transfer_info(&json).unwrap();
        assert_eq!(info.dl_info_speed, 1024);
    }

    // -------------------------------------------------------------------------
    // BuildInfo
    // -------------------------------------------------------------------------

    #[test]
    fn parse_build_info_valid() {
        let json = serde_json::json!({
            "qt": "6.5.0",
            "libtorrent": "2.0.9.0",
            "boost": "1.85.0",
            "openssl": "3.2.0",
            "bitness": 64,
        });
        let info = parse_build_info(&json).unwrap();
        assert_eq!(info.qt, "6.5.0");
        assert_eq!(info.libtorrent, "2.0.9.0");
        assert_eq!(info.boost, "1.85.0");
        assert_eq!(info.openssl, "3.2.0");
        assert_eq!(info.bitness, 64);
        assert!(info.zlib.is_none());
        assert!(info.platform.is_none());
    }

    #[test]
    fn parse_build_info_with_optional_fields() {
        let json = serde_json::json!({
            "qt": "6.5.0",
            "libtorrent": "2.0.9.0",
            "boost": "1.85.0",
            "openssl": "3.2.0",
            "bitness": 64,
            "zlib": "1.2.13",
            "platform": "linux",
        });
        let info = parse_build_info(&json).unwrap();
        assert_eq!(info.zlib, Some("1.2.13".to_string()));
        assert_eq!(info.platform, Some("linux".to_string()));
    }

    #[test]
    fn parse_build_info_not_an_object() {
        let json = serde_json::json!("not_an_object");
        let err = parse_build_info(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_build_info_missing_required_field() {
        let json = serde_json::json!({
            "qt": "6.5.0",
            "libtorrent": "2.0.9.0",
        });
        let err = parse_build_info(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_build_info_wrong_field_type() {
        let json = serde_json::json!({
            "qt": "6.5.0",
            "libtorrent": "2.0.9.0",
            "boost": "1.85.0",
            "openssl": "3.2.0",
            "bitness": "not_a_number",
        });
        let err = parse_build_info(&json).unwrap_err();
        assert!(err.is_invalid_response());
    }

    #[test]
    fn parse_build_info_ignores_unknown_fields() {
        let json = serde_json::json!({
            "qt": "6.5.0",
            "libtorrent": "2.0.9.0",
            "boost": "1.85.0",
            "openssl": "3.2.0",
            "bitness": 64,
            "extra_field": "ignored",
        });
        let info = parse_build_info(&json).unwrap();
        assert_eq!(info.qt, "6.5.0");
    }

    // -------------------------------------------------------------------------
    // Preferences — parse_preferences and deserialize_loose_number
    // -------------------------------------------------------------------------

    fn complete_preferences_json() -> serde_json::Value {
        // Built via from_str to avoid json! macro recursion limit on the
        // large number of fields.
        serde_json::from_str(
            r#"{
                "locale": "en_US",
                "create_subfolder_enabled": true,
                "start_paused_enabled": false,
                "auto_delete_mode": 0,
                "preallocate_all": false,
                "incomplete_files_ext": true,
                "auto_tmm_enabled": 1,
                "torrent_changed_tmm_enabled": 0,
                "save_path_changed_tmm_enabled": 1,
                "category_changed_tmm_enabled": 0,
                "save_path": "/downloads",
                "temp_path_enabled": true,
                "temp_path": "/downloads/temp",
                "scan_dirs": { "/watch": 0 },
                "export_dir": "/exports",
                "export_dir_fin": "/exports/finished",
                "mail_notification_enabled": false,
                "mail_notification_sender": "",
                "mail_notification_email": "",
                "mail_notification_smtp": "",
                "mail_notification_ssl_enabled": false,
                "mail_notification_auth_enabled": false,
                "mail_notification_username": "",
                "mail_notification_password": "",
                "autorun_enabled": false,
                "autorun_program": "",
                "queueing_enabled": true,
                "max_active_downloads": 5,
                "max_active_torrents": 20,
                "max_active_uploads": 5,
                "dont_count_slow_torrents": false,
                "slow_torrent_dl_rate_threshold": 10,
                "slow_torrent_ul_rate_threshold": 10,
                "slow_torrent_inactive_timer": 300,
                "max_ratio_enabled": true,
                "max_ratio": 2.0,
                "max_ratio_act": 1,
                "listen_port": 6881,
                "upnp": true,
                "random_port": false,
                "dl_limit": -1,
                "up_limit": -1,
                "alt_dl_limit": 102400,
                "alt_up_limit": 51200,
                "max_connec": 500,
                "max_connec_per_torrent": 100,
                "max_uploads": -1,
                "max_uploads_per_torrent": -1,
                "enable_piece_extent_affinity": false,
                "bittorrent_protocol": 0,
                "limit_utp_rate": true,
                "limit_tcp_overhead": true,
                "limit_lan_peers": true,
                "scheduler_enabled": false,
                "use_alt_speed_limits": false,
                "schedule_from_hour": 8,
                "schedule_from_min": 0,
                "schedule_to_hour": 20,
                "schedule_to_min": 0,
                "scheduler_days": 0,
                "dht": true,
                "pex": true,
                "lsd": true,
                "encryption": 0,
                "anonymous_mode": false,
                "proxy_type": -1,
                "proxy_ip": "",
                "proxy_port": 8080,
                "proxy_peer_connections": false,
                "proxy_auth_enabled": false,
                "proxy_username": "",
                "proxy_password": "",
                "proxy_torrents_only": false,
                "ip_filter_enabled": false,
                "ip_filter_path": "",
                "ip_filter_trackers": false,
                "web_ui_domain_list": "*",
                "web_ui_address": "0.0.0.0",
                "web_ui_port": 8080,
                "web_ui_upnp": false,
                "web_ui_username": "admin",
                "web_ui_password": "adminadmin",
                "web_ui_csrf_protection_enabled": true,
                "web_ui_clickjacking_protection_enabled": true,
                "web_ui_secure_cookie_enabled": true,
                "web_ui_max_auth_fail_count": 5,
                "web_ui_ban_duration": 3600,
                "web_ui_session_timeout": 3600,
                "web_ui_host_header_validation_enabled": true,
                "bypass_local_auth": false,
                "bypass_auth_subnet_whitelist_enabled": false,
                "bypass_auth_subnet_whitelist": "",
                "alternative_webui_enabled": false,
                "alternative_webui_path": "",
                "use_https": false,
                "ssl_key": "",
                "ssl_cert": "",
                "web_ui_https_key": "",
                "web_ui_https_cert": "",
                "dyndns_enabled": false,
                "dyndns_service": 0,
                "dyndns_username": "",
                "dyndns_password": "",
                "dyndns_domain": "",
                "rss_refresh_interval": 30,
                "rss_max_articles_per_feed": 50,
                "rss_processing_enabled": true,
                "rss_auto_downloading_enabled": true,
                "rss_download_repack_proper_episodes": false,
                "rss_smart_episode_filters": "",
                "add_trackers_enabled": false,
                "add_trackers": "",
                "web_ui_use_custom_http_headers_enabled": false,
                "web_ui_custom_http_headers": "",
                "max_seeding_time_enabled": false,
                "max_seeding_time": -1,
                "announce_to_all_tiers": true,
                "announce_to_all_trackers": true,
                "async_io_threads": 4,
                "hashing_threads": 2,
                "file_pool_size": 40,
                "checking_memory_use": 256,
                "disk_cache": 16384,
                "disk_cache_ttl": 60,
                "enable_upload_suggestions": false,
                "upload_suggestions_interval": 500,
                "send_buffer_watermark": 51200,
                "send_buffer_low_watermark": 10240,
                "send_buffer_watermark_factor": 50,
                "connection_speed": 20,
                "socket_backlog_size": 30,
                "outgoing_ports_min": 0,
                "outgoing_ports_max": 0,
                "upnp_lease_duration": 0,
                "peer_tos": 0,
                "utp_tcp_mixed_mode": 0,
                "idn_support_enabled": true,
                "enable_multi_connections_from_same_ip": true,
                "validate_https_tracker_certificate": true,
                "ssrf_mitigation": true,
                "block_peers_on_privileged_ports": false,
                "enable_embedded_tracker": false,
                "embedded_tracker_port": 9001,
                "mark_of_the_web": false,
                "upload_slots_behavior": 0,
                "upload_choking_algorithm": 0,
                "announce_ip": "",
                "max_concurrent_http_announces": 50,
                "stop_tracker_timeout": 5,
                "peer_turnover": 0.5,
                "peer_turnover_cutoff": 1.0,
                "peer_turnover_interval": 5,
                "request_queue_size": 500,
                "dht_bootstrap_nodes": "",
                "i2p_enabled": false,
                "i2p_address": "",
                "i2p_port": 0,
                "i2p_mixed_mode": false,
                "i2p_inbound_quantity": 4,
                "i2p_outbound_quantity": 4,
                "i2p_inbound_length": 3,
                "i2p_outbound_length": 3,
                "torrent_content_layout": "Original",
                "add_to_top_of_queue": false,
                "torrent_stop_condition": "",
                "merge_trackers": false,
                "excluded_file_names_enabled": false,
                "excluded_file_names": "",
                "autorun_on_torrent_added_enabled": false,
                "autorun_on_torrent_added_program": "",
                "recheck_completed_torrents": true,
                "resolve_peer_countries": true,
                "reannounce_when_address_changed": true,
                "max_active_checking_torrents": 5,
                "max_inactive_seeding_time_enabled": false,
                "max_inactive_seeding_time": 1800,
                "resume_data_storage_type": "Legacy",
                "torrent_file_size_limit": 4096,
                "save_resume_data_interval": 10,
                "save_statistics_interval": 600,
                "confirm_torrent_recheck": false,
                "refresh_interval": 1500,
                "customize_application_instance_name": "",
                "python_executable_path": "",
                "torrent_content_removing_mode": "MoveToTrash",
                "memory_working_set_limit": 0,
                "current_network_interface": "",
                "current_ip_address": "",
                "disk_queue_size": 64,
                "disk_io_type": 0,
                "disk_io_read_mode": 0,
                "disk_io_write_mode": 0,
                "bdecode_depth_limit": 100,
                "bdecode_token_limit": 2000000,
                "socket_send_buffer_size": 0,
                "socket_receive_buffer_size": 0,
                "announce_to_all_trackers_in_tier": true,
                "announce_port": 0,
                "add_trackers_url": "",
                "web_ui_reverse_proxy_enabled": false,
                "web_ui_reverse_proxies_list": "",
                "ignore_ssl_errors": false,
                "enable_port_forwarding_for_embedded_tracker": false,
                "use_subcategories": false,
                "use_category_paths_in_manual_mode": false,
                "delete_torrent_files_afterwards": false
            }"#,
        )
        .unwrap()
    }

    #[test]
    fn parse_preferences_complete() {
        let json = complete_preferences_json();
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.locale, "en_US");
        assert!(prefs.create_subfolder_enabled);
        assert!(!prefs.start_paused_enabled);
        assert_eq!(prefs.auto_delete_mode, 0);
        assert!(!prefs.preallocate_all);
        assert!(prefs.incomplete_files_ext);
        assert_eq!(prefs.auto_tmm_enabled, 1);
        assert_eq!(prefs.torrent_changed_tmm_enabled, 0);
        assert_eq!(prefs.save_path, "/downloads");
        assert!(prefs.temp_path_enabled);
        assert_eq!(prefs.temp_path, "/downloads/temp");
        assert_eq!(prefs.save_path_changed_tmm_enabled, 1);
        assert_eq!(prefs.category_changed_tmm_enabled, 0);
        assert_eq!(prefs.listen_port, 6881);
        assert!(prefs.upnp);
        assert!(!prefs.random_port);
        assert_eq!(prefs.dl_limit, -1);
        assert_eq!(prefs.up_limit, -1);
        assert_eq!(prefs.alt_dl_limit, 102400);
        assert_eq!(prefs.alt_up_limit, 51200);
        assert_eq!(prefs.max_connec, 500);
        assert!(prefs.queueing_enabled);
        assert_eq!(prefs.max_active_downloads, 5);
        assert!(prefs.max_ratio_enabled);
        assert!((prefs.max_ratio - 2.0).abs() < f64::EPSILON);
        assert_eq!(prefs.max_ratio_act, 1);
        assert!(prefs.dht);
        assert!(prefs.pex);
        assert!(prefs.lsd);
        assert_eq!(prefs.encryption, 0);
        assert_eq!(prefs.proxy_type, -1);
        assert_eq!(prefs.proxy_port, 8080);
        assert_eq!(prefs.bittorrent_protocol, 0);
        assert_eq!(prefs.scheduler_days, 0);
        assert_eq!(prefs.web_ui_port, 8080);
        assert_eq!(prefs.web_ui_username, "admin");
        assert!(prefs.web_ui_csrf_protection_enabled);
        assert!(prefs.recheck_completed_torrents);
        assert!(prefs.resolve_peer_countries);
        assert_eq!(prefs.save_resume_data_interval, 10);
        assert_eq!(prefs.refresh_interval, 1500);
        assert_eq!(prefs.utp_tcp_mixed_mode, 0);
    }

    #[test]
    fn parse_preferences_minimal() {
        // Only a few fields present; all others should fall back to defaults.
        let json = serde_json::json!({
            "locale": "de_DE",
            "save_path": "/custom/path",
            "listen_port": 12345,
            "upnp": false
        });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.locale, "de_DE");
        assert_eq!(prefs.save_path, "/custom/path");
        assert_eq!(prefs.listen_port, 12345);
        assert!(!prefs.upnp);
        // Defaults
        assert_eq!(prefs.auto_delete_mode, 0);
        assert!(!prefs.create_subfolder_enabled);
        assert!(!prefs.queueing_enabled);
        assert_eq!(prefs.max_active_downloads, 0);
        assert_eq!(prefs.proxy_type, 0);
        assert_eq!(prefs.proxy_ip, "");
        assert_eq!(prefs.proxy_port, 0);
        assert!(!prefs.dht);
        assert_eq!(prefs.encryption, 0);
        assert_eq!(prefs.web_ui_username, "");
        assert_eq!(prefs.web_ui_password, "");
        assert_eq!(prefs.scan_dirs.len(), 0);
    }

    #[test]
    fn parse_preferences_empty_object() {
        let json = serde_json::json!({});
        let prefs = parse_preferences(&json).unwrap();
        // All fields should be at their defaults.
        assert_eq!(prefs.locale, "");
        assert!(!prefs.create_subfolder_enabled);
        assert_eq!(prefs.auto_delete_mode, 0);
        assert_eq!(prefs.auto_tmm_enabled, 0);
        assert_eq!(prefs.torrent_changed_tmm_enabled, 0);
        assert_eq!(prefs.save_path, "");
        assert!(!prefs.temp_path_enabled);
        assert_eq!(prefs.scan_dirs.len(), 0);
        assert_eq!(prefs.listen_port, 0);
        assert!(!prefs.upnp);
        assert_eq!(prefs.proxy_type, 0);
        assert_eq!(prefs.proxy_ip, "");
        assert_eq!(prefs.proxy_port, 0);
        assert_eq!(prefs.encryption, 0);
        assert_eq!(prefs.bittorrent_protocol, 0);
        assert_eq!(prefs.scheduler_days, 0);
        assert!(!prefs.dht);
        assert!(!prefs.queueing_enabled);
        assert!(!prefs.max_ratio_enabled);
        assert_eq!(prefs.max_ratio_act, 0);
        assert_eq!(prefs.utp_tcp_mixed_mode, 0);
        assert_eq!(prefs.upload_slots_behavior, 0);
        assert_eq!(prefs.upload_choking_algorithm, 0);
        assert_eq!(prefs.disk_io_type, 0);
        assert_eq!(prefs.disk_io_read_mode, 0);
        assert_eq!(prefs.disk_io_write_mode, 0);
        assert_eq!(prefs.dyndns_service, 0);
    }

    #[test]
    fn parse_preferences_not_an_object() {
        let cases = vec![
            serde_json::json!("not an object"),
            serde_json::json!(42),
            serde_json::json!(true),
            serde_json::json!(null),
            serde_json::json!([1, 2, 3]),
        ];
        for input in cases {
            let err = parse_preferences(&input).unwrap_err();
            assert!(err.is_invalid_response(), "expected error for {:?}", input);
            assert!(
                err.message().contains("object"),
                "error message must mention object, got: {}",
                err.message()
            );
        }
    }

    #[test]
    fn parse_preferences_unknown_fields_ignored() {
        let json = serde_json::json!({
            "locale": "en_US",
            "some_future_setting": "future_value",
            "another_unknown": 42,
            "save_path": "/downloads"
        });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.locale, "en_US");
        assert_eq!(prefs.save_path, "/downloads");
        // Unknown fields must not cause an error; defaults should still apply
        assert_eq!(prefs.listen_port, 0);
        assert_eq!(prefs.proxy_type, 0);
    }

    // -------------------------------------------------------------------------
    // deserialize_loose_number — tested through PreferencesDto fields that use it
    //
    // The following fields all use deserialize_loose_number: auto_delete_mode,
    // auto_tmm_enabled, torrent_changed_tmm_enabled, save_path_changed_tmm_enabled,
    // category_changed_tmm_enabled, max_ratio_act, bittorrent_protocol,
    // scheduler_days, encryption, proxy_type, dyndns_service, utp_tcp_mixed_mode,
    // upload_slots_behavior, upload_choking_algorithm, disk_io_type,
    // disk_io_read_mode, disk_io_write_mode.
    //
    // We use proxy_type as the representative field for the edge-case tests.
    // -------------------------------------------------------------------------

    #[test]
    fn deserialize_loose_number_accepts_number() {
        // Normal numeric input (the common case)
        let json = serde_json::json!({ "proxy_type": 2 });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 2);
    }

    #[test]
    fn deserialize_loose_number_accepts_negative() {
        let json = serde_json::json!({ "proxy_type": -1 });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, -1);
    }

    #[test]
    fn deserialize_loose_number_accepts_zero() {
        let json = serde_json::json!({ "proxy_type": 0 });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 0);
    }

    #[test]
    fn deserialize_loose_number_accepts_bool_true() {
        // qB v5 may send booleans for enum-like fields
        let json = serde_json::json!({ "proxy_type": true });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 1);
    }

    #[test]
    fn deserialize_loose_number_accepts_bool_false() {
        let json = serde_json::json!({ "proxy_type": false });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 0);
    }

    #[test]
    fn deserialize_loose_number_accepts_parseable_string() {
        let json = serde_json::json!({ "proxy_type": "1" });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 1);
    }

    #[test]
    fn deserialize_loose_number_accepts_string_zero() {
        let json = serde_json::json!({ "proxy_type": "0" });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 0);
    }

    #[test]
    fn deserialize_loose_number_accepts_negative_string() {
        let json = serde_json::json!({ "proxy_type": "-1" });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, -1);
    }

    #[test]
    fn deserialize_loose_number_unparseable_string_defaults_zero() {
        let json = serde_json::json!({ "proxy_type": "not_a_number" });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 0);
    }

    #[test]
    fn deserialize_loose_number_accepts_null() {
        let json = serde_json::json!({ "proxy_type": null });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 0);
    }

    #[test]
    fn deserialize_loose_number_absent_defaults_zero() {
        // When the field is absent entirely, #[serde(default)] kicks in.
        let json = serde_json::json!({ "locale": "en_US" });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.proxy_type, 0);
    }

    #[test]
    fn deserialize_loose_number_all_loose_fields_work_together() {
        // Exercise all fields that use deserialize_loose_number with a mix of inputs.
        let json = serde_json::json!({
            "auto_delete_mode": true,
            "auto_tmm_enabled": false,
            "torrent_changed_tmm_enabled": 0,
            "save_path_changed_tmm_enabled": "1",
            "category_changed_tmm_enabled": null,
            "max_ratio_act": "not_a_number",
            "bittorrent_protocol": 0,
            "scheduler_days": 7,
            "encryption": true,
            "proxy_type": -1,
            "dyndns_service": "2",
            "utp_tcp_mixed_mode": false,
            "upload_slots_behavior": 0,
            "upload_choking_algorithm": 1,
            "disk_io_type": null,
            "disk_io_read_mode": "3",
            "disk_io_write_mode": true
        });
        let prefs = parse_preferences(&json).unwrap();
        assert_eq!(prefs.auto_delete_mode, 1, "true → 1");
        assert_eq!(prefs.auto_tmm_enabled, 0, "false → 0");
        assert_eq!(prefs.torrent_changed_tmm_enabled, 0, "0 → 0");
        assert_eq!(prefs.save_path_changed_tmm_enabled, 1, "\"1\" → 1");
        assert_eq!(prefs.category_changed_tmm_enabled, 0, "null → 0");
        assert_eq!(prefs.max_ratio_act, 0, "unparseable string → 0");
        assert_eq!(prefs.bittorrent_protocol, 0);
        assert_eq!(prefs.scheduler_days, 7);
        assert_eq!(prefs.encryption, 1, "true → 1");
        assert_eq!(prefs.proxy_type, -1);
        assert_eq!(prefs.dyndns_service, 2, "\"2\" → 2");
        assert_eq!(prefs.utp_tcp_mixed_mode, 0, "false → 0");
        assert_eq!(prefs.upload_slots_behavior, 0);
        assert_eq!(prefs.upload_choking_algorithm, 1);
        assert_eq!(prefs.disk_io_type, 0, "null → 0");
        assert_eq!(prefs.disk_io_read_mode, 3, "\"3\" → 3");
        assert_eq!(prefs.disk_io_write_mode, 1, "true → 1");
    }

    #[test]
    fn parse_preferences_serializes_back_to_snake_case() {
        let json = complete_preferences_json();
        let prefs = parse_preferences(&json).unwrap();
        let serialized = serde_json::to_value(&prefs).unwrap();
        let obj = serialized.as_object().unwrap();
        // Verify snake_case keys are present
        assert!(obj.contains_key("locale"));
        assert!(obj.contains_key("save_path"));
        assert!(obj.contains_key("listen_port"));
        assert!(obj.contains_key("proxy_type"));
        assert!(obj.contains_key("auto_tmm_enabled"));
        assert!(obj.contains_key("max_ratio_act"));
        assert!(obj.contains_key("bittorrent_protocol"));
        assert!(obj.contains_key("scheduler_days"));
        assert!(obj.contains_key("encryption"));
        // Verify serialized defaults for Bool → number fields are numbers
        assert!(serialized["proxy_type"].is_number());
        assert!(serialized["encryption"].is_number());
        assert!(serialized["auto_tmm_enabled"].is_number());
    }

    #[test]
    fn parse_preferences_round_trip_preserves_values() {
        let json = complete_preferences_json();
        let parsed = parse_preferences(&json).unwrap();
        let serialized = serde_json::to_value(&parsed).unwrap();
        let reparsed = parse_preferences(&serialized).unwrap();
        assert_eq!(reparsed.locale, parsed.locale);
        assert_eq!(reparsed.save_path, parsed.save_path);
        assert_eq!(reparsed.listen_port, parsed.listen_port);
        assert_eq!(reparsed.proxy_type, parsed.proxy_type);
        assert_eq!(reparsed.encryption, parsed.encryption);
        assert_eq!(reparsed.auto_tmm_enabled, parsed.auto_tmm_enabled);
        assert_eq!(reparsed.max_ratio_act, parsed.max_ratio_act);
        assert_eq!(reparsed.bittorrent_protocol, parsed.bittorrent_protocol);
        assert_eq!(reparsed.scheduler_days, parsed.scheduler_days);
        assert_eq!(reparsed.dyndns_service, parsed.dyndns_service);
        assert_eq!(reparsed.utp_tcp_mixed_mode, parsed.utp_tcp_mixed_mode);
        assert_eq!(reparsed.upload_slots_behavior, parsed.upload_slots_behavior);
        assert_eq!(
            reparsed.upload_choking_algorithm,
            parsed.upload_choking_algorithm
        );
        assert_eq!(reparsed.disk_io_type, parsed.disk_io_type);
        assert_eq!(reparsed.disk_io_read_mode, parsed.disk_io_read_mode);
        assert_eq!(reparsed.disk_io_write_mode, parsed.disk_io_write_mode);
        assert_eq!(reparsed.web_ui_username, parsed.web_ui_username);
        assert_eq!(reparsed.queueing_enabled, parsed.queueing_enabled);
        assert_eq!(reparsed.scan_dirs.len(), parsed.scan_dirs.len());
    }

    // -------------------------------------------------------------------------
    // PreferencesUpdateDto — SET validation
    // -------------------------------------------------------------------------

    #[test]
    fn preferences_update_dto_accepts_partial_payload() {
        // Only one field present → validates and omits others
        let json = serde_json::json!({ "locale": "fr_FR" });
        let dto: PreferencesUpdateDto = serde_json::value::from_value(json).unwrap();
        assert_eq!(dto.locale.as_deref(), Some("fr_FR"));
        // Spot-check a few other fields are None
        assert!(dto.create_subfolder_enabled.is_none());
        assert!(dto.save_path.is_none());
        assert!(dto.listen_port.is_none());
    }

    #[test]
    fn preferences_update_dto_accepts_empty_payload() {
        let json = serde_json::json!({});
        let dto: PreferencesUpdateDto = serde_json::value::from_value(json).unwrap();
        // All fields are None — validates that Option<T> handles empty objects
        assert!(dto.locale.is_none());
        assert!(dto.create_subfolder_enabled.is_none());
        assert!(dto.listen_port.is_none());
    }

    #[test]
    fn preferences_update_dto_rejects_wrong_type() {
        let json = serde_json::json!({ "locale": 42 });
        let err = serde_json::value::from_value::<PreferencesUpdateDto>(json).unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("locale") || msg.contains("invalid type"),
            "expected error mentioning 'locale' or 'invalid type', got: {}",
            msg
        );
    }

    #[test]
    fn preferences_update_dto_accepts_loose_number() {
        // auto_delete_mode uses deserialize_loose_number_option — accepts true/false
        let json = serde_json::json!({ "auto_delete_mode": true });
        let dto: PreferencesUpdateDto = serde_json::value::from_value(json).unwrap();
        assert_eq!(dto.auto_delete_mode, Some(1));

        let json = serde_json::json!({ "auto_delete_mode": false });
        let dto: PreferencesUpdateDto = serde_json::value::from_value(json).unwrap();
        assert_eq!(dto.auto_delete_mode, Some(0));
    }

    #[test]
    fn preferences_update_dto_null_loose_number_is_none() {
        // null for a loose-number field should deserialize to None, not Some(0)
        let json = serde_json::json!({ "auto_delete_mode": null });
        let dto: PreferencesUpdateDto = serde_json::value::from_value(json).unwrap();
        assert_eq!(
            dto.auto_delete_mode, None,
            "null should deserialize to None, not Some(0)"
        );
    }

    #[test]
    fn preferences_update_dto_serializes_omitting_none_fields() {
        let dto = PreferencesUpdateDto {
            locale: Some("en_US".into()),
            ..Default::default()
        };
        let serialized = serde_json::to_value(&dto).unwrap();
        let obj = serialized.as_object().unwrap();
        assert_eq!(obj.get("locale").and_then(|v| v.as_str()), Some("en_US"));
        // None fields must be omitted entirely, not present as null
        assert!(
            !obj.contains_key("create_subfolder_enabled"),
            "None bool field should be omitted"
        );
        assert!(
            !obj.contains_key("save_path"),
            "None string field should be omitted"
        );
        assert!(
            !obj.contains_key("listen_port"),
            "None i64 field should be omitted"
        );
        // Verify total key count: only the one set field
        assert_eq!(obj.len(), 1, "only locale should be present");
    }

    #[test]
    fn preferences_update_dto_ignores_unknown_fields() {
        let json = serde_json::json!({
            "locale": "de_DE",
            "unknown_future_field": "should be ignored"
        });
        let dto: PreferencesUpdateDto = serde_json::value::from_value(json).unwrap();
        assert_eq!(dto.locale.as_deref(), Some("de_DE"));
    }

    #[test]
    fn preferences_update_dto_scan_dirs_accepts_valid_map() {
        let json = serde_json::json!({ "scan_dirs": { "/watch": 0, "/tv": 1 } });
        let dto: PreferencesUpdateDto = serde_json::value::from_value(json).unwrap();
        let scan_dirs = dto.scan_dirs.unwrap();
        assert_eq!(scan_dirs.get("/watch").unwrap().0, 0);
        assert_eq!(scan_dirs.get("/tv").unwrap().0, 1);
        assert_eq!(scan_dirs.len(), 2);
    }

    #[test]
    fn preferences_update_dto_scan_dirs_accepts_boolean_map_values() {
        let json =
            serde_json::json!({ "scan_dirs": { "/watch": true, "/tv": false, "/movies": 2 } });
        let dto: PreferencesUpdateDto = serde_json::value::from_value(json).unwrap();
        let scan_dirs = dto.scan_dirs.unwrap();
        // true → 1, false → 0, 2 → 2
        assert_eq!(scan_dirs.get("/watch").unwrap().0, 1);
        assert_eq!(scan_dirs.get("/tv").unwrap().0, 0);
        assert_eq!(scan_dirs.get("/movies").unwrap().0, 2);
        assert_eq!(scan_dirs.len(), 3);
    }

    #[test]
    fn preferences_dto_and_update_dto_have_same_field_count() {
        use super::preferences_field_counts::{
            PREFERENCES_DTO_FIELD_COUNT, PREFERENCES_UPDATE_DTO_FIELD_COUNT,
        };
        assert_eq!(
            PREFERENCES_DTO_FIELD_COUNT, PREFERENCES_UPDATE_DTO_FIELD_COUNT,
            "PreferencesDto and PreferencesUpdateDto field counts diverged — \
             every GET field must have a corresponding Option<T> SET field"
        );
    }
}
