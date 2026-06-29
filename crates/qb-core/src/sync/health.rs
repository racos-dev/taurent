//! `MaindataSyncHealth` — live sync health model.
//!
//! Represents `idle`, `healthy`, `degraded`, and `retrying` with
//! consecutive error count and timestamps.

use serde::{Deserialize, Serialize};
use std::time::UNIX_EPOCH;

/// Live sync health states.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SyncHealthState {
    /// No active sync session (never connected or explicitly stopped).
    #[default]
    Idle,
    /// Sync is running and receiving updates normally.
    Healthy,
    /// Sync is running but has seen repeated errors; may recover automatically.
    Degraded,
    /// Sync has failed and is backing off before retrying.
    Retrying,
}

/// Number of consecutive errors before transitioning from `Degraded` to `Retrying`.
/// Matches the frontend's `isProtectedRequestDegraded` threshold.
const RETRY_THRESHOLD: u32 = 2;

/// Live sync health with consecutive error count and timestamps.
///
/// This struct is cheap to clone and is intended to be stored in
/// session state and emitted in sync-change events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaindataSyncHealth {
    /// Current health state.
    pub state: SyncHealthState,
    /// Consecutive errors since last successful response.
    pub consecutive_errors: u32,
    /// Unix timestamp (seconds) of the last successful sync response.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_success_ts: Option<u64>,
    /// Unix timestamp (seconds) of the last error response.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error_ts: Option<u64>,
    /// Human-readable last error message, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error_message: Option<String>,
}

impl Default for MaindataSyncHealth {
    fn default() -> Self {
        Self {
            state: SyncHealthState::Idle,
            consecutive_errors: 0,
            last_success_ts: None,
            last_error_ts: None,
            last_error_message: None,
        }
    }
}

impl MaindataSyncHealth {
    /// Create a new health record in `Idle` state.
    pub fn idle() -> Self {
        Self::default()
    }

    /// Create a health record in `Healthy` state with a success timestamp.
    pub fn healthy() -> Self {
        Self {
            state: SyncHealthState::Healthy,
            consecutive_errors: 0,
            last_success_ts: Some(current_unix_ts()),
            last_error_ts: None,
            last_error_message: None,
        }
    }

    /// Record a successful sync response and update health accordingly.
    ///
    /// Transitions:
    /// - Idle → Healthy (first success)
    /// - Degraded → Healthy (successful response after degraded)
    /// - Retrying → Healthy (successful response after retry)
    /// - Healthy stays Healthy
    pub fn record_success(&mut self) {
        self.consecutive_errors = 0;
        self.last_success_ts = Some(current_unix_ts());
        self.last_error_ts = None;
        self.last_error_message = None;

        match self.state {
            SyncHealthState::Idle => self.state = SyncHealthState::Healthy,
            SyncHealthState::Degraded => self.state = SyncHealthState::Healthy,
            SyncHealthState::Retrying => self.state = SyncHealthState::Healthy,
            SyncHealthState::Healthy => {}
        }
    }

    /// Record a failed sync attempt.
    ///
    /// Transitions:
    /// - Idle → Retrying (first error, start backing off)
    /// - Healthy → Degraded (first error)
    /// - Degraded → Retrying (consecutive errors >= RETRY_THRESHOLD)
    /// - Retrying → Retrying (still in backoff)
    pub fn record_error(&mut self, message: impl Into<String>) {
        self.consecutive_errors += 1;
        self.last_error_ts = Some(current_unix_ts());
        self.last_error_message = Some(message.into());

        match self.state {
            SyncHealthState::Idle => self.state = SyncHealthState::Retrying,
            SyncHealthState::Healthy => self.state = SyncHealthState::Degraded,
            SyncHealthState::Degraded => {
                // Transition to Retrying when error count reaches threshold
                if self.consecutive_errors >= RETRY_THRESHOLD {
                    self.state = SyncHealthState::Retrying;
                }
            }
            SyncHealthState::Retrying => {}
        }
    }

    /// Transition to `Retrying` state explicitly (e.g., after explicit disconnect).
    pub fn set_retrying(&mut self) {
        self.state = SyncHealthState::Retrying;
    }

