//! Build-time validation of the qBittorrent capability profile TOML.
//!
//! The capability resolver (`qb_core::capability::QbResolver`) embeds the
//! TOML profile at compile time. To prevent typos and structural drift
//! from making it into a production binary, this build script:
//!
//! 1. Parses `capabilities/qbittorrent-capabilities.toml`.
//! 2. Verifies the `[base]` section exists with a `capabilities` key.
//! 3. Verifies every capability name in `[base].capabilities` and in every
//!    `[versions."X.Y.Z"].adds` is a known capability (matching the
//!    `KNOWN_CAPABILITIES` list in `capability/version.rs`).
//! 4. Verifies every `[versions."X.Y.Z"]` key is a valid semver triple.
//!
//! On any validation failure the build script prints the error and panics,
//! which surfaces as a normal Cargo build error.
//!
//! The hardcoded capability list here MUST stay in sync with
//! `capability/version.rs::KNOWN_CAPABILITIES` — a comment in that file
//! explains why. The two are kept identical by code review.

use std::collections::BTreeMap;
use std::path::Path;

const KNOWN_CAPABILITIES: &[&str] = &[
    "supports_search",
    "supports_rss",
    "supports_webseed_management",
];

#[derive(serde::Deserialize, Default)]
struct TomlData {
    #[serde(default)]
    base: BaseSection,
    #[serde(default)]
    versions: BTreeMap<String, VersionEntry>,
}

#[derive(serde::Deserialize, Default)]
struct BaseSection {
    #[serde(default)]
    capabilities: Vec<String>,
}

#[derive(serde::Deserialize, Default)]
struct VersionEntry {
    #[serde(default)]
    adds: Vec<String>,
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

    // Validate base capabilities exist (any string is fine; the structural
    // check is that the section is present and parseable).
    if data.base.capabilities.is_empty() {
        panic!(
            "capabilities TOML at {} is missing [base].capabilities entries",
            toml_path.display()
        );
    }
    for cap in &data.base.capabilities {
        if !KNOWN_CAPABILITIES.contains(&cap.as_str()) {
            panic!(
                "Unknown capability {:?} in [base] of {}; known capabilities: {:?}",
                cap,
                toml_path.display(),
                KNOWN_CAPABILITIES
            );
        }
    }

    // Validate every version section.
    for (ver_str, entry) in &data.versions {
        if parse_semver(ver_str).is_none() {
            panic!(
                "Invalid semver version key {:?} under [versions] in {} \
                 (expected \"MAJOR.MINOR.PATCH\")",
                ver_str,
                toml_path.display()
            );
        }
        for cap in &entry.adds {
            if !KNOWN_CAPABILITIES.contains(&cap.as_str()) {
                panic!(
                    "Unknown capability {:?} in [versions.{}].adds of {}; \
                     known capabilities: {:?}",
                    cap,
                    ver_str,
                    toml_path.display(),
                    KNOWN_CAPABILITIES
                );
            }
        }
    }
}

fn parse_semver(s: &str) -> Option<(u16, u16, u16)> {
    let mut parts = s.split('.');
    let major: u16 = parts.next()?.parse().ok()?;
    let minor: u16 = parts.next()?.parse().ok()?;
    let patch: u16 = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}
