//! Cross-filtered facet counts and sidebar projections.
//!
//! Four independent passes, each ignoring exactly one dimension:
//!
//! 1. Status counts — honor category, tag, tracker, search; ignore status.
//! 2. Category counts — honor status, tag, tracker, search; ignore category.
//! 3. Tag counts — honor status, category, tracker, search; ignore tag.
//! 4. Tracker counts — honor status, category, tag, search; ignore tracker.
//!
//! Sidebar item construction:
//!
//! - `sidebar_categories`: order from `snapshot.categories` keys (BTreeMap
//!   iteration order), append `''` (uncategorized) when present in
//!   `category_counts`. Each item carries the server-declared `save_path`
//!   and the cross-filtered `count`.
//! - `sidebar_tags`: dedupe and trim the snapshot's known tags; emit one
//!   item per known tag with its cross-filtered count.
//! - `sidebar_trackers`: sort count desc, then hostname asc via collator.
//!
//! Tracker hostname extraction mirrors JS `new URL(url).hostname` with a
//! host/port parser fallback (the JS implementation throws on bad URLs;
//! the Rust implementation uses `url::Url` which has stricter parsing).

use std::collections::BTreeMap;
use std::collections::HashMap;

use icu_collator::CollatorBorrowed;

use crate::dto::{MaindataCategoryRow, MaindataTorrentRow};
use crate::workspace::filter::{passes_all_filters_except, FilterDimension};
use crate::workspace::view::{SidebarCategoryItem, SidebarTagItem, SidebarTrackerItem};
use crate::workspace::Filters;

/// Sidebar tracker entry used internally by the facet passes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SidebarTrackerEntry {
    pub tracker_url: String,
    pub hostname: String,
    pub count: u64,
}

/// Derive the 12 status-bucket counts honoring category, tag, tracker, and
/// search; ignoring status itself.
pub fn derive_status_counts<'a, I: IntoIterator<Item = &'a MaindataTorrentRow>>(
    torrents: I,
    filters: &Filters,
) -> HashMap<String, u64> {
    // Always emit all 12 keys (zero-filled when no torrents match a bucket).
    let mut counts: HashMap<String, u64> = HashMap::new();
    for (key, _) in super::filter::TORRENT_STATES_FOR_FILTER.iter() {
        counts.insert((*key).to_string(), 0);
    }

    for row in torrents {
        if !passes_all_filters_except(row, filters, FilterDimension::Status) {
            continue;
        }
        // Every row that passes the non-status filters contributes 1 to `all`.
        counts
            .entry("all".to_string())
            .and_modify(|v| *v += 1)
            .or_insert(1);
        for (key, states) in super::filter::TORRENT_STATES_FOR_FILTER.iter() {
            if *key == "all" {
                continue;
            }
            if states.is_empty() {
                continue;
            }
            if let Some(state) = row.state.as_deref() {
                if states.contains(&state) {
                    counts
                        .entry((*key).to_string())
                        .and_modify(|v| *v += 1)
                        .or_insert(1);
                }
            }
        }
    }

    counts
}

/// Derive category counts (including the empty/uncategorized bucket).
///
/// Honors status, tag, tracker, search; ignores category itself. Returns
/// `(map, total_filtered)` where `total_filtered` is the count of torrents
/// that pass all filters except category — the canonical value for the
/// "All Categories" sidebar row.
pub fn derive_category_counts<'a, I: IntoIterator<Item = &'a MaindataTorrentRow>>(
    torrents: I,
    filters: &Filters,
) -> (HashMap<String, u64>, u64) {
    let mut counts: HashMap<String, u64> = HashMap::new();
    let mut total: u64 = 0;

    for row in torrents {
        if !passes_all_filters_except(row, filters, FilterDimension::Category) {
            continue;
        }
        total += 1;
        let key = row.category.clone().unwrap_or_default();
        counts.entry(key).and_modify(|v| *v += 1).or_insert(1);
    }

    (counts, total)
}

