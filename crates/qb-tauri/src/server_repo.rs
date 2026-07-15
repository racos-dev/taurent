//! Shared Rust server repository using tauri-plugin-store.
//!
//! Credentials (password, API key, username) are stored in OS-backed secure
//! storage. macOS uses the data-protection Keychain; other desktop platforms
//! keep using tauri-plugin-secure-storage.
//! The tauri store holds only non-secret server metadata (id, name, url, username).
//!
//! Credential status handling:
//! - `rememberPassword=true` (default): try keychain first; on failure fall back to
//!   transient in-memory map and mark credentialStatus=session_only.
//! - `rememberPassword=false`: skip keychain entirely; store only in transient map.
//! - empty password ("") is treated as a valid session-only credential; the server
//!   can still be connected immediately if the user provides it via the connect flow.

use std::collections::HashMap;
use std::sync::Mutex;

use qb_core::client::normalize_server_url;
use qb_core::{
    AddServerInput, AuthCredentials, CredentialStatus, SavedServerSummary, UpdateServerInput,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
#[cfg(not(target_os = "macos"))]
use tauri_plugin_secure_storage::SecureStorageExt;
use tauri_plugin_store::StoreExt;

/// Prefix for keychain keys storing per-server credentials.
/// Note: the prefix name is preserved from the password-only era for
/// backwards-compatible keychain entries.
const PASSWORD_KEY_PREFIX: &str = "server_password_";
#[cfg(target_os = "macos")]
const KEYCHAIN_SERVICE: &str = "Taurent";

/// Repository state holding the loaded servers map.
/// Transient (in-memory only) credentials are NOT serialized to disk.
#[derive(Clone, Default)]
pub struct ServerRepositoryState {
    store_file: String,
    servers: HashMap<String, ServerRecordMeta>,
    active_server_id: Option<String>,
    /// Transient in-memory credentials for the current process/session.
    /// Key = server_id, Value = `AuthCredentials` (username, password, optional api_key).
    /// Not serialized (kept only in memory).
    transient_credentials: HashMap<String, AuthCredentials>,
}

/// Server metadata stored in tauri-plugin-store (no credentials).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerRecordMeta {
    pub id: String,
    pub name: String,
    pub url: String,
    pub username: String,
}

/// Managed state handle for the server repository.
pub type ServerRepoStateHandle = Mutex<ServerRepositoryState>;

/// Initialize the server repository from the given store file.
pub fn init_repository(app: &AppHandle, store_file: &str) -> Result<ServerRepositoryState, String> {
    let store = app
        .store(store_file)
        .map_err(|e| format!("Failed to open store '{}': {}", store_file, e))?;

    // Load servers map (metadata only, no passwords)
    let servers: HashMap<String, ServerRecordMeta> = store
        .get("servers")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    // Load active server id
    let active_server_id: Option<String> = store
        .get("active_server_id")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    Ok(ServerRepositoryState {
        store_file: store_file.to_string(),
        servers,
        active_server_id,
        transient_credentials: HashMap::new(),
    })
}

/// Initialize and set up the managed state.
pub fn init_and_manage_repository(
    app: &AppHandle,
    store_file: &str,
) -> Result<ServerRepoStateHandle, String> {
    let state = init_repository(app, store_file)?;
    Ok(Mutex::new(state))
}

/// Save the repository state back to the store (metadata only, no passwords).
pub fn save_repository<R: Runtime>(
    app: &AppHandle<R>,
    repo: &ServerRepositoryState,
) -> Result<(), String> {
    let store = app
        .store(&repo.store_file)
        .map_err(|e| format!("Failed to open store '{}': {}", repo.store_file, e))?;

    store.set(
        "servers",
        serde_json::to_value(&repo.servers).map_err(|e| e.to_string())?,
    );
    store.set(
        "active_server_id",
        serde_json::to_value(&repo.active_server_id).map_err(|e| e.to_string())?,
    );
    store
        .save()
        .map_err(|e| format!("Failed to save repository: {}", e))?;

    Ok(())
}

// === Credential storage (macOS) ===

#[cfg(target_os = "macos")]
fn protected_credentials_options(key: &str) -> security_framework::passwords::PasswordOptions {
    let mut options =
        security_framework::passwords::PasswordOptions::new_generic_password(KEYCHAIN_SERVICE, key);
    options.use_protected_keychain();
    options.set_access_synchronized(Some(false));
    options
}

#[cfg(target_os = "macos")]
fn legacy_credentials_options(key: &str) -> security_framework::passwords::PasswordOptions {
    let mut options =
        security_framework::passwords::PasswordOptions::new_generic_password(KEYCHAIN_SERVICE, key);
    options.set_access_synchronized(Some(false));
    options
}

