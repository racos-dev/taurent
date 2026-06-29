# ConfirmDialog

## Responsibility

Generic confirmation dialog with async-aware confirm action, loading state, and danger/default tone.

## Design

`React.memo` component wrapping `Dialog` + `DialogActions`. Manages internal `isSubmitting` state. Calls `onConfirm()`, awaits completion, then auto-closes via `onCancel()`. Shows loading label during submission. Renders an `AlertCircle` icon with tone-colored background (error/primary). `maxWidth="sm"` for compact layout.

## Flow

Always open (`isOpen={true}`). Confirm triggers async `onConfirm`, cancel dismisses. Error in `onConfirm` is logged and dialog closes.

## Integration

Used by `FilterCategorySection`, `FilterTagSection`, `ManageCategoriesBody`, `ManageTagsBody`, `SearchScreenBody`, and `RSSScreenBody` for destructive actions.
