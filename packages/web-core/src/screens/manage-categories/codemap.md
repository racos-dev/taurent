# manage-categories

## Responsibility

Screen model hook for the ManageCategories screen. Composes the categories query with create/edit/remove mutations into a flat result object consumed by `ManageCategoriesBody`.

## Key Files

- `useManageCategoriesScreenModel.ts` — Composes `useCategories` query with `useCreateCategory`, `useEditCategory`, `useRemoveCategories` mutations

## Design Patterns

- **Flat result object**: Exposes `categories`, `isLoading`, `refetch`, `onCreateCategory`, `onEditCategory`, `onRemoveCategory`, `isCreating`, `isEditing`, `isRemoving`, `mutationError`
- **Adapter injection**: Accepts `adapters` with `getCategories`, `createCategory`, `editCategory`, `removeCategories` functions
- **Error aggregation**: Collects first error from any mutation via `formatUserMessage`

## Flow

1. `useCategories` fetches categories list with scope
2. `useCreateCategory`/`useEditCategory`/`useRemoveCategories` manage mutation lifecycle
3. Each mutation invalidates categories + sync-maindata on success
4. Model exposes handlers that call mutation `.mutate()` with appropriate variables

## Integration

- Imports `useCategories` from `hooks/useCategories`
- Imports mutation hooks from `hooks/useCategoryMutations`
- Uses `QueryScope` from `query/scope`
- Used by desktop/mobile ManageCategories screens
