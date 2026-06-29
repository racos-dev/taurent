//! Workspace engine unit tests.
//!
//! Covers:
//! - `compute_and_diff_returns_none_on_identical_recompute`
//! - `compute_and_diff_returns_some_when_field_changes`
//! - `totals_counts_correct_for_hand_fixture`
//! - `status_mapping_mini_gate` — Rust vs JS `TORRENT_STATES_FOR_FILTER` parity
//! - `cross_filtered_facets_ignore_own_dimension`
//! - `sort_by_name_asc_locale_aware`
//! - `tracker_hostname_extraction_matches_url_crate`

use crate::dto::{MaindataCategoryRow, MaindataServerState, MaindataTorrentRow};
use crate::sync::MaindataSnapshot;
use crate::workspace::filter::matches_torrent_filter;
use crate::workspace::test_fixture::{build_hand_fixture, HAND_FIXTURE_ROWS};
use crate::workspace::{
    compare_hashes, derive_category_counts, derive_status_counts, derive_tag_counts,
    derive_tracker_counts, extract_hostname, sidebar_categories_from_counts, Filters, Sort,
    SortDirection, WorkspaceViewEngine, WorkspaceViewRequest,
};

const HAND_FIXTURE_TORRENT_COUNT: usize = 20;

fn default_request() -> WorkspaceViewRequest {
    WorkspaceViewRequest {
        request_id: "test-req".to_string(),
        filters: Filters::default(),
        sort: Sort {
            field: "added_on".to_string(),
            direction: SortDirection::Desc,
        },
        include_sorted_hashes: true,
        locale: "en-US".to_string(),
    }
}

fn snapshot_with(mut row: MaindataTorrentRow, hash: &str) -> MaindataSnapshot {
    let mut snap = MaindataSnapshot::default();
    row.hash = Some(hash.to_string());
    snap.torrents.insert(hash.to_string(), row);
    snap
}

// -----------------------------------------------------------------------------
// compute_and_diff
// -----------------------------------------------------------------------------

#[test]
fn compute_and_diff_returns_none_on_identical_recompute() {
    let snap = build_hand_fixture();
    let mut engine = WorkspaceViewEngine::new(default_request());

    let first = engine.compute_and_diff(&snap);
    assert!(first.is_some(), "first compute must emit");

    // Recomputing against the same snapshot with the same request must not emit.
    let second = engine.compute_and_diff(&snap);
    assert!(
        second.is_none(),
        "identical recompute must return None (got {:?})",
        second.map(|v| v.revision)
    );
}

#[test]
fn compute_and_diff_returns_some_when_field_changes() {
    let mut snap = build_hand_fixture();
    let mut engine = WorkspaceViewEngine::new(default_request());

    let first = engine.compute_and_diff(&snap).expect("first emit");
    assert!(engine.last_view().is_some());

    // Mutate dlspeed on a single torrent — totals must change.
    let original_f01 = first.total_dl_speed - first.total_dl_speed + 100_000; // f01 baseline
    snap.torrents.get_mut("f01").unwrap().dlspeed = Some(9_999_999);
    let view = engine.compute_and_diff(&snap);
    assert!(view.is_some(), "field change must emit a new view");
    let new_total = view.unwrap().total_dl_speed;
    // Total = (original total - original f01) + 9_999_999
    let expected = first.total_dl_speed - original_f01 + 9_999_999;
    assert_eq!(new_total, expected);
}

#[test]
fn compute_and_diff_returns_some_when_request_changes() {
    let snap = build_hand_fixture();
    let mut engine = WorkspaceViewEngine::new(default_request());

    let _ = engine.compute_and_diff(&snap);
    let mut req = default_request();
    req.filters.status = "downloading".to_string();
    engine.set_request(req);

    let view = engine.compute_and_diff(&snap);
    assert!(view.is_some(), "request change must emit");
}

