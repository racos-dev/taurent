# MetricCard

## Responsibility

Labeled value card with tone-aware border coloring for statistics display.

## Design

`React.memo` component. 4 tones: neutral, success, warning, error. Each applies border and background color. Renders uppercase label, primary value, and optional sub-value.

## Flow

Pure presentational. No state.

## Integration

Used by `StatisticsScreenBody` and `HomeScreenBody` for metric display.
