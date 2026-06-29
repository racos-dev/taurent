//! Native desktop download completion notification monitor.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde_json::Value as JsonValue;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

use qb_tauri::client::qb_sync_maindata_from_handle;
use qb_tauri::session::SessionStateHandle;

async fn send_notification(app: &AppHandle, title: &str, body: &str, hash: &str) {
    match app.notification().builder().title(title).body(body).show() {
        Ok(()) => {
            log::info!(
                "download_completion_notifications: notification queued through native plugin, hash={hash}"
            );
        }
        Err(err) => {
            log::warn!(
                "download_completion_notifications: failed to queue notification through native plugin, hash={hash}: {err}"
            );
        }
    }
}

const POLL_INTERVAL_SECS: u64 = 10;

// ─── Pure transition detection ────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct CompletionCandidates {
    pub newly_completed: Vec<(String, String)>,
}

#[cfg(test)]
/// Process a maindata snapshot and return torrents that are newly complete.
pub fn detect_completion_transitions(
    baseline_complete: &mut HashSet<String>,
    data: &JsonValue,
    first_snapshot: bool,
) -> CompletionCandidates {
    let mut torrent_names = HashMap::new();
    detect_completion_transitions_with_names(
        baseline_complete,
        &mut torrent_names,
        data,
        first_snapshot,
    )
}

pub fn detect_completion_transitions_with_names(
    baseline_complete: &mut HashSet<String>,
    torrent_names: &mut HashMap<String, String>,
    data: &JsonValue,
    first_snapshot: bool,
) -> CompletionCandidates {
    let mut candidates = Vec::new();

    if let Some(removed) = data.get("torrents_removed").and_then(|v| v.as_array()) {
        for hash in removed {
            if let Some(h) = hash.as_str() {
                baseline_complete.remove(h);
                torrent_names.remove(h);
            }
        }
    }

    if let Some(torrents) = data.get("torrents").and_then(|v| v.as_object()) {
        for (hash, info) in torrents {
            if let Some(name) = info.get("name").and_then(|v| v.as_str()) {
                torrent_names.insert(hash.clone(), name.to_string());
            }

            let is_complete = is_torrent_complete(info);
            if is_complete == Some(true) && !baseline_complete.contains(hash) {
                let name = torrent_names
                    .get(hash)
                    .map(String::as_str)
                    .unwrap_or("<unknown>")
                    .to_string();
                if !first_snapshot {
                    candidates.push((hash.clone(), name));
                }
                baseline_complete.insert(hash.clone());
            } else if is_complete == Some(false) && baseline_complete.contains(hash) {
                baseline_complete.remove(hash);
            }
        }
    }

    CompletionCandidates {
        newly_completed: candidates,
    }
}

fn is_torrent_complete(info: &JsonValue) -> Option<bool> {
    if let Some(co) = info.get("completion_on").and_then(|v| v.as_i64()) {
        if co > 0 {
            return Some(true);
        }
    }
    if let Some(al) = info.get("amount_left").and_then(|v| v.as_i64()) {
        return Some(al == 0);
    }
    if let Some(prog) = info.get("progress").and_then(|v| v.as_f64()) {
        return Some(prog >= 1.0);
    }
    None
}

// ─── Monitor state ─────────────────────────────────────────────────────────────

pub struct MonitorState {
    enabled: AtomicBool,
}

impl MonitorState {
    fn new(enabled: bool) -> Self {
        Self {
            enabled: AtomicBool::new(enabled),
        }
    }

    fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    pub fn set_enabled(&self, value: bool) {
        self.enabled.store(value, Ordering::SeqCst);
    }
}

pub type SharedMonitorState = Arc<MonitorState>;

pub fn create_monitor_state(enabled: bool) -> SharedMonitorState {
    Arc::new(MonitorState::new(enabled))
}

/// Returns true when the session generation has changed since the last poll,
/// indicating the monitor must reseed its baseline.
fn should_reseed(last_generation: Option<u64>, current_generation: u64) -> bool {
    last_generation.is_some() && last_generation != Some(current_generation)
}

// ─── Background task ────────────────────────────────────────────────────────────

