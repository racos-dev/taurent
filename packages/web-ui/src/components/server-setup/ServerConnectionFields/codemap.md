# ServerConnectionFields

## Responsibility

Shared form fields for server connection: name (optional), URL, username, password, and remember password checkbox.

## Design

`React.memo` component. Uses `Input` primitive for all fields and `Checkbox` for the remember password option. Supports per-field validation errors via `validationErrors` prop. All fields support placeholders and disabled state.

## Flow

All field state controlled via props. No internal state.

## Integration

Shared between `LoginFormBody`, `AddServerFormBody`, and `ServerOverviewSettingsPanel` for consistent server connection forms.
