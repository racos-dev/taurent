//! Shared Rust server repository using tauri-plugin-store.
//!
//! Passwords are stored in OS-backed secure storage.
//! macOS uses the data-protection Keychain; other desktop platforms keep using
//! tauri-plugin-secure-storage.
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

use qb_core::client::{normalize_server_url, qbittorrent_login};
use qb_core::{
    AddServerInput, CredentialStatus, SavedServerSummary, TestConnectionResult, UpdateServerInput,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
#[cfg(not(target_os = "macos"))]
use tauri_plugin_secure_storage::SecureStorageExt;
use tauri_plugin_store::StoreExt;

/// Prefix for keychain keys storing per-server passwords.
const PASSWORD_KEY_PREFIX: &str = "server_password_";
#[cfg(target_os = "macos")]
const KEYCHAIN_SERVICE: &str = "Taurent";

/// Repository state holding the loaded servers map.
/// Transient (in-memory only) passwords are NOT serialized to disk.
#[derive(Clone, Default)]
pub struct ServerRepositoryState {
    store_file: String,
    servers: HashMap<String, ServerRecordMeta>,
    active_server_id: Option<String>,
    /// Transient in-memory passwords for the current process/session.
    /// Key = server_id, Value = password (may be empty string).
    /// Not serialized (kept only in memory).
    transient_passwords: HashMap<String, String>,
}

/// Server metadata stored in tauri-plugin-store (no password).
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
/// Initialize the server repository from the given store file.
/// When the `E2E_STORE_DIR` environment variable is set, the store is placed
/// inside that directory — enabling test isolation from the real app install.
pub fn init_repository(app: &AppHandle, store_file: &str) -> Result<ServerRepositoryState, String> {
    // Respect E2E store directory for test isolation.
    // The test script passes this so the Rust backend uses the same temp
    // profile directory that WebView2 uses, keeping server state out of the
    // real app's data dir.
    let store_path = if let Ok(e2e_dir) = std::env::var("E2E_STORE_DIR") {
        let base = std::path::Path::new(&e2e_dir);
        base.join(store_file).to_string_lossy().into_owned()
    } else {
        store_file.to_string()
    };

    let store = app
        .store(&store_path)
        .map_err(|e| format!("Failed to open store '{}': {}", store_path, e))?;

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
        transient_passwords: HashMap::new(),
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

// === Password storage (macOS) ===

#[cfg(target_os = "macos")]
fn protected_password_options(key: &str) -> security_framework::passwords::PasswordOptions {
    let mut options =
        security_framework::passwords::PasswordOptions::new_generic_password(KEYCHAIN_SERVICE, key);
    options.use_protected_keychain();
    options.set_access_synchronized(Some(false));
    options
}

#[cfg(target_os = "macos")]
fn legacy_password_options(key: &str) -> security_framework::passwords::PasswordOptions {
    let mut options =
        security_framework::passwords::PasswordOptions::new_generic_password(KEYCHAIN_SERVICE, key);
    options.set_access_synchronized(Some(false));
    options
}

/// Store password on macOS using standard (legacy) keychain first.
/// Best-effort: returns Ok(()) on success, warning string on partial failure.
#[cfg(target_os = "macos")]
fn store_password<R: Runtime>(
    _app: &AppHandle<R>,
    server_id: &str,
    password: &str,
) -> Result<(), String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);

    // Try standard/legacy keychain first (no use_protected_keychain)
    let legacy_err = match security_framework::passwords::set_generic_password_options(
        password.as_bytes(),
        legacy_password_options(&key),
    ) {
        Ok(()) => return Ok(()),
        Err(e) => Some(format!("legacy: {}", e)),
    };

    // Fall back to protected keychain if legacy failed
    let protected_err = match security_framework::passwords::set_generic_password_options(
        password.as_bytes(),
        protected_password_options(&key),
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

/// Get password on macOS: checks standard first, then protected.
/// On success with protected-only find, best-effort migrates to standard.
#[cfg(target_os = "macos")]
fn get_password<R: Runtime>(app: &AppHandle<R>, server_id: &str) -> Option<String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);
    let _ = app;

    // Try standard keychain first
    if let Ok(data) = security_framework::passwords::generic_password(legacy_password_options(&key))
    {
        if let Ok(s) = String::from_utf8(data) {
            return Some(s);
        }
    }

    // Fall back to protected keychain
    if let Ok(data) =
        security_framework::passwords::generic_password(protected_password_options(&key))
    {
        if let Ok(s) = String::from_utf8(data.clone()) {
            // Best-effort migration: try to store in standard keychain
            // Ignore errors — we still return the password we found
            let _ = security_framework::passwords::set_generic_password_options(
                data.as_slice(),
                legacy_password_options(&key),
            );
            return Some(s);
        }
    }

    None
}

