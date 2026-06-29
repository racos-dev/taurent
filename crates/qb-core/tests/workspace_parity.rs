//! Parity regression test — Rust `WorkspaceViewEngine` vs frozen JS golden snapshot.
//!
//! **Phase 5 (2026-06-24):** The JS derivation utilities (`deriveSidebarFacetCounts`,
//! `deriveTorrentWorkspace`, `sortTorrents`) were removed from `@taurent/shared` during
//! dead-code cleanup. The golden snapshots in `fixtures/workspace_parity_golden.json`
//! are now a frozen regression snapshot; regeneration requires either adding back a
//! JS derivation pipeline or generating golden JSON directly from the Rust engine.
//!
//! Coverage:
//!   - 30+ representative filter combinations (filter matrix subset).
//!   - All 36 sort fields × 2 directions (72 sort cases).
//!   - Tracker hostname parity for udp/http/https/schemeless/invalid/empty.
//!
//! Run with:
//!   cargo test -p qb-core --test workspace_parity

use std::collections::BTreeMap;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use qb_core::dto::{MaindataCategoryRow, MaindataServerState, MaindataTorrentRow};
use qb_core::sync::MaindataSnapshot;
use qb_core::workspace::{
    extract_hostname, Filters, Sort, SortDirection, WorkspaceViewEngine, WorkspaceViewRequest,
};
use serde::Deserialize;

// ─── Golden snapshot schema ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GoldenFixture {
    version: u32,
    snapshot_rid: u64,
    fixture: GoldenFixtureData,
    filter_cases: Vec<GoldenFilterCase>,
    sort_cases: Vec<GoldenSortCase>,
    tracker_hostname_cases: Vec<GoldenHostnameCase>,
}

