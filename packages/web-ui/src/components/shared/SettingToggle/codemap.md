# SettingToggle

## Responsibility

Checkbox + label + description row for boolean settings with description text.

## Design

`React.memo` component. Renders a bordered row with `Checkbox` on the left and label + optional description on the right. Adapts padding based on description presence.

## Flow

Controlled via `value`/`onChange`. No internal state.

## Integration

Used by settings UIs for boolean preference display.
