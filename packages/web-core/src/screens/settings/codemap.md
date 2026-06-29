# settings

## Responsibility

Headless controller for SettingsScreen orchestration. Manages section expand/collapse state, input modal/confirm dialog state, server management (edit, test, switch, remove), transfer limit preference handlers, theme summary derivation, and section summaries from server preferences.

## Key Files

- `useSettingsScreenController.ts` — Main controller hook with all settings screen state and handlers; includes server switching (atomic session switch via `sessionSwitchServerById`), remote shutdown with confirmation, and operation failure reporting for switch failures

## Design Patterns

- **Section expand state**: Tracks final mobile settings sections by controller key (`server`, `appearance`, `speed`, `downloads`, `connection`, `bittorrent`, `webui`, `advanced`)
- **Input modal**: Generic numeric input modal for editing transfer limits with title, current value, and unit label
- **Confirm dialog**: Generic confirm dialog for dangerous actions (disconnect, shutdown, remove server) with title, message, confirm label, and tone
- **Server editing**: Inline edit state for server name/url/username with save/cancel
- **Server test/switch**: Per-server test results and switching state tracking; atomic switch via `sessionSwitchServerById` with failure reporting through operation notifications
- **Remote shutdown**: Confirm dialog for sending shutdown signal to remote server with navigation to login on success
- **Theme summary**: Derives human-readable theme description from palette/variant config
- **Section summaries**: Derives human-readable summaries for each remote settings section from preferences (speed mode, download flags, port, BitTorrent queue/seeding/privacy flags, WebUI, advanced)
- **Danger zone**: Disconnect and remote shutdown with confirmation dialogs

## Flow

1. App route mounts controller with injected connection state, preferences, mutations, server management functions
2. Controller derives theme summary and section summaries from config/preferences
3. User expands/collapses sections via `toggleSection`
4. User edits transfer limits → `handleEditTransferLimit` opens input modal → `onSubmit` updates the matching qBittorrent preference through `updatePreference`
5. User edits server → inline edit state → `handleSaveEdit` calls updateServer
6. User switches server → `handleSwitchServer` calls atomic switch → navigates to home
7. User disconnects/shuts down → confirm dialog → executes action → navigates to login

## Integration

- Imports `getThemeMetadata` from `@taurent/shared/theme/registry`
- Imports `Preferences` from `@taurent/shared/types/qbittorrent`
- Imports `Server` from `@taurent/shared/types/server`
- Imports `reportOperationFailure` from `hooks/operationFailureReporter`
- Used by desktop/mobile SettingsScreen routes
- Consumes injected mutations, server management functions, and navigation callbacks
