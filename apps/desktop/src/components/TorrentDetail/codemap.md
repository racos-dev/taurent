# apps/desktop/src/components/TorrentDetail/

## Responsibility

Desktop-specific overrides for torrent detail sections. Currently provides a desktop-specific files section that adds native file operations (Open File, Show in Folder) via context menus.

## Design

- **Path resolution**: Server-side paths are translated to local paths by the Rust `resolve_local_path` Tauri command (T132). The desktop side invokes it through `BridgeAdapter.openLocalPath()` / `BridgeAdapter.revealLocalItem()`, which call into Rust rather than local `pathMapping.ts` utilities.
- **Context menus**: Adds right-click context menus for file rows (Open File, Show in Folder) and folder rows (Open Folder, Show in Folder).
- **Fallback to settings**: When path mappings are insufficient, opens the Settings window scrolled to the Path Mappings section.
- **Desktop API calls**: Uses `BridgeAdapter.openLocalPath()` and `BridgeAdapter.revealLocalItem()` (Rust-backed, post-T134) for native file operations. The pre-T134 `openPath` / `revealItemInDir` JS-plugin methods have been removed.

## Key Files

- **DesktopTorrentDetailsFilesSection.tsx** — Wraps the shared `TorrentDetailsFilesSection` from `@taurent/web-ui` and adds desktop-specific context menus and click handlers.

## Flow

1. `DetailPanel` renders `DesktopTorrentDetailsFilesSection` for the Content tab.
2. User right-clicks a file/folder row → context menu appears with native file operations.
3. "Open File" resolves server path → local path via Rust `resolve_local_path` → `BridgeAdapter.openLocalPath()`.
4. "Show in Folder" resolves server path → local path via Rust `resolve_local_path` → `BridgeAdapter.revealLocalItem()`.
5. If no mapping matches, opens Settings → Path Mappings section.

## Integration

- Wraps `TorrentDetailsFilesSection` from `@taurent/web-ui`.
- Server-path-to-local-path resolution is performed by the Rust `resolve_local_path` Tauri command (T132). The pre-T134 `pathMapping.ts` helpers (`resolveLocalPath`, `buildServerTargetPath`, `dirname`) are no longer used by this section; bridge wrappers around the Rust command are the only path-resolution surface.
- Uses `BridgeAdapter` for `openLocalPath`, `revealLocalItem`, `getPathMappings`, `getSessionSnapshot` (post-T134 names; the old `openPath` / `revealItemInDir` were removed).
- Uses `openSettingsWindow` from `../../windows/settings/settingsWindow` for fallback.
