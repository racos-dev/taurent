# TestConnectionFeedback

## Responsibility

Inline feedback banner for connection test states: idle, testing, success, and error.

## Design

`React.memo` component. Returns `null` for idle state. Shows spinner + "Testing connection..." for testing. Green banner with check icon for success. Red banner with X icon, error message, and optional suggestion for error state.

## Flow

Pure presentational. No state.

## Integration

Used by `AddServerFormBody` and `ServerOverviewSettingsPanel` for connection test feedback.
