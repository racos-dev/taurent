# CredentialHealthIndicator

## Responsibility

Displays an inline icon + text indicator for a server's credential storage status.

## Design

Pure presentational `React.memo` component. Maps `CredentialStatus` (from `@taurent/shared/types/server`) to a config record of `{ icon, label, toneClass }`. Returns `null` for healthy statuses (`stored`, `not_requested`, `unknown`).

## Flow

Props in → rendered indicator (or null). No state, no effects.

## Integration

Used by `ServerCard` and `ServerOverviewSettingsPanel` to show whether credentials are stored, session-only, missing, or unavailable.
