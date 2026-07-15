# packages/web-ui/src/components/CapabilityButton/

## Responsibility

A thin wrapper around the `Button` primitive that gates a button's availability based on qBittorrent server capability metadata. It exposes a single prop-driven interface (`enabled`, `requiresVersion`, `isRemoved`, `isUnreleased`) and derives the button's `disabled` state and a human-readable `title` tooltip explaining *why* the action is unavailable.

This component is the UI's bridge between the capability-probing system (from `@taurent/web-core` / bridge layer) and a concrete action button. It keeps the tooltip logic—version-string formatting, removed/unreleased messaging—in one place rather than scattering it across call sites.

## Design

- **Wrapper pattern**: `CapabilityButtonProps` uses `Omit<React.ComponentProps<typeof Button>, 'title' | 'disabled'>`, meaning every standard Button prop (variant, size, loading, onClick, children, etc.) is forwarded directly. The only props `CapabilityButton` intercepts are `disabled` (replaced by a computed value based on `enabled`) and `title` (replaced by the auto-generated tooltip).
- **Derived disabled state**: `disabled={!enabled}` — the button is enabled only when the capability reports `enabled: true`.
- **Derived tooltip**: A pure function `buildTooltip()` returns `undefined` (no tooltip) when the button is enabled, and a contextual string when disabled:
  - Removed features → `"Removed in qBittorrent ${removedIn}+"`
  - Unreleased features → `"Requires a future qBittorrent release."`
  - Existing features behind a version floor → `"Requires qBittorrent ${requiresVersion}+"`
- **Memoization**: The component is wrapped in `React.memo` with the default shallow comparison (since all props are simple scalars or callbacks), avoiding re-renders when the parent re-renders without changing capability props.

## Flow

```
Parent component (e.g. TorrentDetailScreenBody)
  │
  │  Provides capability data from query/session state
  │  (enabled: boolean, requiresVersion?: string, etc.)
  ▼
CapabilityButton
  │  1. Receives capability props + standard Button props
  │  2. Sets disabled = !enabled
  │  3. Calls buildTooltip() → string | undefined
  │  4. Renders <Button disabled={!enabled} title={tooltip} {...rest} />
  ▼
Button (primitive)
  │  Renders <button> with the passed variant, size, onClick, children, etc.
```

## Integration

- **Exported** from `packages/web-ui` via `src/index.ts` as both the component and its props type, making it available to any consumer of the web-ui package.
- **Used in** `apps/desktop/src/screens/TorrentDetailScreen/TorrentDetailScreenBody.tsx` for the "Add HTTP source" action button, gated on `canManageHttpSources`.
- **Depends on** `../primitives/Button` — the Button web implementation (`Button.web.tsx`) which handles styling, density, spinner states, and accessibility.
- **Data source**: The `enabled`/`requiresVersion`/`isRemoved`/`isUnreleased` props are expected to be supplied from higher-level capability probing logic (e.g. from `@taurent/web-core` or bridge adapters that query the qBittorrent capability TOML definitions in `crates/qb-core/capabilities/`).
