# apps/desktop/src/stores/

## Responsibility

Hosts desktop-only state management and the canonical column registry used by the Transfers / Workspace table:

- Provide shell/workspace UI preferences (sidebar, properties pane, column preferences) via Zustand (useShellStore).
- Provide selection mechanics for the torrent table (useTorrentSelectionStore) including focused/anchor semantics and range selection.
- Define the canonical column registry (columnRegistry.ts).

## Modified File

- **index.ts** (modified) — Re-exports consolidated desktop store APIs: useShellStore and related constants/normalizers from shellStore.ts; COLUMN_REGISTRY, COLUMN_MAP, and related constants from columnRegistry.ts; useTorrentSelectionStore from torrentSelectionStore.ts.

## Key files

- `shellStore.ts` — `useShellStore` (Zustand), `DEFAULT_SIDEBAR_WIDTH`, `DEFAULT_PROPERTIES_PANE_HEIGHT`, normalization helpers (`normalizeColumnVisibility`, `normalizeColumnOrder`, `normalizeColumnWidths`).
- `torrentSelectionStore.ts` — `useTorrentSelectionStore` (Zustand), `TorrentSelectionStore` interface, range selection using `useTorrentStore.getState().getSortedTorrents()`.
- `columnRegistry.ts` — `COLUMN_REGISTRY`, `COLUMN_MAP`, `SORTABLE_COLUMNS`, `SORTABLE_COLUMN_IDS`, `DEFERRED_COLUMNS`, `DEFERRED_COLUMN_IDS`, `ColumnDefinition`, `formatState`.
- `index.ts` — Re-exports above APIs; centralizes imports for desktop consumers. Does not re-export a transfer-dialog store (that concern has been migrated to the dialog-window system in `src/windows/dialogs/`).

## Design patterns

- Single source of truth: COLUMN_REGISTRY is canonical definition of every table column.
- Derived read-only maps/constants: COLUMN_MAP (O(1) lookup), DEFAULT_COLUMN_* computed from registry.
- Defensive normalization: normalizeColumnVisibility/Order/Widths enforce CUSTOMIZABLE_COLUMNS (registry-filtered to exclude deferred columns), clamp widths to minWidth.
- Immutable selection state: uses Set<string> copied on updates.
- Delegation to shared store: selection range operations call useTorrentStore (from @taurent/shared/stores).

## Integration

- UI components: TorrentTable, AppShell, and DetailPanel consume COLUMN_REGISTRY and shellStore preferences.
- Selection consumers: event handlers, keyboard handlers, command lists call useTorrentSelectionStore.
- Shared: imports Torrent type and formatters from @taurent/shared; columnRegistry.ts uses shared formatters.
- Re-exports via index.ts so other desktop modules import from 'apps/desktop/src/stores'.