/// Serialize credentials to a storable UTF-8 string. We always serialize
/// `AuthCredentials` to JSON before handing it to the keychain so that the
/// API key field is preserved.
fn serialize_credentials(creds: &AuthCredentials) -> String {
    serde_json::to_string(creds).unwrap_or_default()
}

/// Store credentials on macOS using standard (legacy) keychain first.
/// Best-effort: returns Ok(()) on success, warning string on partial failure.
#[cfg(target_os = "macos")]
fn store_credentials<R: Runtime>(
    _app: &AppHandle<R>,
    server_id: &str,
    creds: &AuthCredentials,
) -> Result<(), String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);
    let serialized = serialize_credentials(creds);
    let bytes = serialized.as_bytes();

    // Try standard/legacy keychain first (no use_protected_keychain)
    let legacy_err = match security_framework::passwords::set_generic_password_options(
        bytes,
        legacy_credentials_options(&key),
    ) {
        Ok(()) => return Ok(()),
        Err(e) => Some(format!("legacy: {}", e)),
    };

    // Fall back to protected keychain if legacy failed
    let protected_err = match security_framework::passwords::set_generic_password_options(
        bytes,
        protected_credentials_options(&key),
    ) {
        Ok(()) => return Ok(()),
        Err(e) => Some(format!("protected: {}", e)),
    };

    Err(format!(
        "Keychain store failed (legacy: {}, protected: {})",
        legacy_err.unwrap_or_default(),
        protected_err.unwrap_or_default()
    ))
}

/// Get credentials on macOS: checks standard first, then protected.
/// On success with protected-only find, best-effort migrates to standard.
/// Supports dual-read: if the stored value is bare password (legacy), it is
/// wrapped into `AuthCredentials` with empty username.
#[cfg(target_os = "macos")]
fn get_credentials<R: Runtime>(app: &AppHandle<R>, server_id: &str) -> Option<AuthCredentials> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);
    let _ = app;

    // Try standard keychain first
    if let Ok(data) =
        security_framework::passwords::generic_password(legacy_credentials_options(&key))
    {
        if let Some(creds) = parse_stored_credentials(&data) {
            return Some(creds);
        }
    }

    // Fall back to protected keychain
    if let Ok(data) =
        security_framework::passwords::generic_password(protected_credentials_options(&key))
    {
        if let Some(creds) = parse_stored_credentials(&data) {
            // Best-effort migration: try to re-store the JSON form in standard
            // keychain so future reads hit the fast path.
            if !creds.username.is_empty() || creds.api_key.is_some() {
                if let Ok(serialized) = serde_json::to_string(&creds) {
                    let _ = security_framework::passwords::set_generic_password_options(
                        serialized.as_bytes(),
                        legacy_credentials_options(&key),
                    );
                }
            }
            return Some(creds);
        }
    }

    None
}

/// Delete credentials on macOS: best-effort delete from both standard and protected.
/// Never fails — missing items are treated as success.
#[cfg(target_os = "macos")]
fn delete_credentials<R: Runtime>(_app: &AppHandle<R>, server_id: &str) -> Result<(), String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);

    let _ = security_framework::passwords::delete_generic_password_options(
        legacy_credentials_options(&key),
    );
    let _ = security_framework::passwords::delete_generic_password_options(
        protected_credentials_options(&key),
    );

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn store_credentials<R: Runtime>(
    app: &AppHandle<R>,
    server_id: &str,
    creds: &AuthCredentials,
) -> Result<(), String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);
    let serialized = serialize_credentials(creds);
    let result = app.secure_storage().set_item(
        app.clone(),
        tauri_plugin_secure_storage::OptionsRequest {
            prefixed_key: Some(key),
            data: Some(serialized),
            sync: Some(false),
            keychain_access: None,
        },
    );
    match result {
        Ok(Some(_)) => Ok(()),
        Ok(None) => Err("Failed to store credentials".to_string()),
        Err(e) => Err(format!("Keychain error: {}", e)),
    }
}

#[cfg(not(target_os = "macos"))]
fn get_credentials<R: Runtime>(app: &AppHandle<R>, server_id: &str) -> Option<AuthCredentials> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);
    let raw = app
        .secure_storage()
        .get_item(
            app.clone(),
            tauri_plugin_secure_storage::OptionsRequest {
                prefixed_key: Some(key),
                data: None,
                sync: None,
                keychain_access: None,
            },
        )
        .ok()?
        .data?;
    parse_stored_credentials(raw.as_bytes())
}