#[test]
fn compute_and_diff_uses_snapshot_rid_as_revision() {
    let mut snap = build_hand_fixture();
    snap.rid = 7;
    let mut engine = WorkspaceViewEngine::new(default_request());

    let view = engine.compute_and_diff(&snap).unwrap();
    assert_eq!(view.revision, 7);
}

// -----------------------------------------------------------------------------
// Totals + counts
// -----------------------------------------------------------------------------

#[test]
fn totals_counts_correct_for_hand_fixture() {
    let snap = build_hand_fixture();
    let mut engine = WorkspaceViewEngine::new(default_request());

    let view = engine.compute_and_diff(&snap).unwrap();

    // 20 torrents in the fixture.
    assert_eq!(view.total_count, HAND_FIXTURE_TORRENT_COUNT);
    assert_eq!(view.filtered_count, HAND_FIXTURE_TORRENT_COUNT);

    // Total dl/ul speeds = sum of per-row dlspeed/upspeed (all Some).
    let expected_dl: i64 = HAND_FIXTURE_ROWS.iter().map(|r| r.dlspeed).sum();
    let expected_ul: i64 = HAND_FIXTURE_ROWS.iter().map(|r| r.upspeed).sum();
    assert_eq!(view.total_dl_speed, expected_dl);
    assert_eq!(view.total_ul_speed, expected_ul);

    // Default filters → isFiltered is false.
    assert!(!view.is_filtered);
}

// -----------------------------------------------------------------------------
// Status mapping mini-gate
// -----------------------------------------------------------------------------

