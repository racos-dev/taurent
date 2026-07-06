//! Canonical shared torrents command group.

use crate::client::{capture_request_context, qb_get, qb_post, SessionRequestContext};
use crate::commands::transfer::{DownloadLimitResponse, UploadLimitResponse};
use crate::session::{emit_resource_invalidated, SessionStateHandle};
use qb_core::normalize::{build_add_torrent_options, split_tags};
use qb_core::{
    parse_search_plugins, parse_search_results, parse_search_start_id, parse_search_statuses,
    parse_sync_torrent_peers, parse_torrent_files, parse_torrent_list, parse_torrent_properties,
    parse_torrent_trackers, parse_webseeds, SearchPluginDto, SearchResultsDto, SearchStatusDto,
    TorrentDto, TorrentFileDto, TorrentPropertiesDto, TrackerDto, WebSeedDto,
};
use serde::{Deserialize, Serialize};
use tauri::State;

// ============================================================================
// Shared DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentListResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    /// Typed torrent list parsed from `/api/v2/torrents/info` via
    /// `qb_core::parse_torrent_list`. Malformed upstream payloads fail at the
    /// Rust boundary rather than being exposed as raw JSON. `tags` is
    /// preserved as qBittorrent's comma-separated string; UI consumers should
    /// use `parseTorrentTags` from `@taurent/shared` for membership checks.
    pub torrents: Vec<TorrentDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TorrentListQuery {
    pub filter: Option<String>,
    pub category: Option<String>,
    pub tag: Option<String>,
    pub sort: Option<String>,
    pub reverse: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub hashes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentPropertiesResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub properties: TorrentPropertiesDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentTrackersResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub trackers: Vec<TrackerDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentFilesResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub files: Vec<TorrentFileDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub success: bool,
}

/// Options for adding a torrent (mobile flavor).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddTorrentOptions {
    pub urls: Option<String>,
    pub torrent_files: Option<Vec<String>>,
    pub savepath: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    #[serde(rename = "skip_checking")]
    pub skip_checking: Option<bool>,
    pub paused: Option<bool>,
    #[serde(rename = "root_folder")]
    pub root_folder: Option<bool>,
    pub rename: Option<String>,
    #[serde(rename = "upLimit")]
    pub up_limit: Option<i64>,
    #[serde(rename = "dlLimit")]
    pub dl_limit: Option<i64>,
    #[serde(rename = "ratioLimit")]
    pub ratio_limit: Option<f64>,
    #[serde(rename = "seedingTimeLimit")]
    pub seeding_time_limit: Option<i64>,
    #[serde(rename = "autoTMM")]
    pub auto_tmm: Option<bool>,
    #[serde(rename = "sequentialDownload")]
    pub sequential_download: Option<bool>,
    #[serde(rename = "firstLastPiecePrio")]
    pub first_last_piece_prio: Option<bool>,
    #[serde(rename = "contentLayout")]
    pub content_layout: Option<String>,
    #[serde(rename = "stopCondition")]
    pub stop_condition: Option<String>,
    #[serde(rename = "addToTop")]
    pub add_to_top: Option<bool>,
}

// ============================================================================
// Torrent list and properties
// ============================================================================

#[tauri::command]
pub async fn get_torrent_list(
    state: State<'_, SessionStateHandle>,
    query: Option<TorrentListQuery>,
) -> Result<TorrentListResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();
    let query = query.unwrap_or_default();

    let mut path = "/api/v2/torrents/info?_=1".to_string();
    if let Some(f) = query.filter {
        path.push_str(&format!("&filter={}", urlencoding::encode(&f)));
    }
    if let Some(c) = query.category {
        path.push_str(&format!("&category={}", urlencoding::encode(&c)));
    }
    if let Some(t) = query.tag {
        path.push_str(&format!("&tag={}", urlencoding::encode(&t)));
    }
    if let Some(s) = query.sort {
        path.push_str(&format!("&sort={}", urlencoding::encode(&s)));
    }
    if let Some(r) = query.reverse {
        path.push_str(&format!("&reverse={}", if r { "1" } else { "0" }));
    }
    if let Some(l) = query.limit {
        path.push_str(&format!("&limit={}", l));
    }
    if let Some(o) = query.offset {
        path.push_str(&format!("&offset={}", o));
    }
    if let Some(ref h) = query.hashes {
        if !h.is_empty() {
            path.push_str(&format!("&hashes={}", h.join("|")));
        }
    }

    let raw = qb_get(&state, &path).await?;
    let torrents = parse_torrent_list(&raw).map_err(|e| e.to_string())?;

    Ok(TorrentListResponse {
        session_generation: gen,
        server_id,
        torrents,
    })
}

