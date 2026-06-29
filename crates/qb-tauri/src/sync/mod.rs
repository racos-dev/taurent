//! Live maindata sync manager for qb-tauri.
//!
//! Owns the Rust-side sync lifecycle: one actor per server/session-generation
//! that polls qBittorrent `/api/v2/sync/maindata`, accumulates deltas via
//! `MaindataAccumulator`, tracks health, and emits `maindata-sync-changed`
//! events to the renderer.

mod events;
mod lifecycle;
mod manager;
mod registry;

pub use events::MaindataSyncChangedEvent;
pub use lifecycle::setup_sync_lifecycle;
pub use manager::{
    LiveSyncHandle, LiveSyncManager, MaindataSnapshotEnvelope, MaindataSnapshotResponse,
};
pub use registry::{
    create_sync_manager_registry, get_maindata_snapshot, start_sync_for_session,
    stop_sync_for_server, SyncManagerRegistry,
};
