# apps/desktop/scripts/testing/

## Responsibility

Deterministic fake qBittorrent HTTP server used by E2E smoke tests to stand in for a real qBittorrent instance with predictable, scriptable behavior.

## Design

Single-module in-memory server. Initialization is scenario-driven so each test can pick the exact state and fault profile it needs. Implements cookie-based auth, error injection controls (latency, status codes, dropped requests), and exposes both an importable API and a CLI mode so it can be reused from tests and run standalone.

## Flow

Request pipeline: apply test controls (delay, failure), then check auth, then dispatch to endpoint handlers. Sync and mutation endpoints update the in-memory state directly. A test-only inspection endpoint exposes the internal state for assertions.

## Integration

Consumed by `apps/desktop/scripts/e2e/*`, especially `infrastructure.ts` and `runner.ts`, which start it as a child process. Implements the API surface the desktop client actually exercises during smoke tests.
