# apps/desktop/scripts/

## Responsibility

Top-level container for desktop support scripts: dev launch, native E2E runner, perf / bundle analysis, and fake backend / testing infrastructure used by those runners.

## Design

Organized as subdirectories: `dev/`, `e2e/`, `perf/`, and `testing/`. Each subdirectory is a self-contained set of standalone CLI entrypoints invoked via pnpm scripts; there is no shared runtime library at this level.

## Flow

Scripts are imperative: they spawn child processes, manage ports and processes, and write artifacts. Each script is a short-lived command launched from a pnpm task; there is no long-running daemon in this folder.

## Integration

`dev/` bridges `pnpm desktop:dev` to `tauri dev`. `e2e/` orchestrates the fake qBittorrent, Vite, Tauri, and WebDriverIO together. `perf/` reads dist assets and writes analysis artifacts. `testing/` hosts the fake backend consumed by the E2E runner.
