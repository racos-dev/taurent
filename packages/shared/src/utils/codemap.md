# packages/shared/src/utils/

## Responsibility

Canonical, environment-agnostic utility implementations shared across desktop, mobile, and web-core. Files encapsulate:

- Data formatting (human-readable bytes, speeds, dates, labels)
- Runtime validation and type-guarding for API responses (Zod-based)
- Domain helpers: torrent state mapping, filtering predicates, sorting logic, error normalization, server URL normalization, tracker entry derivation, torrent list derivation, maindata delta merging, and FormData builders
- ClassName composition with Tailwind conflict resolution
- Performance instrumentation (opt-in)
- Logging

Note: React Query helpers (`createQueryClient`, optimistic update factories) have moved to `packages/web-core/src/query/`.

## Key Files

- `formatters.ts` — Deterministic renderers: `formatBytes`, `formatSpeed`, `formatTime`, `formatEta`, `formatRatio`, `formatDate`/`formatDateTime`, `formatProgress`, `formatPriority`, `formatDuration`, `formatTags`, `formatTracker`, `formatBoolean`, `formatCount`, `formatLabel`, `formatAvailability`, `formatRatioLimit`, `formatSeenComplete`, `formatPopularity`, `formatReannounce`. Handles edge cases (negative values → `'∞'`/`'Unlimited'`, undefined → `'N/A'`).

- `validation.ts` — Runtime validation helpers built on Zod:
  - `validateData(schema, data)` — generic validator returning `ValidationResult<T>`.
  - `validateArray`, `validateRecord` — collection validators.
  - `Validators` object — convenience validators for all API types (torrent, torrents, torrentProperties, trackers, webSeeds, torrentFiles, categories, transferInfo, buildInfo, syncMainData, syncTorrentPeers, searchResults, searchStatus, searchPlugins, cookies).
  - `safeParseWithFallback(schema, data, fallback)` — returns data or fallback on failure.
  - `getValidationErrors(error)` — extracts human-readable error strings.
  - Type guards: `isValidTorrent`, `isValidTransferInfo`, `isValidSyncMainData`, `isValidSyncTorrentPeers`, `isValidSyncTorrentPeersPeerData`.

- `error.ts` — Error normalization utilities (314 lines):
  - `getErrorMessage(error)` — safely extracts message from unknown error types.
  - `isError(error)` — type guard for Error instances.
  - `ApiError` interface — structured API error (message, code, status, details).
  - `parseApiError(error)` — parses unknown into `ApiError`.
  - `isNetworkError`, `isAuthError` — pattern-based error classification.
  - `parseHttpError(error)` — parses Rust Display format `"HTTP error <status> Some(\"reason\")"`.
  - `isConflictError`, `isHttpError`, `isParseError`, `isInvalidResponseError` — typed error checks.
  - `ErrorCategory` — union: `auth | network | http | conflict | parse | invalid-response | unknown`.
  - `classifyError(error)` — maps error to category.
  - `formatUserMessage(error)` — returns user-friendly message, stripping Rust Display artifacts.
  - `getErrorMessageForCategory(category, fallback)` — returns message for a category.

- `torrentStatus.ts` — Torrent state mapping:
  - `TorrentDisplayStatus` — normalized display statuses (downloading, seeding, paused, completed, error, checking, moving, queued).
  - `getTorrentDisplayStatus(torrent)` — maps raw qBittorrent state string to display status.
  - `getStatusLabel(status)` — returns human-readable label.
  - `TORRENT_STATE_LABELS`, `TORRENT_DETAILED_STATE_LABELS` — label maps (detailed preserves DL/UP suffix).
  - `formatTorrentStatus(state, torrent?)` — returns display label.
  - `toStatusBadgeStatus(status)` — maps `TorrentDisplayStatus` to `StatusType` for StatusBadge.
  - `getStatusColorClass(status, variant)` — returns Tailwind color classes for badge/progress/bar variants.

- `torrentFilter.ts` — Domain filter model and predicates:
  - `FilterStatus` — app-level filter status (15 values including paused, resumed, checking, stalled variants).
  - `TorrentFilterType` — filter type for state matching (12 values).
  - `FILTER_STATUS_TO_FILTER_TYPE` — canonical mapping from `FilterStatus` to `TorrentFilterType`.
  - `FILTER_TYPE_TO_STATUS` — inverse mapping.
  - `TORRENT_STATES_FOR_FILTER` — maps each filter type to matching qBittorrent state strings.
  - `TORRENT_FILTER_OPTIONS` — label/value options for UI.
  - `matchesTorrentFilter(filter, torrent)` — state-based filter predicate.
  - `matchesTorrentSearch(torrent, query)` — fuzzy search matching (normalizes separators and whitespace).
  - `parseTorrentTags(tags)` — parses comma-separated tags string.
  - `torrentHasTag(torrent, tag)` — tag membership check.
  - `matchesTorrentTracker(torrent, trackerFilter)` — URL-based tracker matching.

- `sortTorrents.ts` — Deterministic sort utility:
  - `SortField` — union of 34 sortable fields.
  - `SortOrder` — `'asc' | 'desc'`.
  - `sortTorrents(torrents, sortBy, sortOrder)` — stable sort with type-aware comparison (strings via `localeCompare`, booleans via ordinal, numbers via `<`/`>`).
  - `SORT_OPTIONS` — label/icon/defaultOrder metadata for UI sort selectors.
  - `isValidSortField(value)` — type guard.

