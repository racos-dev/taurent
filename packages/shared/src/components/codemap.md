# packages/shared/src/components/

## Responsibility

Minimal UI primitive layer for platform-agnostic components that are safe to import from web-core and web-ui. This package deliberately excludes Tauri bindings and contains only two components: `Icon` and `StatusBadge`.

## Remaining Components

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Icon** | Type-safe wrapper around lucide-react and custom SVG icons | Resolves icon names to components via `iconMap`; supports `iconSize` prop mapped to `ICON_SIZES` |
| **StatusBadge** | Badge and dot for torrent/server connection status display | Exports `StatusBadge`, `StatusDot`, `StatusType`, `StatusBadgeSize` |

## Removed Components

The following components have been moved to `@taurent/web-ui`:
- Button, Card, Input, ProgressBar (previously at `src/components/Button/`, `Card/`, `Input/`, `ProgressBar/`)

## Design

- **Platform-agnostic**: No `@tauri-apps/*` imports; these are pure React components.
- **Semantic color tokens**: Both components use theme CSS variable tokens (e.g., `--color-status-downloading`) rather than literal color values.
- **Memoized**: `StatusBadge` and `StatusDot` use `React.memo` to avoid unnecessary re-renders.
- **Dual rendering**: `StatusBadge` renders as `<button>` when `onClick` is provided, otherwise as `<span>`.

## Integration

- Imported by `packages/web-core` and `packages/web-ui` for theming and status display.
- `Icon` imports from `../../icons/iconMap` and `../../icons/sizes`.
- `StatusBadge` imports `cn` from `@taurent/shared` for Tailwind class composition.
- `StatusType` is consumed by `utils/torrentStatus.ts` via `toStatusBadgeStatus` mapping.
