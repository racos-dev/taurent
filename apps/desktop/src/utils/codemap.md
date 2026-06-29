# apps/desktop/src/utils/

## Responsibility

This directory holds small, pure utility surface APIs consumed by the desktop React renderer, plus test support utilities under `__tests__/`. Utilities are thin, deterministic helpers that centralize common UI concerns.

## Current State

Desktop components should import utility helpers directly from `@taurent/shared`:
- `cn` from `@taurent/shared` (className composition via clsx + tailwind-merge)
- torrent state formatters from `@taurent/shared/utils/torrentStatus` and `@taurent/shared/utils/formatters`

`pathMapping.ts` provides `buildServerTargetPath` (computes server-side target paths for file rows) and `dirname` (string-based directory extraction). Path-mapping resolution (`resolveLocalPath`) has moved to Rust behind the qb-tauri command boundary — see `crates/qb-tauri/src/commands/servers.rs`. Call sites now invoke `resolve_local_path` via `BridgeAdapter.resolveLocalPath()`.

Settings dirty tracking (`isSectionDirty`, `getDirtyFieldKeys`) has been consolidated into `@taurent/shared/settings`. The local `settingsDirty.ts` utility was removed — components now import directly from the shared package.

The `__tests__/` directory contains Vitest unit tests for desktop utilities. The `testing/` directory (sibling to `utils/`) provides mock helpers for Tauri transport and desktop bridge integration in tests; those are not codemapped here but are available for test fixtures.

## Integration

If adding utilities here in the future, prefer pure re-exports from `@taurent/shared` that provide a stable local import path, rather than duplicating shared logic.
