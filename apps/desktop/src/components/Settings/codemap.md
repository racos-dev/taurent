# apps/desktop/src/components/Settings/

## Responsibility

Desktop-specific settings UI components for the Settings window. Contains navigation configuration, sidebar, and section components for desktop-only preferences (theme, window behavior, about, servers, path mappings) and remote qBittorrent settings.

## Design

- **Navigation config**: `SettingsNavConfig.ts` defines two groups — `APP_NAV_ITEMS` (desktop-specific: window behavior, theme, about, servers, path mappings) and `REMOTE_SECTION_NAV` (qBittorrent remote settings: behavior, downloads, connection, speed, BitTorrent, WebUI, advanced).
- **Sidebar component**: `SettingsSidebar` renders grouped navigation with active section highlighting and dirty-section indicators (dot badges).
- **Section components**: Each section is a self-contained React.memo component that reads its data from hooks and renders a settings panel from `@taurent/web-ui`.

## Key Files

- **SettingsNavConfig.ts** — Type definitions for `SectionId`, `SettingsNavItem`, `SettingsNavGroup`, and constants `REMOTE_SECTION_NAV`, `APP_NAV_ITEMS`.
- **SettingsSidebar.tsx** — Memoized sidebar with grouped navigation buttons, active state, and dirty indicators.
- **WindowBehaviorSettings.tsx** — Close-to-tray, start-minimized, auto-start, download completion notifications toggles.
- **DesktopThemeSettings.tsx** — Theme mode/palette/variant selection via `ThemeSettingsPanel`. Uses `useTheme` from `@taurent/web-ui/theme` with `config`, `setMode`, `setSystemPalette`, `setManualPalette`, `setManualVariant`, `setAccent`.
- **DesktopAboutSettings.tsx** — App version, author, and GitHub link.
- **ServerOverviewSettings.tsx** — Multi-server management (add, edit, remove, switch, test connection) with delete confirmation dialog. Uses `useServerManager` and `useQBClient` from `../../connection`, `BridgeAdapter.servers` for test connection, and emits `server-list-changed` events on server removal.
- **PathMappingsSettings.tsx** — Per-server path mapping configuration for server→local path resolution.

## Flow

1. `SettingsScreen` imports section components and renders them in a scrollable main area.
2. `SettingsSidebar` highlights the active section based on scroll position.
3. User edits trigger `handleRemoteStagedChange` → staged state updates (tracked per section via `isSectionDirty` / `getDirtyFieldKeys` from `@taurent/shared/settings`).
4. "Save All" button collects dirty fields across all sections and submits via `setPreferencesMutation`.
5. Close overlay prompts when dirty sections exist on window close.

## Integration

- Sections use hooks from `../hooks/settings/` for preferences and local settings.
- `ServerOverviewSettings` uses `useQBClient` and `useServerManager` from `../connection`.
- `DesktopThemeSettings` uses `useTheme` from `@taurent/web-ui/theme`.
- Shared panel components from `@taurent/web-ui` (`RemoteSettingsPanel`, `ThemeSettingsPanel`, `ServerOverviewSettingsPanel`).
- `SettingsNavConfig` is consumed by `SettingsScreen` for navigation rendering.
