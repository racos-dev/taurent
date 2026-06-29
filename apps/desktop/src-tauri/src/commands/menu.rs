// commands/menu.rs — desktop menu Tauri commands and native menu logic
//
// Native menu events are targeted at the main window only to avoid duplicate handling
// across auxiliary windows.

use serde::{Deserialize, Serialize};
#[cfg(target_os = "macos")]
use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{menu::MenuEvent, AppHandle, Emitter, Manager};

/// Label of the main webview window.
const MAIN_WINDOW_LABEL: &str = "main";

use crate::NativeUiAction;
use crate::PendingNativeUiActions as RustPendingNativeUiActions;
use crate::PendingViewActions;
use crate::ViewListenersReady;

/// If `main` window exists, emit `event` with `payload` to it.
/// Silently no-ops if `main` is absent.
fn emit_to_main_if_present(
    app: &tauri::AppHandle<tauri::Wry>,
    event: &str,
    payload: impl serde::Serialize + Clone,
) {
    if app.get_webview_window(MAIN_WINDOW_LABEL).is_some() {
        let _ = app.emit_to(MAIN_WINDOW_LABEL, event, payload);
    }
}

/// Route a UI-open action: emit immediately if main is present, otherwise
/// enqueue it so the renderer drains it after recreating main.
fn route_ui_action(app: &tauri::AppHandle<tauri::Wry>, action: NativeUiAction) {
    if app.get_webview_window(MAIN_WINDOW_LABEL).is_some() {
        // Main exists — emit immediately.
        match &action {
            NativeUiAction::Settings => emit_to_main_if_present(app, "menu:settings", ()),
            NativeUiAction::About => emit_to_main_if_present(app, "menu:about", ()),
            NativeUiAction::AddTorrent => emit_to_main_if_present(app, "menu:add-torrent", ()),
            NativeUiAction::Nav { route } => {
                emit_to_main_if_present(app, "menu:nav", route.clone())
            }
            NativeUiAction::AddTorrentSource { .. } => {
                emit_to_main_if_present(app, "menu:tray-action", action.clone())
            }
            NativeUiAction::SetGlobalSpeedLimits => {
                emit_to_main_if_present(app, "menu:tray-action", action.clone())
            }
        }
    } else {
        // Main absent — enqueue and recreate.
        let pending = app.state::<RustPendingNativeUiActions>();
        pending.enqueue(vec![action]);
        crate::show_main_window(app);
    }
}

/// Route a view toggle action: emit immediately if JS listeners are ready,
/// otherwise enqueue it so the renderer drains it after listeners register.
fn route_view_action(app: &tauri::AppHandle<tauri::Wry>, panel: &str) {
    let ready = app.state::<ViewListenersReady>();
    if ready.is_ready() {
        emit_to_main_if_present(app, "menu:view", panel.to_string());
    } else {
        let pending = app.state::<PendingViewActions>();
        pending.enqueue(vec![panel.to_string()]);
    }
}

/// Dynamic menu state synced from the frontend via `sync_menu_state`.
/// `can_*` fields control enabled/disabled; `view_*` fields carry the current
/// checked state for View-menu toggles.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MenuState {
    pub can_pause: bool,
    pub can_resume: bool,
    pub can_delete: bool,
    pub can_recheck: bool,
    pub can_reannounce: bool,
    pub can_force_start: bool,
    pub can_set_category: bool,
    pub can_set_tags: bool,
    pub can_queue_up: bool,
    pub can_queue_down: bool,
    pub can_move_top: bool,
    pub can_move_bottom: bool,
    /// Whether the sidebar is currently visible (View → Toggle Sidebar checked state)
    pub view_sidebar: bool,
    /// Whether the details panel is currently visible (View → Toggle Details checked state)
    pub view_details: bool,
    /// Whether the in-window menubar is currently visible (macOS only)
    pub in_window_menubar: bool,
    /// ---- Tray fields (set by frontend's tray state derivation) ----
    /// Whether the alternative speed limits are currently active.
    #[serde(default)]
    pub tray_alt_speed_active: bool,
    /// Whether the qBittorrent session is connected.
    #[serde(default)]
    pub tray_connected: bool,
}

