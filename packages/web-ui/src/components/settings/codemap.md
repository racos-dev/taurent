# packages/web-ui/src/components/settings/

## Responsibility

Preference panel components for configuring qBittorrent server settings, transfer limits, queue behavior, theme, and remote server management.

## Design

- **SettingsSection**: Collapsible section with icon, title, summary, and chevron. Supports controlled (`expanded`/`onToggle`) and uncontrolled (`defaultExpanded`) modes. Density-aware header sizing via `useControlDensity()` — mobile uses `min-h-11`.
- **SettingsRow**: Interactive or static row with title, description, value badge, optional right slot, and chevron for interactive rows. Supports danger tone for destructive actions. Density-aware row rhythm via `useControlDensity()` — mobile uses `min-h-11`.
- **SettingsCard**: Titled card container with optional description. Used for grouping related settings.
- **ThemeSettingsPanel**: System/manual mode selector, palette list with radio selection, and light/dark variant toggle. Uses `getThemeOptions()` from shared theme registry.
- **TransferSettingsPanel**: Download/upload speed limit configuration with alt speed toggle. Desktop: inline `NumberInput` fields with save button. Mobile: `SettingsRow` with modal editing via `onEditLimit`.
- **QueueSettingsPanel**: Queue management settings (enable queueing, max active downloads/uploads/torrents, ignore slow torrents). Desktop: inline `NumberInput` fields. Mobile: `SettingsRow` with modal callbacks.
- **RemoteSettingsPanel**: Generic remote settings renderer driven by `REMOTE_SETTINGS_SECTIONS` config from `@taurent/shared/settings`. Desktop: staged values with dirty tracking and per-field revert. Mobile: immediate apply via `onPreferenceChange`. Supports boolean (toggle), number (input/modal), string (input), textarea, and select field kinds.
- **ServerOverviewSettingsPanel**: Server profile management — list, add, edit, delete, test connection, switch servers. Includes auto-scheme detection (HTTPS → HTTP fallback), inline edit forms, and test result display.

## Flow

Settings panels are controlled — they receive preferences data and mutation callbacks from the app shell. Desktop variant uses staged values with save buttons. Mobile variant applies changes immediately. `RemoteSettingsPanel` uses a declarative field config to render the appropriate input for each preference key.

## Integration

Consumed by `SettingsScreenBody` and app shells. `SettingsSection`, `SettingsRow`, `SettingsCard` are foundational for all settings UI. `RemoteSettingsPanel` is the primary renderer for server-side preferences.