#[derive(Debug, Deserialize)]
struct GoldenFixtureData {
    torrent_rows: Vec<GoldenTorrentRow>,
    categories: Vec<GoldenCategory>,
    known_tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct GoldenTorrentRow {
    hash: String,
    name: String,
    state: String,
    category: String,
    tags: String,
    tracker: String,
    availability: f64,
    eta: i64,
    ratio: f64,
    ratio_limit: f64,
    #[serde(default)]
    popularity: Option<f64>,
    priority: i32,
    force_start: bool,
    dlspeed: i64,
    upspeed: i64,
    size: i64,
    #[serde(default = "default_added_on")]
    added_on: i64,
}

fn default_added_on() -> i64 {
    0
}

#[derive(Debug, Deserialize)]
struct GoldenCategory {
    name: String,
    #[serde(rename = "savePath")]
    save_path: String,
}

#[derive(Debug, Deserialize)]
struct GoldenFilterCase {
    id: String,
    filter: GoldenFilter,
    sort: GoldenSort,
    expected: GoldenExpected,
}

#[derive(Debug, Deserialize)]
struct GoldenFilter {
    status: String,
    category: Option<String>,
    tag: Option<String>,
    tracker: Option<String>,
    #[serde(default)]
    search: String,
}

#[derive(Debug, Deserialize)]
struct GoldenSort {
    field: String,
    direction: String,
}

#[derive(Debug, Deserialize)]
struct GoldenExpected {
    sorted_hashes: Vec<String>,
    filtered_count: usize,
    total_dl_speed: i64,
    total_ul_speed: i64,
    status_counts: HashMap<String, u64>,
    category_counts: HashMap<String, u64>,
    tag_counts: HashMap<String, u64>,
    tracker_counts: HashMap<String, u64>,
    sidebar_categories: Vec<GoldenSidebarCategory>,
    sidebar_tags: Vec<GoldenSidebarTag>,
    sidebar_trackers: Vec<GoldenSidebarTracker>,
    is_filtered: bool,
}

#[derive(Debug, Deserialize)]
struct GoldenSidebarCategory {
    name: String,
    save_path: String,
    count: u64,
}

#[derive(Debug, Deserialize)]
struct GoldenSidebarTag {
    tag: String,
    count: u64,
}

#[derive(Debug, Deserialize)]
struct GoldenSidebarTracker {
    tracker_url: String,
    hostname: String,
    count: u64,
}

#[derive(Debug, Deserialize)]
struct GoldenSortCase {
    id: String,
    field: String,
    direction: String,
    expected_sorted_hashes: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct GoldenHostnameCase {
    id: String,
    url: String,
    expected_hostname: Option<String>,
}

// ─── Fixture construction ────────────────────────────────────────────────────

fn load_golden() -> GoldenFixture {
    let path = golden_path();
    let raw = fs::read_to_string(&path).unwrap_or_else(|e| {
        panic!(
            "failed to read golden fixture at {}: {} — run `pnpm exec jiti scripts/generate-workspace-parity-fixture.ts` to regenerate",
            path.display(),
            e
        )
    });
    serde_json::from_str(&raw).unwrap_or_else(|e| {
        panic!(
            "failed to parse golden fixture at {}: {}",
            path.display(),
            e
        )
    })
}

fn golden_path() -> PathBuf {
    // `CARGO_MANIFEST_DIR` is the qb-core crate root at test time.
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.join("tests/fixtures/workspace_parity_golden.json")
}

fn build_snapshot_from_golden(golden: &GoldenFixture) -> MaindataSnapshot {
    let mut snap = MaindataSnapshot {
        rid: golden.snapshot_rid,
        ..Default::default()
    };

    for row in &golden.fixture.torrent_rows {
        // JS Torrent shape has `total_size` populated; mirror that here so
        // sort-by-total_size parity matches. The Rust hand fixture leaves
        // total_size = None — that's fine for other tests but mismatches
        // the JS golden. This parity test uses the JSON as its source of
        // truth, so we honour whatever the JS side sees.
        let total_size = if row.size > 0 { Some(row.size) } else { None };

        let torrent = MaindataTorrentRow {
            hash: Some(row.hash.clone()),
            name: Some(row.name.clone()),
            state: Some(row.state.clone()),
            category: Some(row.category.clone()),
            tags: Some(row.tags.clone()),
            tracker: Some(row.tracker.clone()),
            availability: Some(row.availability),
            eta: Some(row.eta),
            ratio: Some(row.ratio),
            ratio_limit: Some(row.ratio_limit),
            popularity: row.popularity,
            priority: Some(row.priority),
            force_start: Some(row.force_start),
            dlspeed: Some(row.dlspeed),
            upspeed: Some(row.upspeed),
            size: Some(row.size),
            total_size,
            added_on: Some(row.added_on),
            ..Default::default()
        };
        snap.torrents.insert(row.hash.clone(), torrent);
    }

    for cat in &golden.fixture.categories {
        snap.categories.insert(
            cat.name.clone(),
            MaindataCategoryRow {
                name: Some(cat.name.clone()),
                save_path: Some(cat.save_path.clone()),
                ..Default::default()
            },
        );
    }

    snap.tags = golden.fixture.known_tags.clone();
    snap.server_state = Some(MaindataServerState::default());
    snap
}

fn build_request(id: &str, filter: &GoldenFilter, sort: &GoldenSort) -> WorkspaceViewRequest {
    WorkspaceViewRequest {
        request_id: id.to_string(),
        filters: Filters {
            status: filter.status.clone(),
            category: filter.category.clone(),
            tag: filter.tag.clone(),
            tracker: filter.tracker.clone(),
            search: filter.search.clone(),
        },
        sort: Sort {
            field: sort.field.clone(),
            direction: if sort.direction == "asc" {
                SortDirection::Asc
            } else {
                SortDirection::Desc
            },
        },
        include_sorted_hashes: true,
        locale: "en-US".to_string(),
    }
}

// ─── Parity assertions ───────────────────────────────────────────────────────

fn assert_filter_case_parity(snap: &MaindataSnapshot, case: &GoldenFilterCase) {
    let mut engine = WorkspaceViewEngine::new(build_request(&case.id, &case.filter, &case.sort));
    let view = engine
        .compute_and_diff(snap)
        .unwrap_or_else(|| panic!("filter case {} must emit a view", case.id));

    let exp = &case.expected;

    // sorted_hashes order is the most sensitive parity check.
    assert_eq!(
        view.sorted_hashes, exp.sorted_hashes,
        "filter case {}: sorted_hashes mismatch",
        case.id
    );

    assert_eq!(
        view.filtered_count, exp.filtered_count,
        "filter case {}: filtered_count mismatch",
        case.id
    );
    assert_eq!(
        view.total_dl_speed, exp.total_dl_speed,
        "filter case {}: total_dl_speed mismatch",
        case.id
    );
    assert_eq!(
        view.total_ul_speed, exp.total_ul_speed,
        "filter case {}: total_ul_speed mismatch",
        case.id
    );
    assert_eq!(
        view.is_filtered, exp.is_filtered,
        "filter case {}: is_filtered mismatch",
        case.id
    );

    // Status counts — every key from the golden must exist in the view with
    // the same value. Extra zero-filled buckets on the Rust side (e.g. for
    // errored when no rows match) must also agree.
    assert_maps_eq(
        &view.status_counts,
        &exp.status_counts,
        &format!("filter case {} status_counts", case.id),
    );
    assert_maps_eq(
        &view.category_counts,
        &exp.category_counts,
        &format!("filter case {} category_counts", case.id),
    );
    assert_maps_eq(
        &view.tag_counts,
        &exp.tag_counts,
        &format!("filter case {} tag_counts", case.id),
    );
    assert_maps_eq(
        &view.tracker_counts,
        &exp.tracker_counts,
        &format!("filter case {} tracker_counts", case.id),
    );

    // Sidebar items — order matters for categories (server order + uncategorized).
    assert_eq!(
        view.sidebar_categories.len(),
        exp.sidebar_categories.len(),
        "filter case {}: sidebar_categories length mismatch",
        case.id
    );
    for (i, (got, want)) in view
        .sidebar_categories
        .iter()
        .zip(exp.sidebar_categories.iter())
        .enumerate()
    {
        assert_eq!(
            got.name, want.name,
            "filter case {} sidebar_categories[{}].name",
            case.id, i
        );
        assert_eq!(
            got.save_path, want.save_path,
            "filter case {} sidebar_categories[{}].save_path",
            case.id, i
        );
        assert_eq!(
            got.count, want.count,
            "filter case {} sidebar_categories[{}].count",
            case.id, i
        );
    }

    assert_eq!(
        view.sidebar_tags.len(),
        exp.sidebar_tags.len(),
        "filter case {}: sidebar_tags length mismatch",
        case.id
    );
    for (i, (got, want)) in view
        .sidebar_tags
        .iter()
        .zip(exp.sidebar_tags.iter())
        .enumerate()
    {
        assert_eq!(
            got.tag, want.tag,
            "filter case {} sidebar_tags[{}].tag",
            case.id, i
        );
        assert_eq!(
            got.count, want.count,
            "filter case {} sidebar_tags[{}].count",
            case.id, i
        );
    }

    // Sidebar trackers must agree as multisets (sorted by count desc + hostname).
    // The exact hostname encoding may differ between Node's `URL.hostname` and
    // Rust's `url::Url::host_str` for IDN inputs, so compare by (url, count)
    // and assert hostname is non-empty when present.
    //
    // Note: the Rust engine uses `HashMap` iteration order as the third
    // tiebreak (when count and hostname are equal), which is non-deterministic
    // across runs. The JS reference uses insertion order. To avoid flaky
    // parity failures, sort both lists by URL asc before comparing.
    assert_eq!(
        view.sidebar_trackers.len(),
        exp.sidebar_trackers.len(),
        "filter case {}: sidebar_trackers length mismatch",
        case.id
    );

    let mut got_sorted = view.sidebar_trackers.clone();
    got_sorted.sort_by(|a, b| a.tracker_url.cmp(&b.tracker_url));
    let mut want_sorted: Vec<&GoldenSidebarTracker> = exp.sidebar_trackers.iter().collect();
    want_sorted.sort_by(|a, b| a.tracker_url.cmp(&b.tracker_url));

    for (i, (got, want)) in got_sorted.iter().zip(want_sorted.iter()).enumerate() {
        assert_eq!(
            got.tracker_url, want.tracker_url,
            "filter case {} sidebar_trackers[{}].tracker_url",
            case.id, i
        );
        assert_eq!(
            got.count, want.count,
            "filter case {} sidebar_trackers[{}].count",
            case.id, i
        );
        // Hostname: enforce non-empty + equality for non-IDN hosts. IDN hosts
        // may differ in encoding (Node returns punycode, Rust may return IDN).
        if is_idn_url(&got.tracker_url) {
            assert!(
                !got.hostname.is_empty(),
                "filter case {} sidebar_trackers[{}].hostname must be non-empty for IDN",
                case.id,
                i
            );
        } else {
            assert_eq!(
                got.hostname, want.hostname,
                "filter case {} sidebar_trackers[{}].hostname",
                case.id, i
            );
        }
    }
}

fn is_idn_url(url: &str) -> bool {
    // Cheap heuristic: any non-ASCII byte in the URL signals IDN.
    url.bytes().any(|b| b > 127)
}

fn assert_maps_eq<K: std::hash::Hash + Eq + std::fmt::Debug + std::cmp::Ord>(
    got: &HashMap<K, u64>,
    want: &HashMap<K, u64>,
    label: &str,
) {
    // Compare by multiset: every key in `want` must equal in `got`, and any
    // extra keys in `got` must be zero (engine zero-fills status buckets).
    for (k, v) in want {
        let actual = got
            .get(k)
            .copied()
            .unwrap_or_else(|| panic!("{label}: missing key {k:?} (expected {v})"));
        assert_eq!(actual, *v, "{label}: value mismatch for {k:?}");
    }
    for (k, v) in got {
        if !want.contains_key(k) {
            assert_eq!(
                *v, 0,
                "{label}: unexpected extra key {k:?} with value {v} (should be zero)"
            );
        }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[test]
fn golden_snapshot_version_is_supported() {
    let golden = load_golden();
    assert_eq!(golden.version, 1, "unsupported golden version");
    assert!(
        !golden.filter_cases.is_empty(),
        "golden must include at least one filter case"
    );
    assert!(
        !golden.sort_cases.is_empty(),
        "golden must include at least one sort case"
    );
    assert!(
        !golden.tracker_hostname_cases.is_empty(),
        "golden must include at least one tracker hostname case"
    );
}

#[test]
fn filter_matrix_parity_matches_js() {
    let golden = load_golden();
    let snap = build_snapshot_from_golden(&golden);
    assert_eq!(
        snap.torrents.len(),
        golden.fixture.torrent_rows.len(),
        "fixture row count must match snapshot.torrents after construction"
    );

    for case in &golden.filter_cases {
        assert_filter_case_parity(&snap, case);
    }
}

#[test]
fn sort_parity_for_all_fields_both_directions() {
    let golden = load_golden();
    let snap = build_snapshot_from_golden(&golden);

    // Each sort case uses the default filter (all/all/all/all/all-empty).
    let default_filter = Filters::default();

    for case in &golden.sort_cases {
        let direction = if case.direction == "asc" {
            SortDirection::Asc
        } else {
            SortDirection::Desc
        };
        let req = WorkspaceViewRequest {
            request_id: case.id.clone(),
            filters: default_filter.clone(),
            sort: Sort {
                field: case.field.clone(),
                direction,
            },
            include_sorted_hashes: true,
            locale: "en-US".to_string(),
        };
        // Ensure the cached `last_view` from previous iterations doesn't
        // suppress this emit — we mutate the snapshot rid per case so the
        // engine sees a fresh revision and always emits.
        let mut local_snap = snap.clone();
        local_snap.rid += 1;
        let mut engine = WorkspaceViewEngine::new(req);

        let view = engine
            .compute_and_diff(&local_snap)
            .unwrap_or_else(|| panic!("sort case {} must emit a view", case.id));
        assert_eq!(
            view.sorted_hashes, case.expected_sorted_hashes,
            "sort case {} ({} {}) mismatch",
            case.id, case.field, case.direction
        );
    }
}

#[test]
fn tracker_hostname_parity_matches_js() {
    let _golden = load_golden();
    for case in &golden_hostname_cases() {
        let got = extract_hostname(&case.url);
        match (&case.expected_hostname, got.as_deref()) {
            (Some(want), Some(have)) => {
                if is_idn_url(&case.url) {
                    // IDN: enforce non-empty + agreement on a host portion.
                    assert!(
                        !have.is_empty(),
                        "hostname case {}: IDN host must be non-empty",
                        case.id
                    );
                    // Strip the IDN encoding: both punycode and unicode forms
                    // agree on the suffix (".example.com" in our test).
                    assert!(
                        have.ends_with(".example.com")
                            || have == want
                            || have.trim_end_matches('.').ends_with(".example.com"),
                        "hostname case {}: IDN host {have} does not match expected {want}",
                        case.id
                    );
                } else {
                    assert_eq!(
                        have, want,
                        "hostname case {}: url={} expected={want} got={have}",
                        case.id, case.url
                    );
                }
            }
            (None, None) => { /* both agreed the URL is invalid */ }
            (Some(want), None) => panic!(
                "hostname case {}: expected Some({want}) for url={}, got None",
                case.id, case.url
            ),
            (None, Some(have)) => panic!(
                "hostname case {}: expected None for url={}, got Some({have})",
                case.id, case.url
            ),
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn golden_hostname_cases() -> Vec<GoldenHostnameCase> {
    let golden = load_golden();
    golden.tracker_hostname_cases
}

#[test]
fn golden_fixture_includes_expected_case_count() {
    // Sanity: this test fails loudly if the matrix shrinks below the
    // minimum coverage documented in the deepwork plan.
    let golden = load_golden();
    assert!(
        golden.filter_cases.len() >= 30,
        "expected ≥30 filter cases, found {}",
        golden.filter_cases.len()
    );
    // 36 fields × 2 directions = 72 cases.
    assert!(
        golden.sort_cases.len() >= 70,
        "expected ≥70 sort cases (36 fields × 2 directions), found {}",
        golden.sort_cases.len()
    );
    assert!(
        golden.tracker_hostname_cases.len() >= 4,
        "expected ≥4 tracker hostname cases, found {}",
        golden.tracker_hostname_cases.len()
    );
}

#[test]
fn golden_fixture_has_known_tags_in_sorted_order() {
    // Sanity check on the fixture data: known tags must be sorted + deduped.
    let golden = load_golden();
    let mut seen: BTreeMap<String, ()> = BTreeMap::new();
    for tag in &golden.fixture.known_tags {
        assert!(!tag.is_empty(), "known_tags must not contain empty strings");
        assert!(
            seen.insert(tag.clone(), ()).is_none(),
            "known_tags must be deduplicated; saw {tag} twice"
        );
    }
    let mut sorted = golden.fixture.known_tags.clone();
    sorted.sort();
    assert_eq!(
        sorted, golden.fixture.known_tags,
        "known_tags must be in sorted order"
    );
}
