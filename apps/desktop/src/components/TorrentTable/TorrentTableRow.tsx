import React, { useEffect, useRef, useCallback } from 'react';
import type { Torrent } from '@taurent/shared';
import { ProgressBar } from '@taurent/web-ui';
import type { ColumnDefinition } from '@/stores';
import { useTorrentSelectionStore } from '@/stores';
import { cn, count, isPerfAuditEnabled } from '@taurent/shared';

const DOUBLE_CLICK_DELAY = 300;

/**
 * Selection Behavior (Desktop Transfers Workspace)
 * =================================================
 *
 * Row selection uses stable torrent hashes as identity, never DOM indexes.
 *
 * Interaction Matrix:
 * +------------------+----------------------------+
 * | Input            | Action                     |
 * +------------------+----------------------------+
 * | Click            | Select only this row       |
 * | Ctrl/Cmd+Click   | Toggle this row in selection|
 * | Shift+Click      | Range select from anchor   |
 * | Double-click     | Open properties pane (noop)|
 * +------------------+----------------------------+
 *
 * Keyboard (wired in TorrentTable):
 * +------------------+----------------------------+
 * | Arrow Up/Down    | Move focused row            |
 * | Shift+Arrow      | Extend selection to focus  |
 * | Ctrl/Cmd+A       | Select all visible rows   |
 * | Escape           | Clear all selection        |
 * +------------------+----------------------------+
 *
 * The focusedHash targets the detail pane even when multiple rows are selected.
 */

const ALIGNMENT_CLASS_NAMES: Record<ColumnDefinition['align'], string> = {
  left: 'text-left',
  center: 'text-left',
  right: 'text-left',
};

const TRUNCATED_COLUMN_IDS = new Set([
  'name', 'category', 'save_path', 'state', 'tags', 'tracker',
  'download_path', 'infohash_v1', 'infohash_v2',
]);

interface TorrentTableRowProps {
  columns: ColumnDefinition[];
  columnWidths: Record<string, number>;
  torrent: Torrent;
  rowIndex: number;
  isSelected: boolean;
  isFocused: boolean;
  onClick: (torrent: Torrent) => void;
  onDoubleClick?: (torrent: Torrent) => void;
  style?: React.CSSProperties;
}

/** Serialize style values for memo comparison — stable string key. */
const styleKey = (style: React.CSSProperties | undefined) => {
  if (!style) return '';
  const { height, position, top, left, width, transform, ...rest } = style;
  return JSON.stringify({ height, position, top, left, width, transform, rest: rest ?? {} });
};

/** Inline cell content — rendered inside memoized IndividualCell. */
function CellContent({ column, torrent }: { column: ColumnDefinition; torrent: Torrent }) {
  if (column.id === 'name') {
    return (
      <span className="truncate text-xs text-text-primary" title={torrent.name}>
        {torrent.name}
      </span>
    );
  }

  if (column.id === 'progress') {
    return (
      <div className="min-w-0">
        <ProgressBar
          progress={torrent.progress}
          variant={torrent.progress >= 1 ? 'success' : 'default'}
          size="sm"
          showLabel
          labelFormat="percentage"
        />
      </div>
    );
  }

  const content = column.formatter(torrent);

  const title = TRUNCATED_COLUMN_IDS.has(column.id)
    ? (typeof content === 'string' ? content : undefined)
    : typeof content === 'string' || typeof content === 'number'
      ? String(content)
      : undefined;

  return (
    <span
      className={cn(
        'block text-xs text-text-secondary',
        TRUNCATED_COLUMN_IDS.has(column.id) && 'truncate'
      )}
      title={title}
    >
      {content}
    </span>
  );
}

/**
 * Per-cell memo — only the `<td>` whose column+width+torrent reference
 * is unchanged will skip re-rendering its content.
 * This narrows width-driven fan-out safely without hiding torrent field updates.
 */
interface IndividualCellProps {
  column: ColumnDefinition;
  width: number;
  torrent: Torrent;
}

const cellPropsAreEqual = (
  prev: IndividualCellProps,
  next: IndividualCellProps,
): boolean => {
  return (
    prev.column === next.column &&
    prev.width === next.width &&
    prev.torrent === next.torrent
  );
};

const IndividualCell = React.memo(
  ({ column, width, torrent }: IndividualCellProps) => (
    <td
      className={cn(
        'px-1 py-0 align-middle text-xs overflow-hidden h-[26px]',
        ALIGNMENT_CLASS_NAMES[column.align]
      )}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <CellContent column={column} torrent={torrent} />
    </td>
  ),
  cellPropsAreEqual
);

