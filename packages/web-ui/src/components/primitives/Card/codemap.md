# Card

## Responsibility

Container component with variant, padding, and radius options. Supports clickable mode.

## Design

Web variant (`Card.web.tsx`): `React.memo`. Renders as `div[role=button]` with keyboard support when `onClick` is provided. Otherwise renders as a plain `div`.

## Flow

Controlled via props. Click/keyboard calls `onClick`. No internal state.

## Integration

Used by settings panels, server cards, and other container UIs.
