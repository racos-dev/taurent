# NumberInput

## Responsibility

Numeric input with increment/decrement buttons, min/max clamping, and step precision.

## Design

`React.memo` + `forwardRef`. Renders a native `input[type=number]` with custom up/down arrow buttons. Uses `useImperativeHandle` to expose the internal input ref. Clamps values to min/max and rounds to step precision. Native spin buttons are hidden via CSS.

## Flow

Controlled via `value`/`onChange`. Step buttons modify the value and fire `onChange` with a synthetic event. No complex internal state.

## Integration

Used by `NumberInputModal`, `TransferSettingsPanel`, `QueueSettingsPanel`, `RemoteSettingsPanel`, and `AddTorrentScreenBody` for numeric inputs.