#[tauri::command]
pub async fn get_torrent_properties(
    state: State<'_, SessionStateHandle>,
    hash: String,
) -> Result<TorrentPropertiesResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = format!(
        "/api/v2/torrents/properties?hash={}",
        urlencoding::encode(&hash)
    );
    let raw = qb_get(&state, &path).await?;
    let properties = parse_torrent_properties(&raw).map_err(|e| e.to_string())?;

    Ok(TorrentPropertiesResponse {
        session_generation: gen,
        server_id,
        properties,
    })
}

#[tauri::command]
pub async fn get_torrent_trackers(
    state: State<'_, SessionStateHandle>,
    hash: String,
) -> Result<TorrentTrackersResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = format!(
        "/api/v2/torrents/trackers?hash={}",
        urlencoding::encode(&hash)
    );
    let raw = qb_get(&state, &path).await?;
    let trackers = parse_torrent_trackers(&raw).map_err(|e| e.to_string())?;

    Ok(TorrentTrackersResponse {
        session_generation: gen,
        server_id,
        trackers,
    })
}

#[tauri::command]
pub async fn get_torrent_files(
    state: State<'_, SessionStateHandle>,
    hash: String,
) -> Result<TorrentFilesResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = format!("/api/v2/torrents/files?hash={}", urlencoding::encode(&hash));
    let raw = qb_get(&state, &path).await?;
    let raw_str = raw.to_string();

    let files = match parse_torrent_files(&raw) {
        Ok(mut files) => {
            // qBittorrent attaches `is_seed` (really a torrent-level `isFinished()`
            // flag) ONLY to fileList[0] and omits it from all other entries.
            // Propagate the flag to every file so the UI can display it consistently.
            if let Some(first) = files.first() {
                let is_seed = first.is_seed;
                for f in files.iter_mut() {
                    f.is_seed = is_seed;
                }
            }
            log::info!(
                "get_torrent_files: hash={} raw_bytes={} file_count={}",
                &hash,
                raw_str.len(),
                files.len(),
            );
            files
        }
        Err(e) => {
            log::warn!(
                "get_torrent_files: hash={} raw_bytes={} parse_error={}",
                &hash,
                raw_str.len(),
                e,
            );
            return Err(e.to_string());
        }
    };

    if files.is_empty() {
        log::warn!(
            "get_torrent_files: hash={} returned 0 files (raw_preview: {:.200})",
            &hash,
            raw_str,
        );
    }

    Ok(TorrentFilesResponse {
        session_generation: gen,
        server_id,
        files,
    })
}

// ============================================================================
// Torrent operations
// ============================================================================

