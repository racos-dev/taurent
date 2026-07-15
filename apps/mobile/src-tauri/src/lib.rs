mod torrents;

use qb_tauri::app_builder::{add_mobile_plugins, add_shared_plugins, MOBILE_SERVER_STORE_FILE};
use qb_tauri::commands::app as qb_app;
use qb_tauri::commands::categories;
use qb_tauri::commands::preferences;
use qb_tauri::commands::tags;
use qb_tauri::commands::torrents as qb_torrents;
use qb_tauri::commands::transfer;
use qb_tauri::magnet_links::PendingMagnetLinks;
use qb_tauri::server_repo::init_and_manage_repository;
use qb_tauri::session::create_session_state;
use qb_tauri::sync::{create_sync_manager_registry, setup_sync_lifecycle};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

use torrents::{add_tags, add_torrent, remove_tags, set_category};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = add_shared_plugins(add_mobile_plugins(tauri::Builder::default()))
        .manage(create_session_state())
        .manage(PendingMagnetLinks::new())
        .setup(|app| {
            // Initialize server repository with mobile-specific store file
            let server_repo = init_and_manage_repository(app.handle(), MOBILE_SERVER_STORE_FILE)
                .expect("Failed to initialize server repository");
            app.manage(server_repo);

            // Set up the sync manager registry as Tauri state.
            app.manage(create_sync_manager_registry());
            // Set up the sync manager lifecycle.
            setup_sync_lifecycle(app.handle());

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .target(tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::Webview,
                        ))
                        .build(),
                )?;
            }

            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                app.handle()
                    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }))?;
            }

            // Register deep-link handler for magnet URLs arriving while the app is running.
            {
                let handle = app.handle().clone();
                let _ = app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    let pending = handle.state::<PendingMagnetLinks>();
                    let new_urls = pending.enqueue(urls);
                    if !new_urls.is_empty() {
                        let _ = handle.emit("magnet-link-open", new_urls);
                    }
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

            Ok(())
        })
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
            qb_tauri::session::session_switch_server,
            qb_tauri::session::session_set_error,
            qb_tauri::session::session_clear_error,
            qb_tauri::session::session_teardown,
            qb_tauri::session::session_set_connecting,
            qb_tauri::session::get_session_snapshot,
            qb_tauri::session::bootstrap_session,
            qb_tauri::session::get_bootstrap_contract,
            qb_tauri::commands::servers::list_servers,
            qb_tauri::commands::servers::get_active_server,
            qb_tauri::commands::servers::add_server,
            qb_tauri::commands::servers::update_server,
            qb_tauri::commands::servers::remove_server,
            qb_tauri::commands::servers::select_server,
            qb_tauri::commands::servers::test_server_connection,
            qb_tauri::commands::servers::test_saved_server_connection,
            qb_tauri::commands::servers::normalize_server_url_cmd,
            qb_tauri::commands::servers::probe_server_scheme,
            qb_torrents::get_torrent_list,
            qb_torrents::pause_torrents,
            qb_torrents::resume_torrents,
            qb_torrents::delete_torrents,
            qb_torrents::recheck_torrents,
            qb_torrents::reannounce_torrents,
            qb_torrents::set_force_start,
            qb_torrents::set_torrent_download_limit,
            qb_torrents::set_torrent_upload_limit,
            qb_torrents::set_file_priority,
            qb_torrents::set_torrent_name,
            qb_torrents::rename_file,
            qb_torrents::rename_folder,
            qb_torrents::set_torrent_location,
            qb_torrents::set_auto_management,
            qb_torrents::set_share_limits,
            qb_torrents::set_sequential_download,
            qb_torrents::set_first_last_piece_priority,
            qb_torrents::set_super_seeding,
            qb_torrents::export_torrent,
            qb_torrents::increase_priority,
            qb_torrents::decrease_priority,
            qb_torrents::top_priority,
            qb_torrents::bottom_priority,
            qb_torrents::get_torrent_properties,
            qb_torrents::get_torrent_trackers,
            qb_torrents::get_torrent_files,
            add_torrent,
            qb_tauri::magnet_links::get_pending_magnet_links,
            qb_tauri::commands::sync::get_maindata_snapshot,
            qb_tauri::commands::sync::get_maindata_sync_status,
            qb_tauri::commands::sync::start_maindata_sync,
            qb_tauri::commands::sync::stop_maindata_sync,
            qb_tauri::workspace::set_workspace_view,
            qb_tauri::workspace::get_workspace_view,
            preferences::get_preferences,
            categories::get_categories,
            tags::get_tags,
            preferences::get_version,
            preferences::get_webapi_version,
            preferences::get_build_info,
            categories::create_category,
            categories::edit_category,
            categories::remove_categories,
            transfer::get_global_download_limit,
            transfer::get_global_upload_limit,
            tags::create_tags,
            tags::delete_tags,
            preferences::set_preferences,
            qb_app::set_global_download_limit,
            qb_app::set_global_upload_limit,
            qb_app::get_rss_items,
            qb_app::get_rss_rules,
            qb_app::add_rss_feed,
            qb_app::set_rss_feed_url,
            qb_app::remove_rss_item,
            qb_app::set_rss_rule,
            qb_app::rename_rss_rule,
            qb_app::remove_rss_rule,
            preferences::get_default_save_path,
            preferences::shutdown_server,
            qb_torrents::add_trackers,
            qb_torrents::edit_tracker,
            qb_torrents::remove_trackers,
            qb_torrents::add_webseeds,
            qb_torrents::edit_webseed,
            qb_torrents::remove_webseeds,
            transfer::get_cookies,
            transfer::set_cookies,
            transfer::logout,
            transfer::get_transfer_info,
            transfer::get_speed_limits_mode,
            transfer::toggle_speed_limits_mode,
            transfer::ban_peers,
            qb_torrents::start_search,
            qb_torrents::stop_search,
            qb_torrents::get_search_status,
            qb_torrents::get_search_results,
            qb_torrents::delete_search,
            qb_torrents::get_search_plugins,
            qb_torrents::install_search_plugin,
            qb_torrents::uninstall_search_plugin,
            qb_torrents::enable_search_plugin,
            qb_torrents::update_search_plugins,
            qb_torrents::sync_torrent_peers,
            qb_torrents::get_torrent_webseeds,
            // Mobile-specific commands (thin wrappers)
            set_category,
            add_tags,
            remove_tags,
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
