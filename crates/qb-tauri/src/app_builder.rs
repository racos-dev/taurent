//! Shared app builder for Tauri desktop and mobile applications.
//!
//! Provides plugin initialization helpers that consolidate common patterns
//! used by both desktop and mobile Tauri app crates.

use tauri::Builder;

/// Server store filename for the desktop target.
pub const DESKTOP_SERVER_STORE_FILE: &str = ".servers.dat";
/// Server store filename for the mobile target.
pub const MOBILE_SERVER_STORE_FILE: &str = ".mobile-settings.dat";

/// Add plugins shared by all platforms (store, http, notification, deep-link).
pub fn add_shared_plugins<R: tauri::Runtime>(builder: Builder<R>) -> Builder<R> {
    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
}

/// Windows that are fixed-size and must not have their geometry restored.
/// Keep in sync with the renderer set in apps/desktop/src/hooks/useWindowState.ts.
#[cfg(feature = "desktop")]
const FIXED_SIZE_WINDOWS: &[&str] = &[
    "settings",
    "statistics",
    "add-torrent",
    // dialog-host is the shared singleton window for all modal dialogs
    "dialog-host",
    // All dialog windows are fixed-size — never restore their geometry
    "transfer-limit-dialog",
    "torrent-share-limits-dialog",
    "torrent-numeric-dialog",
    "torrent-text-dialog",
    "rename-dialog",
    "confirm-dialog",
    "create-dialog",
    "edit-category-dialog",
    "torrent-delete-dialog",
    "category-select-dialog",
    "tag-select-dialog",
    "entity-confirm-dialog",
];

/// Add desktop-only plugins (clipboard-manager, dialog, window-state, secure-storage).
#[cfg(feature = "desktop")]
pub fn add_desktop_plugins<R: tauri::Runtime>(builder: Builder<R>) -> Builder<R> {
    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(FIXED_SIZE_WINDOWS)
                // Rust auto-restore halves the size on cross-display restore
                // when the window is briefly on the primary display (different
                // scale factor) before the position-move propagates. JS owns
                // the main-window restore via useWindowState.
                .skip_initial_state("main")
                .build(),
        )
        .plugin(tauri_plugin_secure_storage::init())
        .plugin(tauri_plugin_opener::init())
}

#[cfg(not(feature = "desktop"))]
pub fn add_desktop_plugins<R: tauri::Runtime>(builder: Builder<R>) -> Builder<R> {
    builder
}

/// Add mobile-only plugins (fs, dialog, shell, secure-storage).
#[cfg(feature = "mobile")]
pub fn add_mobile_plugins<R: tauri::Runtime>(builder: Builder<R>) -> Builder<R> {
    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_secure_storage::init())
}

#[cfg(not(feature = "mobile"))]
pub fn add_mobile_plugins<R: tauri::Runtime>(builder: Builder<R>) -> Builder<R> {
    builder
}
