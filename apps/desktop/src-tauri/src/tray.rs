// apps/desktop/src-tauri/src/tray.rs
//
// Desktop tray owner: creates and manages the system tray icon and dynamic
// context menu with qBittorrent-style grouped items.
//
// Tray items that open auxiliary/dialog windows (add torrent, set global speed
// limits) create those windows directly in Rust without
// spawning or restoring the main window. Singleton windows (add-torrent,
// dialog-host) are reused when visible; when reused they receive a fresh
// navigate event so the dialog remounts with updated payload.
//
// Tray items that are pure session actions (toggle alt speed) call existing
// backend command helpers directly and update local tray state optimistically,
// allowing the frontend's next sync_menu_state to overwrite as authoritative.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use urlencoding::encode as url_encode;

use crate::request_app_quit;
use crate::show_main_window;
use crate::suspend_main_window_to_tray;

// ─── Tray menu item IDs ──────────────────────────────────────────────────────

pub mod id {
    pub const SHOW_HIDE: &str = "tray_show_hide";
    pub const ADD_TORRENT: &str = "tray_add_torrent";
    pub const ALTERNATIVE_SPEED: &str = "tray_alternative_speed";
    pub const SET_GLOBAL_SPEED_LIMITS: &str = "tray_set_global_speed_limits";
    pub const QUIT: &str = "tray_quit";
}

// ─── Tray menu state ────────────────────────────────────────────────────────

/// Managed state for the dynamic tray menu.
/// Updated from Rust-side optimistic updates and from frontend sync_menu_state.
#[derive(Debug, Clone, Default)]
pub struct TrayMenuState {
    /// Whether the main window is currently visible.
    pub window_visible: bool,
    /// Whether the alternative (scheduled) speed limits are active.
    pub alt_speed_active: bool,
}

// ─── Inner storage for TrayMenuState ─────────────────────────────────────────

struct TrayStateInner {
    state: TrayMenuState,
    /// Set when the renderer has pushed an authoritative sync that should
    /// overwrite any optimistic Rust-side update.
    renderer_synced: AtomicBool,
    /// Handle to the Show/Hide menu item so we can update its label in-place
    /// without rebuilding the entire tray menu. This is the actual item
    /// inserted into the tray menu (not a separate clone).
    show_hide_item: Mutex<Option<MenuItem<tauri::Wry>>>,
    /// Handle to the Alternative Speed Limits check menu item so we can
    /// update its checked state in-place without rebuilding the tray menu.
    alt_speed_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
}

impl Default for TrayStateInner {
    fn default() -> Self {
        Self {
            state: TrayMenuState::default(),
            renderer_synced: AtomicBool::new(false),
            show_hide_item: Mutex::new(None),
            alt_speed_item: Mutex::new(None),
        }
    }
}

/// Stored in Tauri app state so tray.rs can read/write tray menu state.
pub struct TrayStateHandle {
    inner: Mutex<TrayStateInner>,
}

impl Default for TrayStateHandle {
    fn default() -> Self {
        Self {
            inner: Mutex::new(TrayStateInner::default()),
        }
    }
}

impl TrayStateHandle {
    /// Read the current tray menu state.
    pub fn get_state(&self) -> TrayMenuState {
        self.inner.lock().unwrap().state.clone()
    }

    /// Update state. If `from_renderer` is true, mark renderer-synced so
    /// optimistic Rust updates do not overwrite until the next renderer sync.
    pub fn set_state(&self, state: TrayMenuState, from_renderer: bool) {
        let mut inner = self.inner.lock().unwrap();
        inner.state = state;
        if from_renderer {
            inner.renderer_synced.store(true, Ordering::SeqCst);
        }
    }

    /// Returns true if the renderer has synced since the last optimistic update.
    /// Register the Show/Hide menu item handle so we can update its label
    /// in-place (via set_text) without rebuilding the entire tray menu.
    pub fn set_show_hide_item(&self, item: MenuItem<tauri::Wry>) {
        // Lock the outer Mutex, then use get_mut() on the inner Mutex<Option<...>>
        // to get &mut Option<MenuItem<Wry>> so we can assign to it.
        let mut inner = self.inner.lock().unwrap();
        let slot = inner.show_hide_item.get_mut().unwrap();
        *slot = Some(item);
    }

    /// Register the Alternative Speed Limits check menu item handle so we can
    /// update its checked state in-place without rebuilding the tray menu.
    pub fn set_alt_speed_item(&self, item: CheckMenuItem<tauri::Wry>) {
        let mut inner = self.inner.lock().unwrap();
        let slot = inner.alt_speed_item.get_mut().unwrap();
        *slot = Some(item);
    }

