# apps/desktop/src/components/TorrentTable/

## Responsibility

The main torrent list table with virtualization, sortable columns, column drag-and-drop reordering, resizable column widths, and a header context menu for column management. This is the primary data display component in the desktop transfers workspace.

## Design

- **Virtualization**: Uses `@tanstack/react-virtual` for lists >20 items. The virtualizer provides absolute positioning for rows within a fixed-height scroll container.
- **Column registry**: All columns are defined in `stores/columnRegistry.ts`. The table reads `COLUMN_REGISTRY`, `COLUMN_MAP`, `DEFAULT_COLUMN_*` for configuration.
- **Drag-and-drop columns**: Uses `@dnd-kit/core` and `@dnd-kit/sortable` for header column reordering with visual drag overlay.
- **Resizable columns**: Header cells support drag-to-resize via mouse events. Double-click triggers auto-fit width calculation using canvas text measurement.
- **Per-cell memoization**: `IndividualCell` is memoized with custom equality checks to prevent re-renders when only column width changes (not torrent data).
- **Row memoization**: `TorrentTableRow` is memoized with custom equality checks for all props including serialized style values.
- **Performance audit**: Optional `TorrentTableRenderAudit` component tracks render reasons when `isPerfAuditEnabled()`.
- **Header context menu**: Right-click on column headers opens `HeaderContextMenu` with move/resize/toggle/restore-defaults options.

## Key Files

- **TorrentTable.tsx** — Main table component with virtualization, DnD, and column management.
- **TorrentTableRow.tsx** — Memoized row component with per-cell memoization, selection handling, and double-click detection.
- **HeaderContextMenu.tsx** — Column management context menu (move, resize, toggle visibility, restore defaults).
- **index.ts** — Barrel re-export.

## Flow

1. `HomeScreen` renders `TorrentTable` with sorted/filtered torrents, selection state, and sort config.
2. Table normalizes column config from shell store (visibility, order, widths).
3. Header renders `SortableTh` components with drag handles and resize handles.
4. Body renders `TorrentTableRow` components (virtualized or direct).
5. Click/shift-click/ctrl-click on rows updates selection store.
6. Context menu on headers opens column management panel.

## Integration

- Reads column config from `useShellStore` (columnVisibility, columnOrder, columnWidths).
- Reads selection state from `useTorrentSelectionStore`.
- Reads queueing preference from `usePreferences` to conditionally show priority column.
- Row click/right-click callbacks propagate to `HomeScreen` for selection and context menu handling.
- Uses `ContextMenu` from `@taurent/web-ui` for header context menu.
