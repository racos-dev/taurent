# packages/web-core/

## Responsibility

Platform-agnostic React hooks, session lifecycle management, query orchestration, and screen controller/model composition for qBittorrent client applications. Provides shared business logic that runs in both desktop and mobile renderers without depending on platform-specific APIs.

## Source Structure

```
packages/web-core/src/
├── index.ts                    # Public barrel: server, query, hooks, torrents, session, capabilities, sync, rss, search, screens
├── session/
│   ├── index.ts                # Session barrel
│   ├── sessionController.ts    # Headless session state machine (connect, disconnect, retry, visibility recovery, background retry interval)
│   ├── createQBClientBootstrap.tsx  # QBClient provider factory (composes session + maindata sync)
│   ├── createQBClientContext.ts     # QBClient React context
│   ├── createSessionProvider.tsx    # Session provider factory (used by both apps)
│   ├── createSessionAdapter.ts      # Session adapter factory
│   ├── createSessionBridge.ts       # Session bridge factory
│   ├── createServerManagerProvider.tsx  # ServerManager provider factory
│   ├── createServerManagerBindings.tsx  # Server manager bindings
│   ├── createServerManagerContext.ts    # Server manager context
│   ├── createServerManagerContextValue.ts
│   ├── createAuthBoundary.tsx           # Auth boundary factory
│   ├── QBClientContextValue.ts          # Context value types
│   ├── resourceInvalidation.ts          # Centralized query invalidation helpers
│   ├── useSessionBootstrap.ts           # Shared session bootstrap hook (public path routing decisions)
│   └── useStandardContextValue.ts
├── query/
│   ├── index.ts                # Query barrel
│   ├── query-client.ts         # createQueryClient() factory
│   ├── keys.ts                 # Query key factories (scoped by serverId + sessionGeneration)
│   ├── invalidation.ts         # invalidateTorrents, invalidateFiles, invalidatePreferences, etc.
│   ├── optimistic-updates.ts   # Standardized optimistic mutation lifecycle
│   └── scope.ts                # QueryScope derivation
├── hooks/
│   ├── index.ts                # Hooks barrel
│   ├── createPlatformHooks.ts  # Platform hook factory (categories, tags, settings)
│   ├── createTorrentDetailHooks.ts  # Torrent detail hook factory (properties, trackers, files, peers, webseeds)
│   ├── useTorrents.ts          # Torrent list hook (reads from maindata sync state, client-side filter/sort)
│   ├── useTorrentList.ts       # Derived torrent list
│   ├── useTorrentFiles.ts      # Torrent files query
│   ├── useTorrentProperties.ts # Torrent properties query
│   ├── useTorrentTrackers.ts   # Torrent trackers query
│   ├── useTorrentMutations.ts  # Torrent action mutations
│   ├── useTrackerEntries.ts    # Tracker entry factory (derives from maindata)
│   ├── useTransfer.ts          # Global transfer info query
│   ├── useCategories.ts        # Category query hooks
│   ├── useCategoryMutations.ts # Category CRUD mutations
│   ├── useTags.ts              # Tag query hooks
│   ├── useTagMutations.ts      # Tag CRUD mutations
│   ├── usePreferences.ts       # Server preferences query
│   ├── usePreferencesMutations.ts  # Preferences mutation hooks
│   ├── useSettings.ts          # Settings composition hooks
│   ├── useFiltersFormState.ts  # Filter form state management
│   ├── useFilterSummary.ts     # Filter summary derivation
│   ├── useRssMutations.ts      # RSS mutation hooks
│   ├── useServerStatistics.ts  # Server statistics factory (derives from maindata server_state)
│   ├── useShutdown.ts          # Server shutdown mutation
│   ├── useOperationNotifications.ts  # Operation failure notification hook
│   └── operationFailureReporter.ts   # Operation failure reporting
├── screens/
│   ├── index.ts                # Screens barrel
│   ├── home/                   # Home screen controllers
│   │   ├── createTorrentWorkspaceController.ts
│   │   ├── createMobileHomeController.ts
│   │   └── codemap.md
│   ├── add-torrent/            # Add-torrent screen controller
│   ├── add-server/             # Add-server screen controller
│   ├── login/                  # Login screen controller
│   ├── filters/                # Filters screen controller
│   ├── settings/               # Settings screen controller
│   ├── torrent-detail/         # Torrent detail screen controller
│   ├── manage-categories/      # Category management screen model
│   └── manage-tags/            # Tag management screen model
├── torrents/
│   ├── index.ts                # Torrents barrel
│   ├── useTorrentActionController.ts  # Headless torrent action controller
│   ├── useTorrentActions.ts    # Capability-gated mutations
│   ├── useAddTorrent.ts        # Add torrent mutation
│   ├── createAddTorrentHook.ts # Add torrent hook factory
│   └── createTorrentActionsAdapters.ts  # Action adapter factory
├── sync/
│   ├── index.ts                # Sync barrel
│   ├── MaindataSyncProvider.tsx    # Backend-owned maindata sync provider (hot/cold context split)
│   ├── useMaindataSyncBackend.ts   # Backend-owned live sync via snapshot + event contract, session_generation guards
│   ├── useSelectedTorrentDetailSync.ts  # Detail-pane coordinator with adaptive throttle
│   └── protectedRequestHealth.ts   # Connected-server outage health signal for protected requests
├── server/
│   ├── index.ts                # Server barrel
│   ├── controller.ts           # Server manager controller
│   ├── ServerManagerContextType.ts  # Context type definitions
│   └── useTestServerConnection.ts   # Connection test hook
├── rss/
│   ├── index.ts                # RSS barrel
│   ├── useRssController.ts     # RSS controller/model (typed Rust DTOs)
│   ├── useRssScreenModel.ts    # RSS screen model composition
│   └── createRssAdapterFns.ts  # RSS adapter factory (constructs fetch/mutations from QBClientBridge)
├── search/
│   ├── index.ts                    # Search barrel
│   ├── useSearchController.ts      # Search controller/model (typed Rust DTOs)
│   ├── useSearchScreenModel.ts     # Search screen model composition
│   └── createSearchAdapters.ts     # Search adapter factory (constructs adapters from bridge surface)
├── capabilities/
│   ├── index.ts                    # Capabilities barrel re-exporting from generated/app-capabilities
│   ├── codemap.md                  # Capability gating design notes
│   └── generated/
│       └── app-capabilities.ts     # Auto-generated AppCapabilities interface (21 camelCase bool fields), DEFAULT_APP_CAPABILITIES, toAppCapabilities() mapper, makeAppCapabilities() factory
```

