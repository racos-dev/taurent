# apps/desktop/src/

## Responsibility

This is the desktop renderer source tree. It owns renderer bootstrap, route composition, desktop-only state glue, and the window/dialog system.

## Core areas

- `App.tsx` — router + provider composition; main shell routes and auxiliary window routes live here.
- `connection/` — session/server manager bridges and context wiring.
- `hooks/` — grouped desktop hooks for platform, settings, shell, and torrents.
- `windows/` — auxiliary window configs, singleton open/focus helpers, and route layouts.
- `stores/` — local Zustand stores for selection, shell state, transfer dialogs, and column registry.
- `platform/` — desktop platform adapters and app-level platform facades.

## Design patterns

- **Layered adapter model**: `connection/*` binds the renderer to `@taurent/bridge`; hooks consume those providers.
- **Grouped hook domains**: hook responsibilities are split by domain instead of flat files (`platform/`, `settings/`, `shell/`, `torrents/`).
- **Command-driven shell**: transfer and app commands stay as serializable objects so menus, keyboard shortcuts, and context menus share the same source.
- **Aux-window routing**: dialog and utility windows are launched by config objects and rendered on dedicated routes, not inside overlay components.

## Key flow

1. `main.tsx` loads `App`.
2. `App.tsx` creates the router.
3. Main-window routes mount through `MainWindowLayout` and `AuthBoundary`.
4. Auxiliary routes mount through `AuxWindowLayout` or `DialogWindowLayout`.
5. Hooks translate session scope + selection state into web-core queries, mutations, and native actions.

## Important files

- `connection/index.ts`, `connection/useServerManager.ts` — public connection API.
- `hooks/index.ts` — desktop hook barrel.
- `hooks/platform/platform.ts` — single `createPlatformHooks()` instantiation.
- `windows/auxWindowManager.ts` — generic auxiliary window lifecycle helper.
- `windows/dialogs/*` — fixed-size dialog window configs.
- `windows/settings/settingsWindow.ts`, `windows/statistics/statisticsWindow.ts` — dedicated utility windows.

## Invariants

- Keep platform-specific logic in desktop boundaries only.
- Keep domain logic in web-core/shared where possible.
- Keep settings/dialog windows route-driven and singleton-aware.
