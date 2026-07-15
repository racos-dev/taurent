use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Listener, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_store::StoreExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

mod download_completion_notifications;
mod tray;

/// Minimal payload for session-changed events, used to toggle the download
/// completion notifications monitor on connect/disconnect.
#[derive(serde::Deserialize)]
struct SessionStatusPayload {
    status: String,
}

// ─── Window labels ───────────────────────────────────────────────────────────

/// Label used for the main webview window.
const MAIN_WINDOW_LABEL: &str = "main";

/// Labels of all dialog windows that should be destroyed when entering tray mode.
const AUX_WINDOW_LABELS: &[&str] = &["settings", "statistics", "add-torrent", "dialog-host"];

#[cfg(target_os = "macos")]
fn set_dock_visibility(app_handle: &AppHandle, visible: bool) {
    // Avoid AppHandle::set_dock_visibility on macOS: it uses a runtime process
    // type transform that can make the Dock tile temporarily reappear with a
    // generic executable icon, especially in dev builds. Activation policy is
    // the AppKit-native way to switch between regular and tray-only modes.
    if visible {
        if let Err(error) = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular) {
            log::warn!("failed to restore macOS activation policy: {error}");
        }
        if let Err(error) = app_handle.show() {
            log::warn!("failed to show macOS app: {error}");
        }
    } else if let Err(error) = app_handle.set_activation_policy(tauri::ActivationPolicy::Accessory)
    {
        log::warn!("failed to set macOS accessory activation policy: {error}");
    }
}

#[cfg(not(target_os = "macos"))]
fn set_dock_visibility(_app_handle: &AppHandle, _visible: bool) {
    // No-op on non-macOS platforms.
}

// ─── Main-window lifecycle helpers ───────────────────────────────────────────

/// Find the window config for `main` from the app configuration, if present.
fn main_window_config(app_handle: &AppHandle) -> Option<&tauri::utils::config::WindowConfig> {
    app_handle
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label.as_str() == MAIN_WINDOW_LABEL)
}

/// Build the `main` window directly at its saved geometry (or centered on the
/// primary display on first launch), before it is shown.
///
/// The window is created from config with `create: false` + `visible: false`,
/// so it is never realized on the wrong display. We resolve the saved physical
/// geometry into logical points using the *source* monitor's scale factor (the
/// display the window was on when last saved) and pass it straight to the
/// builder. Because the window is born on the correct display at the correct
/// size, `show()` simply reveals it — there is no post-creation move/resize
/// that would flash the window across screens.
fn build_main_window(app_handle: &AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let config = main_window_config(app_handle).ok_or(tauri::Error::WindowNotFound)?;
    let builder = tauri::WebviewWindowBuilder::from_config(app_handle, config)?;

    let geometry = read_saved_main_window_state(app_handle).and_then(|s| {
        // Ignore corrupt or minimized states (the plugin can persist tiny
        // dimensions when a window is closed while minimized).
        if s.width < 200 || s.height < 150 {
            return None;
        }
        // Find the monitor that contained the saved window center and use its
        // scale factor for the physical→logical conversion. We match physical
        // bounds against the physical saved center (monitor position/size are
        // physical pixels) — note we deliberately do NOT use monitor_from_point,
        // which works in the macOS global *points* space and would mismatch the
        // physical center on non-1× displays.
        let center_x = s.x + (s.width as i32) / 2;
        let center_y = s.y + (s.height as i32) / 2;
        let monitors = app_handle.available_monitors().ok()?;
        let monitor = monitors.into_iter().find(|m| {
            let pos = m.position();
            let size = m.size();
            let right = pos.x + size.width as i32;
            let bottom = pos.y + size.height as i32;
            center_x >= pos.x && center_x < right && center_y >= pos.y && center_y < bottom
        })?;
        let scale = monitor.scale_factor();
        Some((
            f64::from(s.x) / scale,
            f64::from(s.y) / scale,
            f64::from(s.width) / scale,
            f64::from(s.height) / scale,
            s.maximized,
        ))
    });

    let builder = match geometry {
        Some((x, y, w, h, _)) => builder.position(x, y).inner_size(w, h),
        // First launch, or the saved display is no longer connected: center on
        // the primary monitor.
        None => builder.center(),
    };

    let window = builder.build()?;

    if matches!(geometry, Some((.., true))) {
        let _ = window.maximize();
    }

    Ok(window)
}

