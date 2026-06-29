# packages/web-ui/src/

## Responsibility

Public entry point and barrel for the `@taurent/web-ui` package. Re-exports all domain-grouped components, screen bodies, primitives, dialogs, shared helpers, and the theme provider so consuming apps (`apps/desktop`, `apps/mobile`) can import from a single specifier.

## Design

- **Single barrel**: `index.ts` re-exports every public component, type, hook, and utility from child domain barrels — no deep imports needed by consumers.
- **Control density system**: `controlSizing/` provides `ControlDensityProvider`, `useControlDensity()` hook, and static class maps for desktop/mobile control sizing. Mobile apps mount the provider; desktop apps rely on the default.
- **Theme provider**: `theme/` exports `ThemeProvider` and `useTheme` for palette/variant management. Theme class is applied to `document.documentElement` and persisted to `localStorage`. Supports custom accent colors for the Midnight palette.
- **Domain grouping**: `components/` is organized into `primitives` (all density-aware), `layout`, `dialogs`, `management`, `server-setup`, `settings`, `shared`, `torrents`, and top-level standalone components (`ServerCard`, `CredentialHealthIndicator`, `CredentialWarningBanner`, `SidebarFilterItem`, `Tooltip`).
- **Screen bodies**: `screens/` exports thin body components (`HomeScreenBody`, `SearchScreenBody`, etc.) that compose domain components and accept all data/callbacks as props — no direct data fetching.

## Flow

1. Apps mount `<ThemeProvider>` at the root, which reads persisted theme from `localStorage` and applies the resolved CSS class to the document root.
2. Screen bodies receive data (torrents, settings, search results) and callbacks from the app shell via props.
3. Screen bodies compose layout primitives (`WorkspaceFrame`, `ScreenHeader`, `CommandBar`) and domain components (`TorrentActionsBar`, `FilterStatusList`, `SettingsSection`).
4. User interactions bubble up via callback props — screen bodies never mutate shared state directly.

## Integration

- Depends on `@taurent/shared` for types, formatters, icons, theme registry/resolver, and utility functions.
- Depends on `@taurent/web-core` for screen controller hooks (e.g., `useAddServerScreenController`).
- Consumed by `apps/desktop` and `apps/mobile` app shells, which wire data fetching, routing, and native bridge calls.
- `apps/*` should never import `@tauri-apps/*` — this package owns presentation composition only.
