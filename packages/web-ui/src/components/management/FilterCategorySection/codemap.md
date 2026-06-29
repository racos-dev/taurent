# FilterCategorySection

## Responsibility

Category filter section with "All Categories" option, individual category items, inline add form, refresh, and delete confirmation.

## Design

`React.memo` component. Supports `layout: 'pill' | 'list'`. Pill layout shows categories as clickable rows with inline add form and `IconButton`-based refresh/add/delete controls. List layout uses `FilterListItem` components and `Composer` for adding. Delete confirmation uses `ConfirmDialog` (desktop) or delegates to `onLongPressItem` (mobile).

## Flow

Category selection calls `onCategoryChange(category | null)`. Add form manages local state (`showAddForm`, `newCategoryName`). Delete calls `onDeleteCategory(name)` after confirmation.

## Integration

Used by `FiltersScreenBody` for the categories section. Consumed by desktop and mobile filter screens.
