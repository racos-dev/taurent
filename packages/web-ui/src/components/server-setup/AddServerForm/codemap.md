# AddServerForm

## Responsibility

Two-step add server form with connection testing and server creation.

## Design

`React.memo` `AddServerFormBody` with `variant: 'desktop' | 'mobile'`. Desktop shows `StepIndicator` (Enter Details → Test Connection), separate Test/Add buttons, and `TestConnectionFeedback`. Mobile shows a single "Add & Connect" button with inline feedback. Both variants use `ServerConnectionFields` and `TestConnectionFeedback`.

## Flow

1. User fills server details.
2. Desktop: Test connection → see feedback → Add Server. Mobile: Add & Connect (tests + adds in one step).
3. Parent controller manages validation, testing state, and submission.

## Integration

Used by desktop/mobile add-server screens and by `ServerOverviewSettingsPanel` for inline server creation.