#[test]
fn status_mapping_mini_gate_matches_js_torrent_states_for_filter() {
    // Build the engine and ask it for status_counts over the hand fixture.
    let snap = build_hand_fixture();
    let mut engine = WorkspaceViewEngine::new(default_request());
    let view = engine.compute_and_diff(&snap).unwrap();

    // The fixture has exactly one torrent per canonical state (f01..f12),
    // plus 8 more with various other states. Compute expected bucket counts
    // directly from `HAND_FIXTURE_ROWS` using the SAME mapping table the
    // Rust engine uses — that is, by mirroring the JS `matchesTorrentFilter`
    // contract. This makes the test a parity gate against our own
    // implementation: if the JS table ever drifts from Rust, this test
    // will be the seam to update.

    let states: Vec<&'static str> = HAND_FIXTURE_ROWS.iter().map(|r| r.state).collect();

    // Helper: count rows that match a `TorrentFilterType`.
    let count_matching = |ft: &str| -> u64 {
        states
            .iter()
            .filter(|s| matches_torrent_filter(ft, Some(s)))
            .count() as u64
    };

    let expected_all = count_matching("all");
    let expected_downloading = count_matching("downloading");
    let expected_seeding = count_matching("seeding");
    let expected_completed = count_matching("completed");
    let expected_stopped = count_matching("stopped");
    let expected_active = count_matching("active");
    let expected_inactive = count_matching("inactive");
    let expected_running = count_matching("running");
    let expected_stalled = count_matching("stalled");
    let expected_stalled_up = count_matching("stalled_uploading");
    let expected_stalled_dl = count_matching("stalled_downloading");
    let expected_errored = count_matching("errored");

    assert_eq!(view.status_counts.get("all").copied(), Some(expected_all));
    assert_eq!(
        view.status_counts.get("downloading").copied(),
        Some(expected_downloading)
    );
    assert_eq!(
        view.status_counts.get("seeding").copied(),
        Some(expected_seeding)
    );
    assert_eq!(
        view.status_counts.get("completed").copied(),
        Some(expected_completed)
    );
    assert_eq!(
        view.status_counts.get("stopped").copied(),
        Some(expected_stopped)
    );
    assert_eq!(
        view.status_counts.get("active").copied(),
        Some(expected_active)
    );
    assert_eq!(
        view.status_counts.get("inactive").copied(),
        Some(expected_inactive)
    );
    assert_eq!(
        view.status_counts.get("running").copied(),
        Some(expected_running)
    );
    assert_eq!(
        view.status_counts.get("stalled").copied(),
        Some(expected_stalled)
    );
    assert_eq!(
        view.status_counts.get("stalled_uploading").copied(),
        Some(expected_stalled_up)
    );
    assert_eq!(
        view.status_counts.get("stalled_downloading").copied(),
        Some(expected_stalled_dl)
    );
    assert_eq!(
        view.status_counts.get("errored").copied(),
        Some(expected_errored)
    );

    // Hard-coded parity expectations against the fixture as written:
    //   downloading = {downloading, stalledDL, metaDL}: f01, f02, f14, f15, f16, f18, f20 = 7
    //   seeding     = {uploading, stalledUP}:            f03, f04, f17                   = 3
    //   completed   = {uploading, stalledUP, queuedUP, stoppedUP}: f03, f04, f06, f08, f17 = 5
    //   stopped     = {stoppedDL, stoppedUP}:            f07, f08, f13, f19              = 4
    //   active      = {downloading, stalledDL, uploading, stalledUP}: f01, f02, f03, f04, f14, f15, f16, f17, f18, f20 = 10
    //   inactive    = {queuedDL, queuedUP, stoppedDL, stoppedUP}: f05, f06, f07, f08, f13, f19 = 6
    //   running     = {downloading, uploading, forcedDL, forcedUP}: f01, f03, f09, f10, f14, f16, f17, f18, f20 = 9
    //   stalled     = {stalledDL, stalledUP}:            f02, f04, f15                   = 3
    //   stalled_uploading = {stalledUP}:                 f04                             = 1
    //   stalled_downloading = {stalledDL}:               f02, f15                        = 2
    //   errored     = {error, missingFiles}:             f11, f12                        = 2
    //   all:        20
    assert_eq!(view.status_counts.get("all").copied(), Some(20));
    assert_eq!(view.status_counts.get("downloading").copied(), Some(7));
    assert_eq!(view.status_counts.get("seeding").copied(), Some(3));
    assert_eq!(view.status_counts.get("completed").copied(), Some(5));
    assert_eq!(view.status_counts.get("stopped").copied(), Some(4));
    assert_eq!(view.status_counts.get("active").copied(), Some(10));
    assert_eq!(view.status_counts.get("inactive").copied(), Some(6));
    assert_eq!(view.status_counts.get("running").copied(), Some(9));
    assert_eq!(view.status_counts.get("stalled").copied(), Some(3));
    assert_eq!(
        view.status_counts.get("stalled_uploading").copied(),
        Some(1)
    );
    assert_eq!(
        view.status_counts.get("stalled_downloading").copied(),
        Some(2)
    );
    assert_eq!(view.status_counts.get("errored").copied(), Some(2));
}

// -----------------------------------------------------------------------------
// Cross-filtered facets
// -----------------------------------------------------------------------------

