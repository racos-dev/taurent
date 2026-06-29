# SkeletonBlock

## Responsibility

Animated pulse placeholder for loading states.

## Design

`React.memo` component. Configurable `width`, `height`, `radius` (none/sm/md/lg/full), and `background`. Uses CSS `animate-pulse`. `aria-hidden="true"` for accessibility.

## Flow

Pure presentational. No state.

## Integration

Used by `SearchScreenBody`, `RSSScreenBody`, and other screens for loading placeholders.
