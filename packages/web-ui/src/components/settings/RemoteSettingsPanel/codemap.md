# RemoteSettingsPanel

## Responsibility

Generic remote settings renderer driven by declarative field configuration from `@taurent/shared/settings`.

## Design

`React.memo` component. Desktop: staged values with dirty tracking, per-field revert buttons, and controlled mode via `stagedValues`/`onStagedChange`. Mobile: immediate apply via `onPreferenceChange`; booleans use `ToggleSwitch`, numbers use `NumberInputModal` with `mobileEditor` display/transform metadata, strings use `Input`, textareas use native textareas, and selects use the shared `Select`. Respects `visibleWhen` conditional visibility.

## Flow

Desktop: internal staged state or controlled `stagedValues`. Changes call `onStagedChange`. Mobile: each change calls `onPreferenceChange(key, value)` immediately.

## Integration

Used by `SettingsScreenBody` for remote server preferences. Field config is driven by `REMOTE_SETTINGS_SECTIONS` from `@taurent/shared/settings`.
