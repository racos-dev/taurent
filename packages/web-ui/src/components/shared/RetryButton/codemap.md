# RetryButton

## Responsibility

Outline button for retrying failed operations.

## Design

`React.memo` component. Wraps `Button` with `variant="outline"` and `size="sm"`. Configurable label text.

## Flow

Click calls `onClick`. No internal state.

## Integration

Used by `RemoteSectionContainer`, `RSSScreenBody`, and error state UIs.
