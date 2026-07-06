//! Compile-time-embedded qBittorrent Web API capability resolver.
//!
//! Resolves the boolean capability set for a connected server from its
//! `webapiVersion` string, using the cumulative-delta TOML profile embedded
//! at compile time via `include_str!`.
//!
//! See the module-level documentation of [`super`] for the high-level design.

use std::collections::BTreeMap;

use serde::Deserialize;

use super::resolved::ResolvedCapabilities;
use super::version;

/// Resolver for qBittorrent Web API capabilities.
///
/// Stateless — all methods take the inputs they need to produce a
/// `ResolvedCapabilities`. The TOML profile is embedded at compile time
/// (`include_str!`) so resolution is allocation-light and never touches the
/// filesystem at runtime.
pub struct QbResolver;

impl QbResolver {
    /// Resolve capabilities for the given webapi version string.
    ///
    /// On version-parse failure (e.g. malformed input, empty string) the
    /// default all-false `ResolvedCapabilities` is returned. Callers in
    /// `qb-tauri` additionally apply a "2.0" base-profile fallback when the
    /// upstream `webapiVersion` request itself fails, which is a *fetch*
    /// failure rather than a parse failure.
    pub fn resolve(webapi_version: &str) -> ResolvedCapabilities {
        let corrected = version::correct_version(webapi_version);
        let server_ver = match version::parse_semver(corrected) {
            Some(v) => v,
            None => return ResolvedCapabilities::default(),
        };

        // Embed the TOML profile at compile time. Resolved relative to the
        // crate root via `CARGO_MANIFEST_DIR` so it stays correct regardless
        // of the caller's working directory or the build environment.
        //
        // The TOML is also validated by `crates/qb-core/build.rs`
        // (unknown capability names and malformed version keys panic the
        // build), so reaching runtime implies the structure is sound.
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

        let mut caps = ResolvedCapabilities::default();

        // Apply base capabilities
        for cap in &toml_data.base.capabilities {
            set_capability(&mut caps, cap, true);
        }

        // Accumulate version deltas where version_threshold <= server_version
        for (ver_str, version_entry) in &toml_data.versions {
            if let Some(threshold_ver) = version::parse_semver(ver_str) {
                if version::version_le(threshold_ver, server_ver) {
                    for cap in &version_entry.adds {
                        set_capability(&mut caps, cap, true);
                    }
                }
            } else {
                // Invalid threshold in TOML — build.rs catches this at compile
                // time, so reaching here means a corrupted binary. Log loudly.
                log::warn!(
                    "Ignoring capability profile for non-semver version key {:?}",
                    ver_str
                );
            }
        }

        caps
    }
}

/// Resolve the qBittorrent webapi version at which `webseed_management`
/// (i.e. the `/api/v2/torrents/addWebSeeds` family of endpoints) became
/// available.
///
/// Today this is a documentation/observability helper used by callers that
/// want to surface a human-readable "supported since X.Y.Z" string. Returns
/// a `'static str` because the underlying set of version thresholds is
/// defined statically in the TOML profile.
pub fn resolve_webseed_management_version() -> &'static str {
    // Conservative: webseed_management was added in the same release window
    // as search, both gated by the v2.1.1 webapi delta. Hardcoding the
    // version string here keeps the function independent of the TOML parser
    // for callers that only need a label.
    "2.1.1"
}

fn set_capability(caps: &mut ResolvedCapabilities, name: &str, value: bool) {
    match name {
        "supports_search" => caps.supports_search = value,
        "supports_rss" => caps.supports_rss = value,
        "supports_webseed_management" => caps.supports_webseed_management = value,
        // Unknown capabilities are ignored — the build.rs validator catches
        // typos at compile time, so anything that reaches here is benign.
        _ => {}
    }
}

#[derive(Deserialize, Default)]
struct TomlData {
    #[serde(default)]
    base: BaseSection,
    #[serde(default)]
    versions: BTreeMap<String, VersionEntry>,
}

#[derive(Deserialize, Default)]
struct BaseSection {
    #[serde(default)]
    capabilities: Vec<String>,
}

#[derive(Deserialize, Default)]
struct VersionEntry {
    #[serde(default)]
    adds: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_base_only_v20() {
        // v2.0 hits only the [base] profile: only supports_rss.
        let caps = QbResolver::resolve("2.0.0");
        assert!(caps.supports_rss);
        assert!(!caps.supports_search);
        assert!(!caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_v20_minor_only() {
        // v2.0 (no patch) still hits only the base profile.
        let caps = QbResolver::resolve("2.0");
        assert!(caps.supports_rss);
        assert!(!caps.supports_search);
        assert!(!caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_v211_enables_all() {
        // v2.1.1 unlocks search + webseed_management, RSS was already on.
        let caps = QbResolver::resolve("2.1.1");
        assert!(caps.supports_rss);
        assert!(caps.supports_search);
        assert!(caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_v270_corrected_to_v280() {
        // v2.7.0 is the qBittorrent v4.3.0–4.3.3 webapiVersion bug.
        // It must be corrected to v2.8.0 which still has all 3 capabilities.
        let caps = QbResolver::resolve("2.7.0");
        assert!(caps.supports_rss);
        assert!(caps.supports_search);
        assert!(caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_v210_below_v211_threshold() {
        // v2.1.0 is below the v2.1.1 threshold — search and webseed are off.
        let caps = QbResolver::resolve("2.1.0");
        assert!(caps.supports_rss);
        assert!(!caps.supports_search);
        assert!(!caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_v216_high_version() {
        // v2.16.0 is well past every threshold — all capabilities on.
        let caps = QbResolver::resolve("2.16.0");
        assert!(caps.supports_rss);
        assert!(caps.supports_search);
        assert!(caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_garbage_version_falls_back_to_default() {
        // Unparseable input → all-false default.
        let caps = QbResolver::resolve("not-a-version");
        assert_eq!(caps, ResolvedCapabilities::default());
        assert!(!caps.supports_rss);
        assert!(!caps.supports_search);
        assert!(!caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_empty_string_falls_back_to_default() {
        // Empty string also unparseable.
        let caps = QbResolver::resolve("");
        assert_eq!(caps, ResolvedCapabilities::default());
    }

    #[test]
    fn test_resolve_v200_applies_only_base() {
        // v2.0.0 explicitly only enables RSS.
        let caps = QbResolver::resolve("2.0.0");
        assert!(caps.supports_rss);
        assert!(!caps.supports_search);
        assert!(!caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_far_future_major() {
        // Far-future major version still includes the cumulative deltas.
        let caps = QbResolver::resolve("99.0.0");
        assert!(caps.supports_rss);
        assert!(caps.supports_search);
        assert!(caps.supports_webseed_management);
    }

    #[test]
    fn test_resolve_webseed_management_version_label() {
        assert_eq!(resolve_webseed_management_version(), "2.1.1");
    }
}