/// Parse stored credential bytes. New entries are JSON-serialized
/// `AuthCredentials`; legacy entries are bare password strings.
fn parse_stored_credentials(bytes: &[u8]) -> Option<AuthCredentials> {
    let text = std::str::from_utf8(bytes).ok()?;
    if let Ok(creds) = serde_json::from_str::<AuthCredentials>(text) {
        return Some(creds);
    }
    // Legacy migration: bare password string. Wrap with empty username.
    if text.is_empty() {
        return None;
    }
    Some(AuthCredentials {
        api_key: None,
        username: String::new(),
        password: text.to_string(),
    })
}

#[cfg(not(target_os = "macos"))]
fn delete_credentials<R: Runtime>(app: &AppHandle<R>, server_id: &str) -> Result<(), String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);
    let result = app.secure_storage().remove_item(
        app.clone(),
        tauri_plugin_secure_storage::OptionsRequest {
            prefixed_key: Some(key),
            data: None,
            sync: None,
            keychain_access: None,
        },
    );
    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "Keychain delete failed for server '{}': {}",
            server_id, e
        )),
    }
}

// === Repository Operations ===

fn normalize_stored_server_url(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.contains("://") {
        normalize_server_url(trimmed, "https://")
    } else {
        let without_trailing_slash = trimmed.trim_end_matches('/');
        without_trailing_slash
            .strip_suffix("/api/v2")
            .unwrap_or(without_trailing_slash)
            .to_string()
    }
}

/// Returns the credential status for a server given the current repo state.
/// This checks both keychain (secure storage) and the transient map.
fn compute_credential_status<R: Runtime>(
    app: &AppHandle<R>,
    repo: &ServerRepositoryState,
    server_id: &str,
) -> (CredentialStatus, Option<String>) {
    // Check keychain first
    if get_credentials(app, server_id).is_some() {
        return (CredentialStatus::Stored, None);
    }
    // Check transient map
    if repo.transient_credentials.contains_key(server_id) {
        return (CredentialStatus::SessionOnly, None);
    }
    (CredentialStatus::Missing, None)
}

/// List all saved servers (password-free).
pub fn list_servers<R: Runtime>(
    app: &AppHandle<R>,
    repo: &ServerRepositoryState,
) -> Vec<SavedServerSummary> {
    let mut servers: Vec<SavedServerSummary> = repo
        .servers
        .values()
        .map(|r| {
            let (status, warning) = compute_credential_status(app, repo, &r.id);
            SavedServerSummary {
                id: r.id.clone(),
                name: r.name.clone(),
                url: r.url.clone(),
                username: r.username.clone(),
                credential_status: Some(status),
                credential_warning: warning,
            }
        })
        .collect();
    servers.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    servers
}

/// Get the active server summary (password-free).
pub fn get_active_server<R: Runtime>(
    app: &AppHandle<R>,
    repo: &ServerRepositoryState,
) -> Option<SavedServerSummary> {
    repo.active_server_id
        .as_ref()
        .and_then(|id| repo.servers.get(id))
        .map(|r| {
            let (status, warning) = compute_credential_status(app, repo, &r.id);
            SavedServerSummary {
                id: r.id.clone(),
                name: r.name.clone(),
                url: r.url.clone(),
                username: r.username.clone(),
                credential_status: Some(status),
                credential_warning: warning,
            }
        })
}

/// Get a server's metadata by ID (internal use - contains NO password).
pub fn get_server_meta(repo: &ServerRepositoryState, server_id: &str) -> Option<ServerRecordMeta> {
    repo.servers.get(server_id).cloned()
}

/// Get a server's credentials: checks keychain first, then transient in-memory map.
/// Returns `None` if no credentials are available.
///
/// The returned `AuthCredentials` may have an empty `username` if the entry
/// was migrated from a legacy password-only storage entry. Callers that need
/// a non-empty username should merge in the username from their context
/// (e.g. `ServerRecordMeta.username`).
pub fn get_server_credentials<R: Runtime>(
    app: &AppHandle<R>,
    repo: &ServerRepositoryState,
    server_id: &str,
) -> Option<AuthCredentials> {
    // Try keychain first
    if let Some(creds) = get_credentials(app, server_id) {
        return Some(creds);
    }
    // Fall back to transient map
    repo.transient_credentials.get(server_id).cloned()
}

