// Desktop app commands - re-export from qb-tauri
// Note: qb-tauri app module contains mobile-only commands (global limits, RSS)
// Desktop doesn't use these, but we keep the re-export for API completeness
pub use qb_tauri::commands::app::*;
