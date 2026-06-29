# packages/web-ui/src/components/shared/StateSurface/

## Responsibility

A full-area or section-level placeholder component for empty, loading, error, offline, or unsupported states. Renders a centered, dashed-border container with optional icon, title, message, and action buttons. Used when an entire content region has no data to display.

## Design

- **`StateSurface`** — `React.memo` component (`StateSurfaceProps`). ~56 lines.
- **Props**:
  - `tone?: StateSurfaceTone` — one of `'loading' | 'empty' | 'error' | 'offline' | 'unsupported'`. Controls border color (error uses `border-error/30`, others use `border-border`).
  - `title?: string` — primary headline.
  - `message?: string` — descriptive sub-message.
  - `icon?: ReactNode` — rendered in a circular `bg-surface-interactive` background.
  - `actions?: ReactNode` — action buttons area (centered, wrapped).
  - `className?: string` — additional CSS classes.
- **Styling** — dashed double border (`border-2 border-dashed`), generous padding (`px-3 py-6`), centered layout.
- **Tone map** — `toneStyles` record maps each tone to its border class; currently only `error` differs from default.

## Flow

1. Parent passes tone, title, message, icon, actions.
2. Component renders; no internal state or interactions.

## Integration

- **`@taurent/shared`** — `cn`.
- **Used by** — `SearchScreenBody` (capability states), `RSSScreenBody` (capability states), and other screens needing full-area empty/loading states.
- **`StateCard` vs `StateSurface`** — `StateCard` is a simpler card variant; `StateSurface` is for primary content area placeholders with dashed borders.
- **Exported from `index.ts`**: `StateSurface`, `StateSurfaceProps`, `StateSurfaceTone`.
