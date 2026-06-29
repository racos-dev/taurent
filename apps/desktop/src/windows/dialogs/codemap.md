# apps/desktop/src/windows/dialogs/

## Responsibility

Manages all dialog windows in the desktop app: a singleton dialog-host window that reuses a single Tauri window for all dialogs, a dialog type registry mapping dialog kinds to their config and screen components, individual dialog window opener functions, and the standalone add-torrent window.

## Design

- **Singleton dialog host**: A single Tauri window (`dialog-host`) serves all dialogs. `dialogHostWindow.ts` manages its lifecycle — creates it lazily on first use, reuses it for subsequent dialogs, and schedules idle-close when dismissed.
- **Type registry**: `registry.ts` maps each `DialogHostKind` to a `{ config, Screen }` entry. Config includes window dimensions, title, and behavior flags. The Screen is the React component rendered inside the dialog host.
- **Opener pattern**: Each dialog type exports an `open*Window(payload)` function that builds the dialog payload and calls `openDialogHostWindow`. This keeps callers decoupled from the dialog host machinery.
- **Standalone add-torrent window**: `addTorrentWindow.ts` manages its own Tauri window (not the dialog host) since it's complex enough to warrant a dedicated window.

## Files

- **dialogHostWindow.ts** — singleton dialog-host window manager. Creates a 400×220 non-resizable window lazily. `openDialogHostWindow(dialog, config, payload)` navigates the window to the dialog route and sends the payload. `dismissDialogWindow()` hides the window and schedules idle-close after a timeout.
- **registry.ts** — `DESKTOP_DIALOGS` registry mapping `DialogHostKind` → `{ config: { width, height, title, resizable }, Screen: ComponentType }`. Registers dialog types including `category-select`, `confirm`, `create`, `edit-category`, `server-delete`, `tag-select`, `torrent-delete`, `torrent-numeric`, `torrent-share-limits`, `torrent-text`, `transfer-limit`.
- **addTorrentWindow.ts** — standalone add-torrent window (not dialog host). `openAddTorrentWindow(filePath?)` opens a larger resizable window for adding torrents (file or magnet).
- **confirmDialogWindow.ts** — `openConfirmDialogWindow({ title, message, onConfirm, onCancel? })`.
- **serverDeleteDialogWindow.ts** — `openServerDeleteDialogWindow({ serverId, serverName })` — delete saved server profile.
- **torrentDeleteDialogWindow.ts** — `openTorrentDeleteDialogWindow({ hashes, onConfirm })` — includes delete-files checkbox.
- **editCategoryDialogWindow.ts** — `openEditCategoryDialogWindow({ category?, onSave })` — create or edit a category.
- **tagSelectDialogWindow.ts** — `openTagSelectDialogWindow({ hashes, currentTags })` — select tags for torrents.
- **categorySelectDialogWindow.ts** — `openCategorySelectDialogWindow({ hashes, currentCategory })` — select category for torrents.
- **torrentNumericDialogWindow.ts** — `openTorrentNumericDialogWindow({ title, label, value, onSave })` — generic numeric input dialog.
- **torrentTextDialogWindow.ts** — `openTorrentTextDialogWindow({ title, label, value, onSave })` — generic text input dialog.
- **torrentShareLimitsDialogWindow.ts** — `openTorrentShareLimitsDialogWindow({ hashes, onSave })` — edit share ratio limits.
- **transferLimitDialogWindow.ts** — `openTransferLimitDialogWindow({ kind, currentValue, onSave })` — edit global transfer limits.

## Flow

1. Caller imports and calls a dialog opener (e.g., `openConfirmDialogWindow({...})`).
2. The opener builds a `DialogPayload` and calls `openDialogHostWindow(dialogKind, config, payload)`.
3. `dialogHostWindow` creates (or reuses) the Tauri dialog-host window, navigates it to the dialog route, and sends the payload via a navigate event.
4. The dialog host renders the registered `Screen` component with the payload.
5. On user action (confirm/cancel), the dialog calls the callback, then `dismissDialogWindow()` hides the window and schedules idle-close.

## Integration

- `src/windows/layout/DialogWindowLayout` — the layout component rendered inside the dialog-host window, reads navigate events and renders the matching Screen.
- `@tauri-apps/api/window` — `WebviewWindow` for window lifecycle.
- `@taurent/bridge/adapters/desktop` — `BridgeAdapter` for any dialog-driven RPCs.
- Used by: context menus, toolbar, menu bar, sidebar — any UI that needs confirmation, input, or selection dialogs.
