# Button

## Responsibility

Multi-variant, multi-size button with loading state, icon slots, and focus ring.

## Design

Web variant (`Button.web.tsx`): `React.memo` with custom comparator. 9 variants, 3 size categories. Loading shows `Spinner`. Supports `leftIcon`/`rightIcon` slots. Uses semantic token classes. Density-aware sizing via `BUTTON_CONTROL_SIZE_CLASSES[density][size]` — mobile increases min-height to 44px and enlarges text.

## Flow

Controlled via props. Click calls `onClick` (suppressed when disabled/loading). No internal state.

## Integration

Foundation button for all domain components, dialogs, and settings panels.