    /// Update the Show/Hide menu item label in-place using `set_text`,
    /// avoiding a full menu rebuild. No-ops if the handle is not yet registered.
    pub fn update_show_hide_label(&self, window_visible: bool) {
        let label = visibility_label(window_visible);
        let inner_guard = self.inner.lock().unwrap();
        let item_guard = inner_guard.show_hide_item.lock().unwrap();
        if let Some(item) = item_guard.as_ref() {
            let _ = item.set_text(label);
        }
    }

    /// Update the Alternative Speed Limits check menu item checked state
    /// in-place using `set_checked`, avoiding a full menu rebuild.
    /// No-ops if the handle is not yet registered.
    pub fn update_alt_speed_checked(&self, alt_speed_active: bool) {
        let inner_guard = self.inner.lock().unwrap();
        let item_guard = inner_guard.alt_speed_item.lock().unwrap();
        if let Some(item) = item_guard.as_ref() {
            let _ = item.set_checked(alt_speed_active);
        }
    }

    /// Update both stored tray menu item handles in-place from current state.
    /// Does not rebuild the tray menu. Safe to call during tray event handling.
    pub fn update_stored_item_states(&self, state: &TrayMenuState) {
        self.update_show_hide_label(state.window_visible);
        self.update_alt_speed_checked(state.alt_speed_active);
    }
}

// ─── Helpers available to lib.rs ────────────────────────────────────────────

/// Visibility toggle label: "Hide" when visible, "Show" when hidden.
fn visibility_label(window_visible: bool) -> &'static str {
    if window_visible {
        "Hide"
    } else {
        "Show"
    }
}

/// Whether to show the Pause Session item (vs Resume Session).
/// NO LONGER USED — session pause/resume items removed per T84.
#[allow(dead_code)]
fn show_pause_item(_state: &TrayMenuState) -> bool {
    false
}

/// Build the tray menu from the current state.
/// Returns the menu and handles to the two dynamic items that need runtime
/// label/checked-state updates so callers can store them directly (not clones).
fn build_tray_menu(
    app_handle: &AppHandle,
    state: &TrayMenuState,
) -> tauri::Result<(
    Menu<tauri::Wry>,
    MenuItem<tauri::Wry>,
    CheckMenuItem<tauri::Wry>,
)> {
    let show_hide_label = visibility_label(state.window_visible);

    let show_hide_item = MenuItem::with_id(
        app_handle,
        id::SHOW_HIDE,
        show_hide_label,
        true,
        None::<&str>,
    )?;

    let add_torrent_item = MenuItem::with_id(
        app_handle,
        id::ADD_TORRENT,
        "Add Torrent File/Magnet...",
        true,
        None::<&str>,
    )?;

    let alt_speed_check = CheckMenuItem::with_id(
        app_handle,
        id::ALTERNATIVE_SPEED,
        "Alternative Speed Limits",
        true,
        state.alt_speed_active,
        None::<&str>,
    )?;

    let global_speed_item = MenuItem::with_id(
        app_handle,
        id::SET_GLOBAL_SPEED_LIMITS,
        "Set Global Speed Limits...",
        true,
        None::<&str>,
    )?;

    let quit_item = MenuItem::with_id(app_handle, id::QUIT, "Quit", true, None::<&str>)?;

    // Each separator is a distinct handle — reuse of the same variable would
    // cause a native tray crash on some platforms.
    let sep_after_show_hide = PredefinedMenuItem::separator(app_handle)?;
    let sep_before_quit = PredefinedMenuItem::separator(app_handle)?;

    // qBittorrent grouping adjusted for Taurent's unified add-torrent dialog:
    // Show/Hide, separator, Add Torrent File/Magnet, Alternative Speed Limits,
    // Set Global Speed Limits, separator, Quit.
    let menu = Menu::with_items(
        app_handle,
        &[
            &show_hide_item,
            &sep_after_show_hide,
            &add_torrent_item,
            &alt_speed_check,
            &global_speed_item,
            &sep_before_quit,
            &quit_item,
        ],
    )?;

    Ok((menu, show_hide_item, alt_speed_check))
}

// ─── Tray event handlers ──────────────────────────────────────────────────────

