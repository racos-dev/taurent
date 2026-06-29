# packages/web-ui/src/components/shared/SurfaceListItem/

## Responsibility

A polymorphic list item component that renders as a clickable button, a focusable div, or a plain div depending on which interaction handler is provided. Supports a selected state with visual highlighting. Used inside `SurfaceList` for settings lists, server lists, and other selectable row UIs.

## Design

- **`SurfaceListItem`** — `React.memo` component (`SurfaceListItemProps`). ~59 lines.
- **Props**:
  - `selected?: boolean` — applies `bg-primary/10` highlight when true.
  - `onClick?: () => void` — renders as a `<div role="button">` with keyboard support (Enter/Space).
  - `onPress?: () => void` — renders as a `<button>` element (takes precedence over `onClick`).
  - `children: ReactNode` — item content.
  - `className?: string` — additional CSS classes.
- **Polymorphic rendering**:
  - `onPress` provided → `<button>` with `onClick={onPress}`.
  - `onClick` provided → `<div role="button" tabIndex={0}>` with keyboard handler.
  - Neither → plain `<div>`.
- **Interactive styling** — when clickable: `cursor-pointer hover:bg-surface-interactive`.

## Flow

1. Parent (e.g., `SurfaceList`) passes handlers and content.
2. Component renders appropriate element type.
3. User interaction triggers provided callback.

## Integration

- **`@taurent/shared`** — `cn`.
- **Used with `SurfaceList`** — typically rendered as children of `SurfaceList` for consistent spacing and dividers.
- **Exported from `index.ts`**: `SurfaceListItem`, `SurfaceListItemProps`.