#[test]
fn cross_filtered_facets_ignore_own_dimension() {
    let snap = build_hand_fixture();

    // Activate a category filter. Category counts MUST still include all
    // torrents regardless of their actual category.
    let filters = Filters {
        category: Some("docs".to_string()),
        ..Default::default()
    };

    let (cat_counts, total_for_categories) =
        derive_category_counts(snap.torrents.values(), &filters);
    assert_eq!(total_for_categories, HAND_FIXTURE_TORRENT_COUNT as u64);
    // docs torrents in the fixture: f01, f02, f15, f16, f18, f20 = 6
    assert_eq!(cat_counts.get("docs").copied(), Some(6));
    // videos: f03, f04, f17 = 3
    assert_eq!(cat_counts.get("videos").copied(), Some(3));
    // music: f05, f06, f14 = 3
    assert_eq!(cat_counts.get("music").copied(), Some(3));
    // iso: f09, f10, f11, f12 = 4
    assert_eq!(cat_counts.get("iso").copied(), Some(4));
    // "" uncategorized: f07, f08, f13, f19 = 4
    assert_eq!(cat_counts.get("").copied(), Some(4));

    // Same shape for tag counts under an active tag filter.
    let tag_filters = Filters {
        tag: Some("linux".to_string()),
        ..Default::default()
    };
    let (tag_counts, total_for_tags) =
        derive_tag_counts(snap.torrents.values(), &snap.tags, &tag_filters);
    assert_eq!(total_for_tags, HAND_FIXTURE_TORRENT_COUNT as u64);
    // Linux tag is on f03, f04, f17, f20 = 4
    assert_eq!(tag_counts.get("linux").copied(), Some(4));
    // "audio" on f05, f06, f20 = 3
    assert_eq!(tag_counts.get("audio").copied(), Some(3));
    // "4k" on f20 = 1
    assert_eq!(tag_counts.get("4k").copied(), Some(1));

    // Tracker counts under an active tracker filter — must still count all trackers.
    let tracker_filters = Filters {
        tracker: Some("udp://tracker.example.com:80".to_string()),
        ..Default::default()
    };
    let (tracker_map, total_for_trackers) =
        derive_tracker_counts(snap.torrents.values(), &tracker_filters);
    assert_eq!(total_for_trackers, HAND_FIXTURE_TORRENT_COUNT as u64);
    // tracker.example.com (80): f01, f02, f15, f16 = 4
    assert_eq!(
        tracker_map
            .get("udp://tracker.example.com:80")
            .map(|e| e.count),
        Some(4)
    );
    // http://tracker.example.com/announce: f03, f04, f17 = 3
    assert_eq!(
        tracker_map
            .get("http://tracker.example.com/announce")
            .map(|e| e.count),
        Some(3)
    );

    // Status counts under an active status filter — must still count all
    // status buckets.
    let status_filters = Filters {
        status: "downloading".to_string(),
        ..Default::default()
    };
    let status_counts = derive_status_counts(snap.torrents.values(), &status_filters);
    // "all" should still be the full fixture size when ignoring status.
    assert_eq!(
        status_counts.get("all").copied(),
        Some(HAND_FIXTURE_TORRENT_COUNT as u64)
    );
    // seeding = {uploading, stalledUP}: f03, f04, f17 = 3
    assert_eq!(status_counts.get("seeding").copied(), Some(3));
    // errored = {error, missingFiles}: f11, f12 = 2
    assert_eq!(status_counts.get("errored").copied(), Some(2));
}

// -----------------------------------------------------------------------------
// Sort
// -----------------------------------------------------------------------------

#[test]
fn sort_by_name_asc_locale_aware() {
    let snap = build_hand_fixture();
    let mut req = default_request();
    req.sort.field = "name".to_string();
    req.sort.direction = SortDirection::Asc;

    let mut engine = WorkspaceViewEngine::new(req);
    let view = engine.compute_and_diff(&snap).unwrap();

    // sorted_hashes must be in non-decreasing name order under the collator.
    let names: Vec<String> = view
        .sorted_hashes
        .iter()
        .map(|h| snap.torrents.get(h).unwrap().name.clone().unwrap())
        .collect();
    let mut sorted = names.clone();
    // We can't predict ICU's exact CJK/accented ordering, but a stable sort
    // over the same collator must agree with what `compare_hashes` returns.
    sorted.sort_by(|a, b| {
        let row_a = snap
            .torrents
            .values()
            .find(|r| r.name.as_deref() == Some(a.as_str()))
            .unwrap();
        let row_b = snap
            .torrents
            .values()
            .find(|r| r.name.as_deref() == Some(b.as_str()))
            .unwrap();
        // Use a fresh collator here so we don't depend on engine state.
        let mut cache = crate::workspace::CollatorCache::new();
        let collator = cache.get_or_insert("en-US");
        crate::workspace::sort::compare_rows(
            Some(row_a),
            Some(row_b),
            "name",
            crate::workspace::SortDirection::Asc,
            collator.as_deref(),
        )
    });
    assert_eq!(names, sorted, "engine output must be sorted by name asc");
}

