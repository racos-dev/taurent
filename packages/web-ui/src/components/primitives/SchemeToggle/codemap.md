# SchemeToggle

## Responsibility

Segmented radio control for selecting HTTP or HTTPS URL scheme.

## Design

`React.memo` component with `role="radiogroup"`. Two buttons with `role="radio"` and `aria-checked`. Active button uses primary color background.

## Flow

Controlled via `scheme`/`onChange`. Click calls `onChange('http')` or `onChange('https')`. No internal state.

## Integration

Used by `ServerConnectionFields` for URL scheme selection.
