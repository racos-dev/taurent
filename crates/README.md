# Rust Workspace Crates

This directory contains the shared Rust backend crates introduced by the Tauri rework.

- `qb-core`: shared qBittorrent/session/domain backend
- `qb-tauri`: Tauri adapter, commands, events, and platform glue

Phase 1 created the workspace scaffolding. Phase 2 moved shared session/client/backend ownership here while the app crates kept temporary compatibility aliases.
