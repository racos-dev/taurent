# ProgressBar

## Responsibility

Animated progress bar with variant, size, and configurable label format.

## Design

Web variant (`ProgressBar.web.tsx`): `React.memo`. Clamps progress to 0-1 range. 4 variants (default/success/warning/error), 3 sizes (sm/md/lg). Label formats: percentage, fraction, progress (formatted), none. Uses `formatProgress` from `@taurent/shared/utils/formatters`. CSS transition for smooth animation.

## Flow

Controlled via `progress` and `max` props. No internal state.

## Integration

Used by `TorrentDetailHeader`, `HomeScreenBody`, and `TorrentDetailsOverviewSection` for download progress visualization.
