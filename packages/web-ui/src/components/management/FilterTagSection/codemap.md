# FilterTagSection

## Responsibility

Tag filter section with "All Tags" option, individual tag items, inline add form, refresh, and delete confirmation.

## Design

`React.memo` component. Supports `layout: 'pill' | 'list'`. Pill layout shows tags as clickable rows with `IconButton`-based refresh/add/delete controls. List layout uses `FilterListItem` and `Composer`. Delete confirmation via `ConfirmDialog`.

## Flow

Tag selection calls `onTagChange(tag | null)`. Add form manages local state. Delete calls `onDeleteTag(name)` after confirmation.

## Integration

Used by `FiltersScreenBody` for the tags section.