// ---------------------------------------------------------------------------
// Menu item handle storage (macOS only)
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
mod menu_handles {
    use std::sync::{Arc, Mutex, OnceLock};
    use tauri::menu::{CheckMenuItem, MenuItem};

    // Type-erased handle that supports set_enabled (MenuItem) and set_checked
    // (CheckMenuItem). We store MenuItem handles for torrent items (enable/disable)
    // and CheckMenuItem handles for view items (checked state).
    //
    // We need two separate vectors because the two types require different trait
    // objects (different method signatures). Using two trait-object vectors avoids
    // any transmute or type-coercion unsafety.
    static TORRENT_HANDLES: OnceLock<Mutex<Vec<Arc<dyn EnableDisable>>>> = OnceLock::new();
    static VIEW_HANDLES: OnceLock<Mutex<Vec<Arc<dyn Checkable>>>> = OnceLock::new();

    fn torrent_handles() -> &'static Mutex<Vec<Arc<dyn EnableDisable>>> {
        TORRENT_HANDLES.get_or_init(|| Mutex::new(Vec::new()))
    }

    fn view_handles() -> &'static Mutex<Vec<Arc<dyn Checkable>>> {
        VIEW_HANDLES.get_or_init(|| Mutex::new(Vec::new()))
    }

    /// Supports set_enabled(enabled: bool)
    pub(super) trait EnableDisable: Send + Sync {
        fn set_enabled(&self, enabled: bool);
    }

    impl<R: tauri::Runtime> EnableDisable for MenuItem<R> {
        fn set_enabled(&self, enabled: bool) {
            // set_enabled takes &self only (no AppHandle needed)
            let _ = MenuItem::set_enabled(self, enabled);
        }
    }

    /// Supports set_checked(checked: bool)
    pub(super) trait Checkable: Send + Sync {
        fn set_checked(&self, checked: bool);
    }

    impl<R: tauri::Runtime> Checkable for CheckMenuItem<R> {
        fn set_checked(&self, checked: bool) {
            let _ = CheckMenuItem::set_checked(self, checked);
        }
    }

    pub(super) fn clear() {
        let mut torrent = torrent_handles().lock().unwrap_or_else(|e| e.into_inner());
        torrent.clear();
        drop(torrent);

        let mut view = view_handles().lock().unwrap_or_else(|e| e.into_inner());
        view.clear();
    }

    /// Store a MenuItem handle (cloned as Arc)
    pub(super) fn push_torrent<R: tauri::Runtime>(item: MenuItem<R>) {
        let arc: Arc<dyn EnableDisable> = Arc::new(item);
        let mut items = torrent_handles().lock().unwrap_or_else(|e| e.into_inner());
        items.push(arc);
    }

    /// Store a CheckMenuItem handle (cloned as Arc)
    pub(super) fn push_view<R: tauri::Runtime>(item: CheckMenuItem<R>) {
        let arc: Arc<dyn Checkable> = Arc::new(item);
        let mut items = view_handles().lock().unwrap_or_else(|e| e.into_inner());
        items.push(arc);
    }

    /// Apply enable/disable to all stored torrent items
    pub(super) fn apply_torrent_states(states: &[bool]) {
        let items = torrent_handles().lock().unwrap_or_else(|e| e.into_inner());
        for (i, item) in items.iter().enumerate() {
            if i < states.len() {
                item.set_enabled(states[i]);
            }
        }
    }

    /// Apply checked state to all stored view items
    pub(super) fn apply_view_states(states: &[bool]) {
        let items = view_handles().lock().unwrap_or_else(|e| e.into_inner());
        for (i, item) in items.iter().enumerate() {
            if i < states.len() {
                item.set_checked(states[i]);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Menu item IDs
// ---------------------------------------------------------------------------

/// Menu item IDs.
pub mod id {
    // App-level items
    pub const APP_ABOUT: &str = "app_about";
    pub const APP_SETTINGS: &str = "app_settings";
    pub const APP_HIDE: &str = "app_hide";
    pub const APP_HIDE_OTHERS: &str = "app_hide_others";
    pub const APP_UNHIDE: &str = "app_unhide";
    pub const APP_QUIT: &str = "app_quit";

    // File submenu
    pub const FILE_ADD: &str = "file_add";

    // Torrent submenu
    pub const TORRENT_PAUSE: &str = "torrent_pause";
    pub const TORRENT_RESUME: &str = "torrent_resume";
    pub const TORRENT_DELETE: &str = "torrent_delete";
    pub const TORRENT_RECHECK: &str = "torrent_recheck";
    pub const TORRENT_REANNOUNCE: &str = "torrent_reannounce";
    pub const TORRENT_FORCE_START: &str = "torrent_force_start";
    pub const TORRENT_SET_CATEGORY: &str = "torrent_set_category";
    pub const TORRENT_SET_TAGS: &str = "torrent_set_tags";
    pub const TORRENT_QUEUE_UP: &str = "torrent_queue_up";
    pub const TORRENT_QUEUE_DOWN: &str = "torrent_queue_down";
    pub const TORRENT_MOVE_TOP: &str = "torrent_move_top";
    pub const TORRENT_MOVE_BOTTOM: &str = "torrent_move_bottom";

    // View submenu
    pub const VIEW_TOGGLE_SIDEBAR: &str = "view_toggle_sidebar";
    pub const VIEW_TOGGLE_DETAILS: &str = "view_toggle_details";
    pub const VIEW_TOGGLE_IN_WINDOW_MENUBAR: &str = "view_toggle_in_window_menubar";

    // Tools submenu
    pub const TOOLS_SEARCH: &str = "tools_search";
    pub const TOOLS_RSS: &str = "tools_rss";
    pub const TOOLS_STATISTICS: &str = "tools_statistics";
    pub const TOOLS_SETTINGS: &str = "tools_settings";

    // Help submenu
    pub const HELP_ABOUT: &str = "help_about";
}

// ---------------------------------------------------------------------------
// Native menu construction (macOS)
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
use tauri::menu::CheckMenuItemBuilder;

/// Builds the native macOS app menu and stores handles for runtime updates.
/// On non-macOS, returns None.
#[cfg(target_os = "macos")]
pub fn build_native_menu<R: tauri::Runtime>(
    app: &AppHandle<R>,
) -> tauri::Result<tauri::menu::Menu<R>> {
    use menu_handles::{push_torrent, push_view};

    // Clear stale handles from any previous menu build
    menu_handles::clear();

    // --- App submenu ---
    let app_about = MenuItem::with_id(app, id::APP_ABOUT, "About Taurent", true, None::<&str>)?;
    let app_settings = MenuItem::with_id(app, id::APP_SETTINGS, "Settings…", true, Some("Cmd+,"))?;
    let app_sep1 = PredefinedMenuItem::separator(app)?;
    let app_hide = MenuItem::with_id(app, id::APP_HIDE, "Hide Taurent", true, Some("Cmd+H"))?;
    let app_hide_others = MenuItem::with_id(
        app,
        id::APP_HIDE_OTHERS,
        "Hide Others",
        true,
        Some("Cmd+Opt+H"),
    )?;
    let app_unhide = MenuItem::with_id(app, id::APP_UNHIDE, "Show All", true, None::<&str>)?;
    let app_sep2 = PredefinedMenuItem::separator(app)?;
    let app_quit = MenuItem::with_id(app, id::APP_QUIT, "Quit Taurent", true, Some("Cmd+Q"))?;

    let app_menu = SubmenuBuilder::new(app, "Taurent")
        .item(&app_about)
        .item(&app_settings)
        .item(&app_sep1)
        .item(&app_hide)
        .item(&app_hide_others)
        .item(&app_unhide)
        .item(&app_sep2)
        .item(&app_quit)
        .build()?;

    // --- Edit submenu ---
    let edit_undo = PredefinedMenuItem::undo(app, Some("Undo"))?;
    let edit_redo = PredefinedMenuItem::redo(app, Some("Redo"))?;
    let edit_sep1 = PredefinedMenuItem::separator(app)?;
    let edit_cut = PredefinedMenuItem::cut(app, Some("Cut"))?;
    let edit_copy = PredefinedMenuItem::copy(app, Some("Copy"))?;
    let edit_paste = PredefinedMenuItem::paste(app, Some("Paste"))?;
    let edit_sep2 = PredefinedMenuItem::separator(app)?;
    let edit_select_all = PredefinedMenuItem::select_all(app, Some("Select All"))?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&edit_undo)
        .item(&edit_redo)
        .item(&edit_sep1)
        .item(&edit_cut)
        .item(&edit_copy)
        .item(&edit_paste)
        .item(&edit_sep2)
        .item(&edit_select_all)
        .build()?;

    // --- File submenu ---
    let file_add = MenuItem::with_id(app, id::FILE_ADD, "Add Torrent…", true, Some("Cmd+O"))?;
    let file_menu = SubmenuBuilder::new(app, "File").item(&file_add).build()?;

    // --- Torrent submenu ---
    let torrent_pause = MenuItem::with_id(app, id::TORRENT_PAUSE, "Pause", true, Some("Cmd+S"))?;
    let torrent_resume =
        MenuItem::with_id(app, id::TORRENT_RESUME, "Resume", true, Some("Cmd+Return"))?;
    let torrent_delete =
        MenuItem::with_id(app, id::TORRENT_DELETE, "Delete", true, Some("Delete"))?;
    let torrent_sep1 = PredefinedMenuItem::separator(app)?;
    let torrent_recheck =
        MenuItem::with_id(app, id::TORRENT_RECHECK, "Recheck", true, None::<&str>)?;
    let torrent_reannounce = MenuItem::with_id(
        app,
        id::TORRENT_REANNOUNCE,
        "Reannounce",
        true,
        None::<&str>,
    )?;
    let torrent_force_start = MenuItem::with_id(
        app,
        id::TORRENT_FORCE_START,
        "Force Start",
        true,
        None::<&str>,
    )?;
    let torrent_sep2 = PredefinedMenuItem::separator(app)?;
    let torrent_set_category = MenuItem::with_id(
        app,
        id::TORRENT_SET_CATEGORY,
        "Set Category…",
        true,
        None::<&str>,
    )?;
    let torrent_set_tags =
        MenuItem::with_id(app, id::TORRENT_SET_TAGS, "Set Tags…", true, None::<&str>)?;
    let torrent_sep3 = PredefinedMenuItem::separator(app)?;
    let torrent_queue_up =
        MenuItem::with_id(app, id::TORRENT_QUEUE_UP, "Queue Up", true, None::<&str>)?;
    let torrent_queue_down = MenuItem::with_id(
        app,
        id::TORRENT_QUEUE_DOWN,
        "Queue Down",
        true,
        None::<&str>,
    )?;
    let torrent_sep4 = PredefinedMenuItem::separator(app)?;
    let torrent_move_top = MenuItem::with_id(
        app,
        id::TORRENT_MOVE_TOP,
        "Move to Top",
        true,
        Some("Cmd+Alt+Up"),
    )?;
    let torrent_move_bottom = MenuItem::with_id(
        app,
        id::TORRENT_MOVE_BOTTOM,
        "Move to Bottom",
        true,
        Some("Cmd+Alt+Down"),
    )?;

    // Store torrent item handles for runtime enable/disable
    push_torrent(torrent_pause.clone());
    push_torrent(torrent_resume.clone());
    push_torrent(torrent_delete.clone());
    push_torrent(torrent_recheck.clone());
    push_torrent(torrent_reannounce.clone());
    push_torrent(torrent_force_start.clone());
    push_torrent(torrent_set_category.clone());
    push_torrent(torrent_set_tags.clone());
    push_torrent(torrent_queue_up.clone());
    push_torrent(torrent_queue_down.clone());
    push_torrent(torrent_move_top.clone());
    push_torrent(torrent_move_bottom.clone());

    let torrent_menu = SubmenuBuilder::new(app, "Torrent")
        .item(&torrent_pause)
        .item(&torrent_resume)
        .item(&torrent_delete)
        .item(&torrent_sep1)
        .item(&torrent_recheck)
        .item(&torrent_reannounce)
        .item(&torrent_force_start)
        .item(&torrent_sep2)
        .item(&torrent_set_category)
        .item(&torrent_set_tags)
        .item(&torrent_sep3)
        .item(&torrent_queue_up)
        .item(&torrent_queue_down)
        .item(&torrent_sep4)
        .item(&torrent_move_top)
        .item(&torrent_move_bottom)
        .build()?;

    // --- View submenu ---
    // Use CheckMenuItem so we can call set_checked() at runtime.
    let view_toggle_sidebar =
        CheckMenuItemBuilder::with_id(id::VIEW_TOGGLE_SIDEBAR, "Toggle Sidebar")
            .enabled(true)
            .checked(false)
            .accelerator("Cmd+B")
            .build(app)?;
    let view_toggle_details =
        CheckMenuItemBuilder::with_id(id::VIEW_TOGGLE_DETAILS, "Toggle Details Panel")
            .enabled(true)
            .checked(false)
            .accelerator("Cmd+I")
            .build(app)?;
    let view_sep = PredefinedMenuItem::separator(app)?;
    let view_toggle_in_window_menubar =
        CheckMenuItemBuilder::with_id(id::VIEW_TOGGLE_IN_WINDOW_MENUBAR, "Show Menu Bar")
            .enabled(true)
            .checked(false)
            .build(app)?;

    // Store view item handles for runtime checked-state updates
    push_view(view_toggle_sidebar.clone());
    push_view(view_toggle_details.clone());
    push_view(view_toggle_in_window_menubar.clone());

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&view_toggle_sidebar)
        .item(&view_toggle_details)
        .item(&view_sep)
        .item(&view_toggle_in_window_menubar)
        .build()?;

    // --- Tools submenu ---
    let tools_search = MenuItem::with_id(app, id::TOOLS_SEARCH, "Search…", true, Some("Cmd+F"))?;
    let tools_rss = MenuItem::with_id(app, id::TOOLS_RSS, "RSS…", true, None::<&str>)?;
    let tools_statistics =
        MenuItem::with_id(app, id::TOOLS_STATISTICS, "Statistics…", true, None::<&str>)?;
    let tools_sep = PredefinedMenuItem::separator(app)?;
    let tools_settings =
        MenuItem::with_id(app, id::TOOLS_SETTINGS, "Settings…", true, Some("Cmd+,"))?;
    let tools_menu = SubmenuBuilder::new(app, "Tools")
        .item(&tools_search)
        .item(&tools_rss)
        .item(&tools_statistics)
        .item(&tools_sep)
        .item(&tools_settings)
        .build()?;

    // --- Help submenu ---
    let help_about = MenuItem::with_id(app, id::HELP_ABOUT, "About Taurent", true, None::<&str>)?;
    let help_menu = SubmenuBuilder::new(app, "Help").item(&help_about).build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&file_menu)
        .item(&torrent_menu)
        .item(&view_menu)
        .item(&tools_menu)
        .item(&help_menu)
        .build()
}

