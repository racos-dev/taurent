# MetadataRow

## Responsibility

Label + value row for metadata display with consistent left-aligned label and right-aligned value.

## Design

`React.memo` component. Renders as a flex row with fixed-width label and flexible value. Supports either `value` string prop or `children` ReactNode for complex values.

## Flow

Pure presentational. No state.

## Integration

Used by `TorrentDetailsOverviewSection` and `StatisticsScreenBody` for property/stat display.