## Design Patterns

- **Session-centric architecture**: `src/session/` owns connection lifecycle, bootstrap, context wiring, server manager bindings, and invalidation. Apps inject bridge + listeners into factory-created providers.
- **Query scope pattern**: All server-backed queries are keyed by `[resource, serverId, sessionGeneration, ...detail]` so reconnects and server switches invalidate cleanly.
- **Factory pattern**: Platform-specific wiring is centralized in factories (`createSessionProvider`, `createServerManagerProvider`, `createPlatformHooks`, screen controllers) rather than duplicated in app shells.
- **Screen controllers/models**: `src/screens/` contains feature controllers/models that compose hooks, mutations, and derived state into screen-ready view models. Controllers are headless; screen bodies (in web-ui) handle presentation.
- **Hot/cold context split**: `MaindataSyncProvider` isolates backend-owned maindata sync from stable session context. `useMaindataState`/`useMaindataSelector` are hot consumers. `MaindataStateScope` injection reads from accumulated maindata, not renderer-side polling.
- **Backend-owned sync**: The Rust sync manager (`qb-core::sync`) handles all polling, backoff, overlap guard, and RID tracking. The renderer receives lightweight `maindata-sync-changed` events and full snapshots on demand — it does not own the polling loop.
- **Capability-gated features**: RSS and search remain capability-aware; features are only enabled when the server exposes support via Rust's `ServerCapabilities` payload (produced by `qb-core::capability::QbResolver::resolve` from the embedded TOML profile). Every `SessionSnapshot` carries the resolved capability set; web-core maps it to camelCase via `toAppCapabilities()` and exposes it on `QBClientContextValue.capabilities`.
- **No Tauri imports**: Platform boundaries enforced — web-core never imports `@tauri-apps/*` directly. Uses bridge interfaces (types only).

## Flow

```
Desktop App / Mobile App
         │
         │ injects bridge + listeners
         ▼
┌─────────────────────────────────────────┐
│           web-core (shared)             │
├─────────────────────────────────────────┤
│ src/session/     → Session lifecycle, context factories, bootstrap, invalidation, Rust capability merge │
│ src/query/       → React Query keys, invalidation, optimistic updates, createQueryClient │
│ src/screens/     → Screen controllers/models and feature composition │
│ src/hooks/       → Data fetching + factory hooks (query/mutation layer) │
│ src/torrents/    → Torrent action controllers and adapter factories │
│ src/server/      → Server manager controller │
│ src/sync/        → Backend-owned maindata sync, detail-pane coordination, protected request health │
│ src/rss/         → RSS controller/model layer (typed Rust DTOs) │
│ src/search/      → Search controller/model layer (typed Rust DTOs) │
│ src/capabilities → Feature gating based on probe results │
└─────────────────────────────────────────┘
```

## Integration

- **Imports from**: `@taurent/shared` (types, utils), `@taurent/bridge` (types only — no runtime imports).
- **Exports to**: `apps/desktop` and `apps/mobile` via direct imports from `@taurent/web-core`.
- **Key subpath exports**: `@taurent/web-core` (root), `@taurent/web-core/query`, `@taurent/web-core/hooks`, `@taurent/web-core/session`, `@taurent/web-core/torrents`, `@taurent/web-core/screens`, `@taurent/web-core/sync`, `@taurent/web-core/server`.
- **Root-accessible only (no dedicated subpath export)**: `rss`, `search` — import via `@taurent/web-core` root barrel.
- **Removed exports**: `auth`, `theme` — directories no longer exist.
- **Peer dependencies**: `react`, `react-router-dom`.
- **Runtime deps**: `@tanstack/react-query`.

## Key Constraints

- No `@tauri-apps/*` imports allowed.
- Do not create `QueryClient` instances here; `createQueryClient()` is a factory consumed by apps.
- Each app provides a single `QueryClient` at the shell level.
- Screen controllers are headless; presentation belongs in `@taurent/web-ui`.
