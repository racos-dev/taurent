//! qBittorrent Web API capability resolution.
//!
//! This module replaces the previous HTTP-probing-based `CapabilityState`
//! tri-state resolution with a compile-time-embedded TOML version profile
//! model. The design is:
//!
//! - **Compile-time data**: a single TOML file
//!   (`capabilities/qbittorrent-capabilities.toml`) is embedded into the
//!   binary via `include_str!` and validated by `build.rs`.
//! - **Cumulative deltas**: the TOML file declares a `[base]` capability
//!   set that applies to all v2.0+ servers, plus per-version deltas
//!   (`[versions."X.Y.Z"]`) that add new capabilities as the webapi
//!   version advances.
//! - **Boolean output**: resolution produces a `ResolvedCapabilities` with
//!   plain `bool` fields (no tri-state) so the renderer can use the
//!   capabilities directly as feature gates.
//! - **Hardcoded corrections**: known upstream `webapiVersion` reporting
//!   bugs (e.g. qBittorrent v4.3.0–v4.3.3 reporting "2.7.0" instead of
//!   "2.8.0") are corrected at parse time.
//!
//! Resolution flow (called from `qb-tauri` after a successful login):
//!
//! 1. Fetch `GET /api/v2/app/webapiVersion`.
//! 2. On success: call [`resolver::QbResolver::resolve`]`(version)`.
//! 3. On failure: fall back to the "2.0" base profile so the user still
//!    sees `supports_rss` and nothing else.
//! 4. Store the resulting `ResolvedCapabilities` and the raw version
//!    string on the `SessionState`.
//!
//! `supports_pause_resume` is intentionally NOT part of this TOML: it is
//! derived from the qBittorrent **app** version (v5+ removed the
//! `/pause`/`/resume` endpoints) by the existing logic in
//! `qb-tauri/src/session.rs`.

pub mod resolved;
pub mod resolver;
pub mod version;

pub use resolved::ResolvedCapabilities;
pub use resolver::QbResolver;
