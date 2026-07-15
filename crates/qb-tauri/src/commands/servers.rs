//! Canonical shared servers command group.
//!
//! Phase 3: Rust-owned server repository with safe DTOs.

use std::collections::HashMap;

use qb_core::{
    client::{normalize_server_url, qbittorrent_login},
    server::PathMapping,
    AddServerInput, NormalizeServerUrlInput, NormalizeServerUrlOutput, ProbeServerSchemeResult,
    SavedServerSummary, ServerCredentialsInput, TestConnectionResult, UpdateServerInput,
};
#[cfg(any(feature = "desktop", test))]
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;

use crate::app_builder::DESKTOP_SERVER_STORE_FILE;
use crate::server_repo::{
    add_server as repo_add_server, get_active_server as repo_get_active_server,
    get_server_meta as repo_get_server_meta, get_server_password as repo_get_server_password,
    list_servers as repo_list_servers, remove_server as repo_remove_server, save_repository,
    select_server as repo_select_server, test_connection_raw, update_server as repo_update_server,
    ServerRepoStateHandle,
};

// ─── Path mapping types ────────────────────────────────────────────────────────

/// Result of resolving a server path to a local path.
/// Mirrors the TypeScript discriminated union used by the bridge adapter.
#[cfg(any(feature = "desktop", test))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum ResolveResult {
    /// Server path was successfully mapped to a local path.
    Resolved {
        #[serde(rename = "localPath")]
        local_path: String,
    },
    /// No mapping matched the server path — it stays unmapped.
    Unmapped {
        #[serde(rename = "serverPath")]
        server_path: String,
    },
}

// ─── Path normalization helpers ───────────────────────────────────────────────

/// Normalize a server path: split by both / and \, strip empties, rejoin with /.
/// Preserves leading separators for Unix absolute paths (handled separately by
/// normalize_local_path).
#[cfg(any(feature = "desktop", test))]
fn normalize_server_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let segments: Vec<&str> = trimmed
        .split(['/', '\\'])
        .filter(|s| !s.is_empty())
        .collect();
    segments.join("/")
}

/// Normalize a local path: split by both / and \, strip empties, rejoin with /.
/// Unlike normalize_server_path, this preserves leading `//` (UNC prefix) and
/// leading `/` (Unix absolute path).
/// UNC paths can start with `//` (Unix-style) or `\\` (Windows-style, encoded as
/// `\\` in a Rust string literal). Both are normalized to `//`.
#[cfg(any(feature = "desktop", test))]
fn normalize_local_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    // Detect UNC: starts with // (Unix-style) or \\ (Windows-style).
    // The Windows-style \\ is encoded as "\\\\" in a Rust string literal.
    // After normalizing, both become // at the start.
    let starts_with_dslash = trimmed.starts_with("//") || trimmed.starts_with("\\\\");
    // Detect Unix absolute: starts with / but not // (already handled as UNC)
    let is_unix_abs = trimmed.starts_with('/') && !starts_with_dslash;

    // Build prefix to re-attach after joining segments
    let prefix = if starts_with_dslash {
        "//"
    } else if is_unix_abs {
        "/"
    } else {
        ""
    };

    let segments: Vec<&str> = trimmed
        .split(['/', '\\'])
        .filter(|s| !s.is_empty())
        .collect();

    format!("{}{}", prefix, segments.join("/"))
}

/// Count the number of segments in a normalized path.
#[cfg(any(feature = "desktop", test))]
fn segment_count(path: &str) -> usize {
    if path.is_empty() {
        0
    } else {
        path.split('/').count()
    }
}

/// Returns true if `server_path` starts with `mapping_path` as a segment-level
/// prefix. For example, `/data` matches `/data/torrents` but NOT `/data2`.
#[cfg(any(feature = "desktop", test))]
fn segments_match(server_path: &str, mapping_path: &str) -> bool {
    let server_seg_count = segment_count(server_path);
    let mapping_seg_count = segment_count(mapping_path);

    if server_seg_count < mapping_seg_count {
        return false;
    }

    let server_segments: Vec<&str> = server_path.split('/').collect();
    let mapping_segments: Vec<&str> = mapping_path.split('/').collect();

    server_segments[..mapping_seg_count] == mapping_segments[..mapping_seg_count]
}

