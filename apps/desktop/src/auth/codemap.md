# apps/desktop/src/auth/

## Responsibility

Provides the authentication boundary for the desktop main window. Guards protected routes behind session state — shows a loading screen while hydration completes, redirects to the login screen when disconnected, and renders children when connected.

## Design

- **Factory pattern**: Uses `createAuthBoundary` from `@taurent/web-core/session` with desktop-specific hooks (`useQBClient`, `useServerManager`) and a shared `AuthLoadingScreen` from `@taurent/web-ui`.
- **Thin re-export**: The module is a single `AuthBoundary` component that composes web-core logic with desktop-specific wiring. No desktop-specific auth logic lives here.

## Flow

1. `AuthBoundary` mounts inside the main-window layout route.
2. It reads session state via `useQBClient()` (hydrated, connected, connecting).
3. While hydrating, it renders `AuthLoadingScreen`.
4. If hydrated and disconnected, it redirects to `/login`.
5. If hydrated and connected, it renders `children`.

## Integration

- Consumes `useQBClient` and `useServerManager` from `../connection`.
- Uses `createAuthBoundary` factory from `@taurent/web-core/session`.
- Renders `AuthLoadingScreen` from `@taurent/web-ui`.
- Mounted by `MainWindowLayout` / `App.tsx` route configuration.
