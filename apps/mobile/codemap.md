# apps/mobile/

## Responsibility

Mobile renderer for the qBittorrent client built on Tauri 2 (iOS/Android) + React 19 + Vite 7. Provides a touch-optimized experience with:

- Session lifecycle (connect/disconnect/retry) and per-server session scoping
- Persistent server storage and selection
- Touch-optimized navigation (react-router-dom) with a bottom tab shell (MobileShell)
- Torrent list, per-torrent details, and mutation flows
- Capability discovery and maindata polling/synchronization
- Mobile BridgeAdapter implementing the shared bridge contracts
- Local UI state (selection, filters, sort prefs) persisted via `@tauri-apps/plugin-store`

## Package Info

- **Package name**: `taurent-mobile`
- **Build**: Vite 7 + `@vitejs/plugin-react` + TypeScript 5.9 + Tailwind CSS 3
- **Key deps**: React 19, react-router-dom 6, @tanstack/react-query 5
- **Tauri plugins**: dialog, fs, http, log, store
- **Dev server**: Fixed port 1420 with `strictPort: true`

## Source Structure

```
apps/mobile/src/
├── App.tsx                    # Provider composition + router (createBrowserRouter)
├── main.tsx                   # Bootstrap: setupLogging() → mount App
├── index.css                  # Tailwind CSS entrypoint
├── auth/                      # AuthBoundary: session-aware route gating
│   └── AuthBoundary.tsx
├── connection/                # Session & server wiring
│   ├── QBClientProvider.tsx   # Mobile session via createQBClientBootstrap
│   ├── ServerManager.tsx      # Server manager via createServerManagerBindings
│   └── sessionAdapter.ts      # Mobile SessionBridge + listeners + invalidator + retry
├── hooks/                     # Platform hooks + screen model hooks
│   ├── index.ts               # Barrel re-export + web-core factory instantiations
│   ├── platform.ts            # createPlatformHooks factory (categories, tags, settings)
│   ├── useCategories.ts       # Category query hooks
│   ├── useTags.ts             # Tag query hooks
│   ├── useSettings.ts         # Settings/preferences hooks
│   ├── useTorrentDetails.ts   # Torrent detail hooks (via createTorrentDetailHooks)
│   ├── useTorrentActions.ts   # Mobile mutations (BridgeAdapter.*)
│   ├── useTorrentDetailMutations.ts  # Add-tracker + ban-peers mutations
│   ├── useRemoteShutdown.ts   # Remote shutdown mutation
│   ├── useSortPreference.ts   # Persisted sort via @tauri-apps/plugin-store
│   ├── useSelection.ts        # Set-based torrent selection
│   ├── useFilterState.ts      # URL-synced filter state
│   ├── useSearchScreen.ts     # Mobile search screen model hook
│   ├── useRssScreen.ts        # Mobile RSS screen model hook
│   └── useTrackerEntries.ts   # Tracker entry derivation
├── screens/                   # Route-level screen components
│   ├── HomeScreen.tsx         # Main list + selection + batch actions + FAB
│   ├── TorrentDetailScreen.tsx
│   ├── AddTorrentScreen.tsx
│   ├── LoginScreen.tsx
│   ├── AddServerScreen.tsx
│   ├── FiltersScreen.tsx
│   ├── SearchScreen.tsx
│   ├── RSSScreen.tsx
│   ├── SettingsScreen.tsx
│   └── StatisticsScreen.tsx
├── shell/                     # MobileShell: bottom tab bar navigation
├── session/                   # Shared session bootstrap (useSessionBootstrap)
├── platform/                  # Platform abstractions (mobile-specific)
├── ui/                        # Mobile-specific UI primitives + layout helpers
│   ├── Icon.tsx               # Re-exports Icon from @taurent/shared
│   └── mobileScreenLayout.ts  # CSS class helpers for safe-area-aware screen layout
└── testing/                   # Test utilities and fixtures
```

## Design Patterns