pub fn spawn_monitor(
    session_handle: SessionStateHandle,
    monitor_state: SharedMonitorState,
    app: AppHandle,
) {
    log::info!(
        "download_completion_notifications: spawning monitor, enabled={}",
        monitor_state.is_enabled()
    );

    let rt = tauri::async_runtime::handle();
    let session_handle_clone = session_handle;
    let monitor_state_clone = monitor_state;
    let app_clone = app;

    rt.spawn(async move {
        let mut baseline_complete: HashSet<String> = HashSet::new();
        let mut torrent_names: HashMap<String, String> = HashMap::new();
        let mut is_seeding = true;
        let mut rid: Option<u64> = None;
        let mut last_generation: Option<u64> = None;

        log::info!("download_completion_notifications: monitor task started");

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

            if !monitor_state_clone.is_enabled() {
                log::debug!("download_completion_notifications: disabled; skipping poll");
                continue;
            }

            log::debug!(
                "download_completion_notifications: polling, rid_before={:?}, is_seeding={}, baseline_size={}",
                rid,
                is_seeding,
                baseline_complete.len()
            );

            // Detect session generation changes (server switch, reconnect, etc.)
            // and reseed baseline so we don't fire false-positive completion
            // notifications for torrents that were already complete on the new server.
            let current_generation = {
                let session = match session_handle_clone.lock() {
                    Ok(s) => s,
                    Err(e) => {
                        log::warn!("download_completion_notifications: session lock poisoned: {e}; skipping poll");
                        continue;
                    }
                };
                session.get_state().session_generation
            };

            if should_reseed(last_generation, current_generation) {
                log::info!(
                    "download_completion_notifications: session generation changed ({} → {}); reseeding baseline",
                    last_generation.unwrap(),
                    current_generation
                );
                baseline_complete.clear();
                torrent_names.clear();
                rid = None;
                is_seeding = true;
            }
            last_generation = Some(current_generation);

            match qb_sync_maindata_from_handle(&session_handle_clone, rid).await {
                Ok((new_rid, data)) => {
                    let removed_count = data
                        .get("torrents_removed")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.len())
                        .unwrap_or(0);
                    let torrent_count = data
                        .get("torrents")
                        .and_then(|v| v.as_object())
                        .map(|obj| obj.len())
                        .unwrap_or(0);

                    log::debug!(
                        "download_completion_notifications: sync ok, rid_before={:?}, rid_after={}, is_seeding={}, removed_count={}, torrent_entries={}, baseline_size_before={}",
                        rid,
                        new_rid,
                        is_seeding,
                        removed_count,
                        torrent_count,
                        baseline_complete.len()
                    );

                    let candidates = detect_completion_transitions_with_names(
                        &mut baseline_complete,
                        &mut torrent_names,
                        &data,
                        is_seeding,
                    );
                    if is_seeding {
                        log::info!(
                            "download_completion_notifications: seeded baseline, torrent_entries={}, removed_count={}, complete_baseline_size={}; no notifications emitted for first snapshot",
                            torrent_count,
                            removed_count,
                            baseline_complete.len()
                        );
                    }

                    is_seeding = false;

                    log::debug!(
                        "download_completion_notifications: transitions evaluated, candidate_count={}, baseline_size_after={}",
                        candidates.newly_completed.len(),
                        baseline_complete.len()
                    );

                    if !candidates.newly_completed.is_empty() {
                        log::info!(
                            "download_completion_notifications: completion transitions detected, candidate_count={}",
                            candidates.newly_completed.len()
                        );
                    }

                    for (hash, name) in candidates.newly_completed {
                        let body = format!("{name} finished downloading.");
                        log::info!(
                            "download_completion_notifications: showing notification, hash={hash}"
                        );
                        send_notification(&app_clone, "Download complete", &body, &hash).await;
                    }

                    rid = Some(new_rid);
                }
                Err(err) => {
                    if err == "Not connected to server" {
                        log::debug!(
                            "download_completion_notifications: not connected; resetting baseline, rid_before={:?}, err={err}",
                            rid
                        );
                    } else {
                        log::warn!(
                            "download_completion_notifications: sync request failed; resetting baseline, rid_before={:?}, err={err}",
                            rid
                        );
                    }
                    baseline_complete.clear();
                    torrent_names.clear();
                    rid = None;
                    is_seeding = true;
                }
            }
        }
    });
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

const SETTINGS_STORE_FILE: &str = ".settings.dat";
const SETTINGS_KEY: &str = "download_completion_notifications";

