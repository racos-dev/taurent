# Checkbox

## Responsibility

Custom checkbox with checked, indeterminate, and disabled states.

## Design

`React.memo` component. Renders as `button[role=checkbox]` with `aria-checked` (true/false/mixed). Visual states: unchecked (empty), checked (check icon), indeterminate (minus icon). Uses semantic primary color when active. Density-aware wrapper via `CHECKBOX_CONTROL_WRAPPER_CLASSES[density]` — mobile adds padding to extend the hit area to ~44px.

## Flow

Controlled via `checked`/`onChange`. Click toggles. No internal state.

## Integration

Used by settings panels, filter lists, and form UIs throughout the codebase.