- **Provider stack** (`App.tsx`): `QueryClientProvider` → `ThemeProvider` → `ControlDensityProvider` → `ServerManagerProvider` → `QBClientProvider` → `RouterProvider`. Uses `createQueryClient()` from web-core. `ControlDensityProvider` provides density scaling context.
- **Adapter / Bridge**: `BridgeAdapter` (from `@taurent/bridge/adapters/mobile-tauri`) is the platform I/O surface. Mobile hooks wrap bridge calls into web-core query/mutation contracts.
- **React Query composition**: Read hooks delegate to shared web-core query hooks (`createTorrentsHook`, `createTorrentDetailHooks`); write operations are local `useMutation` wrappers that call `BridgeAdapter` then web-core invalidators.
- **Query scoping**: `QueryScope` = `{ serverId, sessionGeneration, isConnected }` derived from `useQBClient()`. Passed to web-core invalidators to avoid cross-server cache leakage.
- **Event-driven invalidation**: `createResourceInvalidatedListener` and session events wired to centralized web-core helpers (`invalidateTorrents`, `invalidateFiles`, etc.).
- **Mobile retry**: Fixed reconnect strategy (no exponential backoff) in `QBClientProvider.mobilePerformRetry`.
- **Mobile screen layout**: Centralized CSS class helpers in `src/ui/mobileScreenLayout.ts` provide safe-area-aware padding, width constraints, and height modes. All screens import these helpers instead of hardcoding Tailwind classes.
- **Backend maindata sync**: `QBClientProvider` passes `BridgeAdapter.qBClient` as `maindataBackendBridge`, enabling backend-owned sync via snapshot + events rather than renderer-side polling.

## Runtime Flow

1. `main.tsx` calls `setupLogging()` and mounts `<App />`.
2. `App.tsx` creates `QueryClient`, composes providers (including `ControlDensityProvider`), mounts router.
3. `AuthBoundary` is the router root element, bootstraps session state via `useSessionBootstrap`, gates public/protected routes.
4. `ServerManagerProvider` adapts `BridgeAdapter.servers.*` to the shared server manager controller.
5. `QBClientProvider` uses `createQBClientBootstrap` with a mobile `SessionBridge`, session listeners, a mobile `QueryInvalidator`, and a backend maindata sync bridge (`BridgeAdapter.qBClient`). On connect: runs capability probes, queries version/build info, starts maindata sync via backend events.
6. UI screens call hooks that invoke `BridgeAdapter` methods; mutations use web-core invalidators.
7. Screen layout is composed using helpers from `src/ui/mobileScreenLayout.ts` for safe-area-aware padding, width constraints, and height modes.

## Integration

- **@taurent/bridge**: `createMobileTauriBridge` / `BridgeAdapter` for all I/O. Mobile uses unprefixed Tauri command names.
- **@taurent/web-core**: `createQBClientBootstrap`, `createServerManagerProvider`, shared hooks, screen controllers, invalidation helpers.
- **@taurent/shared**: Types, `createQueryClient`, theme utilities, formatters, `cn()` for class merging.
- **@taurent/web-ui**: UI primitives, screen bodies, dialog components, `ControlDensityProvider`.
- **src-tauri**: Rust sidecar — `main.rs` (entry → `mobile_lib::run()`), `lib.rs` (plugin composition + ~100 command handlers from `qb-tauri` + sync manager lifecycle), `torrents.rs` (4 mobile-specific thin wrappers).
- **Persistence**: `@tauri-apps/plugin-store` for sort preferences and local UI state.

## Key Differences from Desktop

- No TransferCommand system; uses direct mutation hooks and FAB actions.
- No auxiliary windows; navigation is full-screen routes via react-router-dom.
- No virtualized table; uses simpler list rendering optimized for touch.
- No drag-and-drop column reordering.
- `MobileShell` provides bottom tab navigation instead of `AppShell` sidebar.
- Retry is fixed-delay, not exponential backoff.

## Testing

- **Unit**: Vitest with jsdom — `pnpm mobile:test`.
- **Renderer E2E**: Playwright — `pnpm mobile:renderer:e2e`.
- **CI**: `mobile-test` job in `.github/workflows/ci.yml`.
- Test locations:
  - `src/session/__tests__/useSessionBootstrap.test.ts` — Session/bootstrap routing tests.
  - `src/auth/__tests__/AuthBoundary.test.tsx` — Integration smoke for auth boundary.
- **Test infra** (`src/testing/`): Mock bridge (`mockMobileBridge.ts`, 1435 lines), mock transport, mock plugin stubs (store, dialog, logging), and fixtures (`fixtures/torrent.ts`).
- **E2E tests** (`e2e/`): 6 files — `bootstrap.spec.ts` (5 tests), `add-torrent.spec.ts` (3 tests), `settings.spec.ts` (1 test), `search.spec.ts` (1 test), `rss.spec.ts` (1 test), `helpers/mobile.ts` (101 lines).