/// Derive tag counts (only known tags from the snapshot get buckets).
///
/// Honors status, category, tracker, search; ignores tag itself. Returns
/// `(map, total_filtered)` where `total_filtered` is the count of torrents
/// that pass all filters except tag — used for the "All Tags" sidebar row.
pub fn derive_tag_counts<'a, I: IntoIterator<Item = &'a MaindataTorrentRow>>(
    torrents: I,
    known_tags: &[String],
    filters: &Filters,
) -> (HashMap<String, u64>, u64) {
    let mut counts: HashMap<String, u64> = HashMap::new();
    for t in known_tags {
        counts.insert(t.clone(), 0);
    }
    let mut total: u64 = 0;

    for row in torrents {
        if !passes_all_filters_except(row, filters, FilterDimension::Tag) {
            continue;
        }
        total += 1;
        let Some(tags) = row.tags.as_deref() else {
            continue;
        };
        let mut seen = std::collections::HashSet::new();
        for raw in tags.split(',') {
            let t = raw.trim();
            if t.is_empty() || !seen.insert(t.to_string()) {
                continue;
            }
            if counts.contains_key(t) {
                *counts.get_mut(t).unwrap() += 1;
            }
        }
    }

    (counts, total)
}

/// Derive tracker counts (per-URL + hostname extraction).
///
/// Honors status, category, tag, search; ignores tracker itself. Returns
/// `(map, total_filtered)` where `total_filtered` is the count of torrents
/// that pass all filters except tracker — used for the "All Trackers" sidebar row.
pub fn derive_tracker_counts<'a, I: IntoIterator<Item = &'a MaindataTorrentRow>>(
    torrents: I,
    filters: &Filters,
) -> (HashMap<String, SidebarTrackerEntry>, u64) {
    let mut map: HashMap<String, SidebarTrackerEntry> = HashMap::new();
    let mut hostname_cache: HashMap<String, Option<String>> = HashMap::new();
    let mut total: u64 = 0;

    for row in torrents {
        if !passes_all_filters_except(row, filters, FilterDimension::Tracker) {
            continue;
        }
        total += 1;
        let Some(raw) = row.tracker.as_deref() else {
            continue;
        };
        let url = raw.trim();
        if url.is_empty() {
            continue;
        }
        let hostname = match hostname_cache.get(url) {
            Some(Some(h)) => h.clone(),
            Some(None) => continue,
            None => match extract_hostname(url) {
                Some(h) => {
                    hostname_cache.insert(url.to_string(), Some(h.clone()));
                    h
                }
                None => {
                    hostname_cache.insert(url.to_string(), None);
                    continue;
                }
            },
        };
        map.entry(url.to_string())
            .and_modify(|e| e.count += 1)
            .or_insert(SidebarTrackerEntry {
                tracker_url: url.to_string(),
                hostname,
                count: 1,
            });
    }

    (map, total)
}

