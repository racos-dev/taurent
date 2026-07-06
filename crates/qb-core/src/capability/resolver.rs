//! Compile-time-embedded qBittorrent Web API capability resolver.
//!
//! Resolves the boolean capability set for a connected server from its
//! `webapiVersion` (webapi-version-keyed caps) and its `appVersion`
//! (app-version-keyed caps), using the cumulative-delta TOML profile embedded
//! at compile time via `include_str!`.
//!
//! Resolution is a two-pass walk over the TOML:
//!
//! 1. **Webapi pass** — `[versions]` entries whose semver threshold is
//!    `version_le(threshold, server_ver)` are applied in key order. Each
//!    entry may declare `adds` (capabilities to enable) and `removes`
//!    (capabilities to disable).
//! 2. **App pass** — same algorithm over `[app_versions]`, but using the
//!    `app_version` parameter (the qBittorrent *application* version, e.g.
//!    `v5.0.0`). If the app version cannot be parsed the app pass is skipped
//!    without erroring the whole resolution.
//!
//! Known upstream `webapiVersion` reporting bugs (e.g. qBittorrent v4.3.0–
//! v4.3.3 reporting "2.7.0" instead of "2.8.0") are corrected before
//! threshold comparison via the `[corrections]` map in the TOML.
//!
//! See the module-level documentation of [`super`] for the high-level design.

use std::collections::{BTreeMap, HashMap};

use serde::Deserialize;

use super::generated::{set_capability, ResolvedCapabilities};
use super::version;

/// Resolver for qBittorrent Web API capabilities.
///
/// Stateless — all methods take the inputs they need to produce a
/// `ResolvedCapabilities`. The TOML profile is embedded at compile time
/// (`include_str!`) so resolution is allocation-light and never touches the
/// filesystem at runtime.
pub struct QbResolver;

impl QbResolver {
    /// Resolve capabilities for the given webapi version + app version pair.
    ///
    /// `webapi_version` is the value returned by `GET /api/v2/app/webapiVersion`.
    /// `app_version` is the value returned by `GET /api/v2/app/version` (with
    /// or without the leading `v`); an unparseable `app_version` simply skips
    /// the app-version pass.
    ///
    /// On webapi-version parse failure (malformed input, empty string) the
    /// default all-false `ResolvedCapabilities` is returned.
    pub fn resolve(webapi_version: &str, app_version: &str) -> ResolvedCapabilities {
        // Embed the TOML profile at compile time. Resolved relative to the
        // crate root via `CARGO_MANIFEST_DIR` so it stays correct regardless
        // of the caller's working directory or the build environment.
        //
        // The TOML is also validated by `crates/qb-core/build.rs`
        // (unknown capability names, malformed version keys, and
        // removes-before-adds violations panic the build), so reaching
        // runtime implies the structure is sound.
        let toml_str = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/capabilities/qbittorrent-capabilities.toml"
        ));
        let toml_data: TomlData = match toml::from_str(toml_str) {
            Ok(data) => data,
            Err(error) => {
                log::error!(
                    "Failed to parse embedded capabilities TOML profile ({}); \
                     returning default all-false capability set",
                    error
                );
                return ResolvedCapabilities::default();
            }
        };

        // Apply known upstream corrections (e.g. "2.7.0" → "2.8.0").
        let corrected = toml_data
            .corrections
            .get(webapi_version)
            .map(String::as_str)
            .unwrap_or(webapi_version);

        let server_ver = match version::parse_semver(corrected) {
            Some(v) => v,
            None => return ResolvedCapabilities::default(),
        };

        // App version is optional — on parse failure we skip the app pass
        // but still return the webapi-only result.
        let app_ver = parse_app_semver(app_version);

        let mut caps = ResolvedCapabilities::default();

        // Pass 1: webapi-version-keyed capabilities.
        apply_version_pass(&toml_data.versions, server_ver, &mut caps);

        // Pass 2: app-version-keyed capabilities.
        if let Some(app_ver) = app_ver {
            apply_version_pass(&toml_data.app_versions, app_ver, &mut caps);
        }

        caps
    }
}

