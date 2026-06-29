# TransferSettingsPanel

## Responsibility

Download/upload speed limit configuration with alternative speed limits toggle.

## Design

`React.memo` with `variant: 'desktop' | 'mobile'`. Desktop: inline `NumberInput` fields for DL/UL limits with formatted speed display and save button. Mobile: `SettingsRow` components that call `onEditLimit` for modal editing. Uses `formatSpeed` from shared utils.

## Flow

Desktop: staged values managed internally, synced from props via `useEffect`. Save calls `onSave({ dl_limit, up_limit })`. Mobile: immediate callbacks via `onEditLimit(key, currentValue)`.

## Integration

Used by `SettingsScreenBody` for transfer settings section.
