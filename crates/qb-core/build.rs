//! Build-time validation of the qBittorrent capability profile TOML.
//!
//! The capability resolver (`qb_core::capability::QbResolver`) embeds the
//! TOML profile at compile time. To prevent typos and structural drift
//! from making it into a production binary, this build script:
//!
//! 1. Parses `capabilities/qbittorrent-capabilities.toml`.
//! 2. Verifies every correction key/value is a valid semver.
//! 3. Verifies every `[versions."X.Y.Z"]` key is a valid semver.
//! 4. Verifies every `[app_versions."vX.Y.Z"]` key strips to a valid semver.
//! 5. Verifies the `app_version` field inside `[versions]` entries — if
//!    present and not `"unreleased"` — strips to a valid semver.
//! 6. Walks each `[versions]` and `[app_versions]` table in semver order
//!    and panics if a `removes` entry targets a capability that was never
//!    `adds`'d (or was already `removes`'d) at an earlier threshold.
//!
//! On any validation failure the build script prints the error and panics,
//! which surfaces as a normal Cargo build error.

use std::collections::{BTreeMap, HashSet};
use std::path::Path;

use serde::Deserialize;

#[derive(Deserialize, Default)]
struct TomlData {
    #[serde(default)]
    corrections: BTreeMap<String, String>,
    #[serde(default)]
    versions: BTreeMap<String, VersionEntry>,
    #[serde(default)]
    app_versions: BTreeMap<String, VersionEntry>,
}

