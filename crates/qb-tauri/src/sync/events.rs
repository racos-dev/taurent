//! Event types for the maindata live sync system.

use serde::{Deserialize, Serialize};

/// Payload emitted on `maindata-sync-changed` whenever the sync state or health
/// transitions. The renderer receives this as a lightweight hint and can then
/// call `get_maindata_snapshot` to retrieve the current accumulated state.
///
/// When `delta` is populated, the renderer can apply the embedded delta
/// directly to its state and skip the snapshot round-trip. `delta` is the
/// raw qBittorrent maindata response object, not a typed projection. It is
/// omitted when no data changed (e.g. a pure health transition) or when the
/// serialized payload exceeds the manager's size threshold.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaindataSyncChangedEvent {
    /// The server this event applies to.
    pub server_id: Option<String>,
    /// The session generation active when this event was emitted.
    pub session_generation: u64,
    /// Backend revision counter at the time of the last successful sync response.
    pub revision: u64,
    /// Current sync RID.
    pub rid: u64,
    /// Current sync health.
    pub health: qb_core::sync::MaindataSyncHealth,
    /// Which top-level resource categories changed since the last event.
    /// Used by renderers to gate downstream selectors without fetching the
    /// full snapshot on every poll.
    #[serde(default)]
    pub changed_resources: Vec<String>,
    /// Raw qBittorrent maindata delta for the just-applied poll, when present
    /// and small enough to embed directly in the event. Renderers should
    /// prefer applying this over calling `get_maindata_snapshot`; absence
    /// means the renderer should fall back to the snapshot fetch path.
    pub delta: Option<serde_json::Value>,
}

impl MaindataSyncChangedEvent {
    /// Returns true if this event belongs to a stale (older) session generation.
    pub fn is_stale(&self, current_generation: u64) -> bool {
        self.session_generation < current_generation
    }
}
