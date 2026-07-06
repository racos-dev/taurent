//! Version-parsing helpers for the qBittorrent Web API capability resolver.
//!
//! All version comparisons in this module use `(u16, u16, u16)` tuples to keep
//! the math simple and predictable. Patch is treated as the tie-breaker.

/// Canonical list of capabilities recognised by the resolver.
///
/// This list is the single source of truth used by both the runtime resolver
/// (`resolver.rs`) and the `build.rs` validator to detect unknown capability
/// names in the embedded TOML profiles.
pub const KNOWN_CAPABILITIES: &[&str] = &[
    "supports_search",
    "supports_rss",
    "supports_webseed_management",
];

/// Parse a semantic-version string like "2.16.0" or "2.7.0" into
/// `(major, minor, patch)`. Returns `None` on malformed input.
///
/// Missing patch component is treated as 0 (e.g. "2.7" → (2, 7, 0)).
/// Extra components are ignored.
pub fn parse_semver(s: &str) -> Option<(u16, u16, u16)> {
    let mut parts = s.split('.');
    let major: u16 = parts.next()?.parse().ok()?;
    let minor: u16 = parts.next()?.parse().ok()?;
    let patch: u16 = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

/// Returns `true` if version `a` is less than or equal to version `b`.
pub fn version_le(a: (u16, u16, u16), b: (u16, u16, u16)) -> bool {
    a.0 < b.0 || (a.0 == b.0 && a.1 < b.1) || (a.0 == b.0 && a.1 == b.1 && a.2 <= b.2)
}

/// Apply hardcoded version corrections for known-upstream qBittorrent
/// webapiVersion bugs.
///
/// qBittorrent v4.3.0–v4.3.3 misreported `webapiVersion` as "2.7.0" when the
/// real version was "2.8.0". When the server reports "2.7.0", resolve
/// capabilities as if it had reported "2.8.0".
pub fn correct_version(v: &str) -> &str {
    if v == "2.7.0" {
        "2.8.0"
    } else {
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_semver_standard() {
        assert_eq!(parse_semver("2.16.0"), Some((2, 16, 0)));
        assert_eq!(parse_semver("2.7.0"), Some((2, 7, 0)));
        assert_eq!(parse_semver("2.1.1"), Some((2, 1, 1)));
    }

    #[test]
    fn test_parse_semver_missing_patch() {
        // Missing patch defaults to 0
        assert_eq!(parse_semver("2.7"), Some((2, 7, 0)));
    }

    #[test]
    fn test_parse_semver_empty() {
        assert_eq!(parse_semver(""), None);
    }

    #[test]
    fn test_parse_semver_malformed() {
        assert_eq!(parse_semver("abc"), None);
        assert_eq!(parse_semver("2.x.0"), None);
        assert_eq!(parse_semver("2.7."), None);
    }

    #[test]
    fn test_parse_semver_extra_components_ignored() {
        assert_eq!(parse_semver("1.2.3.4"), Some((1, 2, 3)));
    }

    #[test]
    fn test_version_le_equal() {
        assert!(version_le((2, 7, 0), (2, 7, 0)));
    }

    #[test]
    fn test_version_le_lower() {
        assert!(version_le((2, 0, 0), (2, 7, 0)));
        assert!(version_le((1, 9, 9), (2, 0, 0)));
        assert!(version_le((2, 7, 0), (2, 7, 1)));
    }

    #[test]
    fn test_version_le_greater() {
        assert!(!version_le((2, 7, 0), (2, 6, 99)));
        assert!(!version_le((3, 0, 0), (2, 99, 99)));
    }

    #[test]
    fn test_correct_version_v270_maps_to_280() {
        assert_eq!(correct_version("2.7.0"), "2.8.0");
    }

    #[test]
    fn test_correct_version_passthrough() {
        assert_eq!(correct_version("2.0.0"), "2.0.0");
        assert_eq!(correct_version("2.8.0"), "2.8.0");
        assert_eq!(correct_version("2.16.0"), "2.16.0");
    }

    #[test]
    fn test_known_capabilities_complete() {
        // Guard against accidental drift between this list and the
        // TOML profiles. If a capability is added, both must be updated.
        assert!(KNOWN_CAPABILITIES.contains(&"supports_search"));
        assert!(KNOWN_CAPABILITIES.contains(&"supports_rss"));
        assert!(KNOWN_CAPABILITIES.contains(&"supports_webseed_management"));
    }
}
