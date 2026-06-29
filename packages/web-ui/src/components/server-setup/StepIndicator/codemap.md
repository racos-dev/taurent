# StepIndicator

## Responsibility

Horizontal step progress indicator showing active, completed, and pending states.

## Design

`React.memo` component. Renders numbered circles with connecting lines. Active step uses primary color, completed uses success with check icon, pending uses muted color. Lines between steps are success-colored if the next step is completed.

## Flow

Pure presentational. No state.

## Integration

Used by `AddServerFormBody` (desktop variant) for the two-step connection flow.
