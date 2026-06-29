# RemoteSectionContainer

## Responsibility

Orchestrator for remote settings sections — handles no-server, loading, connection error, data error, save error, and ready states.

## Design

`React.memo` component. Renders different UI states based on props: no active server (with "Review saved servers" button), loading spinner, connection error (with retry + server review), data error (with retry), preferences not ready (with retry), save error, or children when ready.

## Flow

State-driven rendering based on props. Retry calls `onRetry`. Server review calls `onOpenServerOverview`.

## Integration

Used by `SettingsScreenBody` to wrap remote preference sections with appropriate state handling.