/// Apply all `adds` / `removes` entries from `map` whose semver threshold is
/// `<= target`. Entries are sorted by parsed semver before application so
/// lifecycle deltas remain correct across string-order boundaries like
/// `v5.0.0` and `v10.0.0`.
///
/// Threshold keys are parsed with `parse_app_semver` so both
/// `[versions."X.Y.Z"]` (no prefix) and `[app_versions."vX.Y.Z"]`
/// (v-prefixed) entries resolve correctly.
fn apply_version_pass(
    map: &BTreeMap<String, VersionEntry>,
    target: (u16, u16, u16),
    caps: &mut ResolvedCapabilities,
) {
    let mut entries: Vec<((u16, u16, u16), &VersionEntry)> = Vec::new();
    for (threshold_str, entry) in map {
        let Some(threshold) = parse_app_semver(threshold_str) else {
            // Invalid threshold in TOML — build.rs catches this at compile
            // time, so reaching here means a corrupted binary. Log loudly.
            log::warn!(
                "Ignoring capability profile for non-semver version key {:?}",
                threshold_str
            );
            continue;
        };
        entries.push((threshold, entry));
    }

    entries.sort_by_key(|(threshold, _)| *threshold);

    for (threshold, entry) in entries {
        if !version::version_le(threshold, target) {
            continue;
        }

        for cap in &entry.adds {
            set_capability(caps, &cap.name, true);
        }
        for cap in &entry.removes {
            set_capability(caps, &cap.name, false);
        }
    }
}

/// Strip the leading `v` from an app version string and parse it as semver.
/// Returns `None` on any parse failure — callers treat `None` as "skip the
/// app-version pass".
fn parse_app_semver(v: &str) -> Option<(u16, u16, u16)> {
    let stripped = v.strip_prefix('v').unwrap_or(v);
    version::parse_semver(stripped)
}

#[derive(Deserialize, Default)]
struct TomlData {
    #[serde(default)]
    corrections: HashMap<String, String>,
    #[serde(default)]
    versions: BTreeMap<String, VersionEntry>,
    #[serde(default)]
    app_versions: BTreeMap<String, VersionEntry>,
}

#[derive(Deserialize, Default)]
struct VersionEntry {
    /// Lifecycle metadata — present in the TOML for documentation but not
    /// consumed by the resolver. Surfaced here so it round-trips through
    /// the deserializer without being lost.
    #[serde(default)]
    #[allow(dead_code)]
    app_version: String,
    #[serde(default)]
    adds: Vec<CapEntry>,
    #[serde(default)]
    removes: Vec<CapEntry>,
}

#[derive(Deserialize)]
struct CapEntry {
    name: String,
    #[serde(default)]
    #[allow(dead_code)]
    description: String,
}

#[cfg(test)]
mod tests {
    use super::super::generated::{KNOWN_CAPABILITIES, RESOLVER_TEST_TABLE};
    use super::*;

    #[test]
    fn test_resolve_v20_only_base_caps() {
        // v2.0 hits only the [versions."2.0"] delta: supports_rss +
        // supports_rss_rules.
        let caps = QbResolver::resolve("2.0.0", "");
        assert!(caps.supports_rss);
        assert!(caps.supports_rss_rules);
        assert!(!caps.supports_search);
        assert!(!caps.supports_categories_manage);
    }

    #[test]
    fn test_resolve_v211_cumulative() {
        // v2.1.1 hits the 2.0, 2.1.0, and 2.1.1 deltas: rss + rss_rules +
        // categories_manage + search.
        let caps = QbResolver::resolve("2.1.1", "");
        assert!(caps.supports_rss);
        assert!(caps.supports_rss_rules);
        assert!(caps.supports_categories_manage);
        assert!(caps.supports_search);
        assert!(!caps.supports_tracker_editing);
    }