/// Extract hostname from a tracker URL.
///
/// Mirrors `new URL(url).hostname` semantics as closely as possible. URLs
/// without a scheme (`example.com:80/announce`) are parsed by prepending
/// `http://` so the parser can locate the host. Schemes other than
/// `udp`/`http`/`https` are still parsed, matching JS's lenient `URL`.
///
/// Returns `None` for inputs that the `url` crate cannot parse even after
/// normalization. Mirrors the JS try/catch wrapper.
pub fn extract_hostname(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Try direct parse first (handles udp://, http://, https://, ws://, etc.).
    if let Ok(parsed) = url::Url::parse(trimmed) {
        if let Some(host) = parsed.host_str() {
            return Some(host.to_string());
        }
    }

    // Some trackers are advertised without a scheme (`example.com:80/announce`).
    // Prepend `http://` so the parser can locate the host. This mirrors the
    // browser's tolerant behavior — `new URL('example.com')` fails but
    // `new URL('http://example.com')` succeeds.
    let with_scheme = format!("http://{trimmed}");
    if let Ok(parsed) = url::Url::parse(&with_scheme) {
        if let Some(host) = parsed.host_str() {
            return Some(host.to_string());
        }
    }

    None
}

/// Build the sidebar categories list in canonical order.
///
/// Order is the iteration order of the `snapshot.categories` BTreeMap (which
/// matches the server-declared category list). The empty category name
/// (`""`, representing "uncategorized") is appended at the end if present in
/// `category_counts` and not already in the categories map.
pub fn sidebar_categories_from_counts(
    categories: &BTreeMap<String, MaindataCategoryRow>,
    category_counts: &HashMap<String, u64>,
    has_uncategorized: bool,
) -> Vec<SidebarCategoryItem> {
    let mut ordered: Vec<String> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for name in categories.keys() {
        if seen.insert(name.clone()) {
            ordered.push(name.clone());
        }
    }

    let uncategorized_count = category_counts.get("").copied().unwrap_or(0);
    if (uncategorized_count > 0 || has_uncategorized) && !seen.contains("") {
        ordered.push(String::new());
    }

    ordered
        .into_iter()
        .map(|name| SidebarCategoryItem {
            save_path: categories
                .get(&name)
                .and_then(|row| row.save_path.clone())
                .unwrap_or_default(),
            count: category_counts.get(&name).copied().unwrap_or(0),
            name,
        })
        .collect()
}

/// Build the sidebar tags list in canonical order.
///
/// Mirrors `normalizedTags` from the JS reference: trim + dedupe + filter
/// empty strings. Order is the snapshot's `tags` list (already sorted by the
/// accumulator).
pub fn sidebar_tags_from_counts(
    known_tags: &[String],
    tag_counts: &HashMap<String, u64>,
) -> Vec<SidebarTagItem> {
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut items: Vec<SidebarTagItem> = Vec::new();

    for raw in known_tags {
        let t = raw.trim();
        if t.is_empty() || !seen.insert(t.to_string()) {
            continue;
        }
        items.push(SidebarTagItem {
            tag: t.to_string(),
            count: tag_counts.get(t).copied().unwrap_or(0),
        });
    }

    items
}

/// Build the sidebar trackers list sorted by count desc, then hostname asc.
///
/// `collator` is used for the hostname tiebreak so CJK hostnames sort in the
/// same order the JS reference would produce.
pub fn sidebar_trackers_from_map(
    tracker_map: &HashMap<String, SidebarTrackerEntry>,
    collator: Option<&CollatorBorrowed<'static>>,
) -> Vec<SidebarTrackerItem> {
    let mut entries: Vec<SidebarTrackerEntry> = tracker_map.values().cloned().collect();
    entries.sort_by(|a, b| {
        // count desc
        match b.count.cmp(&a.count) {
            Ordering::Equal => {
                let hostname_order = match collator {
                    Some(c) => c.compare(&a.hostname, &b.hostname),
                    None => a.hostname.cmp(&b.hostname),
                };
                hostname_order.then_with(|| a.tracker_url.cmp(&b.tracker_url))
            }
            other => other,
        }
    });
    entries
        .into_iter()
        .map(|e| SidebarTrackerItem {
            tracker_url: e.tracker_url,
            hostname: e.hostname,
            count: e.count,
        })
        .collect()
}

use std::cmp::Ordering;

#[cfg(test)]
mod tests {
    use super::*;

    fn row(
        name: &str,
        state: &str,
        category: &str,
        tags: &str,
        tracker: &str,
    ) -> MaindataTorrentRow {
        MaindataTorrentRow {
            name: Some(name.to_string()),
            state: Some(state.to_string()),
            category: Some(category.to_string()),
            tags: Some(tags.to_string()),
            tracker: Some(tracker.to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn status_counts_populates_all_buckets() {
        let torrents = vec![
            row("a", "downloading", "", "", ""),
            row("b", "stalledDL", "", "", ""),
            row("c", "uploading", "", "", ""),
            row("d", "stalledUP", "", "", ""),
            row("e", "stoppedDL", "", "", ""),
            row("f", "stoppedUP", "", "", ""),
            row("g", "queuedDL", "", "", ""),
            row("h", "queuedUP", "", "", ""),
            row("i", "forcedDL", "", "", ""),
            row("j", "forcedUP", "", "", ""),
            row("k", "error", "", "", ""),
            row("l", "missingFiles", "", "", ""),
            row("m", "metaDL", "", "", ""),
        ];
        let counts = derive_status_counts(torrents.iter(), &Filters::default());
        assert_eq!(counts.get("all").copied(), Some(13));
        // downloading bucket: downloading, stalledDL, metaDL → 3
        assert_eq!(counts.get("downloading").copied(), Some(3));
        // seeding: uploading, stalledUP → 2
        assert_eq!(counts.get("seeding").copied(), Some(2));
        // completed: uploading, stalledUP, queuedUP, stoppedUP → 4
        assert_eq!(counts.get("completed").copied(), Some(4));
        // stopped: stoppedDL, stoppedUP → 2
        assert_eq!(counts.get("stopped").copied(), Some(2));
        // running: downloading, uploading, forcedDL, forcedUP → 4
        assert_eq!(counts.get("running").copied(), Some(4));
        // stalled: stalledDL, stalledUP → 2
        assert_eq!(counts.get("stalled").copied(), Some(2));
        // stalled_uploading: stalledUP → 1
        assert_eq!(counts.get("stalled_uploading").copied(), Some(1));
        // stalled_downloading: stalledDL → 1
        assert_eq!(counts.get("stalled_downloading").copied(), Some(1));
        // active: downloading, stalledDL, uploading, stalledUP → 4
        assert_eq!(counts.get("active").copied(), Some(4));
        // inactive: queuedDL, queuedUP, stoppedDL, stoppedUP → 4
        assert_eq!(counts.get("inactive").copied(), Some(4));
        // errored: error, missingFiles → 2
        assert_eq!(counts.get("errored").copied(), Some(2));
    }

    #[test]
    fn status_counts_respects_category_filter() {
        // Two downloading torrents; only one in category "docs". The
        // status pass should ignore status, so both contribute, but with
        // the category filter active only the docs one counts.
        let torrents = vec![
            row("a", "downloading", "docs", "", ""),
            row("b", "downloading", "other", "", ""),
        ];
        let filters = Filters {
            category: Some("docs".to_string()),
            ..Default::default()
        };
        let counts = derive_status_counts(torrents.iter(), &filters);
        assert_eq!(counts.get("all").copied(), Some(1));
        assert_eq!(counts.get("downloading").copied(), Some(1));
    }

    #[test]
    fn category_counts_includes_uncategorized_bucket() {
        let torrents = vec![
            row("a", "downloading", "docs", "", ""),
            row("b", "downloading", "", "", ""),
            row("c", "uploading", "", "", ""),
            row("d", "downloading", "docs", "", ""),
        ];
        let (counts, total) = derive_category_counts(torrents.iter(), &Filters::default());
        assert_eq!(total, 4);
        assert_eq!(counts.get("docs").copied(), Some(2));
        assert_eq!(counts.get("").copied(), Some(2));
    }

    #[test]
    fn category_counts_ignores_category_filter() {
        // Category filter is active ("docs") but the facet pass must still
        // count torrents in other categories.
        let torrents = vec![
            row("a", "downloading", "docs", "", ""),
            row("b", "downloading", "other", "", ""),
        ];
        let filters = Filters {
            category: Some("docs".to_string()),
            ..Default::default()
        };
        let (counts, total) = derive_category_counts(torrents.iter(), &filters);
        assert_eq!(total, 2);
        assert_eq!(counts.get("docs").copied(), Some(1));
        assert_eq!(counts.get("other").copied(), Some(1));
    }

    #[test]
    fn tag_counts_only_emit_known_tags() {
        let torrents = vec![
            row("a", "downloading", "", "a, b", ""),
            row("b", "downloading", "", "a", ""),
            row("c", "downloading", "", "c", ""), // c not in known tags
        ];
        let known = vec!["a".to_string(), "b".to_string()];
        let (counts, total) = derive_tag_counts(torrents.iter(), &known, &Filters::default());
        assert_eq!(total, 3);
        assert_eq!(counts.get("a").copied(), Some(2));
        assert_eq!(counts.get("b").copied(), Some(1));
        // c is not a known tag → no bucket.
        assert_eq!(counts.get("c"), None);
    }

    #[test]
    fn tag_counts_dedupe_within_torrent() {
        // A torrent with two copies of "a" should still only contribute 1.
        let torrents = vec![row("a", "downloading", "", "a, a, b", "")];
        let known = vec!["a".to_string(), "b".to_string()];
        let (counts, _total) = derive_tag_counts(torrents.iter(), &known, &Filters::default());
        assert_eq!(counts.get("a").copied(), Some(1));
        assert_eq!(counts.get("b").copied(), Some(1));
    }

    #[test]
    fn tag_counts_ignores_tag_filter() {
        // Tag filter active ("a") but the facet pass must still count all tags.
        let torrents = vec![
            row("a", "downloading", "", "a", ""),
            row("b", "downloading", "", "b", ""),
        ];
        let filters = Filters {
            tag: Some("a".to_string()),
            ..Default::default()
        };
        let known = vec!["a".to_string(), "b".to_string()];
        let (counts, total) = derive_tag_counts(torrents.iter(), &known, &filters);
        assert_eq!(total, 2);
        assert_eq!(counts.get("a").copied(), Some(1));
        assert_eq!(counts.get("b").copied(), Some(1));
    }

    #[test]
    fn tracker_counts_skip_invalid_urls() {
        let torrents = vec![
            row("a", "downloading", "", "", "udp://tracker.example.com:80"),
            row(
                "b",
                "downloading",
                "",
                "",
                "http://tracker.example.com/announce",
            ),
            row("c", "downloading", "", "", "not a url"),
            row("d", "downloading", "", "", ""),
        ];
        let (map, total) = derive_tracker_counts(torrents.iter(), &Filters::default());
        assert_eq!(total, 4); // tracker filter is off → all torrents count
        assert_eq!(map.len(), 2); // invalid + empty are dropped
        assert!(map.contains_key("udp://tracker.example.com:80"));
        assert!(map.contains_key("http://tracker.example.com/announce"));
    }

    #[test]
    fn tracker_counts_ignore_tracker_filter() {
        let torrents = vec![
            row("a", "downloading", "", "", "udp://a.example.com"),
            row("b", "downloading", "", "", "udp://b.example.com"),
        ];
        let filters = Filters {
            tracker: Some("udp://a.example.com".to_string()),
            ..Default::default()
        };
        let (map, total) = derive_tracker_counts(torrents.iter(), &filters);
        assert_eq!(total, 2);
        assert_eq!(map.len(), 2);
    }

    #[test]
    fn extract_hostname_udp_http_https() {
        assert_eq!(
            extract_hostname("udp://tracker.example.com:80"),
            Some("tracker.example.com".to_string())
        );
        assert_eq!(
            extract_hostname("http://tracker.example.com/announce"),
            Some("tracker.example.com".to_string())
        );
        assert_eq!(
            extract_hostname("https://tracker.example.com/announce"),
            Some("tracker.example.com".to_string())
        );
    }

    #[test]
    fn extract_hostname_handles_schemeless() {
        // Some trackers are advertised as `host:port/path` without a scheme.
        assert_eq!(
            extract_hostname("tracker.example.com:80/announce"),
            Some("tracker.example.com".to_string())
        );
    }

    #[test]
    fn extract_hostname_handles_invalid() {
        assert_eq!(extract_hostname(""), None);
        assert_eq!(extract_hostname("   "), None);
        // Garbage input that the url crate cannot parse even after normalization.
        assert_eq!(extract_hostname("\0\0\0"), None);
    }

    #[test]
    fn sidebar_categories_orders_then_appends_uncategorized() {
        let mut cats = BTreeMap::new();
        cats.insert(
            "videos".to_string(),
            MaindataCategoryRow {
                name: Some("videos".to_string()),
                save_path: Some("/data/videos".to_string()),
                ..Default::default()
            },
        );
        cats.insert(
            "docs".to_string(),
            MaindataCategoryRow {
                name: Some("docs".to_string()),
                save_path: Some("/data/docs".to_string()),
                ..Default::default()
            },
        );

        let mut counts = HashMap::new();
        counts.insert("docs".to_string(), 3);
        counts.insert("videos".to_string(), 2);
        counts.insert("".to_string(), 1);

        let items = sidebar_categories_from_counts(&cats, &counts, true);
        // BTreeMap iteration: docs first, then videos, then "".
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].name, "docs");
        assert_eq!(items[0].save_path, "/data/docs");
        assert_eq!(items[0].count, 3);
        assert_eq!(items[1].name, "videos");
        assert_eq!(items[2].name, "");
        assert_eq!(items[2].save_path, "");
        assert_eq!(items[2].count, 1);
    }

    #[test]
    fn sidebar_categories_skips_uncategorized_when_empty() {
        let mut cats = BTreeMap::new();
        cats.insert(
            "docs".to_string(),
            MaindataCategoryRow {
                name: Some("docs".to_string()),
                save_path: Some("/d".to_string()),
                ..Default::default()
            },
        );
        let counts = HashMap::new(); // no "" key
        let items = sidebar_categories_from_counts(&cats, &counts, false);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "docs");
    }

    #[test]
    fn sidebar_tags_trims_and_dedupes() {
        let known = vec![
            "a".to_string(),
            "  ".to_string(),
            "a".to_string(),
            "b".to_string(),
        ];
        let mut counts = HashMap::new();
        counts.insert("a".to_string(), 5);
        counts.insert("b".to_string(), 2);
        let items = sidebar_tags_from_counts(&known, &counts);
        // After trim+dedupe: a, b.
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].tag, "a");
        assert_eq!(items[0].count, 5);
        assert_eq!(items[1].tag, "b");
        assert_eq!(items[1].count, 2);
    }

    #[test]
    fn sidebar_trackers_sorted_by_count_then_hostname() {
        let mut map = HashMap::new();
        map.insert(
            "udp://a.example.com".to_string(),
            SidebarTrackerEntry {
                tracker_url: "udp://a.example.com".to_string(),
                hostname: "a.example.com".to_string(),
                count: 1,
            },
        );
        map.insert(
            "udp://b.example.com".to_string(),
            SidebarTrackerEntry {
                tracker_url: "udp://b.example.com".to_string(),
                hostname: "b.example.com".to_string(),
                count: 3,
            },
        );
        map.insert(
            "udp://c.example.com".to_string(),
            SidebarTrackerEntry {
                tracker_url: "udp://c.example.com".to_string(),
                hostname: "c.example.com".to_string(),
                count: 3,
            },
        );
        let items = sidebar_trackers_from_map(&map, None);
        // Count desc: b (3) and c (3), tiebreak by hostname asc.
        assert_eq!(items[0].hostname, "b.example.com");
        assert_eq!(items[1].hostname, "c.example.com");
        assert_eq!(items[2].hostname, "a.example.com");
    }
}