/// Add torrent using options struct.
#[tauri::command]
pub async fn add_torrent_options(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    options: AddTorrentOptions,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    if let Some(file_paths) = &options.torrent_files {
        if !file_paths.is_empty() {
            let path = "/api/v2/torrents/add";

            // Parse urls from comma-separated string
            let urls_str = options.urls.as_deref().unwrap_or_default();
            let urls_list = split_tags(urls_str);

            // Parse tags from comma-separated string
            let tags_str = options.tags.as_deref().unwrap_or_default();
            let tags_list = split_tags(tags_str);

            let fields = build_add_torrent_options(
                &urls_list,
                options.savepath.as_deref(),
                None,
                options.category.as_deref(),
                if tags_list.is_empty() {
                    None
                } else {
                    Some(&tags_list)
                },
                options.skip_checking,
                options.paused,
                options.root_folder,
                options.rename.as_deref(),
                options.up_limit,
                options.dl_limit,
                options.ratio_limit,
                options.seeding_time_limit,
                options.auto_tmm,
                options.first_last_piece_prio,
                options.sequential_download,
                options.content_layout.as_deref(),
                options.stop_condition.as_deref(),
                options.add_to_top,
            );

            let mut form = reqwest::multipart::Form::new();
            for (key, value) in fields {
                form = form.text(key, value);
            }

            for file_path in file_paths {
                let file_bytes = std::fs::read(file_path)
                    .map_err(|e| format!("Failed to add torrent file '{}': {}", file_path, e))?;
                let file_name = std::path::Path::new(file_path)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("torrent.torrent")
                    .to_string();
                let part = reqwest::multipart::Part::bytes(file_bytes).file_name(file_name);
                form = form.part("torrents", part);
            }

            let _ = crate::client::qb_post_multipart(&state, path, form).await?;

            emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

            return Ok(OperationResponse {
                session_generation: gen,
                server_id,
                success: true,
            });
        }
    }

    if let Some(urls) = &options.urls {
        if !urls.is_empty() {
            let path = "/api/v2/torrents/add";

            // Parse urls from comma-separated string
            let urls_list = split_tags(urls);

            // Parse tags from comma-separated string
            let tags_str = options.tags.as_deref().unwrap_or_default();
            let tags_list = split_tags(tags_str);

            let fields = build_add_torrent_options(
                &urls_list,
                options.savepath.as_deref(),
                None,
                options.category.as_deref(),
                if tags_list.is_empty() {
                    None
                } else {
                    Some(&tags_list)
                },
                options.skip_checking,
                options.paused,
                options.root_folder,
                options.rename.as_deref(),
                options.up_limit,
                options.dl_limit,
                options.ratio_limit,
                options.seeding_time_limit,
                options.auto_tmm,
                options.first_last_piece_prio,
                options.sequential_download,
                options.content_layout.as_deref(),
                options.stop_condition.as_deref(),
                options.add_to_top,
            );

            let params: Vec<(&str, &str)> = fields
                .iter()
                .map(|(k, v)| (k.as_str(), v.as_str()))
                .collect();

            let _ = qb_post(&state, path, &params).await?;

            emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());
        }
    }

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn pause_torrents(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = if request.supports_pause_resume {
        "/api/v2/torrents/pause"
    } else {
        "/api/v2/torrents/stop"
    };
    let hashes_param = hashes.join("|");
    let _ = qb_post(&state, path, &[("hashes", hashes_param.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn resume_torrents(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = if request.supports_pause_resume {
        "/api/v2/torrents/resume"
    } else {
        "/api/v2/torrents/start"
    };
    let hashes_param = hashes.join("|");
    let _ = qb_post(&state, path, &[("hashes", hashes_param.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn delete_torrents(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    delete_files: bool,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/delete";
    let hashes_param = hashes.join("|");
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("deleteFiles", if delete_files { "true" } else { "false" }),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn recheck_torrents(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/recheck";
    let hashes_param = hashes.join("|");
    let _ = qb_post(&state, path, &[("hashes", hashes_param.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn reannounce_torrents(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/reannounce";
    let hashes_param = hashes.join("|");
    let _ = qb_post(&state, path, &[("hashes", hashes_param.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_force_start(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    value: bool,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/setForceStart";
    let hashes_param = hashes.join("|");
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("value", if value { "true" } else { "false" }),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_torrent_category(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    category: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/setCategory";
    let hashes_param = hashes.join("|");
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("category", category.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn get_torrent_download_limit(
    state: State<'_, SessionStateHandle>,
    hashes: Vec<String>,
) -> Result<DownloadLimitResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let hashes_param = hashes.join("|");
    let path = format!(
        "/api/v2/torrents/downloadLimit?hashes={}",
        urlencoding::encode(&hashes_param)
    );
    let response = qb_get(&state, &path).await?;
    let limit = response.as_i64().unwrap_or(0);

    Ok(DownloadLimitResponse {
        session_generation: gen,
        server_id,
        limit,
    })
}

#[tauri::command]
pub async fn get_torrent_upload_limit(
    state: State<'_, SessionStateHandle>,
    hashes: Vec<String>,
) -> Result<UploadLimitResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let hashes_param = hashes.join("|");
    let path = format!(
        "/api/v2/torrents/uploadLimit?hashes={}",
        urlencoding::encode(&hashes_param)
    );
    let response = qb_get(&state, &path).await?;
    let limit = response.as_i64().unwrap_or(0);

    Ok(UploadLimitResponse {
        session_generation: gen,
        server_id,
        limit,
    })
}

#[tauri::command]
pub async fn set_torrent_download_limit(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    limit: i64,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/setDownloadLimit";
    let hashes_param = hashes.join("|");
    let limit_param = limit.to_string();
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("limit", limit_param.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_torrent_upload_limit(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    limit: i64,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/setUploadLimit";
    let hashes_param = hashes.join("|");
    let limit_param = limit.to_string();
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("limit", limit_param.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_file_priority(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    ids: Vec<i64>,
    priority: i64,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/filePrio";
    let ids_param = ids
        .iter()
        .map(|id| id.to_string())
        .collect::<Vec<_>>()
        .join("|");
    let priority_param = priority.to_string();
    let _ = qb_post(
        &state,
        path,
        &[
            ("hash", hash.as_str()),
            ("id", ids_param.as_str()),
            ("priority", priority_param.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_torrent_name(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    name: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/rename";
    let _ = qb_post(
        &state,
        path,
        &[("hash", hash.as_str()), ("name", name.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_torrent_location(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    location: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/setLocation";
    let hashes_param = hashes.join("|");
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("location", location.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn increase_priority(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/increasePrio";
    let hashes_param = hashes.join("|");
    let _ = qb_post(&state, path, &[("hashes", hashes_param.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn decrease_priority(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/decreasePrio";
    let hashes_param = hashes.join("|");
    let _ = qb_post(&state, path, &[("hashes", hashes_param.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn top_priority(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/topPrio";
    let hashes_param = hashes.join("|");
    let _ = qb_post(&state, path, &[("hashes", hashes_param.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn bottom_priority(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/bottomPrio";
    let hashes_param = hashes.join("|");
    let _ = qb_post(&state, path, &[("hashes", hashes_param.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

// ============================================================================
// Tracker commands
// ============================================================================

#[tauri::command]
pub async fn add_trackers(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    urls: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/addTrackers";
    let _ = qb_post(
        &state,
        path,
        &[("hash", hash.as_str()), ("urls", urls.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

/// Add one or more peers to the given torrents.
///
/// Maps to `/api/v2/torrents/addPeers`. Both `hashes` and `peers` are sent as
/// pipe-separated (`|`) lists; each peer is a `host:port` pair.
#[tauri::command]
pub async fn add_peers(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    peers: Vec<String>,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let hashes_param = hashes.join("|");
    let peers_param = peers.join("|");

    let path = "/api/v2/torrents/addPeers";
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("peers", peers_param.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn edit_tracker(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    orig_url: String,
    new_url: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/editTracker";
    let _ = qb_post(
        &state,
        path,
        &[
            ("hash", hash.as_str()),
            ("origUrl", orig_url.as_str()),
            ("newUrl", new_url.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn remove_trackers(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    urls: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/removeTrackers";
    let _ = qb_post(
        &state,
        path,
        &[("hash", hash.as_str()), ("urls", urls.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

// ============================================================================
// Rename commands
// ============================================================================

#[tauri::command]
pub async fn rename_file(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    old_path: String,
    new_path: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/renameFile";
    let _ = qb_post(
        &state,
        path,
        &[
            ("hash", hash.as_str()),
            ("oldPath", old_path.as_str()),
            ("newPath", new_path.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn rename_folder(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    new_path: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/renameFolder";
    let _ = qb_post(
        &state,
        path,
        &[("hash", hash.as_str()), ("newPath", new_path.as_str())],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

// ============================================================================
// Peer sync
// ============================================================================

/// Sync torrent peers from qBittorrent.
///
/// Fetches the peer delta from `/api/v2/sync/torrentPeers`, validates it
/// through `qb_core::parse_sync_torrent_peers` (Rust DTO), and returns the
/// typed delta. Invalid responses (e.g. missing `rid`, wrong `rid` type,
/// malformed peer objects) surface as command errors rather than passing raw
/// unvalidated JSON to the bridge adapter.
///
/// The returned JSON shape is `{ rid, full_update, peers?, peers_removed? }`.
/// All peer fields are optional to support incremental partial deltas.
#[tauri::command]
pub async fn sync_torrent_peers(
    state: State<'_, SessionStateHandle>,
    hash: String,
    rid: Option<u64>,
) -> Result<serde_json::Value, String> {
    let _request = capture_request_context(&state)?;

    let rid_val = rid.unwrap_or(0);
    let path = format!(
        "/api/v2/sync/torrentPeers?hash={}&rid={}",
        urlencoding::encode(&hash),
        rid_val
    );

    let raw = qb_get(&state, &path).await?;
    let parsed = parse_sync_torrent_peers(&raw).map_err(|e| e.to_string())?;

    serde_json::to_value(parsed).map_err(|e| e.to_string())
}

// ============================================================================
// Webseeds
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentWebseedsResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub webseeds: Vec<WebSeedDto>,
}

#[tauri::command]
pub async fn get_torrent_webseeds(
    state: State<'_, SessionStateHandle>,
    hash: String,
) -> Result<TorrentWebseedsResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = format!(
        "/api/v2/torrents/webseeds?hash={}",
        urlencoding::encode(&hash)
    );
    let raw = qb_get(&state, &path).await?;
    let webseeds = parse_webseeds(&raw).map_err(|e| e.to_string())?;

    Ok(TorrentWebseedsResponse {
        session_generation: gen,
        server_id,
        webseeds,
    })
}

#[tauri::command]
pub async fn add_webseeds(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    urls: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/addWebSeeds";
    let _ = qb_post(
        &state,
        path,
        &[("hash", hash.as_str()), ("urls", urls.as_str())],
    )
    .await?;

    emit_resource_invalidated(
        &app,
        gen,
        server_id.clone(),
        format!("torrent-webseeds:{}", hash),
    );

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn edit_webseed(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    orig_url: String,
    new_url: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/editWebSeed";
    let _ = qb_post(
        &state,
        path,
        &[
            ("hash", hash.as_str()),
            ("origUrl", orig_url.as_str()),
            ("newUrl", new_url.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(
        &app,
        gen,
        server_id.clone(),
        format!("torrent-webseeds:{}", hash),
    );

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn remove_webseeds(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    urls: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/removeWebSeeds";
    let _ = qb_post(
        &state,
        path,
        &[("hash", hash.as_str()), ("urls", urls.as_str())],
    )
    .await?;

    emit_resource_invalidated(
        &app,
        gen,
        server_id.clone(),
        format!("torrent-webseeds:{}", hash),
    );

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

// ============================================================================
// Sync commands
// ============================================================================

// ============================================================================
// Search commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchStartResponse {
    pub session_generation: u64,
    pub server_id: Option<String>,
    pub id: i32,
}

#[tauri::command]
pub async fn start_search(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    query: String,
    plugins: String,
    category: String,
) -> Result<SearchStartResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/search/start";
    let raw: serde_json::Value = qb_post(
        &state,
        path,
        &[
            ("query", query.as_str()),
            ("plugins", plugins.as_str()),
            ("category", category.as_str()),
        ],
    )
    .await?;

    // Parse the search ID from the qB response via the shared Rust DTO parser
    // (`qb_core::dto::parse_search_start_id`). The parser accepts the three
    // qBittorrent response shapes (string, number, or `{ id: ... }`) and
    // enforces i32 range strictly — values that fit in i64 but overflow i32
    // surface as backend errors rather than being silently truncated.
    let id = parse_search_start_id(&raw).map_err(|e| e.to_string())?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "search".to_string());

    Ok(SearchStartResponse {
        session_generation: gen,
        server_id,
        id,
    })
}

#[tauri::command]
pub async fn stop_search(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    id: i32,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/search/stop";
    let _ = qb_post(&state, path, &[("id", &id.to_string())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "search".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn get_search_status(
    state: State<'_, SessionStateHandle>,
    id: Option<i32>,
) -> Result<Vec<SearchStatusDto>, String> {
    let _request = capture_request_context(&state)?;

    let path = if let Some(search_id) = id {
        format!("/api/v2/search/status?id={}", search_id)
    } else {
        "/api/v2/search/status".to_string()
    };
    let raw = qb_get(&state, &path).await?;
    parse_search_statuses(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_search_results(
    state: State<'_, SessionStateHandle>,
    id: i32,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<SearchResultsDto, String> {
    let _request = capture_request_context(&state)?;

    let limit_str = limit.unwrap_or(0).to_string();
    let offset_str = offset.unwrap_or(0).to_string();
    let path = format!(
        "/api/v2/search/results?id={}&limit={}&offset={}",
        id, limit_str, offset_str
    );
    let raw = qb_get(&state, &path).await?;
    parse_search_results(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_search(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    id: i32,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/search/delete";
    let _ = qb_post(&state, path, &[("id", &id.to_string())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "search".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn get_search_plugins(
    state: State<'_, SessionStateHandle>,
) -> Result<Vec<SearchPluginDto>, String> {
    let _request = capture_request_context(&state)?;

    let path = "/api/v2/search/plugins";
    let raw = qb_get(&state, path).await?;
    parse_search_plugins(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_search_plugin(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    sources: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/search/install";
    let _ = qb_post(&state, path, &[("sources", sources.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "search-plugins".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn uninstall_search_plugin(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    names: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/search/uninstall";
    let _ = qb_post(&state, path, &[("names", names.as_str())]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "search-plugins".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn enable_search_plugin(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    names: String,
    enable: bool,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/search/enable";
    let _ = qb_post(
        &state,
        path,
        &[
            ("names", names.as_str()),
            ("enable", if enable { "true" } else { "false" }),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "search-plugins".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn update_search_plugins(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/search/update";
    let _ = qb_post(&state, path, &[]).await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "search-plugins".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

// ============================================================================
// Torrent management toggles
// ============================================================================

#[tauri::command]
pub async fn set_auto_management(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    enable: bool,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/setAutoManagement";
    let hashes_param = hashes.join("|");
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("enable", if enable { "true" } else { "false" }),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_share_limits(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    ratio_limit: f64,
    seeding_time_limit: i64,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/setShareLimits";
    let hashes_param = hashes.join("|");
    let ratio_str = ratio_limit.to_string();
    let seeding_str = seeding_time_limit.to_string();
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("ratioLimit", ratio_str.as_str()),
            ("seedingTimeLimit", seeding_str.as_str()),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

/// Set sequential download (seq_dl). The `value` parameter is the desired
/// target state. qBittorrent uses a toggle endpoint, so we fetch current
/// state first and only call toggle for torrents whose state differs from target.
#[tauri::command]
pub async fn set_sequential_download(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    value: bool,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    // Fetch current torrent info to determine which ones need toggling
    let path = format!(
        "/api/v2/torrents/info?_=1&hashes={}",
        hashes
            .iter()
            .map(|h| urlencoding::encode(h))
            .collect::<Vec<_>>()
            .join("|")
    );
    let torrents: serde_json::Value = qb_get(&state, &path).await?;

    // Collect hashes where seq_dl differs from target
    // /api/v2/torrents/info returns an array of torrent objects, not a keyed object
    let to_toggle: Vec<&str> = hashes
        .iter()
        .filter(|hash| {
            torrents
                .as_array()
                .and_then(|arr| {
                    arr.iter().find(|t| {
                        t.get("hash")
                            .and_then(|h| h.as_str())
                            .map(|h| h.eq_ignore_ascii_case(hash))
                            .unwrap_or(false)
                    })
                })
                .and_then(|t| t.get("seq_dl"))
                .and_then(|v| v.as_bool())
                .map(|current| current != value)
                .unwrap_or(false)
        })
        .map(|s| s.as_str())
        .collect();

    // Only call toggle endpoint if some torrents need changing
    if !to_toggle.is_empty() {
        let toggle_path = "/api/v2/torrents/toggleSequentialDownload";
        let toggle_param = to_toggle.join("|");
        let _ = qb_post(&state, toggle_path, &[("hashes", toggle_param.as_str())]).await?;
        emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());
    }

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

/// Set first/last piece priority (f_l_piece_prio). The `value` parameter is
/// the desired target state. qBittorrent uses a toggle endpoint, so we fetch
/// current state first and only call toggle for torrents whose state differs.
#[tauri::command]
pub async fn set_first_last_piece_priority(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    value: bool,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    // Fetch current torrent info to determine which ones need toggling
    let path = format!(
        "/api/v2/torrents/info?_=1&hashes={}",
        hashes
            .iter()
            .map(|h| urlencoding::encode(h))
            .collect::<Vec<_>>()
            .join("|")
    );
    let torrents: serde_json::Value = qb_get(&state, &path).await?;

    // Collect hashes where f_l_piece_prio differs from target
    // /api/v2/torrents/info returns an array of torrent objects, not a keyed object
    let to_toggle: Vec<&str> = hashes
        .iter()
        .filter(|hash| {
            torrents
                .as_array()
                .and_then(|arr| {
                    arr.iter().find(|t| {
                        t.get("hash")
                            .and_then(|h| h.as_str())
                            .map(|h| h.eq_ignore_ascii_case(hash))
                            .unwrap_or(false)
                    })
                })
                .and_then(|t| t.get("f_l_piece_prio"))
                .and_then(|v| v.as_bool())
                .map(|current| current != value)
                .unwrap_or(false)
        })
        .map(|s| s.as_str())
        .collect();

    // Only call toggle endpoint if some torrents need changing
    if !to_toggle.is_empty() {
        let toggle_path = "/api/v2/torrents/toggleFirstLastPiecePrio";
        let toggle_param = to_toggle.join("|");
        let _ = qb_post(&state, toggle_path, &[("hashes", toggle_param.as_str())]).await?;
        emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());
    }

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

#[tauri::command]
pub async fn set_super_seeding(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hashes: Vec<String>,
    value: bool,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let path = "/api/v2/torrents/setSuperSeeding";
    let hashes_param = hashes.join("|");
    let _ = qb_post(
        &state,
        path,
        &[
            ("hashes", hashes_param.as_str()),
            ("value", if value { "true" } else { "false" }),
        ],
    )
    .await?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}

// ============================================================================
// Export .torrent
// ============================================================================

async fn fetch_export_bytes(ctx: &SessionRequestContext, hash: &str) -> Result<Vec<u8>, String> {
    let url = format!(
        "{}/api/v2/torrents/export?hash={}",
        ctx.base_url.trim_end_matches('/'),
        urlencoding::encode(hash)
    );
    let response = ctx
        .client
        .get(&url)
        .header("Cookie", ctx.session_cookie.as_str())
        .send()
        .await
        .map_err(|e| format!("export request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "export endpoint returned HTTP {}",
            response.status().as_u16()
        ));
    }

    response
        .bytes()
        .await
        .map_err(|e| format!("failed to read export bytes: {}", e))
        .map(|b| b.to_vec())
}

#[tauri::command]
pub async fn export_torrent(
    state: State<'_, SessionStateHandle>,
    app: tauri::AppHandle,
    hash: String,
    save_path: String,
) -> Result<OperationResponse, String> {
    let request = capture_request_context(&state)?;
    let gen = request.session_generation;
    let server_id = request.server_id.clone();

    let bytes = fetch_export_bytes(&request, &hash).await?;

    // Write directly to the requested path (user picked it via save dialog)
    std::fs::write(&save_path, &bytes)
        .map_err(|e| format!("failed to write .torrent to '{}': {}", save_path, e))?;

    emit_resource_invalidated(&app, gen, server_id.clone(), "torrents".to_string());

    Ok(OperationResponse {
        session_generation: gen,
        server_id,
        success: true,
    })
}