#[test]
fn sort_by_name_desc_reverses_order() {
    let snap = build_hand_fixture();
    let mut req = default_request();
    req.sort.field = "name".to_string();
    req.sort.direction = SortDirection::Desc;

    let mut engine = WorkspaceViewEngine::new(req);
    let desc = engine.compute_and_diff(&snap).unwrap();

    let mut req2 = default_request();
    req2.sort.field = "name".to_string();
    req2.sort.direction = SortDirection::Asc;
    let mut engine2 = WorkspaceViewEngine::new(req2);
    let asc = engine2.compute_and_diff(&snap).unwrap();

    let desc_rev: Vec<String> = desc.sorted_hashes.iter().rev().cloned().collect();
    assert_eq!(desc_rev, asc.sorted_hashes);
}

#[test]
fn sort_by_availability_uses_negative_sentinel() {
    let snap = build_hand_fixture();
    let mut req = default_request();
    req.sort.field = "availability".to_string();
    req.sort.direction = SortDirection::Asc;

    let mut engine = WorkspaceViewEngine::new(req);
    let view = engine.compute_and_diff(&snap).unwrap();

    // The first hash must belong to a torrent with negative availability (the
    // -Inf sentinel) or 0.0 availability (also -Inf-mapped). f15 and f12 are
    // the two negative-availability rows in the fixture.
    let first_hash = &view.sorted_hashes[0];
    let avail = snap
        .torrents
        .get(first_hash)
        .unwrap()
        .availability
        .unwrap_or(-1.0);
    assert!(
        avail < 0.0,
        "asc availability must put negative rows first, got {}",
        avail
    );
}

#[test]
fn sort_by_state_locale_aware_uses_collator() {
    let snap = build_hand_fixture();
    let mut req = default_request();
    req.sort.field = "state".to_string();
    req.sort.direction = SortDirection::Asc;

    let mut engine = WorkspaceViewEngine::new(req);
    let view = engine.compute_and_diff(&snap).unwrap();

    // Verify it's actually sorted by state using the same collator.
    let mut cache = crate::workspace::CollatorCache::new();
    let collator = cache.get_or_insert("en-US");
    for pair in view.sorted_hashes.windows(2) {
        let ord = compare_hashes(
            &pair[0],
            &pair[1],
            &snap,
            "state",
            SortDirection::Asc,
            collator.as_deref(),
        );
        assert!(
            ord != std::cmp::Ordering::Greater,
            "sort_by_state asc violated between {} and {}",
            pair[0],
            pair[1]
        );
    }
}

// -----------------------------------------------------------------------------
// Tracker hostname extraction
// -----------------------------------------------------------------------------

#[test]
fn tracker_hostname_extraction_matches_url_crate() {
    // UDP tracker
    assert_eq!(
        extract_hostname("udp://tracker.example.com:80"),
        Some("tracker.example.com".to_string())
    );
    // HTTP
    assert_eq!(
        extract_hostname("http://tracker.example.com/announce"),
        Some("tracker.example.com".to_string())
    );
    // HTTPS
    assert_eq!(
        extract_hostname("https://tracker.example.com/announce"),
        Some("tracker.example.com".to_string())
    );

    // International hostname (IDN). The url crate may return either the
    // raw Unicode label or the punycode form depending on whether the
    // input uses IDN-aware parsing. We only assert non-empty.
    let idn = extract_hostname("udp://国際.example.com:6969");
    assert!(idn.is_some(), "IDN hostname must extract");
    assert!(!idn.unwrap().is_empty(), "IDN hostname must be non-empty");

    // Invalid → None
    assert_eq!(extract_hostname("not a real url"), None);
    assert_eq!(extract_hostname(""), None);
    assert_eq!(extract_hostname("   "), None);
}

