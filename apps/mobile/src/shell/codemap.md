# apps/mobile/src/shell/

## Responsibility

The authenticated mobile shell layout. Wraps top-level tab destinations (Torrents, Search, RSS, Settings) inside a `WorkspaceFrame` (mobile variant) with an app-owned bottom tab bar. Drill-in routes (torrent detail, add-torrent, filters, manage-*) live outside this shell but remain within the protected/authenticated branch.

## Key Files

- **MobileShell.tsx** — Exports `MobileShell`, a layout component that renders `WorkspaceFrame` with `variant="mobile"`, a `MobileTabBar` footer, and `<Outlet />` for nested route content. Defines `MOBILE_TAB_BAR_SAFE_HEIGHT` constant (`calc(4rem + var(--sab, 0px))`) that sets the shell's CSS custom property `--mobile-tab-bar-safe-height` for downstream safe-area coordination.

## Design

- **Route-driven layout**: `MobileShell` is used as a layout route in `createBrowserRouter` (App.tsx). All child routes (`/`, `/search`, `/rss`, `/settings`, `/statistics`) render inside `<Outlet />` within the shell frame.
- **Bottom tab bar**: `MobileTabBar` renders a horizontal `<nav>` with `NavLink` items for the four primary destinations. Each tab uses the mobile `Icon` component and highlights the active route via `NavLink`'s `isActive` state. Tab bar height includes safe-area-inset-bottom padding via `calc(var(--sab, 0px) + 4px)`.
- **WorkspaceFrame**: Delegates the actual frame layout (safe area handling, scroll containment, content/footer split) to `WorkspaceFrame` from `@taurent/web-ui` with `variant="mobile"`.
- **Tab configuration**: Defined as a static `TAB_ITEMS` array with `to`, `label`, and `icon` properties. Icons use the mobile `Icon` component with `iconSize="lg"` sizing.
- **Safe-area CSS variables**: The shell sets `--mobile-tab-bar-safe-height` on its root div, which downstream components (screens using `mobileScreenLayout.ts` helpers) can reference for bottom spacing coordination.

## Flow

1. `AuthBoundary` determines the user is authenticated and renders child routes.
2. The `/` route matches and renders `MobileShell` as the layout element.
3. `MobileShell` renders `WorkspaceFrame` with the tab bar footer and `<Outlet />` for the matched child route.
4. The child route (e.g., `HomeScreen`) renders inside the `WorkspaceFrame` content area.
5. Navigation between tabs uses `NavLink`, which updates the URL and swaps the rendered child route.

## Integration

- **@taurent/web-ui** — `WorkspaceFrame` component (mobile variant) for the frame layout.
- **../ui/Icon** — Mobile `Icon` component for tab bar icons (`layers`, `search`, `rss`, `settings`).
- **react-router-dom** — `NavLink` for tab navigation with active-state styling, `Outlet` for nested route rendering.