/// Add a new server.
pub fn add_server<R: Runtime>(
    app: &AppHandle<R>,
    repo: &mut ServerRepositoryState,
    input: AddServerInput,
) -> Result<SavedServerSummary, String> {
    // Generate server ID in Rust - no ID provided by renderer
    let id = format!(
        "server_{}",
        uuid::Uuid::new_v4().to_string().replace("-", "")
    );

    // Normalize URL before storing to ensure consistent format
    let normalized_url = normalize_stored_server_url(&input.url);

    let creds = AuthCredentials {
        api_key: input
            .api_key
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty()),
        username: input.username.clone(),
        password: input.password.clone(),
    };

    let (credential_status, credential_warning) = if input.remember_password {
        // Try to persist in keychain; on failure fall back to transient map
        match store_credentials(app, &id, &creds) {
            Ok(()) => (CredentialStatus::Stored, None),
            Err(warning) => {
                // Best-effort: keep in transient map for this session
                repo.transient_credentials.insert(id.clone(), creds);
                (CredentialStatus::SessionOnly, Some(warning))
            }
        }
    } else {
        // Skip keychain entirely; keep only in transient map for session
        repo.transient_credentials.insert(id.clone(), creds);
        (CredentialStatus::NotRequested, None)
    };

    let meta = ServerRecordMeta {
        id: id.clone(),
        name: input.name.clone(),
        url: normalized_url.clone(),
        username: input.username.clone(),
    };

    repo.servers.insert(id.clone(), meta);

    let summary = SavedServerSummary {
        id,
        name: input.name,
        url: normalized_url,
        username: input.username,
        credential_status: Some(credential_status),
        credential_warning,
    };
    Ok(summary)
}

/// Update an existing server.
pub fn update_server<R: Runtime>(
    app: &AppHandle<R>,
    repo: &mut ServerRepositoryState,
    input: UpdateServerInput,
) -> Result<SavedServerSummary, String> {
    // Get server ID first (before any mutable borrow) so we can call compute_credential_status
    let server_id = input.id.clone();
    let _meta = repo
        .servers
        .get(&server_id)
        .ok_or_else(|| format!("Server with id '{}' not found", input.id))?
        .clone();

    // Compute credential status before any mutation (avoids borrow conflict)
    let (credential_status, credential_warning) =
        if input.password.is_none() && input.api_key.is_none() {
            compute_credential_status(app, repo, &server_id)
        } else {
            (CredentialStatus::Unknown, None)
        };

    // Now do metadata updates
    let final_credential_status;
    let final_credential_warning;

    let username_provided = input.username.is_some();
    // Load existing credentials BEFORE taking any mutable borrow on `repo`.
    let existing_creds = get_server_credentials(app, repo, &server_id);
    let had_existing_creds = existing_creds.is_some();
    {
        let meta_mut = repo.servers.get_mut(&server_id).unwrap();
        if let Some(name) = input.name {
            meta_mut.name = name;
        }
        if let Some(url) = input.url {
            meta_mut.url = normalize_stored_server_url(&url);
        }
        if let Some(username) = input.username {
            meta_mut.username = username;
        }

        // Build the new credentials from the existing entry (if any).
        let mut new_creds = existing_creds.unwrap_or_else(|| AuthCredentials {
            api_key: None,
            username: meta_mut.username.clone(),
            password: String::new(),
        });
        let mut creds_changed = false;

        if let Some(password) = input.password.clone() {
            new_creds.password = password;
            creds_changed = true;
        }
        if let Some(api_key) = input.api_key.clone() {
            new_creds.api_key = api_key
                .map(|key| key.trim().to_string())
                .filter(|key| !key.is_empty());
            creds_changed = true;
        }
        // Always reflect the latest username if provided.
        if username_provided {
            new_creds.username = meta_mut.username.clone();
            if had_existing_creds {
                creds_changed = true;
            }
        }

        if creds_changed {
            match input.remember_password {
                Some(true) | None => match store_credentials(app, &server_id, &new_creds) {
                    Ok(()) => {
                        repo.transient_credentials.remove(&server_id);
                        final_credential_status = CredentialStatus::Stored;
                        final_credential_warning = None;
                    }
                    Err(warning) => {
                        repo.transient_credentials
                            .insert(server_id.clone(), new_creds);
                        final_credential_status = CredentialStatus::SessionOnly;
                        final_credential_warning = Some(warning);
                    }
                },
                Some(false) => {
                    let _ = delete_credentials(app, &server_id);
                    repo.transient_credentials
                        .insert(server_id.clone(), new_creds);
                    final_credential_status = CredentialStatus::SessionOnly;
                    final_credential_warning = None;
                }
            }
        } else {
            final_credential_status = credential_status;
            final_credential_warning = credential_warning;
        }
    }

    // Re-get meta for final summary (it's already updated in the repo)
    let meta_final = repo.servers.get(&server_id).unwrap();

    Ok(SavedServerSummary {
        id: meta_final.id.clone(),
        name: meta_final.name.clone(),
        url: meta_final.url.clone(),
        username: meta_final.username.clone(),
        credential_status: Some(final_credential_status),
        credential_warning: final_credential_warning,
    })
}

