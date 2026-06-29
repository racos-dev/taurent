//! Filter predicates for the workspace view.
//!
//! Mirrors the JS implementations in `packages/shared/src/utils/torrentFilter.ts`:
//! - `matchesTorrentFilter` (12 status buckets via `TORRENT_STATES_FOR_FILTER`)
//! - `matchesTorrentSearch` (case-insensitive, `[._-]` normalized to space)
//! - `torrentHasTag` (comma-split, trimmed, exact match)
//! - `matchesTorrentTracker` (case-insensitive exact match)
//!
//! The five filter dimensions are passed in as a `Filters` struct; the
//! engine computes `passes_all_filters` once per torrent per pass.

use crate::dto::MaindataTorrentRow;
use crate::workspace::Filters;

/// Which filter dimension a facet pass should ignore.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterDimension {
    Status,
    Category,
    Tag,
    Tracker,
}

/// Canonical mapping from app-level `TorrentFilterType` to qBittorrent state
/// strings. Mirrors `TORRENT_STATES_FOR_FILTER` in `torrentFilter.ts`.
///
/// The `"all"` bucket always matches (empty list of states is a sentinel).
pub(super) const TORRENT_STATES_FOR_FILTER: &[(&str, &[&str])] = &[
    ("all", &[]),
    ("downloading", &["downloading", "stalledDL", "metaDL"]),
    ("seeding", &["uploading", "stalledUP"]),
    (
        "completed",
        &["uploading", "stalledUP", "queuedUP", "stoppedUP"],
    ),
    ("stopped", &["stoppedDL", "stoppedUP"]),
    (
        "running",
        &["downloading", "uploading", "forcedDL", "forcedUP"],
    ),
    ("stalled", &["stalledDL", "stalledUP"]),
    ("stalled_uploading", &["stalledUP"]),
    ("stalled_downloading", &["stalledDL"]),
    (
        "active",
        &["downloading", "stalledDL", "uploading", "stalledUP"],
    ),
    (
        "inactive",
        &["queuedDL", "queuedUP", "stoppedDL", "stoppedUP"],
    ),
    ("errored", &["error", "missingFiles"]),
];

/// Returns true when the given torrent state matches the requested filter.
///
/// `filter == "all"` always returns true. Unknown filter values return false.
pub fn matches_torrent_filter(filter: &str, state: Option<&str>) -> bool {
    if filter == "all" {
        return true;
    }
    for (key, states) in TORRENT_STATES_FOR_FILTER {
        if *key == filter {
            if states.is_empty() {
                return false;
            }
            return match state {
                Some(s) => states.contains(&s),
                None => false,
            };
        }
    }
    false
}

/// Case-insensitive substring match on the torrent name with `[._-]` → space
/// normalization. Mirrors `matchesTorrentSearch` exactly:
///
/// ```text
/// normalized_search = query.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim()
/// normalized_name   = name.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ')
/// normalized_name.includes(normalized_search)
/// ```
pub fn matches_torrent_search(name: Option<&str>, query: &str) -> bool {
    if query.trim().is_empty() {
        return true;
    }
    let normalized_search = normalize_search(query);
    if normalized_search.is_empty() {
        return true;
    }
    let Some(name) = name else {
        return false;
    };
    let normalized_name = normalize_name(name);
    normalized_name.contains(&normalized_search)
}

#[inline]
fn normalize_search(query: &str) -> String {
    let mut out = String::with_capacity(query.len());
    let mut prev_space = false;
    for ch in query.chars() {
        if is_search_separator(ch) || ch.is_whitespace() {
            if !prev_space {
                out.push(' ');
                prev_space = true;
            }
        } else {
            for lc in ch.to_lowercase() {
                out.push(lc);
            }
            prev_space = false;
        }
    }
    out.trim().to_string()
}

#[inline]
fn normalize_name(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut prev_space = false;
    for ch in name.chars() {
        if is_search_separator(ch) || ch.is_whitespace() {
            if !prev_space {
                out.push(' ');
                prev_space = true;
            }
        } else {
            for lc in ch.to_lowercase() {
                out.push(lc);
            }
            prev_space = false;
        }
    }
    out
}

#[inline]
fn is_search_separator(ch: char) -> bool {
    ch == '.' || ch == '_' || ch == '-'
}

