# FilterListItem

## Responsibility

Selectable button row for filter lists with icon, label, summary, checkmark, and long-press support.

## Design

`React.memo` component. Long-press detection uses a 400ms timeout with touch start/end/move handlers. Context menu (right-click) also triggers `onLongPress`. Active state shows primary background and checkmark icon. Density-aware sizing via `FILTER_LIST_ITEM_CONTROL_SIZE_CLASSES[density]` and `FILTER_LIST_ITEM_LABEL_SIZE_CLASSES[density]` — mobile rows get `min-h-11` touch targets and `text-sm` labels.

## Flow

Click calls `onPress`. Long-press/context menu calls `onLongPress`. No internal state beyond the timer ref.

## Integration

Used by `FilterStatusList`, `FilterTagSection`, `FilterCategorySection`, and `FilterTrackerSection` for filter list items.
