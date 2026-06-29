# QueueSettingsPanel

## Responsibility

Queue management settings: enable queueing, max active downloads/uploads/torrents, and ignore slow torrents.

## Design

`React.memo` with `variant: 'desktop' | 'mobile'`. Desktop: staged values with `ToggleSwitch`, `NumberInput` grid, and save button. Mobile: `SettingsRow` components with boolean toggle switches and `NumberInputModal` editors for queue limits.

## Flow

Desktop: staged values synced from props, save calls `onSave({...})`. Mobile: immediate callbacks via `onPreferenceChange(key, value)` with boolean values for boolean preferences and number values for queue limits.

## Integration

Used by `SettingsScreenBody` for queue settings section.
