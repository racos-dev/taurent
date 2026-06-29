//! Rust-side `WorkspaceViewEngine` for the torrent workspace screen.
//!
//! This module mirrors the JS derivation pipeline that previously lived in
//! `packages/shared/src/utils/{torrentFilter,sortTorrents,deriveTorrentList}.ts`
//! and shifts it into Rust so the per-tick derivation can be amortized over a
//! Tauri command/event boundary. The engine is **pure**: it holds no Tauri
//! state, no I/O, and no locks. The owning layer (`qb-tauri`) wraps the
//! engine in `Arc<StdMutex<...>>` and drives it from the sync manager.
//!
//! Architecture (matches the Phase 3 plan):
//!
//! - `WorkspaceViewRequest` is the command input.
//! - `WorkspaceView` is the output projection (hashes + counts + facets).
//! - `WorkspaceViewEngine::compute_and_diff` recomputes the view from a
//!   `MaindataSnapshot` and returns `Some(view)` only when the new view
//!   differs from the cached one (cheap `PartialEq` short-circuit).
//!
//! Layering rules:
//!
//! - No Tauri, no `tokio`, no `reqwest`.
//! - All torrent row borrows come from the snapshot map — never clone full
//!   `MaindataTorrentRow` objects during computation.

mod facets;
mod filter;
mod fixture;
mod sort;
mod view;

#[cfg(test)]
mod tests;

pub use facets::{
    derive_category_counts, derive_status_counts, derive_tag_counts, derive_tracker_counts,
    extract_hostname, sidebar_categories_from_counts, sidebar_tags_from_counts,
    sidebar_trackers_from_map, SidebarTrackerEntry,
};
pub use filter::{
    is_filtered_request, passes_all_filters, passes_all_filters_except, FilterDimension,
};
pub use sort::{compare_hashes, CollatorCache, SortDirection};
pub use view::{SidebarCategoryItem, SidebarTagItem, SidebarTrackerItem, WorkspaceView};

use std::collections::HashMap;

use crate::dto::{MaindataCategoryRow, MaindataTorrentRow};
use crate::sync::MaindataSnapshot;
use crate::workspace::filter::TORRENT_STATES_FOR_FILTER;

/// Filter values for the workspace view request.
///
/// Mirrors the JS `TorrentFilterType` plus the four optional dimensions
/// (`category`, `tag`, `tracker`) and the free-text search.
#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct Filters {
    /// qBittorrent filter status (`"all"`, `"downloading"`, …). Free-form string
    /// to match the bridge contract — the engine normalizes to the canonical
    /// `TORRENT_STATES_FOR_FILTER` table.
    pub status: String,
    /// `None` = no filter, `Some("")` = uncategorized only, `Some(name)` = exact.
    pub category: Option<String>,
    /// Exact tag match against the comma-separated `tags` string.
    pub tag: Option<String>,
    /// Case-insensitive exact match on `tracker`.
    pub tracker: Option<String>,
    /// Case-insensitive substring match on `name` (normalized `[._-]` → space).
    pub search: String,
}

impl Default for Filters {
    fn default() -> Self {
        Self {
            status: "all".to_string(),
            category: None,
            tag: None,
            tracker: None,
            search: String::new(),
        }
    }
}

/// Sort specification for the workspace view.
#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct Sort {
    /// Sort field name (35 supported values — see `sort::compare_hashes`).
    pub field: String,
    pub direction: SortDirection,
}

impl Default for Sort {
    fn default() -> Self {
        Self {
            field: "added_on".to_string(),
            direction: SortDirection::Desc,
        }
    }
}

/// Input request for the workspace view engine.
///
/// `request_id` is echoed back on the output `WorkspaceView` so the
/// renderer can match async responses to its in-flight request.
#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct WorkspaceViewRequest {
    pub request_id: String,
    pub filters: Filters,
    pub sort: Sort,
    /// Whether the output needs `sorted_hashes`.
    ///
    /// Sidebar/status-only consumers can set this to `false` to skip the
    /// filtered-hash collection and sort pass while still receiving counts,
    /// totals, and sidebar facets.
    #[serde(default = "default_include_sorted_hashes")]
    pub include_sorted_hashes: bool,
    /// Renderer locale (e.g. `"en-US"`, `"zh-CN"`). Used for the string-sort
    /// collator; parsed on demand with a root-collation fallback on failure.
    pub locale: String,
}

fn default_include_sorted_hashes() -> bool {
    true
}