    #[test]
    fn test_resolve_v270_corrected_to_v280() {
        // v2.7.0 is the qBittorrent v4.3.0–4.3.3 webapiVersion bug.
        // It must be corrected to v2.8.0 which adds folder_renaming.
        let caps = QbResolver::resolve("2.7.0", "");
        assert!(caps.supports_rss);
        assert!(caps.supports_folder_renaming);
        assert!(!caps.supports_metadata_api); // added later at v2.11.9
    }

    #[test]
    fn test_resolve_v216_all_webapi_caps() {
        // v2.16.0 unlocks every webapi-version-keyed capability, including
        // speed_limits_api and file_download.
        let caps = QbResolver::resolve("2.16.0", "");
        assert!(caps.supports_api_key_auth);
        assert!(caps.supports_basic_auth);
        assert!(caps.supports_categories_manage);
        assert!(caps.supports_file_download);
        assert!(caps.supports_file_renaming);
        assert!(caps.supports_folder_renaming);
        assert!(caps.supports_metadata_api);
        assert!(caps.supports_piece_availability);
        assert!(caps.supports_process_info);
        assert!(caps.supports_rss);
        assert!(caps.supports_rss_clone);
        assert!(caps.supports_rss_matching);
        assert!(caps.supports_rss_refresh);
        assert!(caps.supports_rss_rules);
        assert!(caps.supports_search);
        assert!(caps.supports_speed_limits_api);
        assert!(caps.supports_tags);
        assert!(caps.supports_torrent_comments);
        assert!(caps.supports_tracker_editing);
        assert!(caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_v216_with_v4_app_adds_pause_resume() {
        // webapi v2.16.0 + app v4.1.0 → supports_pause_resume comes from
        // the app pass (v4.1.0 adds it).
        let caps = QbResolver::resolve("2.16.0", "v4.1.0");
        assert!(caps.supports_speed_limits_api);
        assert!(caps.supports_file_download);
        assert!(caps.supports_pause_resume);
    }

    #[test]
    fn test_resolve_v216_with_v5_app_removes_pause_resume() {
        // webapi v2.16.0 + app v5.0.0 → supports_pause_resume is added at
        // v4.1.0 but removed at v5.0.0, so it must be off.
        let caps = QbResolver::resolve("2.16.0", "v5.0.0");
        assert!(caps.supports_speed_limits_api);
        assert!(caps.supports_file_download);
        assert!(!caps.supports_pause_resume);
    }

    #[test]
    fn test_apply_version_pass_uses_semver_order_not_string_order() {
        let mut map = BTreeMap::new();
        map.insert(
            "v10.0.0".to_string(),
            VersionEntry {
                removes: vec![CapEntry {
                    name: "supports_pause_resume".to_string(),
                    description: String::new(),
                }],
                ..VersionEntry::default()
            },
        );
        map.insert(
            "v5.0.0".to_string(),
            VersionEntry {
                adds: vec![CapEntry {
                    name: "supports_pause_resume".to_string(),
                    description: String::new(),
                }],
                ..VersionEntry::default()
            },
        );

        let mut caps = ResolvedCapabilities::default();
        apply_version_pass(&map, (10, 0, 0), &mut caps);

        assert!(!caps.supports_pause_resume);
    }

    #[test]
    fn test_resolve_garbage_version_falls_back_to_default() {
        let caps = QbResolver::resolve("not-a-version", "");
        assert_eq!(caps, ResolvedCapabilities::default());
    }

    #[test]
    fn test_resolve_empty_string_falls_back_to_default() {
        let caps = QbResolver::resolve("", "");
        assert_eq!(caps, ResolvedCapabilities::default());
    }

    #[test]
    fn test_resolve_far_future_webapi_enables_every_webapi_cap() {
        // v99.0.0 with no app version: every webapi-version-keyed capability
        // must be on. `supports_pause_resume` is app-version-keyed so it
        // stays false without an app version (the app pass is skipped).
        let caps = QbResolver::resolve("99.0.0", "");
        let mut off: Vec<&str> = Vec::new();
        for name in KNOWN_CAPABILITIES {
            let value = match *name {
                "supports_api_key_auth" => caps.supports_api_key_auth,
                "supports_basic_auth" => caps.supports_basic_auth,
                "supports_categories_manage" => caps.supports_categories_manage,
                "supports_file_download" => caps.supports_file_download,
                "supports_file_renaming" => caps.supports_file_renaming,
                "supports_folder_renaming" => caps.supports_folder_renaming,
                "supports_metadata_api" => caps.supports_metadata_api,
                "supports_pause_resume" => caps.supports_pause_resume,
                "supports_piece_availability" => caps.supports_piece_availability,
                "supports_process_info" => caps.supports_process_info,
                "supports_rss" => caps.supports_rss,
                "supports_rss_clone" => caps.supports_rss_clone,
                "supports_rss_matching" => caps.supports_rss_matching,
                "supports_rss_refresh" => caps.supports_rss_refresh,
                "supports_rss_rules" => caps.supports_rss_rules,
                "supports_search" => caps.supports_search,
                "supports_speed_limits_api" => caps.supports_speed_limits_api,
                "supports_tags" => caps.supports_tags,
                "supports_torrent_comments" => caps.supports_torrent_comments,
                "supports_tracker_editing" => caps.supports_tracker_editing,
                "supports_webseed_management" => caps.supports_webseed_management,
                _ => panic!("unknown capability in KNOWN_CAPABILITIES: {name}"),
            };
            // pause_resume is intentionally off — it's app-version-keyed,
            // and we passed no app version.
            if !value && name != &"supports_pause_resume" {
                off.push(name);
            }
        }
        assert!(
            off.is_empty(),
            "expected every webapi cap to be enabled at v99.0.0, but these were off: {off:?}"
        );
        // Sanity: pause_resume must indeed be off without an app version.
        assert!(!caps.supports_pause_resume);
    }

    #[test]
    fn test_resolve_generated_test_table_matches() {
        // Walk every (version, expected) pair generated alongside the TOML
        // profile. Catches drift between the codegen test fixtures and the
        // resolver logic.
        for (version, expected) in RESOLVER_TEST_TABLE {
            let caps = QbResolver::resolve(version, "");
            for (name, want) in *expected {
                let got = match *name {
                    "supports_api_key_auth" => caps.supports_api_key_auth,
                    "supports_basic_auth" => caps.supports_basic_auth,
                    "supports_categories_manage" => caps.supports_categories_manage,
                    "supports_file_download" => caps.supports_file_download,
                    "supports_file_renaming" => caps.supports_file_renaming,
                    "supports_folder_renaming" => caps.supports_folder_renaming,
                    "supports_metadata_api" => caps.supports_metadata_api,
                    "supports_pause_resume" => caps.supports_pause_resume,
                    "supports_piece_availability" => caps.supports_piece_availability,
                    "supports_process_info" => caps.supports_process_info,
                    "supports_rss" => caps.supports_rss,
                    "supports_rss_clone" => caps.supports_rss_clone,
                    "supports_rss_matching" => caps.supports_rss_matching,
                    "supports_rss_refresh" => caps.supports_rss_refresh,
                    "supports_rss_rules" => caps.supports_rss_rules,
                    "supports_search" => caps.supports_search,
                    "supports_speed_limits_api" => caps.supports_speed_limits_api,
                    "supports_tags" => caps.supports_tags,
                    "supports_torrent_comments" => caps.supports_torrent_comments,
                    "supports_tracker_editing" => caps.supports_tracker_editing,
                    "supports_webseed_management" => caps.supports_webseed_management,
                    other => panic!("unknown capability in test table: {other}"),
                };
                assert_eq!(
                    got, *want,
                    "resolver mismatch for webapi {version:?}: {name:?} expected {want}, got {got}"
                );
            }
        }
    }
}