IndividualCell.displayName = 'IndividualCell';

interface RowCellsProps {
  columns: ColumnDefinition[];
  columnWidths: Record<string, number>;
  torrent: Torrent;
}

/** Audit probe for the RowCells shell — tracks row cell-layer rerenders before per-cell memo skips. */
function RowCellsRenderAudit({
  torrent,
  columns,
  columnWidths,
}: Pick<RowCellsProps, 'columns' | 'columnWidths' | 'torrent'>) {
  const prevPropsRef = useRef<{
    torrent: Torrent;
    columns: ColumnDefinition[];
    columnWidths: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    const prev = prevPropsRef.current;
    let matched = false;
    if (prev) {
      if (prev.torrent !== torrent) {
        count('render.TorrentTableRow.cells', 'torrent');
        matched = true;
      }
      if (prev.columns !== columns) {
        count('render.TorrentTableRow.cells', 'columns');
        matched = true;
      }
      if (prev.columnWidths !== columnWidths) {
        count('render.TorrentTableRow.cells', 'columnWidths');
        matched = true;
      }
      if (!matched) {
        count('render.TorrentTableRow.cells', 'other');
      }
    } else {
      count('render.TorrentTableRow.cells', 'initial');
    }

    prevPropsRef.current = {
      torrent,
      columns,
      columnWidths,
    };
    count('render.TorrentTableRow.cells', 'render');
  });

  return null;
}

const rowCellsPropsAreEqual = (
  prev: RowCellsProps,
  next: RowCellsProps,
): boolean => {
  return (
    prev.torrent === next.torrent &&
    prev.torrent.hash === next.torrent.hash &&
    prev.columns === next.columns &&
    prev.columnWidths === next.columnWidths
  );
};

/**
 * RowCells is a lightweight shell — it maps over columns and renders an
 * IndividualCell for each one. It may re-render when torrent/columns/widths change,
 * but width-only updates are narrowed to the affected cells instead of forcing
 * every cell in the row to recompute its content.
 */
const RowCells = React.memo(
  ({ columns, columnWidths, torrent }: RowCellsProps) => {
    const showRenderAudit = isPerfAuditEnabled();

    return (
      <>
        {columns.map((column) => (
          <IndividualCell
            key={column.id}
            column={column}
            width={columnWidths[column.id] ?? column.minWidth}
            torrent={torrent}
          />
        ))}
        {showRenderAudit ? (
          <RowCellsRenderAudit
            columns={columns}
            columnWidths={columnWidths}
            torrent={torrent}
          />
        ) : null}
      </>
    );
  },
  rowCellsPropsAreEqual
);

RowCells.displayName = 'RowCells';

/** Audit probe for the outer `<tr>` — tracks all row-level re-renders separately from cell renders. */
function RowOuterRenderAudit({
  torrent,
  rowIndex,
  isSelected,
  isFocused,
  columns,
  columnWidths,
  style,
}: {
  torrent: Torrent;
  rowIndex: number;
  isSelected: boolean;
  isFocused: boolean;
  columns: ColumnDefinition[];
  columnWidths: Record<string, number>;
  style?: React.CSSProperties;
}) {
  const prevPropsRef = useRef<{
    torrent: Torrent;
    isSelected: boolean;
    isFocused: boolean;
    rowIndex: number;
    columns: ColumnDefinition[];
    columnWidths: Record<string, number>;
    styleKey: string;
  } | null>(null);

  useEffect(() => {
    const prev = prevPropsRef.current;
    const nextStyleKey = styleKey(style);
    let matched = false;
    if (prev) {
      if (prev.torrent !== torrent) {
        count('render.TorrentTableRow.outer', 'torrent');
        matched = true;
      }
      if (prev.isSelected !== isSelected) {
        count('render.TorrentTableRow.outer', 'isSelected');
        matched = true;
      }
      if (prev.isFocused !== isFocused) {
        count('render.TorrentTableRow.outer', 'isFocused');
        matched = true;
      }
      if (prev.rowIndex !== rowIndex) {
        count('render.TorrentTableRow.outer', 'rowIndex');
        matched = true;
      }
      if (prev.columns !== columns) {
        count('render.TorrentTableRow.outer', 'columns');
        matched = true;
      }
      if (prev.columnWidths !== columnWidths) {
        count('render.TorrentTableRow.outer', 'columnWidths');
        matched = true;
      }
      if (prev.styleKey !== nextStyleKey) {
        count('render.TorrentTableRow.outer', 'style');
        matched = true;
      }
      if (!matched) {
        count('render.TorrentTableRow.outer', 'other');
      }
    } else {
      count('render.TorrentTableRow.outer', 'initial');
    }

    prevPropsRef.current = {
      torrent,
      isSelected,
      isFocused,
      rowIndex,
      columns,
      columnWidths,
      styleKey: nextStyleKey,
    };
    count('render.TorrentTableRow.outer', 'render');
  });

  return null;
}
const propsAreEqual = (
  prev: TorrentTableRowProps,
  next: TorrentTableRowProps,
): boolean => {
  return (
    prev.torrent === next.torrent &&
    prev.torrent.hash === next.torrent.hash &&
    prev.rowIndex === next.rowIndex &&
    prev.isSelected === next.isSelected &&
    prev.isFocused === next.isFocused &&
    prev.columns === next.columns &&
    prev.columnWidths === next.columnWidths &&
    styleKey(prev.style) === styleKey(next.style)
  );
};

