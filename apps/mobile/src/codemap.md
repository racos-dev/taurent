# apps/mobile/src/

## Responsibility

Mobile renderer entry for the Tauri-based qBittorrent client. Contains the React application root, provider composition, and mobile-specific platform glue that:

- Bootstraps cross-cutting providers (theme, density, react-query, server manager, session controller).
- Composes the routing graph with public/protected route boundaries via `AuthBoundary`.
- Wires the mobile `BridgeAdapter` (Tauri) into the shared `@taurent/web-core` session/server manager abstractions.
- Defines all screen-level route components and the bottom-tab shell layout.

## Key Files

- **main.tsx** — Bootstrap entry; calls `setupTauriLogging()` from `@taurent/bridge/logging` then mounts `<App />`.
- **App.tsx** — Provider composition tree (`QueryClientProvider → ThemeProvider → ControlDensityProvider → ServerManagerProvider → QBClientProvider → RouterProvider`) and route definition via `createBrowserRouter` with `AuthBoundary` as the root element. Creates a single `QueryClient` via `createQueryClient()` from `@taurent/web-core/query`. Includes `AppNotifications` sub-component that wires `useOperationNotifications` with `toast.error` and mounts `<Toaster />`.
- **index.css** — Tailwind imports plus mobile-safe-area CSS custom properties (`--sat`, `--sar`, `--sab`, `--sal`) and base body styles.
- **vite-env.d.ts** — Vite client type reference.

## Design Patterns

- **Provider composition**: `QueryClientProvider → ThemeProvider → ControlDensityProvider → ServerManagerProvider → QBClientProvider → RouterProvider`. Each provider is a thin mobile wrapper around a web-core factory. `ControlDensityProvider` from `@taurent/web-ui` provides density scaling context.
- **Adapter/Bridge**: `BridgeAdapter` from `@taurent/bridge/adapters/mobile-tauri` implements platform I/O; mobile hooks wrap bridge calls and adapt them to web-core query/mutation contracts.
- **React Query**: Read hooks use shared web-core query hooks; write operations reuse web-core mutations or create local `useMutation` with `onSuccess` invalidation.
- **QueryScope pattern**: `{ serverId, sessionGeneration, isConnected }` derived from `useQBClient()` isolates caches per-server and per-session generation.
- **Event-driven invalidation**: `createResourceInvalidatedListener` and session events wired to centralized invalidation helpers.
- **Backend maindata sync**: `QBClientProvider` passes `BridgeAdapter.qBClient` as `maindataBackendBridge` to `createQBClientBootstrap`, enabling the backend-owned sync path (snapshot + events) instead of renderer-side polling.

## High-level Flow

1. `main.tsx` calls `setupTauriLogging()` (best-effort; warns on failure) then lazy-imports `App.tsx` and renders into `#root`.
2. `App.tsx` creates a `QueryClient` and composes providers. `AuthBoundary` is the router root element; it gates public (`/servers`, `/add-server`) and protected routes.
3. Protected routes are nested under `MobileShell` (bottom tab bar) for top-level destinations (`/`, `/search`, `/rss`, `/settings`, `/statistics`) and standalone screens for drill-in routes (`/torrent/:hash`, `/add-torrent`, `/filters`, `/manage-servers`, `/manage-categories`, `/manage-tags`).
4. `ServerManagerProvider` adapts `BridgeAdapter.servers.*` to the shared server manager controller.
5. `QBClientProvider` uses `createQBClientBootstrap` with mobile session bridge, listeners, retry config, and backend maindata sync bridge (`BridgeAdapter.qBClient`).
6. `AppNotifications` mounts `<Toaster />` and wires `useOperationNotifications` for error toasts.
7. UI screens call hooks in `src/hooks/*` which invoke `BridgeAdapter` and rely on web-core invalidators to refresh caches.

## Integration

- **@taurent/bridge/adapters/mobile-tauri** — `BridgeAdapter` for all Tauri commands.
- **@taurent/bridge/logging** — `setupTauriLogging()` for mobile logging bootstrap.
- **@taurent/web-core** — Factory functions (`createQBClientBootstrap`, `createServerManagerBindings`, `createQueryClient`), shared hooks, capability probes, invalidation helpers.
- **@taurent/web-ui** — Shared UI components (`ThemeProvider`, `ControlDensityProvider`, `Toaster`, `HomeScreenBody`, etc.) plus mobile-local settings presentation in `src/screens/MobileSettingsScreenBody.tsx`.
- **@taurent/shared** — Types, formatters, theme CSS, error utilities.
- **@tanstack/react-query** — `QueryClient`; hooks use `useQuery`/`useMutation`.
- **react-router-dom** — `createBrowserRouter` with `AuthBoundary` root, `NavLink`-based tab bar.
