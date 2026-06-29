# Composer

## Responsibility

Inline text input with add/cancel buttons for creating new items (tags, categories).

## Design

`React.memo` component. Uses `Input` primitive. Enter key submits if value is non-empty. Escape cancels. Submit button disabled when empty or pending.

## Flow

Controlled via `value`/`onChange`. Submit calls `onSubmit()`, cancel calls `onCancel()`. No internal state.

## Integration

Used by `FilterTagSection` and `FilterCategorySection` for inline add forms in list layout mode.