/// Recreate or return the existing `main` webview window.
///
/// Returns `(window, created)` where `created` is `true` if a new window was built.
/// When `created` is `true`, the window is hidden — caller is responsible for
/// showing it once the renderer is ready.
fn ensure_main_window(app_handle: &AppHandle) -> tauri::Result<(tauri::WebviewWindow, bool)> {
    if let Some(win) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        return Ok((win, false));
    }

    let win = build_main_window(app_handle)?;
    Ok((win, true))
}

/// Close all auxiliary (non-main) windows that should be shut down when
/// entering tray mode. Uses `destroy` semantics so dirty windows cannot block
/// tray suspend.
fn destroy_aux_windows_for_tray(app_handle: &AppHandle) {
    for label in AUX_WINDOW_LABELS {
        if let Some(win) = app_handle.get_webview_window(label) {
            let _ = win.destroy();
        }
    }
}

/// Show the main window and restore dock icon on macOS.
pub(crate) fn show_main_window(app_handle: &AppHandle) {
    set_dock_visibility(app_handle, true);
    let (window, created) = match ensure_main_window(app_handle) {
        Ok((win, created)) => (win, created),
        Err(err) => {
            log::error!("failed to ensure main window: {err}");
            return;
        }
    };

    if !created {
        // Existing window — show/focus immediately.
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    // If `created` is true, the window stays hidden; the renderer will show it
    // once window-state restore completes.

    // Notify renderer that we have exited tray mode so it can pre-bake
    // hidden dialog windows for snappy re-open.
    notify_tray_resume(app_handle);
    // Set tray visibility state explicitly to true — do NOT recompute from window
    // presence since close is async and state may lag.
    crate::tray::set_tray_window_visible(app_handle, true);

    // Notify sync managers that the app is now visible.
    let _ = app_handle.emit(
        "app-visibility-changed",
        serde_json::json!({ "visible": true }),
    );
}

/// Suspend the main window by closing it (not hiding) so the renderer is torn
/// down. On macOS also hides the dock icon. Sets the intentional-close guard so
/// the CloseRequested handler allows the close to proceed.
pub(crate) fn suspend_main_window_to_tray(app_handle: &AppHandle) {
    // Save the current window state before any visibility/mode changes so the
    // plugin restores the correct pre-tray dimensions — not transitional state
    // captured after dock visibility changes or during close.
    let _ = app_handle
        .save_window_state(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
        .inspect_err(|e| log::warn!("failed to save window state before tray: {e}"));

    set_dock_visibility(app_handle, false);
    destroy_aux_windows_for_tray(app_handle);
    enter_tray_mode(app_handle);

    let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let state = app_handle.state::<TrayState>();
    state
        .intentional_close_for_tray
        .store(true, Ordering::SeqCst);

    if let Err(err) = window.close() {
        state
            .intentional_close_for_tray
            .store(false, Ordering::SeqCst);
        log::error!("failed to close main window for tray suspend: {err}");
    }
    // Set tray visibility state explicitly to false — do NOT recompute since
    // close is async and state may still read true immediately after close().
    crate::tray::set_tray_window_visible(app_handle, false);

    // Notify sync managers that the app is now hidden.
    let _ = app_handle.emit(
        "app-visibility-changed",
        serde_json::json!({ "visible": false }),
    );
}

pub(crate) fn request_app_quit(app_handle: &AppHandle) {
    let state = app_handle.state::<TrayState>();
    state.explicit_quit_requested.store(true, Ordering::SeqCst);
    app_handle.exit(0);
}

/// Hide the main window and hide the dock icon on macOS.
fn hide_main_window_to_tray(_window: &tauri::Window, app_handle: &AppHandle) {
    suspend_main_window_to_tray(app_handle);
}

/// Notify the renderer that the app has exited tray mode (main window shown).
/// Uses atomic swap so the flag is reset exactly once per tray-hide cycle.
fn notify_tray_resume(app_handle: &AppHandle) {
    let state = app_handle.state::<TrayState>();
    // Atomically check-and-reset: returns the previous value. Only emit if it was true.
    if state.was_hidden_to_tray.swap(false, Ordering::SeqCst) {
        let _ = app_handle.emit(
            "app-tray-state-changed",
            serde_json::json!({ "inTray": false }),
        );
    }
}

// ─── Tray state ──────────────────────────────────────────────────────────────

/// Tracks whether the app was hidden to tray and whether an intentional close
/// has been requested for the main window. Uses AtomicBool so flags can be set
/// and reset without mutable access to the State itself.
struct TrayState {
    /// Set to true when entering tray mode; reset by notify_tray_resume.
    was_hidden_to_tray: AtomicBool,
    /// Set to true when the main window is being intentionally closed to tray
    /// (future phases). The CloseRequested handler checks this to allow the
    /// close instead of re-hiding.
    intentional_close_for_tray: AtomicBool,
    /// Set when the user explicitly requested a real app quit.
    explicit_quit_requested: AtomicBool,
}

impl Default for TrayState {
    fn default() -> Self {
        Self {
            was_hidden_to_tray: AtomicBool::new(false),
            intentional_close_for_tray: AtomicBool::new(false),
            explicit_quit_requested: AtomicBool::new(false),
        }
    }
}

/// Shared logic for entering tray mode: close all auxiliary windows, mark the
/// tray flag, and notify the renderer. Used by all hide-to-tray paths.
fn enter_tray_mode(app_handle: &AppHandle) {
    // Mark that we entered tray so notify_tray_resume fires on the next show.
    let state = app_handle.state::<TrayState>();
    state.was_hidden_to_tray.store(true, Ordering::SeqCst);
    // Notify renderer that we are entering tray mode.
    let _ = app_handle.emit(
        "app-tray-state-changed",
        serde_json::json!({ "inTray": true }),
    );
}

// ─── Pending torrent files state ─────────────────────────────────────────────

/// Holds queued torrent file paths and a dedup set to avoid re-queuing the same
/// path across cold-start, single-instance, and RunEvent::Opened.
struct PendingTorrentFiles {
    /// Ordered queue of paths waiting to be drained by the renderer.
    queue: Mutex<Vec<String>>,
    /// Paths already seen this session — used to filter out duplicates before
    /// emitting or queueing so the renderer never sees the same path twice.
    seen: Mutex<HashSet<String>>,
}

impl PendingTorrentFiles {
    fn new() -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
            seen: Mutex::new(HashSet::new()),
        }
    }

    /// Enqueue `paths`, adding each to `seen` first so duplicates across sources
    /// are suppressed. Returns only the genuinely new paths (emitted to renderer).
    fn enqueue(&self, paths: Vec<String>) -> Vec<String> {
        let mut seen = self.seen.lock().unwrap();
        let mut queue = self.queue.lock().unwrap();
        let mut new_paths = Vec::with_capacity(paths.len());
        for path in paths {
            if seen.insert(path.clone()) {
                // Not seen before — enqueue it
                queue.push(path.clone());
                new_paths.push(path);
            }
        }
        drop(queue);
        new_paths
    }

    fn drain(&self) -> Vec<String> {
        let mut queue = self.queue.lock().unwrap();
        let drained = std::mem::take(&mut *queue);
        drop(queue);

        let mut seen = self.seen.lock().unwrap();
        for path in &drained {
            seen.remove(path);
        }

        drained
    }
}

