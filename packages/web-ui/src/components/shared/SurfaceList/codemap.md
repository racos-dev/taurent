# packages/web-ui/src/components/shared/SurfaceList/

## Responsibility

A thin layout container that renders its children with vertical dividers between them. Used to wrap `SurfaceListItem` children for settings lists, server lists, and other row-based UIs.

## Design

- **`SurfaceList`** — `React.memo` component (`SurfaceListProps`). ~16 lines.
- **Props**:
  - `children: ReactNode` — list items (typically `SurfaceListItem` components).
  - `className?: string` — additional CSS classes.
- **Styling** — applies `divide-y divide-border` to automatically add horizontal dividers between children.
- **No internal state or callbacks** — pure layout wrapper.

## Flow

1. Parent passes `SurfaceListItem` children.
2. `SurfaceList` renders a `<div>` with `divide-y` utility; CSS handles border rendering between items.

## Integration

- **`@taurent/shared`** — `cn`.
- **Paired with `SurfaceListItem`** — the standard pattern is:
  ```tsx
  <SurfaceList>
    <SurfaceListItem onClick={...}>...</SurfaceListItem>
    <SurfaceListItem selected>...</SurfaceListItem>
  </SurfaceList>
  ```
- **Used by** — settings panels, server management lists, filter lists, and any UI needing a divided row layout.
- **Exported from `index.ts`**: `SurfaceList`, `SurfaceListProps`.
