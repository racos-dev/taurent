//! Pending magnet-link queue for deep-link resilience.
//!
//! When a magnet link arrives while the renderer is torn down (e.g. tray mode),
//! the Rust callback enqueues URLs here. The frontend drains them on mount via
//! the `get_pending_magnet_links` command.

use std::collections::HashSet;
use std::sync::Mutex;

use tauri::Manager;

/// Holds queued magnet URLs with dedup to avoid re-queuing the same URL
/// across cold-start, single-instance, and on_open_url events.
pub struct PendingMagnetLinks {
    queue: Mutex<Vec<String>>,
    seen: Mutex<HashSet<String>>,
}

impl Default for PendingMagnetLinks {
    fn default() -> Self {
        Self::new()
    }
}

impl PendingMagnetLinks {
    pub fn new() -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
            seen: Mutex::new(HashSet::new()),
        }
    }

    /// Enqueue `urls`, adding each to `seen` first so duplicates across sources
    /// are suppressed. Returns only the genuinely new URLs.
    pub fn enqueue(&self, urls: Vec<String>) -> Vec<String> {
        let mut seen = self.seen.lock().unwrap();
        let mut queue = self.queue.lock().unwrap();
        let mut new_urls = Vec::with_capacity(urls.len());
        for url in urls {
            if seen.insert(url.clone()) {
                queue.push(url.clone());
                new_urls.push(url);
            }
        }
        drop(queue);
        new_urls
    }

    pub fn drain(&self) -> Vec<String> {
        let mut queue = self.queue.lock().unwrap();
        let drained = std::mem::take(&mut *queue);
        drop(queue);

        let mut seen = self.seen.lock().unwrap();
        for url in &drained {
            seen.remove(url);
        }
        drop(seen);

        drained
    }
}

/// Tauri command: drain pending magnet URLs for the frontend.
#[tauri::command]
pub fn get_pending_magnet_links(app: tauri::AppHandle) -> Vec<String> {
    let pending = app.state::<PendingMagnetLinks>();
    pending.drain()
}