    /// Transition to `Idle` state explicitly (e.g., on reset).
    pub fn set_idle(&mut self) {
        self.state = SyncHealthState::Idle;
        self.consecutive_errors = 0;
        self.last_success_ts = None;
        self.last_error_ts = None;
        self.last_error_message = None;
    }

    /// Returns true if the current state is `Degraded` or `Retrying`.
    pub fn is_degraded(&self) -> bool {
        matches!(
            self.state,
            SyncHealthState::Degraded | SyncHealthState::Retrying
        )
    }
}

/// Returns the current Unix timestamp in seconds.
fn current_unix_ts() -> u64 {
    UNIX_EPOCH.elapsed().map(|d| d.as_secs()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_idle_default() {
        let h = MaindataSyncHealth::idle();
        assert_eq!(h.state, SyncHealthState::Idle);
        assert_eq!(h.consecutive_errors, 0);
        assert!(h.last_success_ts.is_none());
        assert!(h.last_error_ts.is_none());
    }

    #[test]
    fn test_healthy_default() {
        let h = MaindataSyncHealth::healthy();
        assert_eq!(h.state, SyncHealthState::Healthy);
        assert_eq!(h.consecutive_errors, 0);
        assert!(h.last_success_ts.is_some());
    }

    #[test]
    fn test_record_success_from_idle() {
        let mut h = MaindataSyncHealth::idle();
        h.record_success();
        assert_eq!(h.state, SyncHealthState::Healthy);
        assert_eq!(h.consecutive_errors, 0);
    }

    #[test]
    fn test_record_success_from_degraded() {
        let mut h = MaindataSyncHealth::idle();
        h.state = SyncHealthState::Degraded;
        h.record_success();
        assert_eq!(h.state, SyncHealthState::Healthy);
    }

    #[test]
    fn test_record_success_from_retrying() {
        let mut h = MaindataSyncHealth::idle();
        h.state = SyncHealthState::Retrying;
        h.record_success();
        assert_eq!(h.state, SyncHealthState::Healthy);
    }

    #[test]
    fn test_record_error_from_idle() {
        let mut h = MaindataSyncHealth::idle();
        h.record_error("connection refused");
        assert_eq!(h.state, SyncHealthState::Retrying);
        assert_eq!(h.consecutive_errors, 1);
        assert!(h.last_error_message.is_some());
    }

    #[test]
    fn test_record_error_from_healthy() {
        let mut h = MaindataSyncHealth::idle();
        h.state = SyncHealthState::Healthy;
        h.record_error("timeout");
        assert_eq!(h.state, SyncHealthState::Degraded);
        assert_eq!(h.consecutive_errors, 1);
    }

    #[test]
    fn test_record_error_accumulates_and_transitions_to_retrying() {
        let mut h = MaindataSyncHealth::idle();
        h.state = SyncHealthState::Degraded;
        h.record_error("first");
        assert_eq!(h.consecutive_errors, 1);
        assert_eq!(h.state, SyncHealthState::Degraded);
        h.record_error("second");
        assert_eq!(h.consecutive_errors, 2);
        // Threshold reached: transitions to Retrying
        assert_eq!(h.state, SyncHealthState::Retrying);
    }

    #[test]
    fn test_set_retrying() {
        let mut h = MaindataSyncHealth::healthy();
        h.set_retrying();
        assert_eq!(h.state, SyncHealthState::Retrying);
    }

    #[test]
    fn test_set_idle_clears_state() {
        let mut h = MaindataSyncHealth::healthy();
        h.record_error("fail");
        h.set_idle();
        assert_eq!(h.state, SyncHealthState::Idle);
        assert_eq!(h.consecutive_errors, 0);
        assert!(h.last_success_ts.is_none());
        assert!(h.last_error_ts.is_none());
    }

    #[test]
    fn test_is_degraded() {
        let mut h = MaindataSyncHealth::idle();
        assert!(!h.is_degraded());

        h.state = SyncHealthState::Healthy;
        assert!(!h.is_degraded());

        h.state = SyncHealthState::Degraded;
        assert!(h.is_degraded());

        h.state = SyncHealthState::Retrying;
        assert!(h.is_degraded());
    }

    #[test]
    fn test_serde_round_trip() {
        let h = MaindataSyncHealth::healthy();
        let json = serde_json::to_string(&h).unwrap();
        let parsed: MaindataSyncHealth = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.state, SyncHealthState::Healthy);
    }
}
