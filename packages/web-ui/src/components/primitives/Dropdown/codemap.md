# Dropdown

## Responsibility

Generic dropdown infrastructure: viewport-aware positioned panel and a comprehensive hook for dropdown behavior (positioning, keyboard nav, typeahead, outside-click, focus management).

## Design

- **DropdownPanel**: Portal-based panel rendered into `document.body`. Applies viewport-aware positioning, min-width matching trigger, and max-height clamping.
- **useDropdownPanel**: Generic hook managing open/close state, active index, panel position, keyboard navigation (ArrowUp/Down, Home, End, Enter, Space, Escape, Tab), typeahead search, outside-click dismissal, focus management, hover mode (for menubar), and ARIA attributes.

## Flow

1. Consumer provides `options[]`, `getOptionLabel`, `isOptionDisabled`, `onSelect`, and `role`.
2. Hook manages all state and returns refs, handlers, and ARIA attributes.
3. Consumer renders trigger button and `DropdownPanel` with option rows.

## Integration

Used by `Select` and `DropdownMenu` as the underlying dropdown engine. Exported from `src/index.ts`.