/// Open the unified add-torrent auxiliary window in the file/magnet UX.
fn open_add_torrent_window(app_handle: &AppHandle) {
    let label = "add-torrent";
    let route = "/add-torrent-window".to_owned();
    let payload = serde_json::json!({ "source": "link" });
    let query = "source=link".to_owned();

    if let Some(win) = app_handle.get_webview_window(label) {
        // Emit navigate event so the existing window remounts with fresh payload.
        let _ = win.emit(
            "add-torrent:navigate",
            serde_json::json!({
                "route": route,
                "payload": payload,
            }),
        );
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return;
    }

    let url = WebviewUrl::App(format!("{}?{}", route, query).into());

    match WebviewWindowBuilder::new(app_handle, label, url)
        .title("Add Torrent")
        .inner_size(700.0, 680.0)
        .min_inner_size(700.0, 680.0)
        .resizable(false)
        .decorations(true)
        .visible(false)
        .build()
    {
        Ok(win) => {
            let _ = win.show();
        }
        Err(err) => {
            log::error!("failed to open add-torrent window: {err}");
        }
    }
}

/// Open the global speed limits dialog via the dialog-host route.
fn open_global_speed_limits_dialog(app_handle: &AppHandle) {
    use std::sync::atomic::AtomicU64;
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let open_id = SEQUENCE.fetch_add(1, Ordering::SeqCst).to_string();

    let label = "dialog-host";
    let route = "/dialog-host-window";
    let payload = serde_json::json!({
        "dialog": "transfer-limit",
        "mode": "combined",
        "openId": open_id,
    });

    if let Some(win) = app_handle.get_webview_window(label) {
        // Emit navigate event so the existing window remounts with fresh payload.
        let _ = win.emit(
            "dialog-host:navigate",
            serde_json::json!({
                "route": route,
                "payload": payload,
            }),
        );
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return;
    }

    let query = format!(
        "dialog=transfer-limit&mode=combined&openId={}",
        url_encode(&open_id)
    );
    let url = WebviewUrl::App(format!("{}?{}", route, query).into());

    match WebviewWindowBuilder::new(app_handle, label, url)
        .title("Global Speed Limits")
        .inner_size(400.0, 340.0)
        .min_inner_size(400.0, 340.0)
        .resizable(false)
        .minimizable(false)
        .decorations(true)
        .visible(false)
        .build()
    {
        Ok(win) => {
            let _ = win.show();
        }
        Err(err) => {
            log::error!("failed to open global speed limits dialog: {err}");
        }
    }
}

/// Rebuild the tray menu from current state and apply it to the existing tray icon.
/// ONLY used as a documented fallback when in-place updates are unavailable
/// (e.g. if the menu handle is lost). Should NOT be called during tray event
/// handling — use in-place updates instead.
#[allow(dead_code)]
fn rebuild_tray_menu(app_handle: &AppHandle) {
    let Some(tray) = app_handle.tray_by_id("main-tray") else {
        return;
    };
    let state_handle = app_handle.state::<TrayStateHandle>();
    let state = state_handle.get_state();
    match build_tray_menu(app_handle, &state) {
        Ok((menu, _, _)) => {
            let _ = tray.set_menu(Some(menu));
        }
        Err(err) => {
            log::error!("failed to rebuild tray menu: {err}");
        }
    }
}

/// Update tray state and refresh stored item handles in-place.
/// Does NOT rebuild the tray menu — safe to call during tray event handling.
pub fn update_tray_state(app_handle: &AppHandle, state: TrayMenuState, from_renderer: bool) {
    let state_handle = app_handle.state::<TrayStateHandle>();
    state_handle.set_state(state.clone(), from_renderer);
    // Update both dynamic items in-place (show/hide label + alt-speed checked state)
    state_handle.update_stored_item_states(&state);
}

/// Refresh the tray menu label after a visibility change.
/// Uses in-place `set_text` on the Show/Hide item. This is the safe path
/// for visibility changes that occur during tray event handling — it does NOT
/// rebuild the tray menu or call `tray.set_menu`.
#[allow(dead_code)]
pub fn refresh_tray_visibility(app_handle: &AppHandle) {
    let state_handle = app_handle.state::<TrayStateHandle>();

    // Determine current visibility from the main window's presence.
    let window_visible = app_handle
        .get_webview_window("main")
        .is_some_and(|w| w.is_visible().unwrap_or(false));

    // Update state optimistically (from_renderer = false)
    let mut state = state_handle.get_state();
    state.window_visible = window_visible;
    state_handle.set_state(state, false);

    // Update the Show/Hide label in-place (no menu rebuild).
    state_handle.update_show_hide_label(window_visible);
}

