# ToggleSwitch

## Responsibility

Toggle switch for boolean on/off state.

## Design

`React.memo` component. Renders as `button` with `aria-pressed`. Thumb position transitions via CSS `translate-x`. Uses primary color when on, border-input color when off. Density-aware touch target via `TOGGLE_CONTROL_WRAPPER_CLASSES[density]` — mobile adds negative margins + padding to extend the hit area to ~44px without enlarging the visible pill.

## Flow

Controlled via `checked`/`onChange`. Click calls `onChange(!checked)`. No internal state.

## Integration

Used by `TransferSettingsPanel`, `QueueSettingsPanel`, `RemoteSettingsPanel`, `SettingsScreenBody`, `RSSScreenBody`, and `ServerConnectionFields` for boolean toggles.
