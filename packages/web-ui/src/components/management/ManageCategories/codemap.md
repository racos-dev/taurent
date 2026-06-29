# ManageCategories

## Responsibility

Full-page category management UI with create, edit (save path), and delete operations.

## Design

`React.memo` `ManageCategoriesBody` component with `variant: 'desktop' | 'mobile'`. Both variants show an add form (name + save path), a category list with inline edit, and delete confirmation via `ConfirmDialog`. Mobile variant uses larger touch targets and stacked layout. Desktop variant uses a two-column form and inline edit controls.

## Flow

1. Add: User fills name + optional save path, clicks Add → `onCreateCategory(name, savePath)`.
2. Edit: User clicks edit icon → inline edit form for save path → Save → `onEditCategory(name, savePath)`.
3. Delete: User clicks trash → `ConfirmDialog` → `onRemoveCategory(name)`.
4. Refresh: Spinner button calls `refetch()`.

## Integration

Exported from `src/index.ts` as `ManageCategoriesBody`. Used by mobile/desktop management screens.
