# ServerCard

## Responsibility

Displays a single server entry with name, URL, username, credential health indicator, connection status, and optional edit/delete actions.

## Design

`React.memo` component with `variant: 'desktop' | 'mobile'` for layout differences. Shows a spinner during `connecting` state, a check icon when `connected`, and optional `IconButton` actions for edit and delete — visible on hover on desktop, always visible on mobile. Embeds `CredentialHealthIndicator` when `server.credentialStatus` is present.

## Flow

Props in → rendered card. `onSelect` fires when the card body is clicked. `onEdit` fires when the pencil button is clicked. `onDelete` fires when the trash button is clicked. `deletingServerId` drives the per-card spinner state.

## Integration

Consumed by app shells (desktop/mobile) in server selection screens. Imports `Spinner` from `@taurent/web-ui` and `CredentialHealthIndicator` from sibling directory.