// ─── Pending native UI actions ───────────────────────────────────────────────

/// Serializable actions that need to survive main-window recreation.
/// Only UI-open actions are queued: settings, about, add-torrent, search, rss.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum NativeUiAction {
    Settings,
    About,
    AddTorrent,
    Nav {
        route: String,
    },
    /// Open the add-torrent window with a specific source: "file" or "link".
    AddTorrentSource {
        source: String,
    },
    /// Open the global transfer speed limits dialog.
    SetGlobalSpeedLimits,
}

/// Holds pending native UI actions that arrived while `main` was absent.
struct PendingNativeUiActions {
    queue: Mutex<Vec<NativeUiAction>>,
}

impl PendingNativeUiActions {
    fn new() -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
        }
    }

    fn enqueue(&self, actions: Vec<NativeUiAction>) {
        let mut queue = self.queue.lock().unwrap();
        queue.extend(actions);
    }

    fn drain(&self) -> Vec<NativeUiAction> {
        let mut queue = self.queue.lock().unwrap();
        std::mem::take(&mut *queue)
    }
}

// ─── Pending view actions ────────────────────────────────────────────────────

/// Holds pending view toggle actions that arrived before JS listeners were ready.
struct PendingViewActions {
    queue: Mutex<Vec<String>>,
}