#[tauri::command]
pub async fn get_download_completion_notifications_enabled(
    app: AppHandle,
    monitor_state: tauri::State<'_, SharedMonitorState>,
) -> Result<bool, String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("failed to open settings store: {e}"))?;

    let stored_value = store.get(SETTINGS_KEY);
    let stored_disabled = stored_value
        .as_ref()
        .and_then(|v| v.as_str().map(|s| s.eq_ignore_ascii_case("false")))
        .unwrap_or(false);

    let final_enabled = !stored_disabled;
    monitor_state.set_enabled(final_enabled);
    log::info!(
        "download_completion_notifications: enabled loaded from settings, enabled={final_enabled}, key_present={}",
        stored_value.is_some()
    );
    Ok(final_enabled)
}

#[tauri::command]
pub async fn set_download_completion_notifications_enabled(
    app: AppHandle,
    monitor_state: tauri::State<'_, SharedMonitorState>,
    enabled: bool,
) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("failed to open settings store: {e}"))?;

    let value = serde_json::to_value(enabled.to_string()).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY, value);
    store
        .save()
        .map_err(|e| format!("failed to save settings store: {e}"))?;

    monitor_state.set_enabled(enabled);
    log::info!(
        "download_completion_notifications: enabled set to {} and persisted",
        enabled
    );
    Ok(())
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_snapshot_seeds_without_notifying() {
        let mut baseline = HashSet::new();
        let data = serde_json::json!({
            "torrents": {
                "hash1": {
                    "hash": "hash1",
                    "name": "Torrent A",
                    "completion_on": 1,
                    "amount_left": 0,
                    "progress": 1.0
                },
                "hash2": {
                    "hash": "hash2",
                    "name": "Torrent B",
                    "completion_on": 0,
                    "amount_left": 1024,
                    "progress": 0.5
                }
            }
        });

        let result = detect_completion_transitions(&mut baseline, &data, true);
        assert!(
            result.newly_completed.is_empty(),
            "first snapshot must not emit candidates"
        );
        assert_eq!(baseline.len(), 1);
        assert!(baseline.contains("hash1"));
    }

    #[test]
    fn completion_uses_cached_name_when_incremental_update_omits_name() {
        let mut baseline = HashSet::new();
        let mut torrent_names = HashMap::new();

        let initial = serde_json::json!({
            "torrents": {
                "hash1": {
                    "hash": "hash1",
                    "name": "Ubuntu ISO",
                    "completion_on": 0,
                    "amount_left": 1024,
                    "progress": 0.5
                }
            }
        });

        let initial_result = detect_completion_transitions_with_names(
            &mut baseline,
            &mut torrent_names,
            &initial,
            true,
        );
        assert!(initial_result.newly_completed.is_empty());

        let incremental_completion = serde_json::json!({
            "torrents": {
                "hash1": {
                    "amount_left": 0,
                    "progress": 1.0
                }
            }
        });

        let result = detect_completion_transitions_with_names(
            &mut baseline,
            &mut torrent_names,
            &incremental_completion,
            false,
        );

        assert_eq!(result.newly_completed.len(), 1);
        assert_eq!(result.newly_completed[0].0, "hash1");
        assert_eq!(result.newly_completed[0].1, "Ubuntu ISO");
    }
    #[test]
    fn incomplete_to_complete_notifies() {
        let mut baseline = HashSet::new();
        baseline.insert("hash1".to_string());

        let data = serde_json::json!({
            "torrents": {
                "hash2": {
                    "hash": "hash2",
                    "name": "Torrent C",
                    "completion_on": 0,
                    "amount_left": 0,
                    "progress": 1.0
                }
            }
        });

        let result = detect_completion_transitions(&mut baseline, &data, false);
        assert_eq!(result.newly_completed.len(), 1);
        assert_eq!(result.newly_completed[0].0, "hash2");
        assert_eq!(result.newly_completed[0].1, "Torrent C");
    }

    #[test]
    fn repeated_complete_updates_do_not_notify() {
        let mut baseline = HashSet::new();
        baseline.insert("hash1".to_string());

        let data = serde_json::json!({
            "torrents": {
                "hash1": {
                    "hash": "hash1",
                    "name": "Torrent A",
                    "completion_on": 1,
                    "amount_left": 0,
                    "progress": 1.0
                }
            }
        });

        let result = detect_completion_transitions(&mut baseline, &data, false);
        assert!(
            result.newly_completed.is_empty(),
            "repeated complete update must not emit candidate"
        );
    }

    #[test]
    fn multiple_completions_in_one_update_all_emitted() {
        let mut baseline = HashSet::new();
        baseline.insert("hash0".to_string());

        let data = serde_json::json!({
            "torrents": {
                "hash1": {
                    "hash": "hash1",
                    "name": "Torrent A",
                    "completion_on": 1,
                    "amount_left": 0,
                    "progress": 1.0
                },
                "hash2": {
                    "hash": "hash2",
                    "name": "Torrent B",
                    "completion_on": 0,
                    "amount_left": 0,
                    "progress": 1.0
                },
                "hash3": {
                    "hash": "hash3",
                    "name": "Torrent C",
                    "completion_on": 0,
                    "amount_left": 0,
                    "progress": 1.0
                }
            }
        });

        let result = detect_completion_transitions(&mut baseline, &data, false);
        assert_eq!(result.newly_completed.len(), 3);
    }

    #[test]
    fn removed_hash_clears_baseline() {
        let mut baseline = HashSet::new();
        baseline.insert("hash1".to_string());
        baseline.insert("hash2".to_string());

        let data = serde_json::json!({
            "torrents_removed": ["hash1"],
            "torrents": {}
        });

        let result = detect_completion_transitions(&mut baseline, &data, false);
        assert!(result.newly_completed.is_empty());
        assert!(!baseline.contains("hash1"));
        assert!(baseline.contains("hash2"));
    }

    #[test]
    fn becomes_incomplete_clears_baseline_for_future_recompletion() {
        let mut baseline = HashSet::new();
        baseline.insert("hash1".to_string());

        let data = serde_json::json!({
            "torrents": {
                "hash1": {
                    "hash": "hash1",
                    "name": "Torrent A",
                    "completion_on": 0,
                    "amount_left": 1024,
                    "progress": 0.0
                }
            }
        });

        let result = detect_completion_transitions(&mut baseline, &data, false);
        assert!(result.newly_completed.is_empty());
        assert!(
            !baseline.contains("hash1"),
            "hash1 must be cleared so future completion can notify"
        );

        let data2 = serde_json::json!({
            "torrents": {
                "hash1": {
                    "hash": "hash1",
                    "name": "Torrent A",
                    "completion_on": 1,
                    "amount_left": 0,
                    "progress": 1.0
                }
            }
        });
        let result2 = detect_completion_transitions(&mut baseline, &data2, false);
        assert_eq!(
            result2.newly_completed.len(),
            1,
            "re-completion after becoming incomplete must notify"
        );
    }

    #[test]
    fn completion_on_zero_not_complete() {
        let mut baseline = HashSet::new();
        let data = serde_json::json!({
            "torrents": {
                "hash1": {
                    "hash": "hash1",
                    "name": "Torrent A",
                    "completion_on": 0,
                    "amount_left": 1024,
                    "progress": 0.5
                }
            }
        });
        let result = detect_completion_transitions(&mut baseline, &data, false);
        assert!(result.newly_completed.is_empty());

        let data2 = serde_json::json!({
            "torrents": {
                "hash1": {
                    "hash": "hash1",
                    "name": "Torrent A",
                    "completion_on": 0,
                    "amount_left": 0,
                    "progress": 1.0
                }
            }
        });
        let result2 = detect_completion_transitions(&mut baseline, &data2, false);
        assert_eq!(result2.newly_completed.len(), 1);
    }

    #[test]
    fn malformed_torrent_entry_does_not_panic() {
        let data = serde_json::json!({
            "torrents": {
                "hash1": { "name": "Bad Torrent" },
                "hash2": null,
                "hash3": "not an object"
            }
        });

        let mut baseline = HashSet::new();
        let result = detect_completion_transitions(&mut baseline, &data, false);
        assert!(result.newly_completed.is_empty());
    }

    #[test]
    fn incremental_update_without_completion_fields_does_not_clear_baseline() {
        let mut baseline = HashSet::new();
        baseline.insert("hash1".to_string());

        let incremental = serde_json::json!({
            "torrents": {
                "hash1": {
                    "dlspeed": 0
                }
            }
        });

        let result = detect_completion_transitions(&mut baseline, &incremental, false);
        assert!(
            result.newly_completed.is_empty(),
            "incremental update without completion fields must not emit candidates"
        );
        assert!(
            baseline.contains("hash1"),
            "baseline must still contain hash1 — no completion data available"
        );
    }

    #[test]
    fn should_reseed_returns_false_on_initial_poll() {
        assert!(!should_reseed(None, 1));
    }

    #[test]
    fn should_reseed_returns_false_when_generation_unchanged() {
        assert!(!should_reseed(Some(5), 5));
    }

    #[test]
    fn should_reseed_returns_true_when_generation_changed() {
        assert!(should_reseed(Some(3), 7));
    }
}
