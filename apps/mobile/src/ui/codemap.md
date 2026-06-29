# apps/mobile/src/ui/

## Responsibility

Mobile-specific UI primitives, icon re-exports, and layout utility helpers. Provides:

- **Icon re-export**: A thin adapter that re-exports the `Icon` component from `@taurent/shared` as the single import point for icons in the mobile app.
- **Screen layout helpers**: Centralized CSS class name generators for mobile screen layout — safe-area-aware padding, width constraints, height modes, and centered-state utilities. Used by every screen to ensure consistent spacing, translucency, and safe-area handling.

## Key Files

- **Icon.tsx** — Re-exports the `Icon` component and `AppIconName` type from `@taurent/shared`. This is the single import point for icons in the mobile app, ensuring consistency and providing a place to add mobile-specific icon overrides in the future.
- **mobileScreenLayout.ts** — Pure utility module exporting CSS class name helper functions for mobile screen layout. Defines types `MobileScreenWidth` (`compact` | `wide`), `MobileScreenHeight` (`full` | `screen`), and `MobileScreenBottomSpacing` (`none` | `content` | `tab` | `fab`). Exports four helper functions:
  - `mobileScreenWidthClassName()` — Returns `max-w-lg` or `max-w-3xl` for content width constraints.
  - `mobileScreenRootClassName()` — Returns a full-height or full-screen root container class with optional safe-area bottom padding. Used as the outermost `<div>` in every screen.
  - `mobileScreenContentClassName()` — Returns centered, padded content wrapper class with width constraint and safe-area bottom padding. Used inside `<main>` of every screen.
  - `mobileScreenHeaderInnerClassName()` — Returns centered, width-constrained inner wrapper for sticky headers.
  - `mobileCenteredStateClassName()` — Returns a flex-centered container class for loading/error/empty states.
  - Bottom spacing classes use literal rem values inside Tailwind arbitrary-value classes (e.g., `pb-[calc(4rem+var(--sab))]`) to avoid Tailwind's spacing scale limitations. The `--sab` CSS custom property maps to `env(safe-area-inset-bottom)`.

## Design

- **Re-export layer**: The `Icon.tsx` file is intentionally minimal. All shared UI components (`StateCard`, `ConfirmDialog`, `WorkspaceFrame`, etc.) are imported directly from `@taurent/web-ui` in the components that use them.
- **Layout utilities**: `mobileScreenLayout.ts` centralizes all mobile screen spacing/width/safe-area concerns. Screens import helpers from this module instead of hardcoding Tailwind classes, ensuring safe-area padding is consistent and tied to a single source of truth. The helpers compose `cn()` from `@taurent/shared` for conditional class merging.
- **Icon component**: The `Icon` component from `@taurent/shared` wraps Lucide icons and supports the `iconSize` prop (mapping to `ICON_SIZES` from `@taurent/shared/icons/sizes.ts`). All mobile screens import `Icon` from this module.

## Flow

1. A screen imports `mobileScreenRootClassName`, `mobileScreenContentClassName`, and `mobileCenteredStateClassName` from `../ui/mobileScreenLayout`.
2. The screen renders `<div className={mobileScreenRootClassName({ bottomSpacing: 'content' })}>` as its root.
3. Inside, it renders `<ScreenHeader>` with sticky positioning, then `<main className={mobileScreenContentClassName({ bottomSpacing: 'tab' })}>` for the body.
4. Loading/error/empty states use `<div className={mobileCenteredStateClassName()}>` to center content vertically.
5. For icons, screens import `Icon` from `../ui/Icon` and render `<Icon name="..." iconSize="md" />`.

## Integration

- **@taurent/shared** — `Icon` component and `AppIconName` type (wraps Lucide icons); `cn()` utility for class merging.
- **All screens** — `HomeScreen`, `LoginScreen`, `AddServerScreen`, `TorrentDetailScreen`, `AddTorrentScreen`, `FiltersScreen`, `SettingsScreen`, `StatisticsScreen`, `SearchScreen`, and `RSSScreen` import from `mobileScreenLayout`.
- **Shell** — `MobileShell` defines its own tab bar safe-height constant (`calc(4rem + var(--sab, 0px))`) which mirrors the `tab` spacing in `mobileScreenLayout.ts`.