impl PendingViewActions {
    fn new() -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
        }
    }

    fn enqueue(&self, actions: Vec<String>) {
        let mut queue = self.queue.lock().unwrap();
        queue.extend(actions);
    }

    fn drain(&self) -> Vec<String> {
        let mut queue = self.queue.lock().unwrap();
        std::mem::take(&mut *queue)
    }
}

/// Tracks whether JS view listeners have registered and are ready to receive events.
struct ViewListenersReady {
    ready: AtomicBool,
}

impl ViewListenersReady {
    fn new() -> Self {
        Self {
            ready: AtomicBool::new(false),
        }
    }

    fn is_ready(&self) -> bool {
        self.ready.load(Ordering::SeqCst)
    }

    fn set_ready(&self) {
        self.ready.store(true, Ordering::SeqCst);
    }

    fn reset(&self) {
        self.ready.store(false, Ordering::SeqCst);
    }
}

// ─── Command: drain pending native UI actions ────────────────────────────────

#[tauri::command]
fn get_pending_native_ui_actions(app: tauri::AppHandle) -> Vec<NativeUiAction> {
    let pending = app.state::<PendingNativeUiActions>();
    pending.drain()
}

// ─── Command: drain pending view actions ─────────────────────────────────────

#[tauri::command]
fn get_pending_view_actions(app: tauri::AppHandle) -> Vec<String> {
    let pending = app.state::<PendingViewActions>();
    pending.drain()
}

// ─── Command: signal view listeners ready ────────────────────────────────────

#[tauri::command]
fn set_view_listeners_ready(app: tauri::AppHandle) {
    let state = app.state::<ViewListenersReady>();
    state.set_ready();
}

// ─── Command: reset view listeners ready flag ────────────────────────────────

#[tauri::command]
fn reset_view_listeners_ready(app: tauri::AppHandle) {
    let state = app.state::<ViewListenersReady>();
    state.reset();
}

// ─── Command: drain pending torrent file paths ─────────────────────────────────

#[tauri::command]
fn get_pending_torrent_files(app: tauri::AppHandle) -> Vec<String> {
    let pending = app.state::<PendingTorrentFiles>();
    pending.drain()
}

// ─── Saved main-window state (read at creation time) ─────────────────────────

#[derive(Debug, Clone, serde::Deserialize)]
struct MainWindowSavedState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    #[serde(default)]
    maximized: bool,
}

/// Read the saved main-window geometry directly from `.window-state.json`.
/// Values are physical pixels at the source display's scale factor. Used by
/// `build_main_window` to create the window in place — see that function for
/// why the restore happens at creation rather than after.
fn read_saved_main_window_state(app_handle: &AppHandle) -> Option<MainWindowSavedState> {
    let path = app_handle
        .path()
        .app_config_dir()
        .ok()?
        .join(".window-state.json");
    let json = std::fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&json).ok()?;
    let entry = parsed.get(MAIN_WINDOW_LABEL)?;
    serde_json::from_value(entry.clone()).ok()
}

// ─── Single-instance / RunEvent::Opened handler ─────────────────────────────────

struct TorrentsFileOpen;

impl TorrentsFileOpen {
    /// Validate that `raw_path` is an existing file with a `.torrent` extension (case-insensitive).
    fn validate_path(raw_path: &str, cwd: Option<&Path>) -> Option<String> {
        // Strip file:// prefix if present (common on macOS)
        let decoded = if let Some(file_url) = raw_path.strip_prefix("file://") {
            urlencoding::decode(file_url).ok()?.into_owned()
        } else {
            raw_path.to_string()
        };

        let path = Path::new(&decoded);

        // Require .torrent extension (case-insensitive)
        let extension = path.extension()?.to_string_lossy();
        if !extension.eq_ignore_ascii_case("torrent") {
            return None;
        }

        // Resolve against the launching instance's cwd if relative.
        let abs_path = if path.is_relative() {
            cwd.map(Path::to_path_buf)
                .or_else(|| std::env::current_dir().ok())?
                .join(path)
        } else {
            path.to_path_buf()
        };

        // Require it to exist and be a file
        if !abs_path.is_file() {
            return None;
        }

        Some(abs_path.to_string_lossy().into_owned())
    }