/// Explicitly set the tray window visibility and update the Show/Hide label
/// in-place. Use this in show/hide lifecycle paths instead of recomputing
/// from the window. Does NOT rebuild the tray menu.
pub fn set_tray_window_visible(app_handle: &AppHandle, visible: bool) {
    let state_handle = app_handle.state::<TrayStateHandle>();
    let mut state = state_handle.get_state();
    state.window_visible = visible;
    state_handle.set_state(state, false);
    state_handle.update_show_hide_label(visible);
}

// ─── Tray setup ───────────────────────────────────────────────────────────────

const MAIN_TRAY_ID: &str = "main-tray";

fn build_tray_icon(_app: &tauri::App) -> (Image<'static>, bool) {
    #[cfg(target_os = "macos")]
    {
        let icon_bytes = include_bytes!("../icons/tray-template.rgba");
        return (Image::new(icon_bytes, 64, 64).to_owned(), true);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let icon = _app.default_window_icon().cloned().unwrap_or_else(|| {
            log::warn!("default window icon unavailable; falling back to template tray icon");
            let icon_bytes = include_bytes!("../icons/tray-template.rgba");
            Image::new(icon_bytes, 64, 64).to_owned()
        });
        (icon, false)
    }
}

/// Create the system tray icon with a dynamic context menu.
/// Call this once from `lib.rs` setup.
pub fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    // Initialize tray state with conservative defaults (window hidden, alt speed
    // off, disconnected until frontend syncs).
    let initial_state = TrayMenuState {
        window_visible: false,
        alt_speed_active: false,
    };
    app.manage(TrayStateHandle::default());

    let state_handle = app.state::<TrayStateHandle>();
    state_handle.set_state(initial_state, false);

    let (tray_icon, tray_icon_as_template) = build_tray_icon(app);

    let menu = Menu::with_items(app.handle(), &[])?;
    let tray = TrayIconBuilder::with_id(MAIN_TRAY_ID)
        .icon(tray_icon)
        .icon_as_template(tray_icon_as_template)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app_handle: &AppHandle, event| {
            let id = event.id.as_ref();
            match id {
                id::SHOW_HIDE => {
                    let state_handle = app_handle.state::<TrayStateHandle>();
                    let state = state_handle.get_state();
                    if state.window_visible {
                        suspend_main_window_to_tray(app_handle);
                    } else {
                        show_main_window(app_handle);
                    }
                    // Visibility already updated inside show_main_window / suspend_main_window_to_tray via lib.rs hooks.
                }
                id::ADD_TORRENT => {
                    // Open the unified add-torrent window — no file picker, no main window.
                    open_add_torrent_window(app_handle);
                }
                id::ALTERNATIVE_SPEED => {
                    // Toggle alt speed by calling the backend command helper directly.
                    let app = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let session_state = app.state::<qb_tauri::session::SessionStateHandle>();
                        // State is Clone — clone to get an owned State we can move into the async block.
                        let result = crate::commands::transfer::toggle_speed_limits_mode(
                            session_state.clone(),
                            app.clone(),
                        )
                        .await;
                        if let Err(err) = result {
                            log::error!("tray alt speed toggle failed: {err}");
                            return;
                        }
                        // Optimistically flip alt-speed state and update the stored
                        // check item in-place (avoids tray menu rebuild during event handling).
                        let state_handle = app.state::<TrayStateHandle>();
                        let mut state = state_handle.get_state();
                        state.alt_speed_active = !state.alt_speed_active;
                        state_handle.set_state(state.clone(), false);
                        state_handle.update_alt_speed_checked(state.alt_speed_active);
                    });
                }
                id::SET_GLOBAL_SPEED_LIMITS => {
                    open_global_speed_limits_dialog(app_handle);
                }
                id::QUIT => {
                    request_app_quit(app_handle);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
                // Visibility already set explicitly true inside show_main_window
                // via set_tray_window_visible — no additional refresh needed.
            }
        })
        .build(app.handle())?;

    // Build initial menu now that the tray handle exists.
    // build_tray_menu returns the menu plus handles to the two dynamic items
    // (show/hide and alt-speed check). Store the exact handles inserted into
    // the menu so in-place updates work correctly.
    let state = app.state::<TrayStateHandle>().get_state();
    let (menu, show_hide_item, alt_speed_check) = build_tray_menu(app.handle(), &state)?;

    let state_handle = app.state::<TrayStateHandle>();
    state_handle.set_show_hide_item(show_hide_item);
    state_handle.set_alt_speed_item(alt_speed_check);

    let _ = tray.set_menu(Some(menu));

    Ok(())
}
