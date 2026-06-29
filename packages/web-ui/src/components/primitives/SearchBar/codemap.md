# SearchBar

## Responsibility

Compact search input with a search icon, auto-focus, and clear-on-empty behavior. A thin convenience wrapper around the `Input` primitive.

## Design

`React.memo` component. Renders an `Input` with `size="sm"`, `icon={<Icon name="search" />}`, `clearable`, and `autoFocus`. Wraps the input in a `div` with `mt-2` spacing.

- **Props**: `value`, `onChange`, `onClear`, `placeholder` (defaults to `'Search'`).
- **Clear behavior**: When the input value becomes empty, automatically calls `onClear()` in addition to forwarding the empty string to `onChange`.

## Flow

Controlled via `value`/`onChange`. User types → `onChange(value)` fires. Value empties → `onClear()` fires. No internal state.

## Integration

Used by `HomeScreenBody` for the torrent search input. Exported from `src/index.ts`.