    /// Reusable handler: validate `raw_paths`, enqueue new ones, focus main window,
    /// and emit `torrent-file-open` with the genuinely new paths.
    ///
    /// `emit` should be true for single-instance and RunEvent::Opened (renderer
    /// may already be listening); false for cold-start (renderer drains queue on mount).
    fn handle_raw_paths(
        app: &tauri::AppHandle,
        raw_paths: Vec<String>,
        cwd: Option<&Path>,
        emit: bool,
    ) {
        let valid_paths: Vec<String> = raw_paths
            .into_iter()
            .filter_map(|arg| Self::validate_path(&arg, cwd))
            .collect();

        if valid_paths.is_empty() {
            return;
        }

        let pending = app.state::<PendingTorrentFiles>();
        let new_paths = pending.enqueue(valid_paths);

        if new_paths.is_empty() {
            return;
        }

        // Focus main window
        show_main_window(app);

        // Emit only genuinely new paths to renderer
        if emit {
            let _ = app.emit("torrent-file-open", new_paths);
        }
    }
}

// ─── Magnet link open handler ─────────────────────────────────────────────────

struct MagnetLinkOpen;

impl MagnetLinkOpen {
    /// Enqueue magnet URLs, focus main window, and emit `magnet-link-open` event
    /// with the genuinely new URLs that were not previously seen this session.
    fn handle_urls(app: &tauri::AppHandle, raw_urls: Vec<String>, emit: bool) {
        let magnet_urls: Vec<String> = raw_urls
            .into_iter()
            .filter(|url| url.starts_with("magnet:?"))
            .collect();

        if magnet_urls.is_empty() {
            return;
        }

        let pending = app.state::<PendingMagnetLinks>();
        let new_urls = pending.enqueue(magnet_urls);

        if new_urls.is_empty() {
            return;
        }

        show_main_window(app);

        if emit {
            let _ = app.emit("magnet-link-open", new_urls);
        }
    }
}

mod commands;

