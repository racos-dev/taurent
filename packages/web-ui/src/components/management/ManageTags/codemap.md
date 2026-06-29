# ManageTags

## Responsibility

Full-page tag management UI with create and delete operations.

## Design

`React.memo` `ManageTagsBody` component with `variant: 'desktop' | 'mobile'`. Both variants show an add form (name only), a tag list rendered as pills/chips, and delete confirmation via `ConfirmDialog`. Tags are displayed in a flex-wrap layout.

## Flow

1. Add: User fills name, clicks Add → `onCreateTag(name)`.
2. Delete: User clicks X on tag → `ConfirmDialog` → `onDeleteTag(name)`.
3. Refresh: Spinner button calls `refetch()`.

## Integration

Exported from `src/index.ts` as `ManageTagsBody`. Used by mobile/desktop management screens.
