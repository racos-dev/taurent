# apps/desktop/src/components/ContextMenu/

## Responsibility

Desktop-specific context menus for sidebar items (categories, tags, trackers, status filters) and bulk torrent actions. Each context menu is a positioned popover that renders action items relevant to the right-clicked entity.

## Design

- **Composable item builder**: `TorrentBulkMenuItems` returns a plain `ContextMenuItem[]` array (not JSX) that other context menus append to their items list. This avoids JSX duplication for resume/pause/remove actions.
- **Consistent structure**: Each context menu component accepts `x`, `y` position, entity-specific props (name, hashes), action callbacks, and an `onClose` handler. They all render `<ContextMenu>` from `@taurent/web-ui`.
- **Destructive marking**: Destructive actions (delete, remove) use the `destructive: true` flag for visual differentiation.

## Key Files

- **CategoryContextMenu.tsx** — Edit/remove category, remove unused categories, plus bulk torrent actions.
- **TagContextMenu.tsx** — Remove tag, remove unused tags, plus bulk torrent actions.
- **TrackerContextMenu.tsx** — Remove tracker, plus bulk torrent actions.
- **StatusContextMenu.tsx** — Bulk torrent actions scoped to a status filter group.
- **TorrentBulkMenuItems.tsx** — Shared builder returning resume/stop/remove items for a given hash set.
- **index.ts** — Barrel re-exports.

## Flow

1. Parent component (Sidebar, HomeScreen) captures right-click event with position and entity data.
2. Parent sets context menu state (`{ x, y, entity }`).
3. Context menu component renders at the specified position with action callbacks.
4. On action click, callback fires, `onClose` dismisses the menu.

## Integration

- Uses `ContextMenu` from `@taurent/web-ui` for positioning and rendering.
- Actions callback to parent components which invoke `useTorrentActions` or category/tag mutation hooks.
- Sidebar sections (`CategoriesSection`, `TagsSection`, `TrackersSection`) own the context menu state and render these components.