use commands::{categories, menu, preferences, servers, tags, torrents, transfer};
use download_completion_notifications::{
    get_download_completion_notifications_enabled, set_download_completion_notifications_enabled,
};
use qb_tauri::app_builder::{add_desktop_plugins, add_shared_plugins, DESKTOP_SERVER_STORE_FILE};
use qb_tauri::magnet_links::PendingMagnetLinks;
use qb_tauri::server_repo::init_and_manage_repository;
use qb_tauri::session::create_session_state;
use qb_tauri::sync::{create_sync_manager_registry, setup_sync_lifecycle};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = add_shared_plugins(add_desktop_plugins(tauri::Builder::default()));
    let builder = builder.plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        None,
    ));
    let builder = builder.plugin(tauri_plugin_process::init());
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    builder
        .manage(create_session_state())
        .manage(PendingTorrentFiles::new())
        .manage(PendingMagnetLinks::new())
        .manage(PendingNativeUiActions::new())
        .manage(PendingViewActions::new())
        .manage(ViewListenersReady::new())
        .manage(TrayState::default())
        // codeql[rust/hard-coded-cryptographic-value] Tauri's handler macro emits command
        // metadata, including parameter names like "password"; no credential value is hard-coded.
        .invoke_handler(tauri::generate_handler![
            qb_tauri::session::get_session_state,
            qb_tauri::session::get_session_status,
            qb_tauri::session::get_session_generation,
            qb_tauri::session::session_connect,
            qb_tauri::session::session_connect_by_id,
            qb_tauri::session::session_switch_server_by_id,
            qb_tauri::session::session_disconnect,
            qb_tauri::session::session_reconnect,
            qb_tauri::session::session_health_check,
            qb_tauri::session::session_switch_server,
            qb_tauri::session::session_set_error,
            qb_tauri::session::session_clear_error,
            qb_tauri::session::session_teardown,
            qb_tauri::session::session_set_connecting,
            qb_tauri::session::get_session_snapshot,
            qb_tauri::session::bootstrap_session,
            qb_tauri::session::get_bootstrap_contract,
            servers::list_servers,
            servers::get_active_server,
            servers::add_server,
            servers::update_server,
            servers::remove_server,
            servers::select_server,
            servers::get_path_mappings,
            servers::set_path_mappings,
            servers::resolve_local_path,
            servers::open_local_path,
            servers::reveal_local_item,
            servers::normalize_server_url_cmd,
            torrents::get_torrent_list,
            torrents::get_torrent_properties,
            torrents::get_torrent_trackers,
            torrents::get_torrent_files,
            torrents::add_torrent_options,
            torrents::pause_torrents,
            torrents::resume_torrents,
            torrents::delete_torrents,
            torrents::recheck_torrents,
            torrents::reannounce_torrents,
            torrents::set_force_start,
            torrents::set_torrent_category,
            torrents::get_torrent_download_limit,
            torrents::set_torrent_download_limit,
            torrents::get_torrent_upload_limit,
            torrents::set_torrent_upload_limit,
            torrents::set_file_priority,
            torrents::set_torrent_name,
            torrents::rename_file,
            torrents::rename_folder,
            torrents::set_torrent_location,
            torrents::increase_priority,
            torrents::decrease_priority,
            torrents::top_priority,
            torrents::bottom_priority,
            transfer::get_transfer_info,
            transfer::get_speed_limits_mode,
            transfer::toggle_speed_limits_mode,
            transfer::get_download_limit,
            transfer::set_download_limit,
            transfer::get_upload_limit,
            transfer::set_upload_limit,
            transfer::ban_peers,
            transfer::get_cookies,
            transfer::set_cookies,
            transfer::logout,
            categories::get_categories,
            categories::create_category,
            categories::edit_category,
            categories::remove_categories,
            tags::get_tags,
            tags::create_tags,
            tags::delete_tags,
            tags::add_torrent_tags,
            tags::remove_torrent_tags,
            preferences::get_preferences,
            preferences::set_preferences,
            preferences::get_version,
            preferences::get_webapi_version,
            preferences::get_build_info,
            preferences::get_default_save_path,
            preferences::shutdown_server,
            torrents::add_trackers,
            torrents::add_peers,
            torrents::edit_tracker,
            torrents::remove_trackers,
            torrents::sync_torrent_peers,
            torrents::get_torrent_webseeds,
            torrents::add_webseeds,
            torrents::edit_webseed,
            torrents::remove_webseeds,
            torrents::start_search,
            torrents::stop_search,
            torrents::get_search_status,
            torrents::get_search_results,
            torrents::delete_search,
            torrents::get_search_plugins,
            torrents::install_search_plugin,
            torrents::uninstall_search_plugin,
            torrents::enable_search_plugin,
            torrents::update_search_plugins,
            torrents::set_auto_management,
            torrents::set_share_limits,
            torrents::set_sequential_download,
            torrents::set_first_last_piece_priority,
            torrents::set_super_seeding,
            torrents::export_torrent,
            qb_tauri::commands::app::get_rss_items,
            qb_tauri::commands::app::get_rss_rules,
            qb_tauri::commands::app::add_rss_feed,
            qb_tauri::commands::app::set_rss_feed_url,
            qb_tauri::commands::app::remove_rss_item,
            qb_tauri::commands::app::set_rss_rule,
            qb_tauri::commands::app::rename_rss_rule,
            qb_tauri::commands::app::remove_rss_rule,
            qb_tauri::commands::sync::get_maindata_snapshot,
            qb_tauri::commands::sync::get_maindata_sync_status,
            qb_tauri::commands::sync::start_maindata_sync,
            qb_tauri::commands::sync::stop_maindata_sync,
            qb_tauri::workspace::set_workspace_view,
            qb_tauri::workspace::get_workspace_view,
            menu::sync_menu_state,
            menu::exit_app,
            get_pending_torrent_files,
            qb_tauri::magnet_links::get_pending_magnet_links,
            get_pending_native_ui_actions,
            get_pending_view_actions,
            set_view_listeners_ready,
            reset_view_listeners_ready,
            get_download_completion_notifications_enabled,
            set_download_completion_notifications_enabled,
        ])
        .setup(|app: &mut tauri::App| {
            let server_repo = init_and_manage_repository(app.handle(), DESKTOP_SERVER_STORE_FILE)
                .expect("Failed to initialize server repository");
            app.manage(server_repo);

            // Set up the sync manager registry as Tauri state.
            app.manage(create_sync_manager_registry());
            // Set up the sync manager lifecycle (session → sync actor start/stop).
            setup_sync_lifecycle(app.handle());
            let monitor_state = download_completion_notifications::create_monitor_state(false);
            let monitor_state_arc = monitor_state.clone();
            app.manage(monitor_state);

            // Enable/disable download completion notifications monitor based on
            // session connection status. The monitor starts disabled at launch and
            // is only activated after a successful server connection.
            let monitor_for_connect = monitor_state_arc.clone();
            let monitor_for_disconnect = monitor_state_arc.clone();
            app.listen("session-changed", move |event| {
                let payload = event.payload();
                let Ok(parsed) = serde_json::from_str::<SessionStatusPayload>(payload) else {
                    return;
                };
                match parsed.status.as_str() {
                    "connected" => {
                        monitor_for_connect.set_enabled(true);
                        log::info!(
                            "download_completion_notifications: enabled (session connected)"
                        );
                    }
                    "disconnected" | "error" => {
                        monitor_for_disconnect.set_enabled(false);
                        log::info!(
                            "download_completion_notifications: disabled (session {status})",
                            status = parsed.status
                        );
                    }
                    _ => {}
                }
            });

            // Keep native logs on the plugin's default targets and forward only
            // webview-origin logs to the renderer.
            let webview_log_target = tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Webview,
            )
            .filter(|metadata| {
                metadata
                    .target()
                    .starts_with(tauri_plugin_log::WEBVIEW_TARGET)
            });
            let level = if cfg!(debug_assertions) {
                log::LevelFilter::Debug
            } else {
                log::LevelFilter::Warn
            };
            let log_builder = tauri_plugin_log::Builder::default()
                .level(level)
                .target(webview_log_target);
            app.handle().plugin(log_builder.build())?;

            // The main window uses `create: false` in tauri.conf.json so we can
            // build it manually here, directly at its saved geometry (see
            // build_main_window). Auto-creation would place it centered on the
            // primary display, after which JS would move it — causing a visible
            // cross-display jump on launch and tray-restore. Created after the
            // log plugin so the webview's logs forward to the renderer target.
            ensure_main_window(app.handle())?;
            // Spawn after the log plugin is installed so startup diagnostics are visible.
            let session_handle = app
                .state::<qb_tauri::session::SessionStateHandle>()
                .inner()
                .clone();
            download_completion_notifications::spawn_monitor(
                session_handle,
                monitor_state_arc,
                app.handle().clone(),
            );
            app.handle().plugin(tauri_plugin_shell::init())?;

            // Register deep-link handler for magnet URLs arriving while the app is running.
            {
                let handle = app.handle().clone();
                let _ = app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    MagnetLinkOpen::handle_urls(&handle, urls, true);
                });
            }

            // Check if the app was started via a deep link (cold-start).
            {
                let handle = app.handle();
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    let url_strings: Vec<String> = urls.iter().map(|u| u.to_string()).collect();
                    let pending = handle.state::<PendingMagnetLinks>();
                    pending.enqueue(url_strings);
                }
            }

            // Register single-instance plugin to handle .torrent file opens from a second instance.
            // Queue + emit because renderer may not be listening yet (cold-start case).
            app.handle()
                .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
                    let cwd = Path::new(&cwd);
                    TorrentsFileOpen::handle_raw_paths(
                        app,
                        args.clone(),
                        Some(cwd),
                        true, // emit
                    );
                    MagnetLinkOpen::handle_urls(app, args, true);
                }))?;

            // Handle RunEvent::Opened on macOS when the app is already running and receives
            // a file-open event from the OS (e.g. double-clicking a .torrent in Finder).
            // Also handle RunEvent::Reopen to show the window when clicking the Dock icon
            // after the window was hidden to tray.
            // Registered as a custom plugin so its on_event handler receives RunEvent::Opened.
            #[cfg(target_os = "macos")]
            {
                use tauri::Wry;
                app.handle().plugin(
                    tauri::plugin::Builder::<Wry, ()>::new("torrent-file-open-run-event")
                        .on_event(|app, event| match event {
                            tauri::RunEvent::Opened { urls } => {
                                let raw_paths: Vec<String> =
                                    urls.iter().map(|u| u.to_string()).collect();
                                TorrentsFileOpen::handle_raw_paths(app, raw_paths, None, true);
                            }
                            tauri::RunEvent::Reopen {
                                has_visible_windows,
                                ..
                            } => {
                                if !has_visible_windows {
                                    show_main_window(app);
                                }
                            }
                            _ => {}
                        })
                        .build(),
                )?;
            }

            // Cold-start: collect valid .torrent paths from initial command-line args and queue them.
            // Do NOT emit — renderer drains the queue on mount via get_pending_torrent_files.
            let cold_start_raw: Vec<String> = std::env::args().skip(1).collect();
            TorrentsFileOpen::handle_raw_paths(app.handle(), cold_start_raw, None, false);

            // Set up the native macOS app menu before tray so menu events are wired up first.
            menu::setup_native_menu(app)?;
            menu::setup_menu_events(app)?;

            tray::setup_tray(app)?;

            // Start to tray if the setting is enabled (fresh process launch).
            // Hide the window instead of closing it — closing destroys the webview,
            // which prevents the renderer from loading, session from connecting,
            // and polling from running. Hiding keeps the webview alive so the app
            // is fully functional in the background with only the tray visible.
            if let Ok(store) = app.store(".settings.dat") {
                if store
                    .get("start_minimized")
                    .and_then(|v| v.as_str().map(|s| s == "true"))
                    .unwrap_or(false)
                {
                    if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                        if main.is_visible().unwrap_or(false) {
                            set_dock_visibility(app.handle(), false);
                            enter_tray_mode(app.handle());
                            let _ = main.hide();
                            crate::tray::set_tray_window_visible(app.handle(), false);
                            // Notify sync managers that the app started hidden.
                            // Without this emission the sync manager defaults
                            // `is_visible = true` and polls at foreground speed.
                            let _ = app.handle().emit(
                                "app-visibility-changed",
                                serde_json::json!({ "visible": false }),
                            );
                        }
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == MAIN_WINDOW_LABEL {
                        let state = window.app_handle().state::<TrayState>();
                        if !state
                            .intentional_close_for_tray
                            .swap(false, Ordering::SeqCst)
                        {
                            // Read close_to_tray setting from store
                            let should_hide = window
                                .app_handle()
                                .store(".settings.dat")
                                .ok()
                                .and_then(|store| store.get("close_to_tray"))
                                .and_then(|v| v.as_str().map(|s| s == "true"))
                                .unwrap_or(false);
                            if should_hide {
                                api.prevent_close();
                                hide_main_window_to_tray(window, window.app_handle());
                            }
                            // else: allow normal close
                        }
                    }
                }
                tauri::WindowEvent::Focused(focused) => {
                    if window.label() == MAIN_WINDOW_LABEL && *focused {
                        // Only emit on focus-gained. The `visible: false` signal
                        // is exclusively sent via the tray-suspend path, which
                        // correctly handles the case where the user clicks an
                        // auxiliary window (settings, add-torrent, dialog-host)
                        // and the main window loses focus — the app is still
                        // visible and should continue foreground polling.
                        let _ = window.app_handle().emit(
                            "app-visibility-changed",
                            serde_json::json!({ "visible": true }),
                        );
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                let state = app.state::<TrayState>();
                if state.explicit_quit_requested.swap(false, Ordering::SeqCst) {
                    return;
                }

                // Intercept only implicit last-window exits during tray suspend.
                let is_tray_suspend_exit = code.is_none_or(|c| c == 0);

                if is_tray_suspend_exit {
                    // Only prevent exit when we are in tray mode (last window was closed intentionally).
                    if state.was_hidden_to_tray.load(Ordering::SeqCst) {
                        api.prevent_exit();
                    }
                }
            }
        });
}
