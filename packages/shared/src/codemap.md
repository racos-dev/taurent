# packages/shared/src/

## Responsibility

Platform-agnostic shared library for the Taurent workspace. Serves as the canonical source for:

- **API surface**: barrel re-exports of types, runtime schemas, utilities, constants, theme helpers, platform interfaces, icon components, and lightweight UI primitives consumed by desktop, mobile, and web-core packages.
- **Domain contracts**: authoritative TypeScript DTOs mirroring qBittorrent Web API payloads (Torrent, Preferences, SyncMainData, etc.) and local application state shapes (Server, Auth, ServerManager).
- **Reusable primitives**: pure utilities (formatters, validators, domain derivation helpers, error normalization, FormData builders), lightweight Zustand stores, theme registry/resolver, and small shared React components (Icon, StatusBadge).
- **Settings metadata**: full registry of qBittorrent remote preferences with validation, display labels, help text, and mobile-desktop parity mapping.

This package deliberately contains no platform-specific side-effects (no `@tauri-apps/*` imports). Platform integrations implement adapters that consume the abstractions defined here.

## Design Patterns

- **Barrel export pattern**: `src/index.ts` is the single public entry-point re-exporting the principal modules consumed by other packages.
- **Type-first contracts**: Types under `src/types/*` are DTOs and Context shapes used as compile-time contracts for stores and adapters.
- **Schema-based runtime validation**: Zod schemas under `src/schemas/*` provide compatibility/parity parsing and shape the typed model that consumers rely on. They are no longer the primary network-response boundary: `qb-core::dto` is the canonical Rust-owned validator for the migrated DTO families (categories, tags, `sync_torrent_peers`), and remaining schemas (torrent list, maindata, properties, trackers, files, search, RSS) are retained as compatibility/test artifacts for the renderer fallback path and unit tests. `utils/validation.ts` wraps `safeParse` and produces structured diagnostics.
- **Metadata-driven settings**: All remote settings defined as constant objects with full metadata (label, helpText, validation, min/max, selectOptions, visibleWhen predicates).
- **Minimal shared stores**: Zustand stores expose typed state + action APIs; they intentionally avoid consumer-specific selectors — derived selectors and side-effects are composed by consumers.
- **Pure functional derivation**: `deriveTrackerEntries`, `deriveFilteredAndSortedTorrents`, `deriveSidebarFacetCounts` produce deterministic results from torrent lists without side-effects.
- **Builder pattern**: `FormDataBuilder` in `utils/formBuilders.ts` uses a fluent API for multipart payloads.
- **CSS variable theming**: Colors reference `var(--color-*)` tokens; theme registry maps palette+variant to CSS class names applied to the DOM.

## Flow (end-to-end data flows)

1. **Network → Validation → Domain DTOs**
   - Network layer fetches JSON from the qBittorrent Web API and deserializes into the TypeScript DTOs defined in `src/types/qbittorrent.ts`.
   - For the migrated DTO families (categories, tags, `sync_torrent_peers`), `qb-core::dto` performs strict Rust-side parsing inside Tauri commands and returns typed envelopes to the bridge; malformed upstream payloads fail at the Rust boundary rather than flowing as raw JSON.
   - For the remaining DTO families (torrent list, maindata, properties, trackers, files, search, RSS) call-sites run Zod validators (`src/schemas/*` via `utils/validation.ts` `Validators.*`) to assert runtime shape before propagation. These schemas serve the renderer fallback path and unit tests.

2. **Validation → Stores**
   - Consumers push validated DTOs into shared stores. `torrentStore` stores canonical torrent arrays, categories, tags, filters, sort state, `lastUpdated` and error/loading flags.
   - `torrentStore` exposes `lastUpdated`/`refetch` semantics: `refetch()` sets `lastUpdated = Date.now()` and consumers observe that to trigger network syncs.

3. **Derived state computation**
   - `mergeMaindata` applies incremental SyncMainData deltas onto accumulated MaindataState with no-op detection and reference preservation.
   - `sortTorrents`, `torrentFilter`, and `deriveTrackerEntries` remain as shared utilities for tests, mocks, and focused fallback-style derivations.
   - The desktop/mobile torrent workspace projection is Rust-owned via `qb-core::workspace::WorkspaceViewEngine`.

4. **Presentation**
   - Pure display utilities in `utils/formatters.ts` and `utils/torrentStatus.ts` produce deterministic, locale-independent strings for bytes, speeds, ETA, progress, and normalized torrent states.
   - Theme tokens, CSS variables, and the Icon/StatusBadge components provide consistent visual output across platforms.
   - Accent color system (`theme/accent.ts`) derives a full Midnight accent override token map from a user-chosen hex color, serialized to CSS for inline injection before React hydration.

## Quick references

- **Entry barrel**: `packages/shared/src/index.ts`
- **Stores**: `torrentStore.ts`, `uiStore.ts`
- **Utilities**: `formatters.ts`, `validation.ts`, `error.ts`, `torrentStatus.ts`, `torrentFilter.ts`, `sortTorrents.ts`, `deriveTrackerEntries.ts`, `maindata.ts`, `formBuilders.ts`, `cn.ts`, `logger.ts`, `server-url.ts`, `perfAudit.ts`
- **Types**: `qbittorrent.ts`, `server.ts`, `auth.ts`
- **Schemas**: `qbittorrent.ts`, `addTorrent.ts`
- **Theme**: `tokens.ts`, `registry.ts`, `resolver.ts`, `helpers.ts`, `types.ts`, `accent.ts`, `background.ts`, `backgroundRuntime.ts`, `motion.ts`
- **Server domain**: `server/` (types, validation, ID generation)
- **Settings**: `remoteSettings.ts`, `remoteSettingsSections.ts`, `parityMap.ts`, `remoteSettingsHelpers.ts`
- **Icons**: `icons/` (lucide re-exports, custom SVGs, icon map, sizes)
- **Components**: `Icon/`, `StatusBadge/`
- **Constants**: `constants/connection.ts`
- **Platform**: `platform/index.ts` (PlatformStorage interface)

---

Last updated: reflect code in packages/shared/src/ as of 2026-06-18
