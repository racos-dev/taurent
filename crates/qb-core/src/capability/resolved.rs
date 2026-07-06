//! Resolved server capabilities — all boolean, no tri-state.
//!
//! These represent what the connected qBittorrent server supports. The fields
//! are computed by the [`super::resolver::QbResolver`] from the server's
//! `webapiVersion` against the embedded TOML capability profiles.

use serde::{Deserialize, Serialize};

/// Boolean capability set returned to the Tauri host and renderer.
///
/// Each field represents a single feature category the renderer can toggle
/// behind. Tri-state "unknown" semantics are intentionally not exposed here:
/// the resolver always produces a definite `true`/`false` answer so the
/// renderer doesn't have to thread a third case through its gate logic.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ResolvedCapabilities {
    pub supports_search: bool,
    pub supports_rss: bool,
    pub supports_webseed_management: bool,
}
