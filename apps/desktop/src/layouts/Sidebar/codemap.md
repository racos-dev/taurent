# apps/desktop/src/layouts/Sidebar/

## Responsibility

Provides the left sidebar with collapsible sections for filtering torrents by status, category, tag, and tracker. Shows counts for each filter option and supports toggle-based filter activation. Includes context menus for category/tag/tracker management and bulk actions.

## Design

- **Collapsible sections**: Each filter type (Status, Categories, Tags, Trackers) is rendered as a collapsible `SidebarSection`. Expansion state is local — not persisted to shellStore.
- **Filter activation**: Clicking a filter item sets it as the active filter; clicking again clears it. Filter state is stored in `useTorrentStore`'s filter slice.
- **Count display**: Each filter option shows a count of matching torrents, computed from the full torrent list using `matchesTorrentFilter`.
- **Context menus**: Right-click on categories/tags/trackers opens a context menu for management actions (edit, delete for categories; delete for tags; open-folder, copy for trackers).
- **Bulk actions**: `useSidebarActions` provides `resumeAll`, `pauseAll`, and `removeAll` for the currently filtered torrent group.
- **Controller pattern**: Uses `useTorrentWorkspaceSidebarController` from `@taurent/web-core` for filter state management and count computation.

## Files

- **Sidebar.tsx** — main sidebar container. Renders status filter buttons (All, Downloading, Completed, Paused, Active, Inactive, Errored) plus collapsible sections for categories, tags, and trackers. Tracks expansion state per section.
- **SidebarSection.tsx** — reusable collapsible section wrapper with a title bar and expand/collapse toggle button.
- **CategoriesSection.tsx** — renders the category list with counts and right-click context menu. The context menu offers edit (opens edit-category dialog), delete (bulk remove categories), and set-as-filter actions.
- **TagsSection.tsx** — renders the tag list with counts and right-click context menu for deletion.
- **TrackersSection.tsx** — renders the tracker filter list with counts and right-click context menu.
- **useSidebarActions.ts** — provides bulk action functions (`resumeAll`, `pauseAll`, `removeAll`) that operate on all torrents matching the current filter group.
- **index.ts** — barrel re-export of `Sidebar`.

## Flow

1. `Sidebar` renders status filter buttons and three collapsible sections.
2. User clicks a status filter → filter is applied to `useTorrentStore`, triggering torrent list re-filtering in the main content area.
3. User clicks a category/tag/tracker item → filter is toggled in the store, and counts update reactively.
4. User right-clicks a category/tag → context menu appears with management options, which call into platform hooks (`useRemoveCategories`, `useDeleteTags`) or dialog openers.
5. User clicks a bulk action in the section header → `useSidebarActions` applies the action to all torrents in the filtered group.

## Integration

- `@taurent/shared/stores` — `useTorrentStore` for torrents, categories, tags, and active filters.
- `@taurent/shared` — `TORRENT_FILTER_OPTIONS`, `matchesTorrentFilter`, `TorrentFilterType`.
- `@taurent/web-core` — `useTorrentWorkspaceSidebarController` for filter/count logic.
- `components/ContextMenu` — `CategoryContextMenu`, `TagContextMenu` for right-click menus.
- `windows/dialogs/editCategoryDialogWindow` — `openEditCategoryDialogWindow` for category editing.
- `hooks` — `useRemoveCategories`, `useDeleteTags` for management mutations.
- `hooks/torrents/useTorrentActions` — bulk pause/resume/remove actions.
- Rendered by `AppShell` in the rail slot.
