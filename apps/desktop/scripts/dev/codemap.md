# apps/desktop/scripts/dev/

## Responsibility

Wraps `tauri dev` with platform-specific environment setup so the desktop app can be launched the same way from any developer machine and CI environment.

## Design

A single thin Node wrapper, `tauri-dev.mjs`. On macOS it sets a `CARGO_TARGET_DIR` override to keep Rust build artifacts off the root volume, and it forwards process signals (SIGINT / SIGTERM) to the child.

## Flow

Forwards CLI args to `pnpm exec tauri dev`, inherits stdio for live logs, and maps the child's exit / signal status to conventional exit codes so pnpm and CI see a clean status.

## Integration

Entrypoint for the `pnpm desktop:dev` task. Drives Tauri through the official CLI, which reads `apps/desktop/src-tauri/tauri.conf.json`.