/// Delete password on macOS: best-effort delete from both standard and protected.
/// Never fails — missing items are treated as success.
#[cfg(target_os = "macos")]
fn delete_password<R: Runtime>(_app: &AppHandle<R>, server_id: &str) -> Result<(), String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);

    let _ = security_framework::passwords::delete_generic_password_options(
        legacy_password_options(&key),
    );
    let _ = security_framework::passwords::delete_generic_password_options(
        protected_password_options(&key),
    );

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn store_password<R: Runtime>(
    app: &AppHandle<R>,
    server_id: &str,
    password: &str,
) -> Result<(), String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);
    let result = app.secure_storage().set_item(
        app.clone(),
        tauri_plugin_secure_storage::OptionsRequest {
            prefixed_key: Some(key),
            data: Some(password.to_string()),
            sync: Some(false),
            keychain_access: None,
        },
    );
    match result {
        Ok(Some(_)) => Ok(()),
        Ok(None) => Err("Failed to store password".to_string()),
        Err(e) => Err(format!("Keychain error: {}", e)),
    }
}

#[cfg(not(target_os = "macos"))]
fn get_password<R: Runtime>(app: &AppHandle<R>, server_id: &str) -> Option<String> {
    let key = format!("{}{}", PASSWORD_KEY_PREFIX, server_id);
    app.secure_storage()
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
        .data
}

