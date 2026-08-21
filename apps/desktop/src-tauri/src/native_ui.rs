use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeUiLabels {
    pub menu_app: String,
    pub menu_about: String,
    pub menu_add_torrent: String,
    pub menu_copy: String,
    pub menu_cut: String,
    pub menu_delete: String,
    pub menu_edit: String,
    pub menu_file: String,
    pub menu_force_start: String,
    pub menu_help: String,
    pub menu_hide: String,
    pub menu_hide_others: String,
    pub menu_move_bottom: String,
    pub menu_move_top: String,
    pub menu_paste: String,
    pub menu_pause: String,
    pub menu_queue_down: String,
    pub menu_queue_up: String,
    pub menu_quit: String,
    pub menu_reannounce: String,
    pub menu_recheck: String,
    pub menu_redo: String,
    pub menu_resume: String,
    pub menu_rss: String,
    pub menu_search: String,
    pub menu_select_all: String,
    pub menu_set_category: String,
    pub menu_set_tags: String,
    pub menu_settings: String,
    pub menu_show_all: String,
    pub menu_show_menu_bar: String,
    pub menu_statistics: String,
    pub menu_toggle_details: String,
    pub menu_toggle_sidebar: String,
    pub menu_tools: String,
    pub menu_torrent: String,
    pub menu_undo: String,
    pub menu_view: String,
    pub tray_add_torrent: String,
    pub tray_alternative_speed: String,
    pub tray_global_speed_limits: String,
    pub tray_hide: String,
    pub tray_quit: String,
    pub tray_show: String,
    pub window_add_torrent: String,
    pub window_global_speed_limits: String,
}

impl Default for NativeUiLabels {
    fn default() -> Self {
        Self {
            menu_app: "Taurent".into(),
            menu_about: "About Taurent".into(),
            menu_add_torrent: "Add Torrent…".into(),
            menu_copy: "Copy".into(),
            menu_cut: "Cut".into(),
            menu_delete: "Delete".into(),
            menu_edit: "Edit".into(),
            menu_file: "File".into(),
            menu_force_start: "Force Start".into(),
            menu_help: "Help".into(),
            menu_hide: "Hide Taurent".into(),
            menu_hide_others: "Hide Others".into(),
            menu_move_bottom: "Move to Bottom".into(),
            menu_move_top: "Move to Top".into(),
            menu_paste: "Paste".into(),
            menu_pause: "Pause".into(),
            menu_queue_down: "Queue Down".into(),
            menu_queue_up: "Queue Up".into(),
            menu_quit: "Quit Taurent".into(),
            menu_reannounce: "Reannounce".into(),
            menu_recheck: "Recheck".into(),
            menu_redo: "Redo".into(),
            menu_resume: "Resume".into(),
            menu_rss: "RSS…".into(),
            menu_search: "Search…".into(),
            menu_select_all: "Select All".into(),
            menu_set_category: "Set Category…".into(),
            menu_set_tags: "Set Tags…".into(),
            menu_settings: "Settings…".into(),
            menu_show_all: "Show All".into(),
            menu_show_menu_bar: "Show Menu Bar".into(),
            menu_statistics: "Statistics…".into(),
            menu_toggle_details: "Toggle Details Panel".into(),
            menu_toggle_sidebar: "Toggle Sidebar".into(),
            menu_tools: "Tools".into(),
            menu_torrent: "Torrent".into(),
            menu_undo: "Undo".into(),
            menu_view: "View".into(),
            tray_add_torrent: "Add Torrent File/Magnet…".into(),
            tray_alternative_speed: "Alternative Speed Limits".into(),
            tray_global_speed_limits: "Set Global Speed Limits…".into(),
            tray_hide: "Hide".into(),
            tray_quit: "Quit".into(),
            tray_show: "Show".into(),
            window_add_torrent: "Add Torrent".into(),
            window_global_speed_limits: "Global Speed Limits".into(),
        }
    }
}

#[derive(Default)]
pub struct NativeUiLabelsState(Mutex<NativeUiLabels>);

impl NativeUiLabelsState {
    pub fn get(&self) -> NativeUiLabels {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }

    pub fn replace(&self, labels: NativeUiLabels) {
        *self.0.lock().unwrap_or_else(|error| error.into_inner()) = labels;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_usable_before_the_renderer_syncs() {
        let labels = NativeUiLabels::default();
        assert_eq!(labels.tray_show, "Show");
        assert_eq!(labels.window_add_torrent, "Add Torrent");
    }

    #[test]
    fn renderer_labels_replace_the_cached_window_titles() {
        let state = NativeUiLabelsState::default();
        let labels = NativeUiLabels {
            window_add_torrent: "Adaugă torrent".into(),
            ..NativeUiLabels::default()
        };
        state.replace(labels);

        assert_eq!(state.get().window_add_torrent, "Adaugă torrent");
    }
}
