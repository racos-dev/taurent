# crates/qb-core/src/capability/

## Responsibility

Determine the set of qBittorrent Web API features available on the connected
server, so the Rust backend and TypeScript renderer can gate UI and logic behind
feature flags. Replaces an older HTTP-probing-based tri-state model with a
compile-time-embedded, TOML-driven boolean resolution.

The module answers: *"Given this server's `webapiVersion` and `appVersion`,
which API endpoints and features does it support?"*

## Design

**Compile-time TOML profile.** A single source-of-truth TOML file at
`crates/qb-core/capabilities/qbittorrent-capabilities.toml` is embedded into the
binary via `include_str!` and validated by `build.rs`. The TOML declares
capability changes as cumulative deltas keyed by version threshold.

**Two-pass resolution.** The resolver walks `[versions]` (webapi-version-keyed
caps) first, then `[app_versions]` (app-version-keyed caps). Each pass applies
every entry whose semver threshold is `<= target`, enabling `adds` and disabling
`removes`. Entries are sorted by parsed semver so `v10.0.0` is correctly ordered
after `v5.0.0`.

**Boolean output.** `ResolvedCapabilities` exposes plain `bool` fields (no
tri-state). The renderer uses these directly as feature gates. The default state
is all-false, so an unparseable version string degrades to a minimal capability
set.

**Hardcoded version corrections.** Known upstream `webapiVersion` reporting bugs
(e.g. qBittorrent v4.3.0–v4.3.3 reporting `"2.7.0"` instead of `"2.8.0"`) are
corrected via the `[corrections]` map at parse time, before threshold
comparison.

**Code generation.** A JS script (`scripts/codegen/capabilities.mjs`) reads the
same TOML and generates three outputs:
- Rust: `crates/qb-core/src/capability/generated.rs` — `ResolvedCapabilities`
  struct, `set_capability()` setter, `KNOWN_CAPABILITIES` list, and
  `RESOLVER_TEST_TABLE` for regression tests.
- TypeScript: `packages/bridge/src/generated/server-capabilities.ts` —
  `ServerCapabilities` interface with `makeServerCapabilities()` factory.
- TypeScript: `packages/web-core/src/capabilities/generated/app-capabilities.ts`
  — `AppCapabilities` (camelCase), `DEFAULT_APP_CAPABILITIES`,
  `toAppCapabilities()` converter, and `CAPABILITY_ADDED_IN`/`CAPABILITY_REMOVED_IN`
  maps.

**Build-time validation.** `build.rs` parses the TOML and panics on structural
errors: non-semver keys, invalid `app_version` metadata, and `removes` entries
that target a capability never `adds`'d at a prior threshold. This prevents
typos and structural drift from reaching production binaries.

**App-version lifecycle example.** `supports_pause_resume` is
`adds`'d at `[app_versions."v4.1.0"]` and `removes`'d at
`[app_versions."v5.0.0"]`, reflecting the real qBittorrent API lifecycle where
pause/resume endpoints were removed in v5.

## Flow

```
Tauri backend (after login)
  │
  ├─ GET /api/v2/app/webapiVersion   → "2.16.0"
  ├─ GET /api/v2/app/version         → "v4.1.0"
  │
  ▼
QbResolver::resolve(webapi_version, app_version)
  │
  ├─ 1. Embed TOML at compile time (include_str!)
  ├─ 2. Apply [corrections] map (e.g. "2.7.0" → "2.8.0")
  ├─ 3. Parse webapi version as semver (u16, u16, u16)
  ├─ 4. Parse app version as semver (optional — None skips pass 6)
  ├─ 5. Pass 1: Walk [versions] entries in semver order,
  │         applying adds/removes when threshold <= parsed webapi version
  ├─ 6. Pass 2: Walk [app_versions] entries in semver order,
  │         applying adds/removes when threshold <= parsed app version
  │
  ▼
ResolvedCapabilities { supports_rss: true, supports_pause_resume: true, … }
  │
  ▼
Stored on SessionState alongside raw version strings
  │
  ▼
Serialized to Tauri host → TypeScript renderer
  │
  ▼
toAppCapabilities() converts snake_case ServerCapabilities → camelCase AppCapabilities
  │
  ▼
UI components read AppCapabilities as feature gates
```

On failure (network error, unparseable version), the resolver returns the
all-false default so the user still sees a minimal UI (`supports_rss` from the
`"2.0"` baseline and nothing else).

## Integration

- **`crates/qb-core/src/session.rs`** — `SessionState` stores the resolved
  `ResolvedCapabilities` and the raw version strings. The session manager calls
  `QbResolver::resolve` after a successful `connect()`.
- **`crates/qb-core/build.rs`** — Validates the TOML at compile time (semver
  keys, removes-before-adds violations). Panics on structural errors, surfacing
  as a normal Cargo build failure.
- **`crates/qb-tauri`** — Calls `QbResolver::resolve` after login, stores the
  result on the session, and exposes it to the TypeScript renderer via Tauri
  commands and events.
- **`packages/bridge`** — Re-exports `ServerCapabilities` and
  `makeServerCapabilities` from the generated TypeScript as part of its public
  API. These flow through `SessionSnapshot` to the rest of the frontend.
- **`packages/web-core`** — Converts snake-case `ServerCapabilities` to
  camelCase `AppCapabilities` via `toAppCapabilities()`. The `useSession` hook
  applies this conversion when a new session snapshot arrives.
- **`scripts/codegen/capabilities.mjs`** — Derives all three generated outputs
  (Rust `generated.rs`, two TypeScript modules) from the same TOML. Run via
  `pnpm codegen:capabilities`, which is a prerequisite for `pnpm desktop:dev`,
  all build/test commands, and CI.
- **`crates/qb-core/src/capability/version.rs`** — Version-parsing helpers
  (`parse_semver`, `version_le`) used by the resolver and test suite. Kept
  separate for focused unit-testing and reuse.
- **`crates/qb-core/src/capability/generated.rs`** — Auto-generated via codegen
  (gitignored). Contains `ResolvedCapabilities`, `set_capability()`,
  `KNOWN_CAPABILITIES`, and `RESOLVER_TEST_TABLE` for regression tests.
