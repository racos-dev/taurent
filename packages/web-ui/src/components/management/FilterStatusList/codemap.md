# FilterStatusList

## Responsibility

Renders a list of status filter options (All, Downloading, Seeding, etc.) using `FilterListItem`.

## Design

`React.memo` component. Maps `FilterStatusListOption[]` to `FilterListItem` components. The "all" value is selected when `selectedValue` is null or matches `allValue`.

## Flow

Selection calls `onSelect(option.value)`. No internal state.

## Integration

Used by `FiltersScreenBody` for the status filter section.
