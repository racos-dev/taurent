export {
	useShellStore,
	DEFAULT_SIDEBAR_WIDTH,
	DEFAULT_COLUMN_VISIBILITY,
	DEFAULT_COLUMN_ORDER,
	DEFAULT_COLUMN_WIDTHS,
	normalizeColumnVisibility,
	normalizeColumnOrder,
	normalizeColumnWidths,
} from './shellStore';

export {
	COLUMN_REGISTRY,
	COLUMN_MAP,
	type ColumnDefinition,
} from './columnRegistry';

// Selection store (desktop-only)
export {
	useTorrentSelectionStore,
} from './torrentSelectionStore';