/// Pure resolution function: given a server path and a list of path mappings,
/// returns the resolved local path or an unmapped result.
#[cfg(any(feature = "desktop", test))]
fn resolve_local_path_impl(server_path: &str, mappings: &[PathMapping]) -> ResolveResult {
    let trimmed = server_path.trim();
    if trimmed.is_empty() {
        return ResolveResult::Unmapped {
            server_path: server_path.to_string(),
        };
    }

    let normalized = normalize_server_path(trimmed);
    if normalized.is_empty() {
        return ResolveResult::Unmapped {
            server_path: server_path.to_string(),
        };
    }

    // Find the best (longest-prefix) matching mapping
    let best_match: Option<(usize, &PathMapping)> = mappings
        .iter()
        .filter_map(|m| {
            let server = normalize_server_path(&m.server_path);
            if segments_match(&normalized, &server) {
                Some((segment_count(&server), m))
            } else {
                None
            }
        })
        .max_by_key(|(seg_count, _)| *seg_count);

    match best_match {
        Some((_, mapping)) => {
            let server_normalized = normalize_server_path(&mapping.server_path);
            let local_normalized = normalize_local_path(&mapping.local_path);
            let seg_count = segment_count(&server_normalized);

            let server_segments: Vec<&str> = normalized.split('/').collect();
            let remaining: Vec<&str> = server_segments[seg_count..].to_vec();

            let local_path = if remaining.is_empty() {
                local_normalized
            } else {
                format!("{}/{}", local_normalized, remaining.join("/"))
            };

            ResolveResult::Resolved { local_path }
        }
        None => ResolveResult::Unmapped {
            server_path: server_path.to_string(),
        },
    }
}

/// Get the containing directory of a path — the parent folder.
/// Handles UNC paths, drive roots (C:\), trailing separators, and no-separator
/// paths. Returns the parent directory path.
/// Normalizes all backslashes to forward slashes to match TS dirname behavior.
#[cfg(any(feature = "desktop", test))]
fn get_containing_directory(item_path: &str) -> String {
    let trimmed = item_path.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // Detect UNC `//` prefix (or Windows-style `\\`)
    let is_unc = trimmed.starts_with("//") || trimmed.starts_with("\\\\");
    // Detect Unix absolute (starts with / but not UNC)
    let is_unix_abs = trimmed.starts_with('/') && !is_unc;

    // Normalize all backslashes to forward slashes for uniform processing
    let normalized = trimmed.replace('\\', "/");

    // Strip trailing slashes
    let stripped = normalized.trim_end_matches('/');
    if stripped.is_empty() {
        return String::new();
    }

    // Find the last '/'
    if let Some(pos) = stripped.rfind('/') {
        let prefix = &stripped[..pos];
        // prefix_trimmed: remove any trailing slashes from prefix (shouldn't happen
        // after rfind but defensive)
        let prefix_trimmed = prefix.trim_end_matches('/');
        if prefix_trimmed.is_empty() {
            // The original path had its first slash at position 0 (or was UNC starting //)
            if is_unc {
                "//".to_string()
            } else if prefix == "D:"
                || prefix == "C:"
                || (prefix.len() == 2 && prefix.chars().nth(1) == Some(':'))
            {
                // Bare drive root like "D:" — return as-is, no trailing slash
                prefix.to_string()
            } else {
                // Unix absolute path like /file → parent is /
                "/".to_string()
            }
        } else {
            // Reconstruct the prefix preserving Unix absolute or UNC root
            if is_unix_abs && !prefix_trimmed.starts_with('/') {
                // Re-attach the leading slash that was stripped
                format!("/{}", prefix_trimmed)
            } else if is_unc && !prefix_trimmed.starts_with('/') {
                // UNC: ensure leading slash
                format!("/{}", prefix_trimmed)
            } else {
                prefix_trimmed.to_string()
            }
        }
    } else {
        // No separator — relative path with no directory component
        // Aligned with TS getContainingDirectory which returns "." for this case
        ".".to_string()
    }
}

// ─── Desktop-only commands ─────────────────────────────────────────────────────

#[cfg(feature = "desktop")]
use tauri_plugin_opener::{open_path, reveal_item_in_dir};

/// Resolve a server path to a local path using stored path mappings for the given server.
/// Returns a discriminated union: { kind: "resolved", localPath } or { kind: "unmapped", serverPath }.
#[cfg(feature = "desktop")]
#[tauri::command]
pub fn resolve_local_path(
    app: AppHandle,
    server_id: String,
    server_path: String,
) -> Result<ResolveResult, String> {
    let path_mappings = load_path_mappings_by_server(&app)?;
    let mappings = path_mappings.get(&server_id).cloned().unwrap_or_default();

    Ok(resolve_local_path_impl(&server_path, &mappings))
}

