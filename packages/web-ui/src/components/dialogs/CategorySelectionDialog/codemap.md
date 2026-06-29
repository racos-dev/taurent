# CategorySelectionDialog

## Responsibility

Modal dialog for selecting a single category from a list, or choosing "No Category".

## Design

`React.memo` component wrapping `Dialog` + `DialogActions`. Renders a scrollable list of category buttons plus a "No Category" option. Includes `MutationErrorBanner` for server error display.

## Flow

Parent controls open/close via `isPending`/`onCancel`. Category selection calls `onSelect(categoryName)` (empty string for "No Category"). Parent closes dialog.

## Integration

Used by `HomeScreenBody` for batch category assignment on selected torrents.
