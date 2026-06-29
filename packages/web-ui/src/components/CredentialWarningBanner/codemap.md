# CredentialWarningBanner

## Responsibility

Renders a dismissible warning banner with an icon, message text, optional action slot, and dismiss button.

## Design

Pure presentational `React.memo` component. Uses semantic warning tokens (`bg-warning-20`, `text-warning`). Accepts `warning` string, optional `onDismiss` callback, and optional `action` ReactNode slot for a custom button.

## Flow

Props in → rendered banner. Dismiss click calls `onDismiss`. No internal state.

## Integration

Used in server setup and settings flows to warn about credential-related issues (e.g., passwords not saved).
