//! Tauri-free sync primitives for qBittorrent `/api/v2/sync/maindata`.
//!
//! This module owns qBittorrent sync semantics:
//! - required RID tracking
//! - full-update replacement
//! - incremental field merge
//! - removed torrents/categories/tags
//! - sorted tag accumulation
//! - server_state partial merge
//! - reset behavior

mod accumulator;
mod health;

pub use accumulator::{MaindataAccumulator, MaindataSnapshot};
pub use health::{MaindataSyncHealth, SyncHealthState};