- `deriveTrackerEntries.ts` — Pure derivation: `deriveTrackerEntries(torrents)` produces sorted `TrackerEntry[]` (trackerUrl, hostname, count) sorted by count desc, then hostname asc.

- `deriveTorrentList.ts` — Pure derivation functions (704 lines):
  - `deriveFilteredAndSortedTorrents(options)` — applies filters (status, category, tag, tracker, search) and sorts by field/direction. Wrapped in `measure()` for perf instrumentation.
  - `deriveStatusCounts(torrents)` — counts torrents per filter type.
  - `ALL_FILTER_TYPES` — ordered list of all filter types.
  - `deriveTorrentWorkspace(options)` — single-pass derivation returning sortedTorrents, filteredCount, statusCounts, totalDLSpeed, totalULSpeed, isFiltered.
  - `deriveSidebarFacetCounts(options)` — four-pass derivation computing per-facet counts (status, category, tag, tracker) where each pass ignores its own filter dimension to avoid cross-contamination. Returns sidebar view models (SidebarCategoryItem, SidebarTagItem, SidebarTrackerEntry).
  - `deriveSidebarAggregates({ torrents, categories, tags })` — derives sidebar view models without filter state (stable across filter/sort changes).
  - `deriveFilteredMeta({ torrents, filters })` — returns filteredCount and isFiltered.

- `maindata.ts` — Delta merging:
  - `normalizeTorrentMap(torrents)` — re-injects `torrent.hash` from the keyed map key so React consumers always receive hash-bearing torrent objects. Used by both the full-update merge path and backend snapshot ingestion.
  - `createEmptyMaindataState()` — returns an empty `MaindataState` sentinel (`rid: 0`, empty maps/tags, null server_state) used when no snapshot is available yet.
  - `normalizeBackendMaindata(params)` — normalizes a backend-owned maindata snapshot into a `MaindataState` that React can consume directly, applying `normalizeTorrentMap` and defaulting missing collections.
  - `mergeMaindata(current, delta)` — applies `SyncMainData` delta onto `MaindataState`. Handles `full_update` (full snapshot replacement) and incremental merge (torrents field-level merge, categories add/remove, tags add/remove, server_state field-level merge). Includes no-op detection (`torrentDeltaIsNoop`, `serverStateDeltaIsNoop`) to preserve object references when fields are unchanged.

- `formBuilders.ts` — FormData construction:
  - `FormDataBuilder` — fluent builder with `appendIfDefined`, `appendFiles`, `appendObject`, `appendOptions`, `build`.
  - `TorrentFileObject` — `{ uri, name, type? }` for mobile file references.
  - `buildTorrentFormData(files, options)` — builds FormData for torrent addition (URLs, files, options).

- `cn.ts` — `cn(...inputs)` — className composition via `clsx` + `tailwind-merge`.

- `logger.ts` — `createLogger(config?)` — prefixed console logger factory (info, warn, error, debug). `logger` — default instance without prefix.

- `server-url.ts` — `normalizeServerUrl(url, defaultScheme?)` — URL normalizer (trim, strip trailing slash, strip `/api/v2`, add protocol).

- `perfAudit.ts` — Opt-in browser instrumentation:
  - Enable: `localStorage['taurent:perf-audit'] = '1'`.
  - `measure(label, fn)` — wraps synchronous function, records elapsed time.
  - `measureAsync(label, fn)` — async variant.
  - `count(label, key, n?)` — increments named counter.
  - `flushAudit(label?)`, `flushCounters(label?)` — manual flush.
  - `mark(label)`, `getPerfMarks()`, `resetPerfMarks()` — timestamp mark support via `window.__TAURENT_PERF_MARKS__`.
  - All functions are no-ops when disabled; SSR-safe (guards against missing `window`/`localStorage`).

## Design Patterns

- **Builder pattern**: `FormDataBuilder` fluent API for multipart payloads.
- **Pure derivation**: `deriveTrackerEntries`, `deriveFilteredAndSortedTorrents`, `deriveSidebarFacetCounts`, `deriveSidebarAggregates` are deterministic pure functions with no side-effects.
- **Zod schema-based validation**: `validation.ts` delegates to generated Zod schemas under `../schemas/qbittorrent`.
- **cn composition**: `clsx` builds class strings; `tailwind-merge` resolves Tailwind class conflicts for deterministic output.
- **Error classification**: Multi-strategy error analysis (pattern matching, HTTP status parsing, Rust Display artifact stripping) with user-friendly message generation.
- **Opt-in instrumentation**: perfAudit wraps functions only when enabled, with zero overhead when disabled.

## Integration

- Export surface: utilities re-exported from `packages/shared/src/index.ts` and consumed by `@taurent/web-core`, desktop, mobile, and web-ui packages.
- `cn.ts` enables components to call `cn(...)` for safe Tailwind class merging.
- `torrentStatus.ts` provides display status mapping used by `StatusBadge` and other UI components.
- `deriveTrackerEntries.ts` is used by both mobile and desktop filter screens for tracker-based filtering.
- `deriveTorrentList.ts` powers `torrentStore.getSortedTorrents()` and sidebar count derivations.
- `maindata.ts` powers the incremental sync flow for both desktop and mobile apps; `normalizeBackendMaindata` bridges backend snapshots into the renderer's `MaindataState`.
- `formatters.ts` provides all human-readable display strings for torrent data.
- `error.ts` provides centralized error handling used by bridge adapters and UI error display.
