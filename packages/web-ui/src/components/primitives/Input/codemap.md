# Input

## Responsibility

Multi-size text input with label, error, helper text, icon slot, clear button, and controlled/uncontrolled modes.

## Design

Web variant (`Input.web.tsx`): `React.memo` inner + `forwardRef` wrapper. Supports `size: 'sm' | 'md'`. Clearable mode shows an X button. Icon slot shifts input padding. Error state changes border color. Uncontrolled mode uses internal state with `defaultValue`. Density-aware sizing via `INPUT_CONTROL_SIZE_CLASSES[density]`, with matching icon/clear padding and offset classes for each density.

## Flow

Controlled via `value`/`onChange` or uncontrolled via `defaultValue`. Clear button calls `onChange('')`. No complex internal state.

## Integration

Used by all form UIs: server setup, settings, dialogs, management screens, and search.
