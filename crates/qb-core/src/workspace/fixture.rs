//! Hand-written fixture of ~20 torrents used by the workspace engine tests.
//!
//! The fixture is intentionally small but covers all edge cases the parity
//! matrix will exercise at scale:
//!
//! - `uncategorized` (`category == Some("")`)
//! - multi-tag torrents (`tags == "a, b"`)
//! - udp / http / https / invalid trackers
//! - CJK + accented torrent names
//! - sentinel numeric fields (`availability < 0`, `eta < 0`, etc.)
//! - every status needed to populate the 12 status buckets

use crate::dto::{MaindataCategoryRow, MaindataServerState, MaindataTorrentRow};
use crate::sync::MaindataSnapshot;

/// One fixture row. `state`, `category`, `tags`, `tracker`, `name` are the
/// hot fields; the rest are sensible defaults.
#[derive(Debug, Clone)]
pub struct FixtureRow {
    pub hash: &'static str,
    pub name: &'static str,
    pub state: &'static str,
    pub category: &'static str,
    pub tags: &'static str,
    pub tracker: &'static str,
    pub availability: Option<f64>,
    pub eta: Option<i64>,
    pub ratio: Option<f64>,
    pub ratio_limit: Option<f64>,
    pub popularity: Option<f64>,
    pub priority: Option<i32>,
    pub force_start: Option<bool>,
    pub dlspeed: i64,
    pub upspeed: i64,
    pub size: i64,
}

impl FixtureRow {
    fn to_row(&self) -> MaindataTorrentRow {
        MaindataTorrentRow {
            hash: Some(self.hash.to_string()),
            name: Some(self.name.to_string()),
            state: Some(self.state.to_string()),
            category: Some(self.category.to_string()),
            tags: Some(self.tags.to_string()),
            tracker: Some(self.tracker.to_string()),
            availability: self.availability,
            eta: self.eta,
            ratio: self.ratio,
            ratio_limit: self.ratio_limit,
            popularity: self.popularity,
            priority: self.priority,
            force_start: self.force_start,
            dlspeed: Some(self.dlspeed),
            upspeed: Some(self.upspeed),
            size: Some(self.size),
            ..Default::default()
        }
    }
}

