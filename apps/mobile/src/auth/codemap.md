# apps/mobile/src/auth/

## Responsibility

Provides the authentication boundary that gates public and protected routes. Determines whether the user has an active session and redirects accordingly — unauthenticated users see login/add-server screens; authenticated users see the main app shell.

## Key Files

- **AuthBoundary.tsx** — Thin mobile instantiation of `createAuthBoundary` from `@taurent/web-core/session`. Wires the mobile `useQBClient` and `useServerManager` hooks plus `AuthLoadingScreen` from `@taurent/web-ui` as the loading fallback.

## Design

- **Factory pattern**: Uses `createAuthBoundary({ useQBClient, useServerManager, LoadingComponent })` from `@taurent/web-core/session` to produce a route-level `AuthBoundary` component. All session-state derivation logic lives in web-core; this file is pure wiring.
- **Route-root element**: `AuthBoundary` is the root `<Route element>` in `createBrowserRouter` (App.tsx), so it wraps every screen in the app. It conditionally renders `<Outlet />` for protected routes or redirects to `/servers`.
- **Loading state**: Shows `AuthLoadingScreen` while session hydration is in progress (`!isHydrated`).

## Flow

1. `AuthBoundary` mounts as the router root element.
2. It reads session state from `useQBClient()` (isHydrated, isConnected) and server list from `useServerManager()`.
3. If hydrating, it renders `AuthLoadingScreen`.
4. If hydrated and not connected, it redirects to `/servers` (or `/add-server` if no servers exist).
5. If connected, it renders `<Outlet />`, which matches child routes (`/`, `/search`, `/torrent/:hash`, etc.).

## Integration

- **@taurent/web-core/session** — `createAuthBoundary` factory that implements all session-state gating logic.
- **@taurent/web-ui** — `AuthLoadingScreen` component for the loading state.
- **../connection/QBClientProvider** — `useQBClient` for session state (isHydrated, isConnected).
- **../connection/ServerManager** — `useServerManager` for server list (determines redirect target when no servers exist).