// -----------------------------------------------------------------------------
// Sidebar projections
// -----------------------------------------------------------------------------

#[test]
fn sidebar_categories_preserves_server_order_and_appends_uncategorized() {
    let snap = build_hand_fixture();

    let mut engine = WorkspaceViewEngine::new(default_request());
    let view = engine.compute_and_diff(&snap).unwrap();

    // The fixture's BTreeMap iterates docs, iso, music, videos (lex order).
    // The "" uncategorized bucket is appended because some torrents have an
    // empty category (uncategorizedCount > 0).
    let names: Vec<&str> = view
        .sidebar_categories
        .iter()
        .map(|s| s.name.as_str())
        .collect();
    let expected = vec!["docs", "iso", "music", "videos", ""];
    assert_eq!(names, expected);

    // The empty category bucket is last.
    assert_eq!(view.sidebar_categories.last().unwrap().name, "");

    // Save paths are populated for known categories.
    let docs = view
        .sidebar_categories
        .iter()
        .find(|c| c.name == "docs")
        .unwrap();
    assert_eq!(docs.save_path, "/data/docs");
}

#[test]
fn sidebar_tags_matches_known_tags_order() {
    let snap = build_hand_fixture();
    let mut engine = WorkspaceViewEngine::new(default_request());
    let view = engine.compute_and_diff(&snap).unwrap();

    // The fixture's known tags should appear in canonical alphabetical order
    // (after trim+dedupe). f13 contributes "a" and "b" as distinct tags, so
    // they appear in the list alongside the other tags.
    let expected_tags: Vec<&str> = vec![
        "4k", "a", "audio", "b", "broken", "force", "linux", "paused", "stalled", "world",
    ];
    let actual_tags: Vec<&str> = view.sidebar_tags.iter().map(|s| s.tag.as_str()).collect();
    assert_eq!(actual_tags, expected_tags);
}

#[test]
fn sidebar_trackers_sorted_by_count_desc_then_hostname_asc() {
    let snap = build_hand_fixture();
    let mut engine = WorkspaceViewEngine::new(default_request());
    let view = engine.compute_and_diff(&snap).unwrap();

    // Counts from the fixture (invalid + empty trackers are dropped; the
    // IDN tracker `udp://国際.example.com:6969` is extracted because the
    // `url` crate handles IDN hostnames via the idna adapter):
    //   udp://tracker.example.com:80        → f01, f02, f15, f16 = 4
    //   http://tracker.example.com/announce → f03, f04, f17     = 3
    //   https://tracker.example.com/announce → f05, f06         = 2
    //   udp://other.example.com:6969        → f07, f08          = 2
    //   udp://forced.example.com:80         → f09, f10          = 2
    //   udp://broken.example.com:80         → f11, f12          = 2
    //   udp://example.com:80                → f13               = 1
    //   udp://国際.example.com:6969           → f14               = 1
    //   udp://multi.example.com:80          → f20               = 1
    // 9 distinct trackers total.
    assert_eq!(view.sidebar_trackers.len(), 9);

    // The first entry is the one with count=4.
    assert_eq!(view.sidebar_trackers[0].count, 4);
    assert_eq!(
        view.sidebar_trackers[0].tracker_url,
        "udp://tracker.example.com:80"
    );

    // Within the count=3 group there's only one entry.
    let mut count_groups: Vec<(u64, Vec<&str>)> = Vec::new();
    for entry in &view.sidebar_trackers {
        if let Some(last) = count_groups.last_mut() {
            if last.0 == entry.count {
                last.1.push(entry.hostname.as_str());
                continue;
            }
        }
        count_groups.push((entry.count, vec![entry.hostname.as_str()]));
    }
    let count3 = count_groups
        .iter()
        .find(|(c, _)| *c == 3)
        .map(|(_, v)| v.clone())
        .unwrap_or_default();
    assert_eq!(count3.len(), 1);

    // Within the count=2 group we expect 4 entries sorted by hostname asc.
    let count2: Vec<&str> = count_groups
        .iter()
        .find(|(c, _)| *c == 2)
        .map(|(_, v)| v.clone())
        .unwrap_or_default();
    assert_eq!(count2.len(), 4);
    let mut sorted_count2 = count2.clone();
    sorted_count2.sort();
    assert_eq!(count2, sorted_count2, "count=2 group must be hostname asc");
}

