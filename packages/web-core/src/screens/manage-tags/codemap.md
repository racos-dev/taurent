# manage-tags

## Responsibility

Screen model hook for the ManageTags screen. Composes the tags query with create/delete mutations into a flat result object consumed by `ManageTagsBody`.

## Key Files

- `useManageTagsScreenModel.ts` — Composes `useTags` query with `useCreateTags`, `useDeleteTags` mutations

## Design Patterns

- **Flat result object**: Exposes `tags`, `isLoading`, `refetch`, `onCreateTag`, `onDeleteTag`, `isCreating`, `isDeleting`, `mutationError`
- **Adapter injection**: Accepts `adapters` with `getTags`, `createTags`, `deleteTags` functions
- **Error aggregation**: Collects first error from any mutation via `formatUserMessage`

## Flow

1. `useTags` fetches tags list with scope
2. `useCreateTags`/`useDeleteTags` manage mutation lifecycle
3. Each mutation invalidates tags + sync-maindata on success (delete also invalidates torrents)
4. Model exposes handlers that call mutation `.mutate()` with tag arrays

## Integration

- Imports `useTags` from `hooks/useTags`
- Imports mutation hooks from `hooks/useTagMutations`
- Uses `QueryScope` from `query/scope`
- Used by desktop/mobile ManageTags screens
