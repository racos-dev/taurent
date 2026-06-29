# SettingsRow

## Responsibility

Interactive or static settings row with title, description, value badge, optional right slot, and chevron.

## Design

`React.memo` component. Renders as `button` when interactive (has `onPress` and not disabled), otherwise as `div`. Supports `tone: 'default' | 'danger'` for destructive actions. Shows chevron icon for interactive rows. Density-aware row rhythm via `useControlDensity()` — mobile uses `min-h-11 px-3 py-2`, desktop uses `px-2 py-2`.

## Flow

Click calls `onPress`. No internal state.

## Integration

Used by `TransferSettingsPanel`, `QueueSettingsPanel`, `RemoteSettingsPanel`, and `SettingsScreenBody` for mobile settings rows.