#[derive(Deserialize, Default)]
struct VersionEntry {
    #[serde(default)]
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

fn main() {
    let manifest_dir =
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set by Cargo");
    let toml_path = Path::new(&manifest_dir).join("capabilities/qbittorrent-capabilities.toml");

    // Re-run this build script if the TOML changes.
    println!("cargo:rerun-if-changed=capabilities/qbittorrent-capabilities.toml");

    let toml_text = match std::fs::read_to_string(&toml_path) {
        Ok(text) => text,
        Err(error) => panic!(
            "Failed to read capabilities TOML at {}: {}",
            toml_path.display(),
            error
        ),
    };

    let data: TomlData = match toml::from_str(&toml_text) {
        Ok(data) => data,
        Err(error) => panic!(
            "Failed to parse capabilities TOML at {}: {}",
            toml_path.display(),
            error
        ),
    };

    validate_corrections(&data.corrections, &toml_path);
    validate_versions_table(&data.versions, "versions", &toml_path, parse_lenient_semver);
    validate_versions_table(
        &data.app_versions,
        "app_versions",
        &toml_path,
        parse_app_semver,
    );
    validate_removes_before_adds(&data.versions, "versions", &toml_path, parse_lenient_semver);
    validate_removes_before_adds(
        &data.app_versions,
        "app_versions",
        &toml_path,
        parse_app_semver,
    );
}

/// Validate every key/value in `[corrections]` is a strict semver triple
/// (no missing patch component — corrections only fire on exact match).
fn validate_corrections(corrections: &BTreeMap<String, String>, toml_path: &Path) {
    for (from, to) in corrections {
        if parse_strict_semver(from).is_none() {
            panic!(
                "Invalid semver correction key {:?} in [corrections] of {} \
                 (expected \"MAJOR.MINOR.PATCH\")",
                from,
                toml_path.display()
            );
        }
        if parse_strict_semver(to).is_none() {
            panic!(
                "Invalid semver correction value {:?} for {:?} in [corrections] of {} \
                 (expected \"MAJOR.MINOR.PATCH\")",
                to,
                from,
                toml_path.display()
            );
        }
    }
}

/// Validate every threshold key in a `[versions]`-style table is a valid
/// semver (using `parse_fn` for the key shape — lenient for `[versions]`,
/// v-stripping lenient for `[app_versions]`). Also validates the inner
/// `app_version` metadata field on each entry.
fn validate_versions_table(
    map: &BTreeMap<String, VersionEntry>,
    section: &str,
    toml_path: &Path,
    parse_fn: fn(&str) -> Option<(u16, u16, u16)>,
) {
    for (ver_str, entry) in map {
        if parse_fn(ver_str).is_none() {
            panic!(
                "Invalid semver version key {:?} under [{}] in {} \
                 (expected \"MAJOR.MINOR.PATCH\"{})",
                ver_str,
                section,
                toml_path.display(),
                if section == "app_versions" {
                    ", optionally with a leading 'v'"
                } else {
                    ""
                }
            );
        }

        if !entry.app_version.is_empty()
            && entry.app_version != "unreleased"
            && parse_app_semver(&entry.app_version).is_none()
        {
            panic!(
                "Invalid app_version {:?} under [{}.{}] in {} \
                 (expected \"vMAJOR.MINOR.PATCH\" or \"unreleased\")",
                entry.app_version,
                section,
                ver_str,
                toml_path.display()
            );
        }
    }
}

/// Walk `map` in semver order and panic on any `removes` entry that targets
/// a capability not currently in `active`. This catches the two error modes
/// the resolver cannot otherwise detect:
///
/// - Removing a capability that was never `adds`'d.
/// - Removing a capability that was already `removes`'d at an earlier
///   threshold (i.e. a duplicate remove).
fn validate_removes_before_adds(
    map: &BTreeMap<String, VersionEntry>,
    section: &str,
    toml_path: &Path,
    parse_fn: fn(&str) -> Option<(u16, u16, u16)>,
) {
    // Sort by parsed semver (BTreeMap iterates by key *string*, which puts
    // "10.0.0" before "2.0.0"). `validate_versions_table` already
    // guaranteed every key parses, so `parse_fn` always succeeds here.
    let mut thresholds: Vec<(&str, &VersionEntry)> =
        map.iter().map(|(k, v)| (k.as_str(), v)).collect();
    thresholds.sort_by_key(|(k, _)| parse_fn(k).unwrap());

    let mut active: HashSet<String> = HashSet::new();
    for (ver_str, entry) in thresholds {
        for cap in &entry.removes {
            if !active.contains(&cap.name) {
                panic!(
                    "Capability {:?} is `removes`'d at [{}.{}] in {} \
                     but was never `adds`'d at an earlier threshold. \
                     Every `removes` must match a prior `adds`.",
                    cap.name,
                    section,
                    ver_str,
                    toml_path.display()
                );
            }
        }
        for cap in &entry.removes {
            active.remove(&cap.name);
        }
        for cap in &entry.adds {
            active.insert(cap.name.clone());
        }
    }
}

/// Parse a strict semver triple — all three components must be present.
/// Used for `[corrections]` keys and values, which must 1:1 match the
/// upstream-reported version string.
fn parse_strict_semver(s: &str) -> Option<(u16, u16, u16)> {
    let mut parts = s.split('.');
    let major: u16 = parts.next()?.parse().ok()?;
    let minor: u16 = parts.next()?.parse().ok()?;
    let patch: u16 = parts.next()?.parse().ok()?;
    Some((major, minor, patch))
}

/// Parse a lenient semver — patch defaults to 0 when missing. Matches the
/// resolver's `version::parse_semver` so build-time validation agrees with
/// runtime resolution. Used for `[versions]` keys.
fn parse_lenient_semver(s: &str) -> Option<(u16, u16, u16)> {
    let mut parts = s.split('.');
    let major: u16 = parts.next()?.parse().ok()?;
    let minor: u16 = parts.next()?.parse().ok()?;
    let patch: u16 = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

/// Strip a leading `v` and parse as lenient semver. Used for
/// `[app_versions]` keys and `app_version` metadata fields.
fn parse_app_semver(s: &str) -> Option<(u16, u16, u16)> {
    let stripped = s.strip_prefix('v').unwrap_or(s);
    parse_lenient_semver(stripped)
}
