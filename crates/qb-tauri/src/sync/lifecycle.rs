//! Sync manager lifecycle helpers.
//!
//! Sets up the `SyncManagerRegistry` as Tauri state and wires session lifecycle
//! events (connect, disconnect, switch, teardown) to start/stop the sync actor.
//!
//! Call `setup_sync_lifecycle(app)` during app setup to initialize the registry
//! and event listeners. The listeners run for the lifetime of the app.

use tauri::{AppHandle, Listener, Manager};

use crate::session::SessionStateHandle;
use crate::sync::{start_sync_for_session, stop_sync_for_server, SyncManagerRegistry};

/// Set up the sync manager registry and session lifecycle event handlers.
/// Call once from the desktop or mobile `setup()` function.
pub fn setup_sync_lifecycle(app: &AppHandle) {
    let app_handle = app.clone();
    let visibility_app = app.clone();
    app.listen("session-changed", move |event| {
        let payload = event.payload();
        let Ok(parsed) = serde_json::from_str::<SessionChangedPayload>(payload) else {
            log::warn!("session-changed: failed to parse payload");
            return;
        };

        match parsed.status.as_str() {
            "connected" => {
                // Access state inside the async block to avoid lifetime issues.
                // The app_handle is Clone + 'static, so it's safe to move into the task.
                let app = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    let registry = app.state::<SyncManagerRegistry>();
                    let session_handle = app.state::<SessionStateHandle>();
                    if let Err(e) = start_sync_for_session(&registry, &session_handle, &app).await {
                        log::error!("Failed to start sync manager on session connect: {}", e);
                    }
                });
            }
            "disconnected" | "error" => {
                if let Some(ref server_id) = parsed.server_id {
                    // Clone the server_id so it owns the data for the async task.
                    let server_id = server_id.clone();
                    let app = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let registry = app.state::<SyncManagerRegistry>();
                        if let Err(e) = stop_sync_for_server(&registry, &server_id).await {
                            log::warn!("Failed to stop sync manager for {}: {}", server_id, e);
                        }
                    });
                }
            }
            _ => {}
        }
    });

    // Forward visibility changes to all active sync managers.
    visibility_app
        .clone()
        .listen("app-visibility-changed", move |event| {
            let payload = event.payload();
            let Ok(parsed) = serde_json::from_str::<VisibilityChangedPayload>(payload) else {
                log::warn!("app-visibility-changed: failed to parse payload");
                return;
            };
            log::debug!("Visibility changed: visible={}", parsed.visible);

            let app = visibility_app.clone();
            tauri::async_runtime::spawn(async move {
                let registry = app.state::<SyncManagerRegistry>();
                let handles = {
                    let Ok(reg) = registry.lock() else {
                        log::warn!("app-visibility-changed: failed to lock registry");
                        return;
                    };
                    reg.values()
                        .map(|entry| entry.handle.clone())
                        .collect::<Vec<_>>()
                };
                for handle in &handles {
                    handle.set_visible(parsed.visible).await;
                }
            });
        });

    log::info!("Sync lifecycle initialized");
}

/// Lightweight payload parsed from the `session-changed` event.
#[derive(Debug, serde::Deserialize)]
struct SessionChangedPayload {
    server_id: Option<String>,
    status: String,
}

/// Lightweight payload parsed from the `app-visibility-changed` event.
#[derive(Debug, serde::Deserialize)]
struct VisibilityChangedPayload {
    visible: bool,
}