impl WorkspaceViewRequest {
    /// Construct a default request with the given `request_id`.
    pub fn default_for(request_id: impl Into<String>) -> Self {
        Self {
            request_id: request_id.into(),
            filters: Filters::default(),
            sort: Sort::default(),
            include_sorted_hashes: true,
            locale: "en-US".to_string(),
        }
    }
}

/// Pure Rust derivation engine for the torrent workspace view.
///
/// Owns the current request, the cached last output, and a per-locale
/// collator cache. Call `compute_and_diff` whenever the underlying
/// `MaindataSnapshot` changes; the engine returns `Some(view)` only when the
/// computed view differs from the cached one.
pub struct WorkspaceViewEngine {
    request: WorkspaceViewRequest,
    last: Option<WorkspaceView>,
    collators: CollatorCache,
}

impl WorkspaceViewEngine {
    /// Create a new engine bound to the given request.
    pub fn new(request: WorkspaceViewRequest) -> Self {
        Self {
            request,
            last: None,
            collators: CollatorCache::new(),
        }
    }

    /// Replace the active request. Does **not** clear the cached last view;
    /// the next `compute_and_diff` will diff against it.
    pub fn set_request(&mut self, request: WorkspaceViewRequest) {
        self.request = request;
    }

    /// Active request reference.
    pub fn request(&self) -> &WorkspaceViewRequest {
        &self.request
    }

    /// Last computed view (if any).
    pub fn last_view(&self) -> Option<&WorkspaceView> {
        self.last.as_ref()
    }

    /// Recompute the workspace view from the given snapshot.
    ///
    /// Returns `Some(view)` when the new view differs from the cached one
    /// (short-circuiting on `request_id`, `revision`, counts, totals, and
    /// sidebar items before comparing `sorted_hashes`). Returns `None` when
    /// the view is unchanged.
    pub fn compute_and_diff(&mut self, snapshot: &MaindataSnapshot) -> Option<WorkspaceView> {
        let view = self.compute(snapshot);
        if Some(&view) == self.last.as_ref() {
            return None;
        }
        self.last = Some(view.clone());
        Some(view)
    }