/// Parse a torrent's comma-separated tags string into a trimmed, non-empty list.
pub fn parse_torrent_tags(tags: Option<&str>) -> impl Iterator<Item = &str> {
    tags.unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// True when the torrent has the given tag (exact match, trimmed).
pub fn torrent_has_tag(tags: Option<&str>, tag: &str) -> bool {
    parse_torrent_tags(tags).any(|t| t == tag)
}

/// Case-insensitive exact match on the torrent tracker URL.
/// Empty filter passes through.
pub fn matches_torrent_tracker(tracker: Option<&str>, filter: &str) -> bool {
    if filter.is_empty() {
        return true;
    }
    let t = tracker.unwrap_or("").trim();
    if t.is_empty() {
        return false;
    }
    eq_ignore_case(t, filter.trim())
}

#[inline]
fn eq_ignore_case(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .all(|(x, y)| x.eq_ignore_ascii_case(&y))
}

/// True if the row passes every active filter dimension.
pub fn passes_all_filters(row: &MaindataTorrentRow, filters: &Filters) -> bool {
    // Status filter
    if filters.status != "all" && !matches_torrent_filter(&filters.status, row.state.as_deref()) {
        return false;
    }

    // Category filter: None = no filter, Some("") = uncategorized only,
    // Some(name) = exact match.
    if let Some(ref want_category) = filters.category {
        let actual = row.category.as_deref().unwrap_or("");
        if actual != want_category {
            return false;
        }
    }

    // Tag filter
    if let Some(ref tag) = filters.tag {
        if !torrent_has_tag(row.tags.as_deref(), tag) {
            return false;
        }
    }

    // Tracker filter
    if let Some(ref tracker) = filters.tracker {
        if !matches_torrent_tracker(row.tracker.as_deref(), tracker) {
            return false;
        }
    }

    // Search filter
    if !matches_torrent_search(row.name.as_deref(), &filters.search) {
        return false;
    }

    true
}

/// Same as `passes_all_filters` but skips the filter dimension matching
/// `except` so facet counts can include torrents excluded by their own
/// dimension (e.g. category counts must include torrents in *every*
/// category even when a category filter is active).
pub fn passes_all_filters_except(
    row: &MaindataTorrentRow,
    filters: &Filters,
    except: FilterDimension,
) -> bool {
    // Status
    if except != FilterDimension::Status
        && filters.status != "all"
        && !matches_torrent_filter(&filters.status, row.state.as_deref())
    {
        return false;
    }

    // Category
    if except != FilterDimension::Category {
        if let Some(ref want_category) = filters.category {
            let actual = row.category.as_deref().unwrap_or("");
            if actual != want_category {
                return false;
            }
        }
    }

    // Tag
    if except != FilterDimension::Tag {
        if let Some(ref tag) = filters.tag {
            if !torrent_has_tag(row.tags.as_deref(), tag) {
                return false;
            }
        }
    }

    // Tracker
    if except != FilterDimension::Tracker {
        if let Some(ref tracker) = filters.tracker {
            if !matches_torrent_tracker(row.tracker.as_deref(), tracker) {
                return false;
            }
        }
    }

    // Search
    if !matches_torrent_search(row.name.as_deref(), &filters.search) {
        return false;
    }

    true
}

/// Canonical "is filtered" check used by every derivation path. True when
/// any filter dimension is non-default.
pub fn is_filtered_request(filters: &Filters) -> bool {
    filters.status != "all"
        || filters.category.is_some()
        || filters.tag.is_some()
        || filters.tracker.is_some()
        || !filters.search.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row_with_state(state: &str) -> MaindataTorrentRow {
        MaindataTorrentRow {
            state: Some(state.to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn status_mapping_matches_js_table() {
        // Downloading bucket: downloading, stalledDL, metaDL.
        assert!(matches_torrent_filter(
            "downloading",
            row_with_state("downloading").state.as_deref()
        ));
        assert!(matches_torrent_filter(
            "downloading",
            row_with_state("stalledDL").state.as_deref()
        ));
        assert!(matches_torrent_filter(
            "downloading",
            row_with_state("metaDL").state.as_deref()
        ));
        assert!(!matches_torrent_filter(
            "downloading",
            row_with_state("uploading").state.as_deref()
        ));

        // Seeding: uploading, stalledUP.
        assert!(matches_torrent_filter(
            "seeding",
            row_with_state("uploading").state.as_deref()
        ));
        assert!(!matches_torrent_filter(
            "seeding",
            row_with_state("stoppedUP").state.as_deref()
        ));

        // Completed: uploading, stalledUP, queuedUP, stoppedUP.
        for state in ["uploading", "stalledUP", "queuedUP", "stoppedUP"] {
            assert!(
                matches_torrent_filter("completed", Some(state)),
                "completed must include {state}"
            );
        }
        assert!(!matches_torrent_filter("completed", Some("downloading")));

        // Stopped: stoppedDL, stoppedUP.
        assert!(matches_torrent_filter("stopped", Some("stoppedDL")));
        assert!(matches_torrent_filter("stopped", Some("stoppedUP")));

        // Running: downloading, uploading, forcedDL, forcedUP.
        for state in ["downloading", "uploading", "forcedDL", "forcedUP"] {
            assert!(
                matches_torrent_filter("running", Some(state)),
                "running must include {state}"
            );
        }

        // Stalled: stalledDL, stalledUP.
        assert!(matches_torrent_filter("stalled", Some("stalledDL")));
        assert!(matches_torrent_filter("stalled", Some("stalledUP")));

        // Stalled sub-buckets.
        assert!(matches_torrent_filter(
            "stalled_uploading",
            Some("stalledUP")
        ));
        assert!(!matches_torrent_filter(
            "stalled_uploading",
            Some("stalledDL")
        ));
        assert!(matches_torrent_filter(
            "stalled_downloading",
            Some("stalledDL")
        ));
        assert!(!matches_torrent_filter(
            "stalled_downloading",
            Some("stalledUP")
        ));

        // Active: downloading, stalledDL, uploading, stalledUP.
        for state in ["downloading", "stalledDL", "uploading", "stalledUP"] {
            assert!(
                matches_torrent_filter("active", Some(state)),
                "active must include {state}"
            );
        }
        assert!(!matches_torrent_filter("active", Some("stoppedDL")));

        // Inactive: queuedDL, queuedUP, stoppedDL, stoppedUP.
        for state in ["queuedDL", "queuedUP", "stoppedDL", "stoppedUP"] {
            assert!(
                matches_torrent_filter("inactive", Some(state)),
                "inactive must include {state}"
            );
        }
        assert!(!matches_torrent_filter("inactive", Some("downloading")));

        // Errored: error, missingFiles.
        assert!(matches_torrent_filter("errored", Some("error")));
        assert!(matches_torrent_filter("errored", Some("missingFiles")));
        assert!(!matches_torrent_filter("errored", Some("downloading")));

        // All: always true.
        assert!(matches_torrent_filter("all", Some("downloading")));
        assert!(matches_torrent_filter("all", None));

        // Unknown filter: false.
        assert!(!matches_torrent_filter("not-a-filter", Some("downloading")));
    }

    #[test]
    fn search_normalizes_separators_and_case() {
        let row = MaindataTorrentRow {
            name: Some("My.Torrent_Name-1".to_string()),
            ..Default::default()
        };
        // Dots/underscores/dashes become spaces, lower-cased.
        assert!(matches_torrent_search(row.name.as_deref(), "my.torrent"));
        assert!(matches_torrent_search(row.name.as_deref(), "My_Torrent"));
        assert!(matches_torrent_search(row.name.as_deref(), "name 1"));
        assert!(!matches_torrent_search(row.name.as_deref(), "missing"));

        // Empty / whitespace queries pass.
        assert!(matches_torrent_search(row.name.as_deref(), ""));
        assert!(matches_torrent_search(row.name.as_deref(), "   "));
        // Query made of only separators normalizes to empty → pass.
        assert!(matches_torrent_search(row.name.as_deref(), "._-_."));

        // Missing name + non-empty query → fail.
        let no_name = MaindataTorrentRow::default();
        assert!(!matches_torrent_search(no_name.name.as_deref(), "abc"));
    }

    #[test]
    fn tag_filter_splits_trims_exact_matches() {
        let r = MaindataTorrentRow {
            tags: Some("a, b ,c".to_string()),
            ..Default::default()
        };
        assert!(torrent_has_tag(r.tags.as_deref(), "a"));
        assert!(torrent_has_tag(r.tags.as_deref(), "b"));
        assert!(torrent_has_tag(r.tags.as_deref(), "c"));
        assert!(!torrent_has_tag(r.tags.as_deref(), "d"));
        // Empty tag inputs are filtered out, so "" never matches.
        assert!(!torrent_has_tag(r.tags.as_deref(), ""));
        // No tags at all.
        let empty = MaindataTorrentRow::default();
        assert!(!torrent_has_tag(empty.tags.as_deref(), "a"));
    }

    #[test]
    fn tracker_filter_is_case_insensitive_exact() {
        let r = MaindataTorrentRow {
            tracker: Some("  UDP://Tracker.Example.com:80  ".to_string()),
            ..Default::default()
        };
        assert!(matches_torrent_tracker(
            r.tracker.as_deref(),
            "udp://tracker.example.com:80"
        ));
        assert!(matches_torrent_tracker(
            r.tracker.as_deref(),
            "UDP://TRACKER.EXAMPLE.COM:80"
        ));
        // Substring must NOT match (exact only).
        assert!(!matches_torrent_tracker(
            r.tracker.as_deref(),
            "tracker.example"
        ));
        // Empty filter passes everything.
        assert!(matches_torrent_tracker(r.tracker.as_deref(), ""));
        // No tracker + non-empty filter fails.
        let none = MaindataTorrentRow::default();
        assert!(!matches_torrent_tracker(none.tracker.as_deref(), "udp://x"));
    }

    #[test]
    fn category_filter_semantics() {
        let f = Filters {
            category: Some("".to_string()),
            ..Default::default()
        };
        let uncategorized = MaindataTorrentRow {
            category: Some("".to_string()),
            ..Default::default()
        };
        let named = MaindataTorrentRow {
            category: Some("docs".to_string()),
            ..Default::default()
        };
        assert!(passes_all_filters(&uncategorized, &f));
        assert!(!passes_all_filters(&named, &f));

        let f = Filters {
            category: Some("docs".to_string()),
            ..Default::default()
        };
        assert!(passes_all_filters(&named, &f));
        assert!(!passes_all_filters(&uncategorized, &f));

        // None = no filter.
        let f = Filters::default();
        assert!(passes_all_filters(&uncategorized, &f));
        assert!(passes_all_filters(&named, &f));
    }

    #[test]
    fn is_filtered_request_only_true_when_a_dimension_is_active() {
        assert!(!is_filtered_request(&Filters::default()));
        assert!(is_filtered_request(&Filters {
            status: "downloading".into(),
            ..Default::default()
        }));
        assert!(is_filtered_request(&Filters {
            category: Some("docs".into()),
            ..Default::default()
        }));
        assert!(is_filtered_request(&Filters {
            tag: Some("linux".into()),
            ..Default::default()
        }));
        assert!(is_filtered_request(&Filters {
            tracker: Some("udp://x".into()),
            ..Default::default()
        }));
        assert!(is_filtered_request(&Filters {
            search: "x".into(),
            ..Default::default()
        }));
    }

    #[test]
    fn passes_all_filters_except_skips_target_dimension() {
        let row = MaindataTorrentRow {
            category: Some("docs".into()),
            state: Some("downloading".into()),
            tags: Some("a".into()),
            tracker: Some("udp://t".into()),
            name: Some("foo".into()),
            ..Default::default()
        };
        let mut filters = Filters::default();

        // Default: all empty → passes everything regardless.
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Status
        ));

        // Active status filter: skipping status should still pass.
        filters.status = "downloading".into();
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Status
        ));
        // The same filter applied via a different except dimension must
        // also pass — the row's state matches.
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Category
        ));

        // But a row whose state does NOT match the filter must fail when
        // the status filter is applied.
        let wrong_state = MaindataTorrentRow {
            state: Some("stoppedDL".into()),
            ..row.clone()
        };
        assert!(!passes_all_filters_except(
            &wrong_state,
            &filters,
            FilterDimension::Category
        ));
        // ...unless we skip the status dimension.
        assert!(passes_all_filters_except(
            &wrong_state,
            &filters,
            FilterDimension::Status
        ));

        // Restore and switch on category.
        filters = Filters::default();
        filters.category = Some("docs".into());
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Category
        ));
        // Skipping any other dimension still honors category — and since
        // the row's category matches, the row still passes.
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Tracker
        ));

        // A row whose category does NOT match the filter must NOT pass when
        // the function applies the category filter (i.e. except != Category).
        let wrong_row = MaindataTorrentRow {
            category: Some("other".into()),
            state: Some("downloading".into()),
            tags: Some("a".into()),
            tracker: Some("udp://t".into()),
            name: Some("foo".into()),
            ..Default::default()
        };
        assert!(!passes_all_filters_except(
            &wrong_row,
            &filters,
            FilterDimension::Tracker
        ));

        // Restore and switch on tag.
        filters = Filters::default();
        filters.tag = Some("a".into());
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Tag
        ));
        // The row's tag matches → still passes when the tag filter is applied.
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Status
        ));
        // A row whose tags don't include "a" must fail when tag filter applied.
        let no_tag = MaindataTorrentRow {
            tags: Some("other".into()),
            ..row.clone()
        };
        assert!(!passes_all_filters_except(
            &no_tag,
            &filters,
            FilterDimension::Status
        ));
        // ...unless we skip the tag dimension.
        assert!(passes_all_filters_except(
            &no_tag,
            &filters,
            FilterDimension::Tag
        ));

        // Restore and switch on tracker.
        filters = Filters::default();
        filters.tracker = Some("udp://t".into());
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Tracker
        ));
        // The row's tracker matches → still passes when the tracker filter is applied.
        assert!(passes_all_filters_except(
            &row,
            &filters,
            FilterDimension::Status
        ));
        // A row whose tracker does NOT match must fail.
        let wrong_tracker = MaindataTorrentRow {
            tracker: Some("udp://other".into()),
            ..row.clone()
        };
        assert!(!passes_all_filters_except(
            &wrong_tracker,
            &filters,
            FilterDimension::Status
        ));
        // ...unless we skip the tracker dimension.
        assert!(passes_all_filters_except(
            &wrong_tracker,
            &filters,
            FilterDimension::Tracker
        ));
    }
}