/// Open a local filesystem path using the system opener.
#[cfg(feature = "desktop")]
#[tauri::command]
pub fn open_local_path(path: String) -> Result<(), String> {
    open_path(path.as_str(), None::<&str>).map_err(|e| e.to_string())
}

/// Reveal a local filesystem item in the system file browser.
/// On Linux, if the DBus service is unavailable (org.freedesktop.DBus.Error.ServiceUnknown),
/// falls back to opening the containing directory.
#[cfg(feature = "desktop")]
#[tauri::command]
pub fn reveal_local_item(path: String) -> Result<(), String> {
    let result = reveal_item_in_dir(path.as_str());

    if let Err(ref e) = result {
        let err_str = e.to_string();
        if err_str.contains("org.freedesktop.DBus.Error.ServiceUnknown") {
            // Linux fallback: open the parent directory instead
            let parent = get_containing_directory(&path);
            return open_path(parent.as_str(), None::<&str>).map_err(|e| e.to_string());
        }
        return Err(err_str);
    }

    result.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_mapping(server: &str, local: &str) -> PathMapping {
        PathMapping {
            server_path: server.to_string(),
            local_path: local.to_string(),
        }
    }

    // ── resolve_local_path_impl tests (mirror pathMapping.test.ts) ───────────

    #[test]
    fn resolve_basic_prefix_match() {
        let mappings = vec![make_mapping("/data/torrents", "//nas/torrents")];
        let result = resolve_local_path_impl("/data/torrents/movie.mkv", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas/torrents/movie.mkv");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_exact_mapping() {
        let mappings = vec![make_mapping("/data/torrents", "//nas/torrents")];
        let result = resolve_local_path_impl("/data/torrents", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas/torrents");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_longest_prefix_wins() {
        let mappings = vec![
            make_mapping("/data", "//nas"),
            make_mapping("/data/torrents", "//nas/torrents"),
        ];
        // /data/torrents/movie.mkv should match /data/torrents, not /data
        let result = resolve_local_path_impl("/data/torrents/movie.mkv", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas/torrents/movie.mkv");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_longest_prefix_reversed_order() {
        let mappings = vec![
            make_mapping("/data/torrents", "//nas/torrents"),
            make_mapping("/data", "//nas"),
        ];
        let result = resolve_local_path_impl("/data/torrents/movie.mkv", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas/torrents/movie.mkv");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_shorter_when_exact() {
        let mappings = vec![
            make_mapping("/data/torrents", "//nas/torrents"),
            make_mapping("/data", "//nas"),
        ];
        let result = resolve_local_path_impl("/data", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_no_false_positive_data2() {
        // /data2 should NOT match when only /data is mapped
        let mappings = vec![make_mapping("/data", "//nas")];
        let result = resolve_local_path_impl("/data2/movie.mkv", &mappings);
        match result {
            ResolveResult::Unmapped { server_path } => {
                assert_eq!(server_path, "/data2/movie.mkv");
            }
            _ => panic!("expected Unmapped, got {:?}", result),
        }
    }

    #[test]
    fn resolve_no_false_positive_data2_torrents() {
        let mappings = vec![make_mapping("/data", "//nas")];
        let result = resolve_local_path_impl("/data2/torrents/movie.mkv", &mappings);
        match result {
            ResolveResult::Unmapped { server_path } => {
                assert_eq!(server_path, "/data2/torrents/movie.mkv");
            }
            _ => panic!("expected Unmapped, got {:?}", result),
        }
    }

    #[test]
    fn resolve_no_false_positive_shorter_mapping() {
        // /data should NOT match when only /data/torrents is mapped
        let mappings = vec![make_mapping("/data/torrents", "//nas/torrents")];
        let result = resolve_local_path_impl("/data", &mappings);
        match result {
            ResolveResult::Unmapped { server_path } => {
                assert_eq!(server_path, "/data");
            }
            _ => panic!("expected Unmapped, got {:?}", result),
        }
    }

    #[test]
    fn resolve_trailing_slash_normalization() {
        let mappings = vec![make_mapping("/data/", "//nas/")];
        let result = resolve_local_path_impl("/data/file.txt", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas/file.txt");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_server_path_trailing_slash() {
        let mappings = vec![make_mapping("/data", "//nas")];
        let result = resolve_local_path_impl("/data/", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_both_trailing_slashes() {
        let mappings = vec![make_mapping("/data/", "//nas/")];
        let result = resolve_local_path_impl("/data/", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_mixed_separators_backslash_in_server_path() {
        let mappings = vec![make_mapping("/data/torrents", "//nas/torrents")];
        let result = resolve_local_path_impl("\\data\\torrents\\movie.mkv", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas/torrents/movie.mkv");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_mixed_separators_backslash_in_mapping() {
        let mappings = vec![make_mapping("/data/torrents", "\\\\nas\\torrents")];
        let result = resolve_local_path_impl("/data/torrents/movie.mkv", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas/torrents/movie.mkv");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_no_mapping_no_match() {
        let mappings = vec![make_mapping("/other", "//other")];
        let result = resolve_local_path_impl("/data/torrents/movie.mkv", &mappings);
        match result {
            ResolveResult::Unmapped { server_path } => {
                assert_eq!(server_path, "/data/torrents/movie.mkv");
            }
            _ => panic!("expected Unmapped, got {:?}", result),
        }
    }

    #[test]
    fn resolve_empty_mappings() {
        let mappings: Vec<PathMapping> = vec![];
        let result = resolve_local_path_impl("/data/torrents/movie.mkv", &mappings);
        match result {
            ResolveResult::Unmapped { server_path } => {
                assert_eq!(server_path, "/data/torrents/movie.mkv");
            }
            _ => panic!("expected Unmapped, got {:?}", result),
        }
    }

    #[test]
    fn resolve_whitespace_trimmed_in_mapping() {
        let mappings = vec![make_mapping(
            " /mnt/data/torrents ",
            " /Volumes/Downloads/torrents ",
        )];
        let result = resolve_local_path_impl("/mnt/data/torrents/radarr/file.mkv", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "/Volumes/Downloads/torrents/radarr/file.mkv");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_whitespace_subfolder_match() {
        let mappings = vec![make_mapping(
            "/mnt/data/torrents ",
            "/Volumes/Downloads/torrents",
        )];
        let result = resolve_local_path_impl("/mnt/data/torrents/radarr", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "/Volumes/Downloads/torrents/radarr");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_whitespace_input_trimmed() {
        let mappings = vec![make_mapping(
            "/mnt/data/torrents",
            "/Volumes/Downloads/torrents",
        )];
        let result = resolve_local_path_impl("  /mnt/data/torrents/radarr  ", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "/Volumes/Downloads/torrents/radarr");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    #[test]
    fn resolve_unc_local_path() {
        let mappings = vec![make_mapping("/data", "//nas")];
        let result = resolve_local_path_impl("/data/torrents/file.mkv", &mappings);
        match result {
            ResolveResult::Resolved { local_path } => {
                assert_eq!(local_path, "//nas/torrents/file.mkv");
            }
            _ => panic!("expected Resolved, got {:?}", result),
        }
    }

    // ── get_containing_directory tests ───────────────────────────────────────

    #[test]
    fn dir_simple_path() {
        assert_eq!(
            get_containing_directory("/data/torrents/file.txt"),
            "/data/torrents"
        );
    }

    #[test]
    fn dir_root_level_file() {
        assert_eq!(
            get_containing_directory("/data/torrents/file1.txt"),
            "/data/torrents"
        );
    }

    #[test]
    fn dir_no_slash() {
        // No separator — relative path with no directory component → return "."
        assert_eq!(get_containing_directory("file1.txt"), ".");
    }

    #[test]
    fn dir_windows_backslash() {
        assert_eq!(
            get_containing_directory("D:\\Downloads\\FolderB\\file.txt"),
            "D:/Downloads/FolderB"
        );
    }

    #[test]
    fn dir_windows_trailing_backslash() {
        // 'D:\Downloads\FolderB\' → strip trailing \ → 'D:\Downloads\FolderB' → normalize → 'D:/Downloads/FolderB' → parent is 'D:/Downloads'
        assert_eq!(
            get_containing_directory("D:\\Downloads\\FolderB\\"),
            "D:/Downloads"
        );
    }

    #[test]
    fn dir_drive_root_single_segment() {
        // For "D:\FolderB", parent is "D:"
        assert_eq!(get_containing_directory("D:\\FolderB"), "D:");
    }

    #[test]
    fn dir_mixed_separators() {
        assert_eq!(
            get_containing_directory("D:\\Downloads/FolderB\\sub\\file.txt"),
            "D:/Downloads/FolderB/sub"
        );
    }

    #[test]
    fn dir_unc_path() {
        // UNC path: //server/share/file.txt → parent is //server/share
        assert_eq!(
            get_containing_directory("//server/share/file.txt"),
            "//server/share"
        );
    }

    #[test]
    fn dir_unc_deep() {
        assert_eq!(
            get_containing_directory("//server/share/folder/file.txt"),
            "//server/share/folder"
        );
    }

    #[test]
    fn dir_unix_root_child() {
        // /file → parent is /
        assert_eq!(get_containing_directory("/file"), "/");
    }

    #[test]
    fn dir_trailing_slash_stripped() {
        // TS dirname normalizes: "/data/torrents/" → "/data/torrents" → lastSlash=5 → "/data"
        assert_eq!(get_containing_directory("/data/torrents/"), "/data");
    }

    #[test]
    fn dir_empty_path() {
        assert_eq!(get_containing_directory(""), "");
    }
}

const PATH_MAPPINGS_KEY: &str = "path_mappings";

fn load_path_mappings_by_server(
    app: &AppHandle,
) -> Result<HashMap<String, Vec<PathMapping>>, String> {
    let store = app.store(DESKTOP_SERVER_STORE_FILE).map_err(|error| {
        format!(
            "Failed to open store '{}': {}",
            DESKTOP_SERVER_STORE_FILE, error
        )
    })?;

    Ok(store
        .get(PATH_MAPPINGS_KEY)
        .and_then(|value| serde_json::from_value(value.clone()).ok())
        .unwrap_or_default())
}

/// List all saved servers (password-free summary, with credential status).
#[tauri::command]
pub fn list_servers(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
) -> Vec<SavedServerSummary> {
    let repo = state.lock().unwrap();
    repo_list_servers(&app, &repo)
}

/// Get the currently active server (password-free summary, with credential status).
#[tauri::command]
pub fn get_active_server(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
) -> Option<SavedServerSummary> {
    let repo = state.lock().unwrap();
    repo_get_active_server(&app, &repo)
}

/// Add a new server.
#[tauri::command]
pub fn add_server(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
    input: AddServerInput,
) -> Result<SavedServerSummary, String> {
    let mut repo = state.lock().unwrap();
    let result = repo_add_server(&app, &mut repo, input)?;
    save_repository(&app, &repo)?;
    Ok(result)
}

/// Update an existing server.
#[tauri::command]
pub fn update_server(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
    input: UpdateServerInput,
) -> Result<SavedServerSummary, String> {
    let mut repo = state.lock().unwrap();
    let result = repo_update_server(&app, &mut repo, input)?;
    save_repository(&app, &repo)?;
    Ok(result)
}

/// Remove a server.
#[tauri::command]
pub fn remove_server(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
    server_id: String,
) -> Result<(), String> {
    let mut repo = state.lock().unwrap();
    repo_remove_server(&app, &mut repo, &server_id)?;
    save_repository(&app, &repo)?;
    Ok(())
}

/// Select a server as the active server.
#[tauri::command]
pub fn select_server(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
    server_id: String,
) -> Result<(), String> {
    let mut repo = state.lock().unwrap();
    repo_select_server(&mut repo, &server_id)?;
    save_repository(&app, &repo)?;
    Ok(())
}

/// Get stored path mappings for a server.
#[tauri::command]
pub fn get_path_mappings(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
    server_id: String,
) -> Result<Vec<PathMapping>, String> {
    let repo = state.lock().unwrap();
    repo_get_server_meta(&repo, &server_id)
        .ok_or_else(|| format!("Server '{}' not found", server_id))?;

    let path_mappings = load_path_mappings_by_server(&app)?;
    Ok(path_mappings.get(&server_id).cloned().unwrap_or_default())
}

/// Set stored path mappings for a server.
#[tauri::command]
pub fn set_path_mappings(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
    server_id: String,
    mappings: Vec<PathMapping>,
) -> Result<(), String> {
    let repo = state.lock().unwrap();
    repo_get_server_meta(&repo, &server_id)
        .ok_or_else(|| format!("Server '{}' not found", server_id))?;

    let store = app.store(DESKTOP_SERVER_STORE_FILE).map_err(|error| {
        format!(
            "Failed to open store '{}': {}",
            DESKTOP_SERVER_STORE_FILE, error
        )
    })?;

    let mut path_mappings = load_path_mappings_by_server(&app)?;
    path_mappings.insert(server_id, mappings);

    store.set(
        PATH_MAPPINGS_KEY,
        serde_json::to_value(path_mappings).map_err(|error| error.to_string())?,
    );
    store
        .save()
        .map_err(|error| format!("Failed to save repository: {}", error))?;

    Ok(())
}

/// Test connection using raw credentials (for add server flow).
#[tauri::command]
pub async fn test_server_connection(
    server_url: String,
    credentials: ServerCredentialsInput,
) -> TestConnectionResult {
    test_connection_raw(&server_url, &credentials.username, &credentials.password).await
}

/// Test connection for a saved server by ID (for UI testing saved server).
#[tauri::command]
pub async fn test_saved_server_connection(
    state: State<'_, ServerRepoStateHandle>,
    app: AppHandle,
    server_id: String,
) -> Result<TestConnectionResult, String> {
    let (server_url, username) = {
        let repo = state.lock().unwrap();
        let meta = repo_get_server_meta(&repo, &server_id)
            .ok_or_else(|| format!("Server '{}' not found", server_id))?;
        (meta.url.clone(), meta.username.clone())
    };
    let password = {
        let repo = state.lock().unwrap();
        repo_get_server_password(&app, &repo, &server_id)
            .ok_or_else(|| format!("Password not found for server '{}'", server_id))?
    };
    Ok(test_connection_raw(&server_url, &username, &password).await)
}

// ─── URL normalization / probing / validation ────────────────────────────────

/// Normalize a server URL (add scheme if missing, strip trailing slash, strip /api/v2).
#[tauri::command]
pub fn normalize_server_url_cmd(input: NormalizeServerUrlInput) -> NormalizeServerUrlOutput {
    let normalized = normalize_server_url(&input.url, &input.default_scheme);
    NormalizeServerUrlOutput { normalized }
}

/// Probe a server URL to determine reachable scheme (https-first, http-fallback
/// on network errors). Mirrors the TS `detectScheme` logic.
///
/// # Security note
///
/// When the HTTPS probe fails with a network error, the function retries with `http://`,
/// sending the username and password in plaintext over an unencrypted connection.
/// This is a faithful migration of the existing TypeScript behavior.
///
/// # Future improvement
///
/// Perform a credential-free HEAD request for scheme detection only, then re-attempt
/// login with the detected scheme. This would avoid sending credentials over HTTP.
#[tauri::command]
pub async fn probe_server_scheme(
    url: String,
    username: String,
    password: String,
) -> ProbeServerSchemeResult {
    // If URL already has scheme, test directly
    if url.starts_with("http://") || url.starts_with("https://") {
        let normalized = normalize_server_url(&url, "https://");
        match qbittorrent_login(&normalized, &username, &password).await {
            Ok(_) => ProbeServerSchemeResult {
                success: true,
                normalized_url: Some(normalized),
                error: None,
            },
            Err(e) => ProbeServerSchemeResult {
                success: false,
                normalized_url: None,
                error: Some(e.to_string()),
            },
        }
    } else {
        // Try https first
        let https_url = normalize_server_url(&url, "https://");
        let https_result = qbittorrent_login(&https_url, &username, &password).await;

        if https_result.is_ok() {
            return ProbeServerSchemeResult {
                success: true,
                normalized_url: Some(https_url),
                error: None,
            };
        }

        // Only retry http on network-level failures
        let https_error = https_result.unwrap_err();
        if https_error.is_network_error() {
            let http_url = normalize_server_url(&url, "http://");
            let http_result = qbittorrent_login(&http_url, &username, &password).await;

            if http_result.is_ok() {
                return ProbeServerSchemeResult {
                    success: true,
                    normalized_url: Some(http_url),
                    error: None,
                };
            }
            // Both failed — return https error
            return ProbeServerSchemeResult {
                success: false,
                normalized_url: None,
                error: Some(https_error.to_string()),
            };
        }

        // Non-network error (auth, TLS, HTTP error) — surface to user
        ProbeServerSchemeResult {
            success: false,
            normalized_url: None,
            error: Some(https_error.to_string()),
        }
    }
}