// -----------------------------------------------------------------------------
// Regression: small snapshots
// -----------------------------------------------------------------------------

#[test]
fn empty_snapshot_returns_view_with_zero_totals() {
    let snap = MaindataSnapshot::default();
    let mut engine = WorkspaceViewEngine::new(default_request());
    let view = engine.compute_and_diff(&snap).unwrap();

    assert_eq!(view.total_count, 0);
    assert_eq!(view.filtered_count, 0);
    assert_eq!(view.total_dl_speed, 0);
    assert_eq!(view.total_ul_speed, 0);
    assert!(!view.is_filtered);
    assert!(view.sorted_hashes.is_empty());
    // All status buckets should still be present (zero-filled).
    assert_eq!(view.status_counts.get("all").copied(), Some(0));
}

#[test]
fn single_torrent_snapshot_sorts_correctly() {
    let snap = snapshot_with(
        MaindataTorrentRow {
            name: Some("alone".to_string()),
            state: Some("downloading".to_string()),
            category: Some("".to_string()),
            dlspeed: Some(100),
            ..Default::default()
        },
        "alone-hash",
    );
    let mut engine = WorkspaceViewEngine::new(default_request());
    let view = engine.compute_and_diff(&snap).unwrap();
    assert_eq!(view.sorted_hashes, vec!["alone-hash"]);
    assert_eq!(view.total_count, 1);
    assert_eq!(view.total_dl_speed, 100);
}

#[test]
fn request_can_skip_sorted_hash_projection() {
    let snap = build_hand_fixture();
    let mut request = default_request();
    request.include_sorted_hashes = false;
    let mut engine = WorkspaceViewEngine::new(request);

    let view = engine.compute_and_diff(&snap).unwrap();

    assert!(view.sorted_hashes.is_empty());
    assert_eq!(view.total_count, snap.torrents.len());
    assert_eq!(view.filtered_count, snap.torrents.len());
    assert_eq!(
        view.total_dl_speed,
        HAND_FIXTURE_ROWS.iter().map(|r| r.dlspeed).sum::<i64>(),
    );
    assert!(!view.sidebar_categories.is_empty());
}

#[test]
fn sidebar_categories_from_counts_skips_uncategorized_when_absent() {
    let mut cats = std::collections::BTreeMap::new();
    cats.insert(
        "docs".to_string(),
        MaindataCategoryRow {
            name: Some("docs".to_string()),
            save_path: Some("/d".to_string()),
            ..Default::default()
        },
    );
    let mut counts = std::collections::HashMap::new();
    counts.insert("docs".to_string(), 5);
    // No "" key → no uncategorized row appended.
    let items = sidebar_categories_from_counts(&cats, &counts, false);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].name, "docs");
    assert_eq!(items[0].count, 5);
}

#[test]
fn server_state_present_does_not_affect_view() {
    let mut snap = build_hand_fixture();
    snap.server_state = Some(MaindataServerState {
        dl_info_speed: Some(9_999_999),
        connection_status: Some("connected".to_string()),
        ..Default::default()
    });
    let mut engine = WorkspaceViewEngine::new(default_request());
    let view = engine.compute_and_diff(&snap).unwrap();
    // The view's total_dl_speed is the sum of per-torrent dlspeed, NOT
    // server_state.dl_info_speed — they're separate aggregates.
    let expected: i64 = HAND_FIXTURE_ROWS.iter().map(|r| r.dlspeed).sum();
    assert_eq!(view.total_dl_speed, expected);
}