/// Remove a server and its keychain credentials.
/// Credential deletion is best-effort; server metadata removal failures are surfaced.
pub fn remove_server<R: Runtime>(
    app: &AppHandle<R>,
    repo: &mut ServerRepositoryState,
    server_id: &str,
) -> Result<(), String> {
    if repo.servers.remove(server_id).is_none() {
        return Err(format!("Server with id '{}' not found", server_id));
    }

    // Best-effort: try to delete from keychain, but don't fail the operation
    if let Err(warning) = delete_credentials(app, server_id) {
        log::warn!(
            "Failed to delete credentials for server '{}': {}",
            server_id,
            warning
        );
    }

    // Remove from transient map as well
    repo.transient_credentials.remove(server_id);

    // Clear active if it was this server
    if repo.active_server_id.as_ref() == Some(&server_id.to_string()) {
        repo.active_server_id = None;
    }

    Ok(())
}

fn apply_authenticated_server_metadata(
    repo: &mut ServerRepositoryState,
    server_id: &str,
    authenticated_url: &str,
    make_active: bool,
) -> Result<(String, Option<String>), String> {
    let meta = repo
        .servers
        .get_mut(server_id)
        .ok_or_else(|| format!("Server with id '{}' not found", server_id))?;
    let original_url = std::mem::replace(
        &mut meta.url,
        normalize_stored_server_url(authenticated_url),
    );
    let original_active = repo.active_server_id.clone();
    if make_active {
        repo.active_server_id = Some(server_id.to_string());
    }
    Ok((original_url, original_active))
}

/// Persist the effective URL proven by a successful authenticated request and,
/// for atomic switches, select the server in the same repository transaction.
/// On persistence failure both in-memory metadata changes are rolled back.
pub fn persist_authenticated_server<R: Runtime>(
    app: &AppHandle<R>,
    repo: &mut ServerRepositoryState,
    server_id: &str,
    authenticated_url: &str,
    make_active: bool,
) -> Result<(), String> {
    let (original_url, original_active) =
        apply_authenticated_server_metadata(repo, server_id, authenticated_url, make_active)?;
    if let Err(persist_err) = save_repository(app, repo) {
        if let Some(meta) = repo.servers.get_mut(server_id) {
            meta.url = original_url;
        }
        repo.active_server_id = original_active;
        return Err(persist_err);
    }
    Ok(())
}

/// Select a server as active.
pub fn select_server(repo: &mut ServerRepositoryState, server_id: &str) -> Result<(), String> {
    if !repo.servers.contains_key(server_id) {
        return Err(format!("Server with id '{}' not found", server_id));
    }

    repo.active_server_id = Some(server_id.to_string());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_repository() -> ServerRepositoryState {
        ServerRepositoryState {
            store_file: "test-servers.json".to_string(),
            servers: HashMap::from([
                (
                    "candidate".to_string(),
                    ServerRecordMeta {
                        id: "candidate".to_string(),
                        name: "Candidate".to_string(),
                        url: "localhost:8080".to_string(),
                        username: "admin".to_string(),
                    },
                ),
                (
                    "current".to_string(),
                    ServerRecordMeta {
                        id: "current".to_string(),
                        name: "Current".to_string(),
                        url: "https://example.test".to_string(),
                        username: "admin".to_string(),
                    },
                ),
            ]),
            active_server_id: Some("current".to_string()),
            transient_credentials: HashMap::new(),
        }
    }

    #[test]
    fn authenticated_switch_updates_effective_url_and_active_server_together() {
        let mut repo = test_repository();

        apply_authenticated_server_metadata(&mut repo, "candidate", "http://localhost:8080/", true)
            .unwrap();

        assert_eq!(
            repo.servers.get("candidate").unwrap().url,
            "http://localhost:8080"
        );
        assert_eq!(repo.active_server_id.as_deref(), Some("candidate"));
    }

    #[test]
    fn authenticated_reconnect_updates_url_without_changing_active_server() {
        let mut repo = test_repository();

        apply_authenticated_server_metadata(&mut repo, "candidate", "http://localhost:8080", false)
            .unwrap();

        assert_eq!(
            repo.servers.get("candidate").unwrap().url,
            "http://localhost:8080"
        );
        assert_eq!(repo.active_server_id.as_deref(), Some("current"));
    }
}