    /// Internal: run all 5 passes against `snapshot` and assemble the view.
    fn compute(&mut self, snapshot: &MaindataSnapshot) -> WorkspaceView {
        let request_id = self.request.request_id.clone();
        let revision = snapshot.rid;
        let filters = &self.request.filters;
        let sort = &self.request.sort;
        let is_filtered = is_filtered_request(filters);

        // Pre-acquire collator for string fields. Used by both the sort
        // and the tracker-hostname sort.
        let collator = self.collators.get_or_insert(&self.request.locale);

        // Pass 1: main filtered+sorted list, totals, unfiltered status counts.
        // `status_counts` is intentionally UNFILTERED (matches the
        // `WorkspaceView::status_counts` contract and `deriveTorrentWorkspace`'s
        // JS reference). The cross-filtered status pass is handled
        // separately for any consumer that needs it.
        let mut total_dl_speed: i64 = 0;
        let mut total_ul_speed: i64 = 0;
        let mut status_counts_unfiltered: HashMap<String, u64> = HashMap::new();
        for (key, _) in TORRENT_STATES_FOR_FILTER.iter() {
            status_counts_unfiltered.insert((*key).to_string(), 0);
        }
        let include_sorted_hashes = self.request.include_sorted_hashes;
        // Pre-size hint: at most every torrent passes the filter. Sidebar or
        // summary consumers can opt out to avoid collecting and sorting hashes.
        let mut filtered_hashes: Vec<String> = if include_sorted_hashes {
            Vec::with_capacity(snapshot.torrents.len())
        } else {
            Vec::new()
        };
        let mut filtered_count: usize = 0;

        for (hash, row) in snapshot.torrents.iter() {
            total_dl_speed += row.dlspeed.unwrap_or(0);
            total_ul_speed += row.upspeed.unwrap_or(0);

            // Unfiltered status bucketing: every torrent increments `all`,
            // and increments each bucket whose state set contains the row's
            // state. No filter is applied here.
            status_counts_unfiltered
                .entry("all".to_string())
                .and_modify(|v| *v += 1);
            if let Some(state) = row.state.as_deref() {
                for (key, states) in TORRENT_STATES_FOR_FILTER.iter() {
                    if *key == "all" || states.is_empty() {
                        continue;
                    }
                    if states.contains(&state) {
                        status_counts_unfiltered
                            .entry((*key).to_string())
                            .and_modify(|v| *v += 1);
                    }
                }
            }

            if passes_all_filters(row, filters) {
                filtered_count += 1;
                if include_sorted_hashes {
                    filtered_hashes.push(hash.clone());
                }
            }
        }

        // Sort by the requested field. Stable sort preserves insertion order
        // for equal keys — matches the JS `[...arr].sort()` semantics.
        if include_sorted_hashes {
            filtered_hashes.sort_by(|a, b| {
                sort::compare_hashes(
                    a,
                    b,
                    snapshot,
                    &sort.field,
                    sort.direction,
                    collator.as_deref(),
                )
            });
        }

        let total_count = snapshot.torrents.len();

        // Pass 2-5: facet counts. Each facet ignores its own dimension.
        // Note: `status_counts` for the view itself is unfiltered and was
        // accumulated in pass 1 above; we don't call the cross-filtered
        // `derive_status_counts` here.
        let (category_counts_map, total_filtered_for_categories) =
            facets::derive_category_counts(snapshot.torrents.values(), filters);
        let (tag_counts_map, total_filtered_for_tags) =
            facets::derive_tag_counts(snapshot.torrents.values(), &snapshot.tags, filters);
        let (tracker_map, total_filtered_for_trackers) =
            facets::derive_tracker_counts(snapshot.torrents.values(), filters);

        // Sidebar projections.
        let has_uncategorized = category_counts_map.contains_key("");
        let sidebar_categories = sidebar_categories_from_counts(
            &snapshot.categories,
            &category_counts_map,
            has_uncategorized,
        );
        let sidebar_tags = sidebar_tags_from_counts(&snapshot.tags, &tag_counts_map);
        let sidebar_trackers = sidebar_trackers_from_map(&tracker_map, collator.as_deref());

        // Convert owned maps to the typed output shape. The maps are
        // computed above so we can keep this engine borrowing from
        // `snapshot` only at construction time. The derived maps are
        // already `HashMap<String, u64>` so no remapping is needed.
        let status_counts_out = status_counts_unfiltered;
        let category_counts_out = category_counts_map;
        let tag_counts_out = tag_counts_map;
        let tracker_counts_out: std::collections::HashMap<String, u64> = tracker_map
            .iter()
            .map(|(k, v)| (k.clone(), v.count))
            .collect();

        // Debug-level assertion that the facet totals are consistent with
        // the per-dimension totals — but only when no filter on the
        // respective facet dimension is active. When a category filter is
        // active, the category-facet pass ignores it, so its total will
        // exceed the main filtered count; same for tag/tracker. Asserting
        // unconditionally fired under any active per-dimension filter.
        // This catches drift early in debug builds without paying a
        // runtime cost in release builds.
        if filters.category.is_none() {
            debug_assert_eq!(
                total_filtered_for_categories, filtered_count as u64,
                "category-facet total must equal main filtered count when no category filter is active"
            );
        }
        if filters.tag.is_none() {
            debug_assert_eq!(
                total_filtered_for_tags, filtered_count as u64,
                "tag-facet total must equal main filtered count when no tag filter is active"
            );
        }
        if filters.tracker.is_none() {
            debug_assert_eq!(
                total_filtered_for_trackers, filtered_count as u64,
                "tracker-facet total must equal main filtered count when no tracker filter is active"
            );
        }
        let _ = total_filtered_for_categories;
        let _ = total_filtered_for_tags;
        let _ = total_filtered_for_trackers;

        WorkspaceView {
            request_id,
            revision,
            sorted_hashes: filtered_hashes,
            filtered_count,
            total_count,
            total_dl_speed,
            total_ul_speed,
            status_counts: status_counts_out,
            category_counts: category_counts_out,
            tag_counts: tag_counts_out,
            tracker_counts: tracker_counts_out,
            sidebar_categories,
            sidebar_tags,
            sidebar_trackers,
            is_filtered,
        }
    }
}

/// Helper: resolve a torrent row by hash, returning `None` if missing.
///
/// Engine code must never assume the requested hash exists in the snapshot
/// — it can be evicted between request and compute.
#[inline]
pub fn lookup_row<'a>(
    snapshot: &'a MaindataSnapshot,
    hash: &str,
) -> Option<&'a MaindataTorrentRow> {
    snapshot.torrents.get(hash)
}

/// Helper: walk all categories in server-declared order (BTreeMap iteration).
pub fn category_rows(
    snapshot: &MaindataSnapshot,
) -> impl Iterator<Item = (&str, &MaindataCategoryRow)> {
    snapshot
        .categories
        .iter()
        .map(|(name, row)| (name.as_str(), row))
}

/// Hand-written fixture for unit tests. Re-exported from the test module.
#[doc(hidden)]
pub mod test_fixture {
    pub use super::fixture::{build_hand_fixture, FixtureRow, HAND_FIXTURE_ROWS};
}