// ---------------------------------------------------------------------------
// Apply menu state (macOS only)
// ---------------------------------------------------------------------------

/// Apply MenuState to stored native menu item handles.
/// Enables/disables torrent items and updates checked state for View toggles.
#[cfg(target_os = "macos")]
pub fn apply_menu_state(_app: &AppHandle, state: &MenuState) {
    use menu_handles::{apply_torrent_states, apply_view_states};

    // Torrent items: enable/disable based on `can_*` fields (order matches push_torrent)
    let torrent_states = [
        state.can_pause,
        state.can_resume,
        state.can_delete,
        state.can_recheck,
        state.can_reannounce,
        state.can_force_start,
        state.can_set_category,
        state.can_set_tags,
        state.can_queue_up,
        state.can_queue_down,
        state.can_move_top,
        state.can_move_bottom,
    ];
    apply_torrent_states(&torrent_states);

    // View items (CheckMenuItem): update checked state (order matches push_view)
    let view_states = [
        state.view_sidebar,
        state.view_details,
        state.in_window_menubar,
    ];
    apply_view_states(&view_states);
}

#[cfg(not(target_os = "macos"))]
pub fn apply_menu_state<R: tauri::Runtime>(_app: &AppHandle<R>, _state: &MenuState) {
    // No-op on non-macOS platforms
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

/// Handle a native menu event, routing it to the main window only.
pub fn handle_menu_event(app: &tauri::AppHandle<tauri::Wry>, event: &MenuEvent) {
    let id = event.id.as_ref();

    match id {
        id::APP_QUIT => {
            crate::request_app_quit(app);
        }
        id::APP_HIDE | id::APP_HIDE_OTHERS => {
            crate::suspend_main_window_to_tray(app);
        }
        id::APP_UNHIDE => {
            crate::show_main_window(app);
        }
        id::APP_SETTINGS | id::TOOLS_SETTINGS => {
            route_ui_action(app, NativeUiAction::Settings);
        }
        id::APP_ABOUT | id::HELP_ABOUT => {
            route_ui_action(app, NativeUiAction::About);
        }
        id::FILE_ADD => {
            route_ui_action(app, NativeUiAction::AddTorrent);
        }
        id::TOOLS_SEARCH => {
            route_ui_action(
                app,
                NativeUiAction::Nav {
                    route: "search".to_owned(),
                },
            );
        }
        id::TOOLS_RSS => {
            route_ui_action(
                app,
                NativeUiAction::Nav {
                    route: "rss".to_owned(),
                },
            );
        }
        id::TOOLS_STATISTICS => {
            emit_to_main_if_present(app, "menu:statistics", ());
        }
        id::TORRENT_PAUSE => {
            emit_to_main_if_present(app, "menu:action", "pause");
        }
        id::TORRENT_RESUME => {
            emit_to_main_if_present(app, "menu:action", "resume");
        }
        id::TORRENT_DELETE => {
            emit_to_main_if_present(app, "menu:action", "delete");
        }
        id::TORRENT_RECHECK => {
            emit_to_main_if_present(app, "menu:action", "recheck");
        }
        id::TORRENT_REANNOUNCE => {
            emit_to_main_if_present(app, "menu:action", "reannounce");
        }
        id::TORRENT_FORCE_START => {
            emit_to_main_if_present(app, "menu:action", "force-start");
        }
        id::TORRENT_SET_CATEGORY => {
            emit_to_main_if_present(app, "menu:action", "set-category");
        }
        id::TORRENT_SET_TAGS => {
            emit_to_main_if_present(app, "menu:action", "set-tags");
        }
        id::TORRENT_QUEUE_UP => {
            emit_to_main_if_present(app, "menu:action", "queue-up");
        }
        id::TORRENT_QUEUE_DOWN => {
            emit_to_main_if_present(app, "menu:action", "queue-down");
        }
        id::TORRENT_MOVE_TOP => {
            emit_to_main_if_present(app, "menu:action", "move-top");
        }
        id::TORRENT_MOVE_BOTTOM => {
            emit_to_main_if_present(app, "menu:action", "move-bottom");
        }
        id::VIEW_TOGGLE_SIDEBAR => {
            route_view_action(app, "toggle-sidebar");
        }
        id::VIEW_TOGGLE_DETAILS => {
            route_view_action(app, "toggle-details");
        }
        id::VIEW_TOGGLE_IN_WINDOW_MENUBAR => {
            route_view_action(app, "toggle-in-window-menubar");
        }
        _ => {}
    }
}

// =============================================================================
// Tauri commands
// =============================================================================

/// Synchronize the native menu's enabled/disabled and checked state from the frontend.
#[tauri::command]
pub fn sync_menu_state(app: tauri::AppHandle, state: MenuState) {
    apply_menu_state(&app, &state);
    // Also update the tray menu with the frontend's authoritative state.
    if app.try_state::<crate::tray::TrayStateHandle>().is_some() {
        let tray_state = crate::tray::TrayMenuState {
            window_visible: match app.get_webview_window("main") {
                Some(w) => match w.is_visible() {
                    Ok(visible) => visible,
                    Err(err) => {
                        eprintln!("Failed to query main window visibility: {err}");
                        false
                    }
                },
                None => false,
            },
            alt_speed_active: state.tray_alt_speed_active,
        };
        crate::tray::update_tray_state(&app, tray_state, true);
    }
}

/// Exit the application immediately (proper quit, not hide-to-tray).
#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    crate::request_app_quit(&app);
}

/// Hook: configure the native menu (macOS only).
pub fn setup_native_menu(app: &mut tauri::App) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let menu = build_native_menu(app.handle())?;
        app.set_menu(menu)?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
    }
    Ok(())
}

/// Hook: attach the native menu event handler.
pub fn setup_menu_events(app: &mut tauri::App<tauri::Wry>) -> tauri::Result<()> {
    app.on_menu_event(|app, event| {
        handle_menu_event(app, &event);
    });
    Ok(())
}