/// The canonical hand-written fixture.
///
/// Coverage:
///
/// - `f01`–`f12` populate all 12 status buckets (each appears exactly once
///   with the canonical state for that bucket).
/// - `f13` is uncategorized with two tags.
/// - `f14` has CJK + accented name and a `udp://` tracker.
/// - `f15` has `availability < 0`.
/// - `f16` has `eta < 0` and `ratio < 0`.
/// - `f17` has `popularity = None`.
/// - `f18` has an invalid tracker URL.
/// - `f19` has an empty tracker.
/// - `f20` exercises the multi-tag `"a, b"` case.
pub const HAND_FIXTURE_ROWS: &[FixtureRow] = &[
    // Status coverage (f01..f12)
    FixtureRow {
        hash: "f01",
        name: "downloading-torrent",
        state: "downloading",
        category: "docs",
        tags: "",
        tracker: "udp://tracker.example.com:80",
        availability: Some(1.0),
        eta: Some(120),
        ratio: Some(0.5),
        ratio_limit: Some(2.0),
        popularity: Some(100.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 100_000,
        upspeed: 0,
        size: 1_000_000,
    },
    FixtureRow {
        hash: "f02",
        name: "stalled-DL",
        state: "stalledDL",
        category: "docs",
        tags: "stalled",
        tracker: "udp://tracker.example.com:80",
        availability: Some(0.5),
        eta: Some(-1),
        ratio: Some(0.4),
        ratio_limit: Some(-1.0),
        popularity: Some(50.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 1_000_000,
    },
    FixtureRow {
        hash: "f03",
        name: "seeding-torrent",
        state: "uploading",
        category: "videos",
        tags: "linux",
        tracker: "http://tracker.example.com/announce",
        availability: Some(2.0),
        eta: Some(-1),
        ratio: Some(1.5),
        ratio_limit: Some(2.0),
        popularity: Some(200.0),
        priority: Some(0),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 50_000,
        size: 2_000_000,
    },
    FixtureRow {
        hash: "f04",
        name: "stalled-UP",
        state: "stalledUP",
        category: "videos",
        tags: "linux",
        tracker: "http://tracker.example.com/announce",
        availability: Some(1.5),
        eta: Some(-1),
        ratio: Some(1.2),
        ratio_limit: Some(2.0),
        popularity: Some(150.0),
        priority: Some(0),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 2_000_000,
    },
    FixtureRow {
        hash: "f05",
        name: "queued-DL",
        state: "queuedDL",
        category: "music",
        tags: "audio",
        tracker: "https://tracker.example.com/announce",
        availability: Some(0.0),
        eta: Some(60),
        ratio: Some(0.0),
        ratio_limit: Some(-1.0),
        popularity: Some(10.0),
        priority: Some(2),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 500_000,
    },
    FixtureRow {
        hash: "f06",
        name: "queued-UP",
        state: "queuedUP",
        category: "music",
        tags: "audio",
        tracker: "https://tracker.example.com/announce",
        availability: Some(1.0),
        eta: Some(-1),
        ratio: Some(1.0),
        ratio_limit: Some(-1.0),
        popularity: Some(80.0),
        priority: Some(0),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 500_000,
    },
    FixtureRow {
        hash: "f07",
        name: "stopped-DL",
        state: "stoppedDL",
        category: "",
        tags: "paused",
        tracker: "udp://other.example.com:6969",
        availability: Some(0.0),
        eta: Some(-1),
        ratio: Some(0.0),
        ratio_limit: Some(-1.0),
        popularity: Some(20.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 750_000,
    },
    FixtureRow {
        hash: "f08",
        name: "stopped-UP",
        state: "stoppedUP",
        category: "",
        tags: "paused",
        tracker: "udp://other.example.com:6969",
        availability: Some(1.0),
        eta: Some(-1),
        ratio: Some(1.0),
        ratio_limit: Some(-1.0),
        popularity: Some(40.0),
        priority: Some(0),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 750_000,
    },
    FixtureRow {
        hash: "f09",
        name: "forced-DL",
        state: "forcedDL",
        category: "iso",
        tags: "force",
        tracker: "udp://forced.example.com:80",
        availability: Some(1.0),
        eta: Some(30),
        ratio: Some(0.5),
        ratio_limit: Some(2.0),
        popularity: Some(60.0),
        priority: Some(1),
        force_start: Some(true),
        dlspeed: 200_000,
        upspeed: 0,
        size: 4_000_000,
    },
    FixtureRow {
        hash: "f10",
        name: "forced-UP",
        state: "forcedUP",
        category: "iso",
        tags: "force",
        tracker: "udp://forced.example.com:80",
        availability: Some(1.0),
        eta: Some(-1),
        ratio: Some(1.5),
        ratio_limit: Some(2.0),
        popularity: Some(120.0),
        priority: Some(0),
        force_start: Some(true),
        dlspeed: 0,
        upspeed: 100_000,
        size: 4_000_000,
    },
    FixtureRow {
        hash: "f11",
        name: "error-state",
        state: "error",
        category: "iso",
        tags: "broken",
        tracker: "udp://broken.example.com:80",
        availability: Some(0.0),
        eta: Some(-1),
        ratio: Some(0.0),
        ratio_limit: Some(-1.0),
        popularity: None,
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 1_500_000,
    },
    FixtureRow {
        hash: "f12",
        name: "missing-files",
        state: "missingFiles",
        category: "iso",
        tags: "broken",
        tracker: "udp://broken.example.com:80",
        availability: Some(-1.0), // negative sentinel
        eta: Some(-1),
        ratio: Some(-1.0), // negative sentinel
        ratio_limit: Some(-1.0),
        popularity: None, // None sentinel
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 1_500_000,
    },
    // Edge cases (f13..f20)
    FixtureRow {
        hash: "f13",
        name: "uncategorized-two-tags",
        state: "stoppedDL",
        category: "",
        tags: "a, b",
        tracker: "udp://example.com:80",
        availability: Some(0.0),
        eta: Some(-1),
        ratio: Some(0.0),
        ratio_limit: Some(-1.0),
        popularity: Some(5.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 100_000,
    },
    FixtureRow {
        hash: "f14",
        name: "日本語-clef-café", // CJK + accented
        state: "downloading",
        category: "music",
        tags: "world",
        tracker: "udp://国際.example.com:6969",
        availability: Some(1.0),
        eta: Some(45),
        ratio: Some(0.5),
        ratio_limit: Some(2.0),
        popularity: Some(70.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 50_000,
        upspeed: 0,
        size: 800_000,
    },
    FixtureRow {
        hash: "f15",
        name: "availability-negative",
        state: "stalledDL",
        category: "docs",
        tags: "stalled",
        tracker: "udp://tracker.example.com:80",
        availability: Some(-2.0), // negative sentinel
        eta: Some(-1),
        ratio: Some(0.4),
        ratio_limit: Some(2.0),
        popularity: Some(30.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 1_000_000,
    },
    FixtureRow {
        hash: "f16",
        name: "eta-and-ratio-negative",
        state: "downloading",
        category: "docs",
        tags: "",
        tracker: "udp://tracker.example.com:80",
        availability: Some(0.0),
        eta: Some(-1),     // negative sentinel → +Inf for asc
        ratio: Some(-1.0), // negative sentinel
        ratio_limit: Some(-1.0),
        popularity: Some(15.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 25_000,
        upspeed: 0,
        size: 1_000_000,
    },
    FixtureRow {
        hash: "f17",
        name: "popularity-none",
        state: "uploading",
        category: "videos",
        tags: "linux",
        tracker: "http://tracker.example.com/announce",
        availability: Some(1.0),
        eta: Some(-1),
        ratio: Some(1.5),
        ratio_limit: Some(2.0),
        popularity: None, // None → -Inf
        priority: Some(0),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 75_000,
        size: 2_000_000,
    },
    FixtureRow {
        hash: "f18",
        name: "invalid-tracker",
        state: "downloading",
        category: "docs",
        tags: "",
        tracker: "not a real url",
        availability: Some(1.0),
        eta: Some(60),
        ratio: Some(0.5),
        ratio_limit: Some(2.0),
        popularity: Some(25.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 10_000,
        upspeed: 0,
        size: 1_000_000,
    },
    FixtureRow {
        hash: "f19",
        name: "empty-tracker",
        state: "stoppedDL",
        category: "",
        tags: "",
        tracker: "",
        availability: Some(0.0),
        eta: Some(-1),
        ratio: Some(0.0),
        ratio_limit: Some(-1.0),
        popularity: Some(2.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 0,
        upspeed: 0,
        size: 50_000,
    },
    FixtureRow {
        hash: "f20",
        name: "multi-tag",
        state: "downloading",
        category: "docs",
        tags: "linux, audio, 4k",
        tracker: "udp://multi.example.com:80",
        availability: Some(1.0),
        eta: Some(90),
        ratio: Some(0.5),
        ratio_limit: Some(2.0),
        popularity: Some(45.0),
        priority: Some(1),
        force_start: Some(false),
        dlspeed: 75_000,
        upspeed: 0,
        size: 3_000_000,
    },
];

/// Build a `MaindataSnapshot` from `HAND_FIXTURE_ROWS`.
///
/// Includes the category list and the deduped/sorted known-tags list so
/// the engine can run end-to-end.
pub fn build_hand_fixture() -> MaindataSnapshot {
    let mut snap = MaindataSnapshot {
        rid: 42,
        ..Default::default()
    };
    for fr in HAND_FIXTURE_ROWS {
        snap.torrents.insert(fr.hash.to_string(), fr.to_row());
    }

    snap.categories.insert(
        "docs".to_string(),
        MaindataCategoryRow {
            name: Some("docs".to_string()),
            save_path: Some("/data/docs".to_string()),
            ..Default::default()
        },
    );
    snap.categories.insert(
        "videos".to_string(),
        MaindataCategoryRow {
            name: Some("videos".to_string()),
            save_path: Some("/data/videos".to_string()),
            ..Default::default()
        },
    );
    snap.categories.insert(
        "music".to_string(),
        MaindataCategoryRow {
            name: Some("music".to_string()),
            save_path: Some("/data/music".to_string()),
            ..Default::default()
        },
    );
    snap.categories.insert(
        "iso".to_string(),
        MaindataCategoryRow {
            name: Some("iso".to_string()),
            save_path: Some("/data/iso".to_string()),
            ..Default::default()
        },
    );

    // Sort + dedupe known tags across all rows. Mirrors accumulator behavior.
    let mut all_tags: Vec<String> = HAND_FIXTURE_ROWS
        .iter()
        .flat_map(|r| r.tags.split(','))
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(|t| t.to_string())
        .collect();
    all_tags.sort();
    all_tags.dedup();
    snap.tags = all_tags;

    snap.server_state = Some(MaindataServerState::default());

    snap
}
