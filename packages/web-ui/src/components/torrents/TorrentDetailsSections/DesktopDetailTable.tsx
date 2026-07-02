import React from 'react';
import { cn, Icon } from '@taurent/shared';

export type DesktopDetailTableSortDirection = 'asc' | 'desc';

export interface DesktopDetailTableColumn<T> {
  id: string;
  label: React.ReactNode;
  width: number;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  renderCell: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DesktopDetailTableProps<T> {
  columns: DesktopDetailTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  activeRowKey?: string | null;
  sortColumnId?: string | null;
  sortDirection?: DesktopDetailTableSortDirection;
  onSortChange?: (columnId: string) => void;
  onRowClick?: (row: T) => void;
  onRowContextMenu?: (event: React.MouseEvent<HTMLTableRowElement>, row: T) => void;
  onTableContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  getRowClassName?: (row: T) => string | undefined;
}

const ALIGNMENT_CLASS_NAMES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function DesktopDetailTable<T>({
  columns,
  rows,
  rowKey,
  activeRowKey = null,
  sortColumnId = null,
  sortDirection = 'asc',
  onSortChange,
  onRowClick,
  onRowContextMenu,
  onTableContextMenu,
  getRowClassName,
}: DesktopDetailTableProps<T>) {
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(() => (
    columns.reduce<Record<string, number>>((acc, column) => {
      acc[column.id] = column.width;
      return acc;
    }, {})
  ));
  const [isResizing, setIsResizing] = React.useState(false);

  const resizeStateRef = React.useRef<{
    columnId: string;
    startWidth: number;
    startX: number;
    minWidth: number;
  } | null>(null);

  React.useEffect(() => {
    setColumnWidths((current) => {
      const next = { ...current };
      let changed = false;

      for (const column of columns) {
        if (next[column.id] == null) {
          next[column.id] = column.width;
          changed = true;
        }
      }

      for (const key of Object.keys(next)) {
        if (!columns.some((column) => column.id === key)) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [columns]);

  React.useEffect(() => {
    if (!isResizing || !resizeStateRef.current) {
      return undefined;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStateRef.current) {
        return;
      }

      const { columnId, startWidth, startX, minWidth } = resizeStateRef.current;
      const nextWidth = Math.max(minWidth, startWidth + event.clientX - startX);

      setColumnWidths((current) => ({
        ...current,
        [columnId]: nextWidth,
      }));
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const totalWidth = columns.reduce((sum, column) => sum + (columnWidths[column.id] ?? column.width), 0);

  return (
    <div
      className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface"
      onContextMenu={onTableContextMenu}
    >
      <table className="w-full border-separate border-spacing-0 text-xs" style={{ minWidth: totalWidth, tableLayout: 'fixed' }}>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((column) => {
              const width = columnWidths[column.id] ?? column.width;
              const isSorted = sortColumnId === column.id;
              const align = column.align ?? 'left';

              return (
                <th
                  key={column.id}
                  scope="col"
                  style={{ width, minWidth: width, maxWidth: width }}
                  className={cn(
                    'group relative border-b border-border bg-surface px-1 py-1 text-xs font-medium text-text-secondary select-none',
                    ALIGNMENT_CLASS_NAMES[align],
                    column.sortable ? 'cursor-pointer hover:bg-surface-interactive hover:text-text-primary' : 'cursor-default',
                    column.headerClassName
                  )}
                  onClick={() => {
                    if (column.sortable) {
                      onSortChange?.(column.id);
                    }
                  }}
                >
                  <span className={cn(
                    'flex items-center gap-1 pr-2',
                    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
                  )}>
                    <span className="truncate" title={typeof column.label === 'string' ? column.label : undefined}>{column.label}</span>
                    {isSorted ? (
                      <Icon
                        name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                        className="h-3 w-3 shrink-0 text-primary"
                      />
                    ) : null}
                  </span>

                  <button
                    type="button"
                    aria-label={`Resize ${typeof column.label === 'string' ? column.label : 'column'}`}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      resizeStateRef.current = {
                        columnId: column.id,
                        startWidth: width,
                        startX: event.clientX,
                        minWidth: column.minWidth ?? Math.min(column.width, 72),
                      };
                      setIsResizing(true);
                    }}
                    className="absolute inset-y-0 right-0 w-2 cursor-col-resize bg-transparent opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const key = rowKey(row);
            const isActive = activeRowKey === key;

            return (
              <tr
                key={key}
                onClick={() => { onRowClick?.(row); }}
                onContextMenu={(event) => {
                  if (onRowContextMenu) {
                    event.stopPropagation();
                    onRowContextMenu(event, row);
                  }
                }}
                className={cn(
                  'transition-colors',
                  onRowContextMenu ? 'select-none' : undefined,
                  onRowClick || onRowContextMenu ? 'cursor-pointer' : undefined,
                  isActive
                    ? 'bg-primary-20 ring-1 ring-inset ring-primary-30 hover:bg-primary-20'
                    : index % 2 === 0
                      ? 'bg-surface hover:bg-surface-interactive'
                      : 'bg-surface-elevated/40 hover:bg-surface-interactive',
                  getRowClassName?.(row)
                )}
              >
                {columns.map((column) => {
                  const width = columnWidths[column.id] ?? column.width;
                  const align = column.align ?? 'left';

                  return (
                    <td
                      key={column.id}
                      style={{ width, minWidth: width, maxWidth: width }}
                      className={cn(
                        'px-1 py-0 align-middle text-xs',
                        ALIGNMENT_CLASS_NAMES[align],
                        column.cellClassName
                      )}
                    >
                      {column.renderCell(row)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
