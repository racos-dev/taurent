//! qBittorrent Web API capability resolution.
//!
//! This module replaces the previous HTTP-probing-based `CapabilityState`
//! tri-state resolution with a compile-time-embedded TOML version profile
//! model. The design is:
//!
//! - **Compile-time data**: a single TOML file
//!   (`capabilities/qbittorrent-capabilities.toml`) is embedded into the
//!   binary via `include_str!` and validated by `build.rs`.
//! - **Cumulative deltas**: the TOML file declares per-threshold entries
//!   (`[versions."X.Y.Z"]`, `[app_versions."vX.Y.Z"]`) that add or remove
//!   capabilities as the corresponding version advances.
//! - **Two-pass resolution**: [`resolver::QbResolver::resolve`] walks the
//!   webapi-version entries first, then the app-version entries. Each pass
//!   applies `adds` (set true) and `removes` (set false) for every threshold
//!   `<= target`.
//! - **Boolean output**: resolution produces a `ResolvedCapabilities` with
//!   plain `bool` fields (no tri-state) so the renderer can use the
//!   capabilities directly as feature gates.
//! - **Hardcoded corrections**: known upstream `webapiVersion` reporting
//!   bugs (e.g. qBittorrent v4.3.0–v4.3.3 reporting "2.7.0" instead of
//!   "2.8.0") are corrected via the `[corrections]` map at parse time.
//!
//! Resolution flow (called from `qb-tauri` after a successful login):
//!
//! 1. Fetch `GET /api/v2/app/webapiVersion` and `GET /api/v2/app/version`.
//! 2. On success: call
//!    [`resolver::QbResolver::resolve`]`(webapi_version, app_version)`.
//! 3. On failure: fall back to the "2.0" base profile so the user still
//!    sees `supports_rss` and nothing else.
//! 4. Store the resulting `ResolvedCapabilities` and the raw version strings
//!    on the `SessionState`.
//!
//! `supports_pause_resume` follows the qBittorrent app release lifecycle:
//! added in `[app_versions."v4.1.0"]` and removed in
//! `[app_versions."v5.0.0"]`.

pub mod generated;
pub mod resolver;
pub mod version;

pub use generated::ResolvedCapabilities;
pub use resolver::QbResolver;
