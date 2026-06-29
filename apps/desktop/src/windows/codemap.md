# apps/desktop/src/windows/

## Responsibility

This folder owns the auxiliary-window subsystem for the desktop renderer:

- shared open/close/focus lifecycle via `auxWindowManager.ts`
- fixed-size dialog window configs in `dialogs/`
- dedicated utility windows in `settings/` and `statistics/`
- route wrappers in `layout/` that mount auxiliary screens outside the main shell

## Architecture

- **Generic window manager**: `openAuxWindow()` deduplicates concurrent opens, reuses existing windows, centers new ones, and delivers payloads through window-scoped events.
- **Window lifecycle**: `createWindowLifecycle()` wraps `openAuxWindow` with prebake/idle-close scheduling (`idleTtlMs=0` disables it).
- **Singleton utility windows**: settings/statistics windows are opened by label and reused when possible via lifecycle helpers.
- **Dialog-host model**: small dialogs (confirm, numeric, text, select, etc.) share a single `dialog-host` window via `openDialogHostWindow()`. Each dialog registers its config and screen in `registry.ts` (`DESKTOP_DIALOGS`).
- **Fixed-geometry design**: all dialogs are non-resizable with explicit dimensions; `useWindowState` skips geometry restore for fixed-size windows (`settings`, `statistics`, `add-torrent`).
- **Geometry split**: `AuxWindowLayout` restores state for utility windows; `DialogWindowLayout` intentionally does not.

## Key files

- `auxWindowManager.ts` — `openAuxWindow()`, `closeAuxWindow()`, `focusAuxWindow()`, `createWindowLifecycle()`.
- `dialogs/dialogHostWindow.ts` — shared dialog-host window singleton (`dialog-host` label) and `openDialogHostWindow(dialog, config, payload)`.
- `dialogs/registry.ts` — `DESKTOP_DIALOGS` registry mapping `DialogHostKind` → `{ config, Screen }`; `registerDesktopDialog()`.
- `dialogs/addTorrentWindow.ts` — standalone add-torrent window (no dialog host).
- `dialogs/filtersDeleteDialogWindow.ts` — dialog-host confirm dialog for category/tag deletion.
- `dialogs/torrentDeleteDialogWindow.ts`, `dialogs/torrentShareLimitsDialogWindow.ts`, `dialogs/torrentNumericDialogWindow.ts`, `dialogs/torrentTextDialogWindow.ts`, `dialogs/transferLimitDialogWindow.ts` — dialog-host torrent dialogs.
- `dialogs/categorySelectDialogWindow.ts`, `dialogs/tagSelectDialogWindow.ts` — dialog-host selection dialogs.
- `dialogs/createDialogWindow.ts`, `dialogs/editCategoryDialogWindow.ts` — dialog-host creation/edit dialogs.
- `settings/settingsWindow.ts` — fixed-size settings window with deep-link section support and resource invalidation emission.
- `statistics/statisticsWindow.ts` — fixed-size statistics window opener/config.
- `layout/*.tsx` — route shells for auxiliary windows.

## Integration

- `src/App.tsx` registers the window routes.
- `useWindowState` restores utility window geometry where appropriate.
- `@tauri-apps/api/event` and `@tauri-apps/api/webviewWindow` provide the IPC/window primitives.
