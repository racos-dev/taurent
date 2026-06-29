# packages/shared/src/components/StatusBadge/

## Responsibility

Renders a colored status badge or status dot for torrent states and connection statuses. Provides a consistent visual language for status indicators across the application.

## Key Files

- `types.ts` — `StatusType` union (17 values: downloading, seeding, paused, completed, error, uploading, connected, disconnected, active, inactive, checking, moving, tracker-working, tracker-error, tracker-disabled, tracker-pending, tracker-updating), `StatusBadgeSize` (`small|medium`), base/web/native prop interfaces.
- `StatusBadge.web.tsx` — Web implementation: `StatusBadge` (memoized) renders a `<span>` or `<button>` with color-coded background/text/border classes; `StatusDot` renders a colored circle.
- `index.ts` — Barrel re-export of types and web implementation.

## Design

- **Configuration-driven**: `statusConfig` record maps each `StatusType` to Tailwind color classes (`colorClass`, `bgClass`, `bgAlphaClass`, `borderClass`, `label`).
- **Size variants**: `small` (px-1.5 py-0.5, 11px font, 6px dot) and `medium` (px-2 py-1, xs font, 8px dot).
- **Transparent mode**: When `transparent` is true, renders with a border instead of a background fill.
- **Interactive**: Accepts optional `onClick` to render as a clickable `<button>` with hover opacity.
- **Memoized**: Both `StatusBadge` and `StatusDot` use `React.memo`.

## Flow

1. Consumer passes `status="downloading"` and optional `label`, `showDot`, `size`, `transparent`, `onClick`.
2. `statusConfig[status]` provides the color classes and default label.
3. `sizeStyles[size]` provides padding, font size, and dot dimensions.
4. `cn()` composes the final className from base styles, color classes, and any custom `className`.
5. If `onClick` is provided, renders `<button>`; otherwise renders `<span>`.

## Integration

- Imports `cn` from `@taurent/shared` for Tailwind class composition.
- `StatusType` is consumed by `utils/torrentStatus.ts` via `toStatusBadgeStatus` to map `TorrentDisplayStatus` to `StatusType`.
- Re-exported from `packages/shared/src/index.ts` as `{ StatusBadge, StatusDot, type StatusType, type StatusBadgeSize }`.
- Used by both desktop and mobile apps for torrent list status indicators, connection status display, and tracker status badges.
