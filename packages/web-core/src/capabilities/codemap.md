# capabilities

## Responsibility

Server capability discovery from the Rust backend. Maps the `ResolvedCapabilities` payload returned by Rust's `getServerCapabilities` Tauri command into a typed `AppCapabilities` shape consumed by the UI layer. Rust is the single source of truth for capability flags — there is no TypeScript probe or version-resolution fallback.

## Key Files

- `index.ts` — Barrel export
- `mapRustCapabilities.ts` — Maps the Rust tri-state `CapabilityState` (`confirmed`/`unsupported`/`unknown`) into `AppCapabilities` flags (`boolean | null`). Defines the local `AppCapabilities` interface consumed by `QBClientContextValue`.

## Design Patterns

- **Rust as source of truth**: All capability flags are derived from Rust's `getServerCapabilities` Tauri command. The TypeScript side does no version parsing, no probe calls, and no fallback resolution.
- **Tri-state boolean mapping**: `'confirmed' → true`, `'unsupported' → false`, `'unknown' → null`. `hasUnknownCapabilities` is `true` whenever any flag maps to `null` so consumers can decide whether to show a degraded-state UI.
- **Minimal surface**: Only three flags exposed to UI consumers — `supportsSearch`, `supportsRss`, `supportsPauseResume`. These match the only production consumers (`SearchScreen`, `RSSScreen`, and the pause/resume mutation flows). All other capability fields (buildInfo, API key auth, version/buildInfo payload) were removed in Phase 3 — Rust owns them internally and they are not consumed by renderer code.

## Flow

1. `useStandardContextValue` calls `bridge.getServerCapabilities()` when the session is connected and a server is selected.
2. The Rust response `{ capabilities: { supports_search, supports_rss, supports_pause_resume } }` is mapped via `mapRustCapabilitiesToFlags` into `AppCapabilities`.
3. The result is wired into `QBClientContextValue.capabilities` and consumed by feature controllers.

## Integration

- Exports `AppCapabilities` type and `mapRustCapabilitiesToFlags` function used by `QBClientContextValue` and `useStandardContextValue`.
- Used by `rss/useRssController` (gates RSS UI on `capabilities.supportsRss`) and `search/useSearchController` (gates search UI on `capabilities.supportsSearch`).
- Consumed by `useStandardContextValue` which fetches Rust capabilities and maps them.