/**
 * Outer `<tr>` that owns `style` (for virtualization positioning), event handlers,
 * and the click-timeout ref for double-click cancellation.
 * Renders `RowCells` (the expensive cell-content) as children — `RowCells` is memoized
 * and will NOT re-render when only `style` changes.
 * The `<tr>` itself may re-render for style updates, but cell memo prevents the
 * expensive inner rendering from churning on every scroll position change.
 */
export const TorrentTableRow = React.memo(
  ({
    columns,
    columnWidths,
    torrent,
    rowIndex,
    isSelected,
    isFocused,
    onClick,
    onDoubleClick,
    style,
  }: TorrentTableRowProps) => {
    const clickTimeoutRef = useRef<number | null>(null);
    const onClickRef = useRef(onClick);
    const onDoubleClickRef = useRef(onDoubleClick);

    useEffect(() => {
      onClickRef.current = onClick;
      onDoubleClickRef.current = onDoubleClick;
    }, [onClick, onDoubleClick]);

    useEffect(() => {
      return () => {
        const timeout = clickTimeoutRef.current;
        if (timeout !== null) {
          window.clearTimeout(timeout);
        }
      };
    }, []);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        const { selectTorrent, toggleTorrent } = useTorrentSelectionStore.getState();

        if (e.shiftKey) {
          selectTorrent(torrent.hash, false, true);
          return;
        }

        if (e.ctrlKey || e.metaKey) {
          toggleTorrent(torrent.hash);
          return;
        }

        if (clickTimeoutRef.current !== null) {
          window.clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }

        if (!onDoubleClickRef.current) {
          selectTorrent(torrent.hash, false, false);
          onClickRef.current?.(torrent);
          return;
        }

        clickTimeoutRef.current = window.setTimeout(() => {
          selectTorrent(torrent.hash, false, false);
          onClickRef.current?.(torrent);
          clickTimeoutRef.current = null;
        }, DOUBLE_CLICK_DELAY);
      },
      [torrent]
    );

    const handleDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        if (clickTimeoutRef.current !== null) {
          window.clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }

        if (e.ctrlKey || e.metaKey) {
          return;
        }

        onDoubleClickRef.current?.(torrent);
      },
      [torrent]
    );

    return (
      <tr
        data-index={rowIndex}
        data-testid="torrent-row"
        data-torrent-hash={torrent.hash}
        data-torrent-name={torrent.name}
        data-torrent-state={torrent.state}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={style}
        className={cn(
          'select-none cursor-pointer transition-colors h-[26px] w-full',
          isSelected
            ? 'bg-primary-20 hover:bg-primary-20'
            : rowIndex % 2 === 0
              ? 'bg-surface-elevated/40 hover:bg-surface-interactive'
              : 'bg-surface hover:bg-surface-interactive',
          isSelected && isFocused && 'ring-1 ring-inset ring-primary-30'
        )}
      >
        <RowCells
          columns={columns}
          columnWidths={columnWidths}
          torrent={torrent}
        />
        {isPerfAuditEnabled() ? (
          <RowOuterRenderAudit
            torrent={torrent}
            rowIndex={rowIndex}
            isSelected={isSelected}
            isFocused={isFocused}
            columns={columns}
            columnWidths={columnWidths}
            style={style}
          />
        ) : null}
      </tr>
    );
  },
  propsAreEqual
);

TorrentTableRow.displayName = 'TorrentTableRow';
