//! `WorkspaceView` — output projection for the torrent workspace view.
//!
//! The view is intentionally hash-only on the torrent list side; the renderer
//! keeps `maindataState.torrents` as the object store and maps hashes back
//! to typed `Torrent` objects. This keeps the IPC payload tiny and avoids
//! re-serializing every torrent on every tick.

use std::collections::HashMap;

use serde::Serialize;

/// One sidebar category row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SidebarCategoryItem {
    /// Category name. Empty string represents the uncategorized bucket.
    pub name: String,
    /// qBittorrent-declared save path (empty for the uncategorized bucket).
    pub save_path: String,
    /// Cross-filtered count (honors status/tag/tracker/search; ignores
    /// the category filter itself).
    pub count: u64,
}

/// One sidebar tag row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SidebarTagItem {
    pub tag: String,
    /// Cross-filtered count (honors status/category/tracker/search; ignores
    /// the tag filter itself).
    pub count: u64,
}

/// One sidebar tracker row. Fields mirror the JS `SidebarTrackerEntry`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SidebarTrackerItem {
    pub tracker_url: String,
    pub hostname: String,
    /// Cross-filtered count (honors status/category/tag/search; ignores the
    /// tracker filter itself).
    pub count: u64,
}

/// The full workspace view, returned by `WorkspaceViewEngine::compute_and_diff`.
#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceView {
    /// Echoes the request ID from `WorkspaceViewRequest`. Used by the
    /// renderer to correlate async responses.
    pub request_id: String,
    /// Snapshot revision (RID) the view was computed from.
    pub revision: u64,
    /// Hashes in sorted/filtered order. The renderer maps each hash back to
    /// its `Torrent` row via the upstream state store.
    pub sorted_hashes: Vec<String>,
    /// Number of torrents passing all active filters.
    pub filtered_count: usize,
    /// Total torrents in the snapshot.
    pub total_count: usize,
    /// Sum of `dlspeed` over every torrent (unfiltered).
    pub total_dl_speed: i64,
    /// Sum of `upspeed` over every torrent (unfiltered).
    pub total_ul_speed: i64,
    /// Status bucket counts over all torrents (unfiltered).
    /// Keys are `TorrentFilterType` strings (12 + `"all"`).
    pub status_counts: HashMap<String, u64>,
    /// Category counts; honors status/tag/tracker/search, ignores category.
    pub category_counts: HashMap<String, u64>,
    /// Tag counts; honors status/category/tracker/search, ignores tag.
    pub tag_counts: HashMap<String, u64>,
    /// Tracker counts; honors status/category/tag/search, ignores tracker.
    /// Keyed by tracker URL (matches `SidebarTrackerItem::tracker_url`).
    pub tracker_counts: HashMap<String, u64>,
    pub sidebar_categories: Vec<SidebarCategoryItem>,
    pub sidebar_tags: Vec<SidebarTagItem>,
    pub sidebar_trackers: Vec<SidebarTrackerItem>,
    /// True when any filter dimension is non-default.
    pub is_filtered: bool,
}

impl PartialEq for WorkspaceView {
    /// Short-circuit equality that compares the cheap fields first and only
    /// inspects `sorted_hashes` when everything else matches. This is the
    /// hot path that decides whether the engine emits a new event.
    fn eq(&self, other: &Self) -> bool {
        if self.request_id != other.request_id
            || self.revision != other.revision
            || self.filtered_count != other.filtered_count
            || self.total_count != other.total_count
            || self.total_dl_speed != other.total_dl_speed
            || self.total_ul_speed != other.total_ul_speed
            || self.is_filtered != other.is_filtered
        {
            return false;
        }

        if self.status_counts != other.status_counts {
            return false;
        }
        if self.category_counts != other.category_counts {
            return false;
        }
        if self.tag_counts != other.tag_counts {
            return false;
        }
        if self.tracker_counts != other.tracker_counts {
            return false;
        }

        if self.sidebar_categories != other.sidebar_categories {
            return false;
        }
        if self.sidebar_tags != other.sidebar_tags {
            return false;
        }
        if self.sidebar_trackers != other.sidebar_trackers {
            return false;
        }

        // `sorted_hashes` last because it is the most expensive comparison.
        self.sorted_hashes == other.sorted_hashes
    }
}

impl Eq for WorkspaceView {}
