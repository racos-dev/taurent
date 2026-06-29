//! Mobile torrents commands.
//!
//! Only mobile-specific commands are defined here. All other commands are
//! imported directly from qb_tauri modules in lib.rs.
//!
//! Mobile uses comma-separated tag strings rather than Vec<String>, so
//! add_tags/remove_tags are thin wrappers over the canonical commands.

use qb_core::normalize::split_tags;
use qb_tauri::commands::tags::{self, OperationResponse as TagOperationResponse};
use qb_tauri::commands::torrents::{
    self, AddTorrentOptions, OperationResponse as TorrentOperationResponse,
};
use qb_tauri::session::SessionStateHandle;
use tauri::{AppHandle, State};

/// Mobile-specific add_torrent that accepts AddTorrentOptions.
/// Delegates to the canonical add_torrent_options in qb_tauri.
#[tauri::command]
pub async fn add_torrent(
    state: State<'_, SessionStateHandle>,
    app: AppHandle,
    options: AddTorrentOptions,
) -> Result<TorrentOperationResponse, String> {
    torrents::add_torrent_options(state, app, options).await
}

/// Mobile-specific set_category command (same as set_torrent_category).
/// Delegates to the canonical set_torrent_category in qb_tauri.
#[tauri::command]
pub async fn set_category(
    state: State<'_, SessionStateHandle>,
    app: AppHandle,
    hashes: Vec<String>,
    category: String,
) -> Result<TorrentOperationResponse, String> {
    torrents::set_torrent_category(state, app, hashes, category).await
}

/// Mobile-specific add_tags with tags as comma-separated string.
/// Converts to Vec<String> and delegates to the canonical add_torrent_tags in tags module.
/// Bridge contract: payload key is `tags` (not `tags_str`).
#[tauri::command]
pub async fn add_tags(
    state: State<'_, SessionStateHandle>,
    app: AppHandle,
    hashes: Vec<String>,
    tags: String,
) -> Result<TagOperationResponse, String> {
    let tag_vec = split_tags(&tags);
    tags::add_torrent_tags(state, app, hashes, tag_vec).await
}

/// Mobile-specific remove_tags with tags as comma-separated string.
/// Converts to Vec<String> and delegates to the canonical remove_torrent_tags in tags module.
/// Bridge contract: payload key is `tags` (not `tags_str`).
#[tauri::command]
pub async fn remove_tags(
    state: State<'_, SessionStateHandle>,
    app: AppHandle,
    hashes: Vec<String>,
    tags: String,
) -> Result<TagOperationResponse, String> {
    let tag_vec = split_tags(&tags);
    tags::remove_torrent_tags(state, app, hashes, tag_vec).await
}
