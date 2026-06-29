# FilterTrackerSection

## Responsibility

Tracker filter section with "All Trackers" option and individual tracker items showing hostname and torrent count.

## Design

`React.memo` component. Uses `FilterListItem` for each tracker entry. Shows `StateCard` empty state when no trackers exist. Default globe icon for each row.

## Flow

Selection calls `onTrackerChange(trackerUrl | null)`. No internal state.

## Integration

Used by `FiltersScreenBody` for the trackers section.
