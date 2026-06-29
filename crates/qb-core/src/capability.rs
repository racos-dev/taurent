//! Capability resolution types for qBittorrent server features.
//! No Tauri dependencies — pure Rust utilities.

use serde::{Deserialize, Serialize};

/// Tri-state capability: confirmed supported, confirmed unsupported, or unknown/probe-failed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CapabilityState {
    Confirmed,
    Unsupported,
    Unknown,
}

/// Resolved server capabilities.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ResolvedCapabilities {
    pub supports_search: CapabilityState,
    pub supports_rss: CapabilityState,
    pub supports_pause_resume: CapabilityState,
}

/// Parse a version string like "2.11.5" or "4.6.0" into (major, minor, patch). Returns None on malformed input.
pub fn parse_version(v: &str) -> Option<(u32, u32, u32)> {
    let mut parts = v.split('.');
    let major: u32 = parts.next()?.parse().ok()?;
    let minor: u32 = parts.next()?.parse().ok()?;
    let patch: u32 = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

/// Check if api_version meets a minimum threshold (e.g., api_version_meets("2.11.5", 2, 11) → true).
pub fn api_version_meets(api_version: &str, required_major: u32, required_minor: u32) -> bool {
    if let Some((major, minor, _)) = parse_version(api_version) {
        if major > required_major {
            true
        } else if major == required_major {
            minor >= required_minor
        } else {
            false
        }
    } else {
        false
    }
}

/// Resolve capabilities from version strings and probe results.
/// Tri-state probe_ok: Some(true)=Confirmed, Some(false)=Unsupported (probe succeeded but non-2xx),
/// None=Unknown (probe failed — network error, DNS failure, etc.).
/// When app_version is None, all features become Unknown.
pub fn resolve_capabilities(
    api_version: Option<&str>,
    app_version: Option<&str>,
    search_probe_ok: Option<bool>,
    rss_probe_ok: Option<bool>,
) -> ResolvedCapabilities {
    let version_known = app_version.is_some();

    let supports_search = match search_probe_ok {
        Some(true) => CapabilityState::Confirmed,
        Some(false) if version_known => CapabilityState::Unsupported,
        _ => CapabilityState::Unknown,
    };

    let supports_rss = match rss_probe_ok {
        Some(true) => CapabilityState::Confirmed,
        Some(false) if version_known => CapabilityState::Unsupported,
        _ => CapabilityState::Unknown,
    };

    // Pause/resume: Confirmed if api_version_meets(api_version, 2, 11) (qBittorrent v5+),
    // Unsupported if version is known but doesn't meet threshold, Unknown if version is unknown.
    let supports_pause_resume = match api_version {
        Some(v) if api_version_meets(v, 2, 11) => CapabilityState::Confirmed,
        Some(_) => CapabilityState::Unsupported,
        None => CapabilityState::Unknown,
    };

    ResolvedCapabilities {
        supports_search,
        supports_rss,
        supports_pause_resume,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // parse_version tests
    #[test]
    fn test_parse_version_standard() {
        assert_eq!(parse_version("2.11.5"), Some((2, 11, 5)));
        assert_eq!(parse_version("4.6.0"), Some((4, 6, 0)));
    }

    #[test]
    fn test_parse_version_minimal() {
        assert_eq!(parse_version("1.0"), Some((1, 0, 0)));
    }

    #[test]
    fn test_parse_version_empty() {
        assert_eq!(parse_version(""), None);
    }

    #[test]
    fn test_parse_version_malformed_letters() {
        assert_eq!(parse_version("abc"), None);
    }

    #[test]
    fn test_parse_version_too_many_parts() {
        assert_eq!(parse_version("1.2.3.4"), Some((1, 2, 3))); // Extra part is ignored
    }

    #[test]
    fn test_parse_version_partial() {
        // Trailing dot means minor parses ok but patch is empty string which fails
        assert_eq!(parse_version("1.2."), None);
    }

    // api_version_meets tests
    #[test]
    fn test_api_version_meets_exact() {
        assert!(api_version_meets("2.11.5", 2, 11));
    }

    #[test]
    fn test_api_version_meets_greater_minor() {
        assert!(api_version_meets("2.12.0", 2, 11));
    }

    #[test]
    fn test_api_version_meets_greater_major() {
        assert!(api_version_meets("3.0.0", 2, 11));
    }

    #[test]
    fn test_api_version_meets_lesser() {
        assert!(!api_version_meets("2.10.0", 2, 11));
        assert!(!api_version_meets("1.9.0", 2, 11));
    }

    #[test]
    fn test_api_version_meets_unknown() {
        assert!(!api_version_meets("unknown", 2, 11));
    }

    // resolve_capabilities tests
    #[test]
    fn test_resolve_capabilities_probes_ok() {
        let result = resolve_capabilities(Some("2.11.5"), Some("4.6.0"), Some(true), Some(true));
        assert_eq!(result.supports_search, CapabilityState::Confirmed);
        assert_eq!(result.supports_rss, CapabilityState::Confirmed);
        assert_eq!(result.supports_pause_resume, CapabilityState::Confirmed);
    }

    #[test]
    fn test_resolve_capabilities_probes_fail_known_version() {
        let result = resolve_capabilities(Some("2.11.5"), Some("4.6.0"), Some(false), Some(false));
        assert_eq!(result.supports_search, CapabilityState::Unsupported);
        assert_eq!(result.supports_rss, CapabilityState::Unsupported);
        assert_eq!(result.supports_pause_resume, CapabilityState::Confirmed); // API version meets threshold
    }

    #[test]
    fn test_resolve_capabilities_probes_fail_unknown_version() {
        // Probe succeeded (Some(false)=non-2xx) but app_version unknown → Unknown
        let result = resolve_capabilities(None, None, Some(false), Some(false));
        assert_eq!(result.supports_search, CapabilityState::Unknown);
        assert_eq!(result.supports_rss, CapabilityState::Unknown);
        assert_eq!(result.supports_pause_resume, CapabilityState::Unknown);
    }

    #[test]
    fn test_resolve_capabilities_mixed_probes() {
        let result = resolve_capabilities(Some("2.11.5"), Some("4.6.0"), Some(true), Some(false));
        assert_eq!(result.supports_search, CapabilityState::Confirmed);
        assert_eq!(result.supports_rss, CapabilityState::Unsupported);
        assert_eq!(result.supports_pause_resume, CapabilityState::Confirmed);
    }

    #[test]
    fn test_resolve_capabilities_old_api_version() {
        // API version 2.10 doesn't meet the 2.11 threshold
        let result = resolve_capabilities(Some("2.10.0"), Some("4.5.0"), Some(false), Some(false));
        assert_eq!(result.supports_pause_resume, CapabilityState::Unsupported);
    }

    #[test]
    fn test_resolve_capabilities_no_api_version() {
        let result = resolve_capabilities(None, Some("4.6.0"), Some(false), Some(false));
        assert_eq!(result.supports_pause_resume, CapabilityState::Unknown);
    }

    #[test]
    fn test_resolve_capabilities_probe_failed_network_error() {
        // Probe failed (None) → Unknown regardless of version
        let result = resolve_capabilities(Some("2.11.5"), Some("4.6.0"), None, None);
        assert_eq!(result.supports_search, CapabilityState::Unknown);
        assert_eq!(result.supports_rss, CapabilityState::Unknown);
        assert_eq!(result.supports_pause_resume, CapabilityState::Confirmed);
    }

    #[test]
    fn test_resolve_capabilities_probe_failed_with_unknown_version() {
        // Both probe failed and version unknown → all Unknown
        let result = resolve_capabilities(None, None, None, None);
        assert_eq!(result.supports_search, CapabilityState::Unknown);
        assert_eq!(result.supports_rss, CapabilityState::Unknown);
        assert_eq!(result.supports_pause_resume, CapabilityState::Unknown);
    }
}