#[cfg(not(target_os = "macos"))]
fn delete_password<R: Runtime>(app: &AppHandle<R>, server_id: &str) -> Result<(), String> {
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

/// Returns the credential status for a server given the current repo state.
/// This checks both keychain (secure storage) and the transient map.
fn compute_credential_status<R: Runtime>(
    app: &AppHandle<R>,
    repo: &ServerRepositoryState,
    server_id: &str,
) -> (CredentialStatus, Option<String>) {
    // Check keychain first
    if get_password(app, server_id).is_some() {
        return (CredentialStatus::Stored, None);
    }
    // Check transient map
    if repo.transient_passwords.contains_key(server_id) {
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

/// Get a server's password: checks keychain first, then transient in-memory map.
/// Returns None if no password is available.
pub fn get_server_password<R: Runtime>(
    app: &AppHandle<R>,
    repo: &ServerRepositoryState,
    server_id: &str,
) -> Option<String> {
    // Try keychain first
    if let Some(pw) = get_password(app, server_id) {
        return Some(pw);
    }
    // Fall back to transient map (may be empty string)
    repo.transient_passwords.get(server_id).cloned()
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
    let normalized_url = normalize_server_url(&input.url, "https://");

    let (credential_status, credential_warning) = if input.remember_password {
        // Try to persist in keychain; on failure fall back to transient map
        match store_password(app, &id, &input.password) {
            Ok(()) => (CredentialStatus::Stored, None),
            Err(warning) => {
                // Best-effort: keep in transient map for this session
                repo.transient_passwords
                    .insert(id.clone(), input.password.clone());
                (CredentialStatus::SessionOnly, Some(warning))
            }
        }
    } else {
        // Skip keychain entirely; keep only in transient map for session
        repo.transient_passwords
            .insert(id.clone(), input.password.clone());
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
    let (credential_status, credential_warning) = if input.password.is_none() {
        compute_credential_status(app, repo, &server_id)
    } else {
        (CredentialStatus::Unknown, None)
    };

    // Now do metadata updates
    let final_credential_status;
    let final_credential_warning;

    {
        let meta_mut = repo.servers.get_mut(&server_id).unwrap();
        if let Some(name) = input.name {
            meta_mut.name = name;
        }
        if let Some(url) = input.url {
            meta_mut.url = normalize_server_url(&url, "https://");
        }
        if let Some(username) = input.username {
            meta_mut.username = username;
        }

        if let Some(password) = input.password {
            match input.remember_password {
                Some(true) | None => match store_password(app, &meta_mut.id, &password) {
                    Ok(()) => {
                        repo.transient_passwords.remove(&meta_mut.id);
                        final_credential_status = CredentialStatus::Stored;
                        final_credential_warning = None;
                    }
                    Err(warning) => {
                        repo.transient_passwords
                            .insert(meta_mut.id.clone(), password);
                        final_credential_status = CredentialStatus::SessionOnly;
                        final_credential_warning = Some(warning);
                    }
                },
                Some(false) => {
                    let _ = delete_password(app, &meta_mut.id);
                    repo.transient_passwords
                        .insert(meta_mut.id.clone(), password);
                    final_credential_status = CredentialStatus::SessionOnly;
                    final_credential_warning = None;
                }
            }
        } else {
            final_credential_status = credential_status;
            final_credential_warning = credential_warning;
        }
    } // release mutable borrow on meta_mut here

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

/// Remove a server and its keychain password.
/// Password deletion is best-effort; server metadata removal failures are surfaced.
pub fn remove_server<R: Runtime>(
    app: &AppHandle<R>,
    repo: &mut ServerRepositoryState,
    server_id: &str,
) -> Result<(), String> {
    if repo.servers.remove(server_id).is_none() {
        return Err(format!("Server with id '{}' not found", server_id));
    }

    // Best-effort: try to delete from keychain, but don't fail the operation
    if let Err(warning) = delete_password(app, server_id) {
        log::warn!(
            "Failed to delete password for server '{}': {}",
            server_id,
            warning
        );
    }

    // Remove from transient map as well
    repo.transient_passwords.remove(server_id);

    // Clear active if it was this server
    if repo.active_server_id.as_ref() == Some(&server_id.to_string()) {
        repo.active_server_id = None;
    }

    Ok(())
}

/// Select a server as active and persist the change to disk.
pub fn select_server_and_persist<R: Runtime>(
    app: &AppHandle<R>,
    repo: &mut ServerRepositoryState,
    server_id: &str,
) -> Result<(), String> {
    if !repo.servers.contains_key(server_id) {
        return Err(format!("Server with id '{}' not found", server_id));
    }

    let new_active = Some(server_id.to_string());
    let original_active = repo.active_server_id.clone();
    repo.active_server_id = new_active;
    if let Err(persist_err) = save_repository(app, repo) {
        // Rollback: restore original active_server_id so both in-memory and
        // persisted state remain unchanged on persistence failure.
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

/// Test connection using raw credentials (for add/test flows).
pub async fn test_connection_raw(
    server_url: &str,
    username: &str,
    password: &str,
) -> TestConnectionResult {
    match qbittorrent_login(server_url, username, password).await {
        Ok(_) => TestConnectionResult {
            success: true,
            error: None,
        },
        Err(e) => TestConnectionResult {
            success: false,
            error: Some(e.to_string()),
        },
    }
}

/// Test connection using a saved server ID (loads credentials from keychain then transient map).
pub async fn test_saved_server<R: Runtime>(
    app: &AppHandle<R>,
    repo: &ServerRepositoryState,
    server_id: &str,
) -> TestConnectionResult {
    let meta = match repo.servers.get(server_id) {
        Some(m) => m,
        None => {
            return TestConnectionResult {
                success: false,
                error: Some(format!("Server '{}' not found", server_id)),
            }
        }
    };

    let password = match get_server_password(app, repo, server_id) {
        Some(p) => p,
        None => {
            return TestConnectionResult {
                success: false,
                error: Some(format!("Password not found for server '{}'", server_id)),
            }
        }
    };

    test_connection_raw(&meta.url, &meta.username, &password).await
}
