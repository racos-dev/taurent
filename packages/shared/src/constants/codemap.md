# packages/shared/src/constants/

## Responsibility

Application-wide constant definitions. Currently contains connection-related constants for retry logic and status color mapping. Serves as a centralized location for numeric thresholds, timing values, and static mappings used across the application.

## Key Files

- `connection.ts` — Exports:
  - `MAX_CONSECUTIVE_FAILURES` (3) — threshold before marking connection as failed.
  - `DEFAULT_RETRY_INTERVAL` (5000ms) — base delay between retry attempts.
  - `MAX_RETRY_INTERVAL` (30000ms) — upper bound for exponential backoff.
  - `RETRY_DELAYS` ([1000, 2000, 5000, 10000, 30000]) — progressive retry delay array.
  - `getConnectionStatusColor(status)` — maps connection status strings (`connected`, `firewalled`, `disconnected`, `idle`, `connecting`, `reconnecting`, `unreachable`, `auth_failed`) to CSS variable references (`var(--color-status-*)`).

## Design

- **Numeric thresholds**: Centralized magic numbers for retry logic shared between desktop and mobile connection management.
- **Status color mapping**: Returns CSS variable token names for consistent theming — consumers use these in style props or Tailwind classes.
- **Pure functions**: `getConnectionStatusColor` is a pure function with no side-effects.

## Integration

- Imported by connection management code in desktop and mobile apps for retry configuration.
- `getConnectionStatusColor` used to style connection status indicators in server management UI.
- `RETRY_DELAYS` used by reconnection logic in connection management.
- Exported from `packages/shared/src/index.ts` as `export * from './constants/connection'`.
