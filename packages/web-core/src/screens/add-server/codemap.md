# add-server

## Responsibility

Headless controller for AddServerScreen orchestration. Manages form field state, validation, scheme auto-detection (https→http fallback), test connection flow, and add-server submission.

## Key Files

- `index.ts` — Barrel export
- `useAddServerScreenController.ts` — Main controller hook with form state, validation, scheme detection, test connection, and submit logic; uses `ServerUrlProbeBridge` with `normalizeServerUrl` and `probeServerScheme` for URL handling
- `normalizeUrl.ts` — URL validation (checks structure when scheme is present, accepts schemeless input for auto-detection); normalization delegated to bridge via `normalizeServerUrl`
- `mapTestErrorToSuggestion.ts` — Maps connection test error patterns to actionable user suggestions (ECONNREFUSED, timeout, unauthorized, SSL, etc.)

## Design Patterns

- **Scheme auto-detection**: When URL has no scheme, tries https first; on network-level failures (connection refused, timeout), falls back to http; does NOT retry on auth/TLS/HTTP errors
- **Validation with suggestion**: Failed test connections produce URL suggestions via `mapTestErrorToSuggestion`
- **Normalized URL output**: `handleSubmit` normalizes URL via `normalizeServerUrl` before persisting
- **Form field setters with validation**: Each setter (setName, setUrl, setUsername) updates both value and validation error atomically

## Flow

1. User enters name, URL, username, password
2. `setUrl` normalizes and validates in real-time
3. `handleTestConnection` detects scheme (if missing) and tests
4. On test failure, `mapTestErrorToSuggestion` produces actionable hint
5. `handleSubmit` validates form, auto-detects scheme as safety net, normalizes URL, calls `addServer`

## Architecture notes

- `normalizeUrl.ts` only validates URL structure; normalization is delegated to `bridgeServers.normalizeServerUrl()` from the `ServerUrlProbeBridge` interface. This keeps URL normalization logic in the bridge layer where it can be shared across platforms.
- Scheme auto-detection is handled by `bridgeServers.probeServerScheme()` which tries https first and falls back to http on network failures. The controller calls this during test connection flow.
- `mapTestErrorToSuggestion` provides presentation-layer error classification for user-facing hints.

## Integration

- Imports `ServerUrlProbeBridge` from `@taurent/bridge` for URL normalization and scheme probing
- Imports `TestConnectionResult` from `@taurent/shared/types/server`
- Imports `getErrorMessage` from `@taurent/shared/utils/error`
- Used by desktop/mobile AddServerScreen routes
- Consumes injected `addServer` and `bridgeServers` (with `normalizeServerUrl`, `probeServerScheme`) from app-level configuration
