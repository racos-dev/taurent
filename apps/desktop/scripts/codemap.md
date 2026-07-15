# apps/desktop/scripts/

## Responsibility

Top-level container for desktop support scripts: dev launch, icon generation, and perf / bundle analysis.

## Design

Organized as self-contained CLI entrypoints and subdirectories invoked via pnpm scripts; there is no shared runtime library at this level.

## Flow

Scripts are imperative: they spawn child processes, manage ports and processes, and write artifacts. Each script is a short-lived command launched from a pnpm task; there is no long-running daemon in this folder.

## Integration

`dev/` bridges `pnpm desktop:dev` to `tauri dev`. `perf/` reads dist assets and writes analysis artifacts. Icon scripts generate and validate desktop assets.
