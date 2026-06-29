import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, cn, count, isPerfAuditEnabled } from '@taurent/shared';
import type { Torrent } from '@taurent/shared';
import type { SortField, SortDirection } from '@taurent/shared/stores';
import {
  COLUMN_MAP,
  COLUMN_REGISTRY,
  DEFAULT_COLUMN_ORDER,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_COLUMN_WIDTHS,
  normalizeColumnOrder,
  normalizeColumnVisibility,
  normalizeColumnWidths,
  type ColumnDefinition,
  useShellStore,
  useTorrentSelectionStore,
} from '@/stores';
import { usePreferences } from '@/hooks';
import { HeaderContextMenu, type ColumnMoveDirection } from './HeaderContextMenu';
import { TorrentTableRow } from './TorrentTableRow';

interface TorrentTableProps {
  torrents: Torrent[];
  selectedHashes: Set<string>;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onTorrentClick: (torrent: Torrent) => void;
  onDoubleClick?: (torrent: Torrent) => void;
  onRightClick?: (e: React.MouseEvent, torrent: Torrent, isSelected: boolean) => void;
  onBlankSpaceClick?: () => void;
}

function TorrentTableRenderAudit({
  torrents,
  selectedHashes,
  sortField,
  sortDirection,
  focusedHash,
  columnOrder,
  columnVisibility,
  columnWidths,
  contextMenuOpen,
  activeColumnId,
  visibleColumns,
  tableMinWidth,
  queueingEnabled,
  availableVisibleColumnIds,
}: {
  torrents: Torrent[];
  selectedHashes: Set<string>;
  sortField: SortField;
  sortDirection: SortDirection;
  focusedHash: string | null;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnWidths: Record<string, number>;
  contextMenuOpen: boolean;
  activeColumnId: string | null;
  /** visibleColumns array identity — derived from columnOrder, columnVisibility, queueingEnabled */
  visibleColumns: ColumnDefinition[];
  /** tableMinWidth value — recomputed from columnWidths and visibleColumns */
  tableMinWidth: number;
  /** queueingEnabled from preferences — gates priority column visibility */
  queueingEnabled: boolean;
  /** availableVisibleColumnIds array identity — used by context menu */
  availableVisibleColumnIds: string[];
}) {
  const prevRef = useRef<{
    torrents: Torrent[];
    selectedHashes: Set<string>;
    sortField: SortField;
    sortDirection: SortDirection;
    focusedHash: string | null;
    columnOrder: string[];
    columnVisibility: Record<string, boolean>;
    columnWidths: Record<string, number>;
    contextMenuOpen: boolean;
    activeColumnId: string | null;
    visibleColumns: ColumnDefinition[];
    tableMinWidth: number;
    queueingEnabled: boolean;
    availableVisibleColumnIds: string[];
  } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    let matched = false;
    if (prev) {
      if (prev.torrents !== torrents) {
        count('render.TorrentTable.reason', 'torrents');
        matched = true;
      }
      if (prev.selectedHashes !== selectedHashes) {
        count('render.TorrentTable.reason', 'selectedHashes');
        matched = true;
      }
      if (prev.sortField !== sortField) {
        count('render.TorrentTable.reason', 'sortField');
        matched = true;
      }
      if (prev.sortDirection !== sortDirection) {
        count('render.TorrentTable.reason', 'sortDirection');
        matched = true;
      }
      if (prev.focusedHash !== focusedHash) {
        count('render.TorrentTable.reason', 'focusedHash');
        matched = true;
      }
      if (prev.columnOrder !== columnOrder) {
        count('render.TorrentTable.reason', 'columnOrder');
        matched = true;
      }
      if (prev.columnVisibility !== columnVisibility) {
        count('render.TorrentTable.reason', 'columnVisibility');
        matched = true;
      }
      if (prev.columnWidths !== columnWidths) {
        count('render.TorrentTable.reason', 'columnWidths');
        matched = true;
      }
      if (prev.contextMenuOpen !== contextMenuOpen) {
        count('render.TorrentTable.reason', 'contextMenu');
        matched = true;
      }
      if (prev.activeColumnId !== activeColumnId) {
        count('render.TorrentTable.reason', 'activeColumn');
        matched = true;
      }
      // ── previously bucketed as "other" — now explicit ──────────────────────
      if (prev.visibleColumns !== visibleColumns) {
        count('render.TorrentTable.reason', 'visibleColumns');
        matched = true;
      }
      if (prev.tableMinWidth !== tableMinWidth) {
        count('render.TorrentTable.reason', 'tableMinWidth');
        matched = true;
      }
      if (prev.queueingEnabled !== queueingEnabled) {
        count('render.TorrentTable.reason', 'queueingEnabled');
        matched = true;
      }
      if (prev.availableVisibleColumnIds !== availableVisibleColumnIds) {
        count('render.TorrentTable.reason', 'availableVisibleColumnIds');
        matched = true;
      }
      if (!matched) {
        count('render.TorrentTable.reason', 'other');
      }
    } else {
      count('render.TorrentTable.reason', 'initial');
    }

    prevRef.current = {
      torrents,
      selectedHashes,
      sortField,
      sortDirection,
      focusedHash,
      columnOrder,
      columnVisibility,
      columnWidths,
      contextMenuOpen,
      activeColumnId,
      visibleColumns,
      tableMinWidth,
      queueingEnabled,
      availableVisibleColumnIds,
    };
    count('render.TorrentTable', 'render');
  });

  return null;
}

const ROW_HEIGHT = 26;

// Approximate average character width for 12px system-ui font when canvas measurement is unavailable.
const FALLBACK_CHAR_WIDTH = 7;

const ALIGNMENT_CLASS_NAMES: Record<ColumnDefinition['align'], string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const CONTENT_ALIGNMENT_CLASS_NAMES: Record<ColumnDefinition['align'], string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const measureTextWidth = (text: string, context: CanvasRenderingContext2D | null) => (
  context ? context.measureText(text).width : text.length * FALLBACK_CHAR_WIDTH
);

const getColumnAutoFitWidth = (column: ColumnDefinition, torrents: Torrent[]) => {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const context = canvas?.getContext('2d') ?? null;

  if (context) {
    context.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  }

  let maxTextWidth = measureTextWidth(column.label, context);

  for (const torrent of torrents) {
    const content = column.id === 'name' ? torrent.name : column.formatter(torrent);
    if (typeof content === 'string' || typeof content === 'number') {
      maxTextWidth = Math.max(maxTextWidth, measureTextWidth(String(content), context));
    }
  }

  const chromeWidth = column.id === 'progress' ? 104 : column.sortable ? 28 : 16;
  return Math.max(column.minWidth, Math.ceil(maxTextWidth + chromeWidth));
};

interface SortableThProps {
  column: ColumnDefinition;
  columnWidth: number;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onColumnWidthChange: (columnId: string, width: number) => void;
  onResizeToFit: (columnId: string) => void;
  onColumnContextMenu: (columnId: string, x: number, y: number) => void;
}

function SortableThInner({
  column,
  columnWidth,
  sortField,
  sortDirection,
  onSort,
  onColumnWidthChange,
  onResizeToFit,
  onColumnContextMenu,
}: SortableThProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: column.id });

  const isActive = column.sortable && sortField === column.field;
  const resizeStateRef = useRef<{ startWidth: number; startX: number } | null>(null);
  const ignoreNextSortRef = useRef(false);

  const handleSort = () => {
    if (!column.sortable || ignoreNextSortRef.current) {
      return;
    }
    onSort(column.field as SortField);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLTableCellElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onColumnContextMenu(column.id, event.clientX, event.clientY);
  };

  const style: React.CSSProperties = {
    width: columnWidth,
    minWidth: columnWidth,
    maxWidth: columnWidth,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      scope="col"
      data-testid="torrent-header-cell"
      data-column-id={column.id}
      title={column.sortable ? `${column.label} — drag to reorder` : 'Drag to reorder'}
      onClick={handleSort}
      onContextMenu={handleContextMenu}
      className={cn(
        'group relative border-b border-border bg-surface px-1 py-1 text-xs font-medium text-text-secondary select-none',
        ALIGNMENT_CLASS_NAMES[column.align],
        column.sortable ? 'cursor-pointer hover:bg-surface-interactive hover:text-text-primary' : 'cursor-default',
        isDragging && 'bg-surface-interactive/50'
      )}
      style={style}
      {...attributes}
      {...listeners}
    >
      <span className={cn('flex items-center gap-1 pr-2', CONTENT_ALIGNMENT_CLASS_NAMES[column.align])}>
        <span className="truncate">{column.label}</span>
        {isActive ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-3 w-3 shrink-0 text-primary" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
          )
        ) : null}
      </span>

      {column.resizable ? (
        <button
          type="button"
          aria-label={`Resize ${column.label} column`}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            // Critical: stop propagation BEFORE dnd-kit's PointerSensor can register the pointermove.
            // This prevents the resize handle from accidentally triggering a column drag.
            event.stopPropagation();
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            ignoreNextSortRef.current = true;
            resizeStateRef.current = {
              startWidth: columnWidth,
              startX: event.clientX,
            };

            const handleMouseMove = (moveEvent: MouseEvent) => {
              if (!resizeStateRef.current) return;
              const nextWidth = resizeStateRef.current.startWidth + moveEvent.clientX - resizeStateRef.current.startX;
              onColumnWidthChange(column.id, Math.max(column.minWidth, nextWidth));
            };

            const handleMouseUp = () => {
              resizeStateRef.current = null;
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            resizeStateRef.current = null;
            ignoreNextSortRef.current = true;
            onResizeToFit(column.id);
            window.setTimeout(() => {
              ignoreNextSortRef.current = false;
            }, 0);
          }}
          className="absolute inset-y-0 right-0 w-2 cursor-col-resize bg-transparent opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        />
      ) : null}
    </th>
  );
}

// Memoize SortableTh so a stable onSort doesn't churn header cells on unrelated HomeScreen renders.
// The memo comparison uses shallow equality for all props — onSort is stable via useCallback in HomeScreen,
// setColumnWidth is a stable Zustand action, and handleColumnContextMenu has no dependencies.
const SortableTh = React.memo(SortableThInner);

export const TorrentTable: React.FC<TorrentTableProps> = ({
  torrents,
  selectedHashes,
  sortField,
  sortDirection,
  onSort,
  onTorrentClick,
  onDoubleClick,
  onRightClick,
  onBlankSpaceClick,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const shellColumnVisibility = useShellStore((state) => state.columnVisibility);
  const shellColumnOrder = useShellStore((state) => state.columnOrder);
  const shellColumnWidths = useShellStore((state) => state.columnWidths);
  const setColumnOrder = useShellStore((state) => state.setColumnOrder);
  const setColumnWidth = useShellStore((state) => state.setColumnWidth);
  const setColumnWidths = useShellStore((state) => state.setColumnWidths);
  const setColumnVisibility = useShellStore((state) => state.setColumnVisibility);
  const focusedHash = useTorrentSelectionStore((state) => state.focusedHash);
  const { preferences } = usePreferences();

  const renderAuditEnabledRef = useRef<boolean | null>(null);
  if (renderAuditEnabledRef.current === null) {
    renderAuditEnabledRef.current = isPerfAuditEnabled();
  }

  // Columns available for display — suppress priority column when queueing is disabled
  const queueingEnabled = preferences?.queueing_enabled ?? true;
  const availableColumns = useMemo(
    () => (queueingEnabled ? COLUMN_REGISTRY : COLUMN_REGISTRY.filter((col) => col.id !== 'priority')),
    [queueingEnabled]
  );

  // Header context menu state
  const [contextMenu, setContextMenu] = useState<{ columnId: string; x: number; y: number } | null>(null);

  const columnVisibility = useMemo(
    () => normalizeColumnVisibility(shellColumnVisibility),
    [shellColumnVisibility]
  );

  const columnOrder = useMemo(
    () => normalizeColumnOrder(shellColumnOrder),
    [shellColumnOrder]
  );

  const columnWidths = useMemo(
    () => normalizeColumnWidths(shellColumnWidths),
    [shellColumnWidths]
  );

  const visibleColumns = useMemo(
    () => columnOrder
      .map((columnId) => COLUMN_MAP[columnId])
      .filter((column): column is ColumnDefinition =>
        Boolean(column) &&
        columnVisibility[column.id] &&
        // Suppress priority column when queueing is disabled
        (column.id !== 'priority' || queueingEnabled)
      ),
    [columnOrder, columnVisibility, queueingEnabled]
  );

  // Visible column IDs for context menu — also excludes priority when queueing disabled
  const availableVisibleColumnIds = useMemo(
    () =>
      columnOrder.filter(
        (id) =>
          columnVisibility[id] &&
          // Suppress priority column when queueing is disabled
          (id !== 'priority' || queueingEnabled)
      ),
    [columnOrder, columnVisibility, queueingEnabled]
  );

  const tableMinWidth = useMemo(
    () => visibleColumns.reduce((totalWidth, column) => totalWidth + (columnWidths[column.id] ?? column.minWidth), 0),
    [columnWidths, visibleColumns]
  );

  const handleReorderColumns = useCallback((activeId: string, overId: string) => {
    const visibleColumnIds = columnOrder.filter((id) => columnVisibility[id]);
    const activeIndex = visibleColumnIds.indexOf(activeId);
    const overIndex = visibleColumnIds.indexOf(overId);

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    const nextVisibleColumnIds = [...visibleColumnIds];
    const [moved] = nextVisibleColumnIds.splice(activeIndex, 1);
    nextVisibleColumnIds.splice(overIndex, 0, moved);

    let nextVisibleIndex = 0;
    const nextOrder = columnOrder.map((id) => {
      if (!columnVisibility[id]) {
        return id;
      }
      const result = nextVisibleColumnIds[nextVisibleIndex];
      nextVisibleIndex += 1;
      return result;
    });

    setColumnOrder(nextOrder);
  }, [columnOrder, columnVisibility, setColumnOrder]);

  // Header context menu handlers
  const handleColumnContextMenu = useCallback((columnId: string, x: number, y: number) => {
    setContextMenu({ columnId, x, y });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleMoveColumn = useCallback((columnId: string, direction: ColumnMoveDirection) => {
    const visibleColumnIds = columnOrder.filter((id) => columnVisibility[id]);
    const currentIndex = visibleColumnIds.indexOf(columnId);
    if (currentIndex === -1) return;

    let nextVisibleColumnIds: string[];
    switch (direction) {
      case 'start':
        nextVisibleColumnIds = [columnId, ...visibleColumnIds.filter((id) => id !== columnId)];
        break;
      case 'end':
        nextVisibleColumnIds = [...visibleColumnIds.filter((id) => id !== columnId), columnId];
        break;
      case 'left':
        if (currentIndex <= 0) return;
        nextVisibleColumnIds = [...visibleColumnIds];
        [nextVisibleColumnIds[currentIndex - 1], nextVisibleColumnIds[currentIndex]] =
          [nextVisibleColumnIds[currentIndex], nextVisibleColumnIds[currentIndex - 1]];
        break;
      case 'right':
        if (currentIndex >= visibleColumnIds.length - 1) return;
        nextVisibleColumnIds = [...visibleColumnIds];
        [nextVisibleColumnIds[currentIndex], nextVisibleColumnIds[currentIndex + 1]] =
          [nextVisibleColumnIds[currentIndex + 1], nextVisibleColumnIds[currentIndex]];
        break;
      default:
        return;
    }

    let nextVisibleIndex = 0;
    const nextOrder = columnOrder.map((id) => {
      if (!columnVisibility[id]) return id;
      return nextVisibleColumnIds[nextVisibleIndex++];
    });

    setColumnOrder(nextOrder);
  }, [columnOrder, columnVisibility, setColumnOrder]);

  const handleToggleColumn = useCallback((columnId: string) => {
    const currentVisibility = columnVisibility[columnId] ?? true;
    // Prevent hiding the last visible column
    const visibleCount = Object.values(columnVisibility).filter(Boolean).length;
    if (currentVisibility && visibleCount <= 1) return;

    setColumnVisibility({ ...columnVisibility, [columnId]: !currentVisibility });
  }, [columnVisibility, setColumnVisibility]);

  const handleResizeToFit = useCallback((columnId: string) => {
    if (torrents.length === 0) return;
    const column = COLUMN_MAP[columnId];
    if (!column) return;

    setColumnWidth(columnId, getColumnAutoFitWidth(column, torrents));
  }, [torrents, setColumnWidth]);

  const handleResizeAllToFit = useCallback(() => {
    if (torrents.length === 0) return;

    const newWidths: Record<string, number> = { ...shellColumnWidths };

    for (const column of visibleColumns) {
      newWidths[column.id] = getColumnAutoFitWidth(column, torrents);
    }

    useShellStore.getState().setColumnWidths(newWidths);
  }, [torrents, visibleColumns, shellColumnWidths]);

  const handleRestoreDefaults = useCallback(() => {
    setColumnOrder([...DEFAULT_COLUMN_ORDER]);
    setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY });
    setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
  }, [setColumnOrder, setColumnVisibility, setColumnWidths]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const { focusedHash, anchorHash, setFocusedHash, selectTorrent, selectAll, deselectAll } = useTorrentSelectionStore.getState();
    const hashList = torrents.map((t) => t.hash);
    const currentIndex = focusedHash ? hashList.indexOf(focusedHash) : -1;

    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault();
        if (currentIndex > 0) {
          const prevHash = hashList[currentIndex - 1];
          if (e.shiftKey && anchorHash) {
            selectTorrent(prevHash, false, true);
          } else {
            setFocusedHash(prevHash);
          }
        } else if (currentIndex === -1 && hashList.length > 0) {
          setFocusedHash(hashList[0]);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (currentIndex < hashList.length - 1) {
          const nextHash = hashList[currentIndex + 1];
          if (e.shiftKey && anchorHash) {
            selectTorrent(nextHash, false, true);
          } else {
            setFocusedHash(nextHash);
          }
        } else if (currentIndex === -1 && hashList.length > 0) {
          setFocusedHash(hashList[hashList.length - 1]);
        }
        break;
      }
      case 'a':
      case 'A': {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          selectAll();
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        deselectAll();
        break;
      }
    }
  };

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      handleReorderColumns(String(active.id), String(over.id));
    }
  };

  const activeColumn = activeDragId ? visibleColumns.find((c) => c.id === activeDragId) : null;
  const columnIds = visibleColumns.map((c) => c.id);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual exposes non-memoizable functions; this component keeps memoized values out of those callbacks.
  const virtualizer = useVirtualizer({
    count: torrents.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
    getItemKey: (index) => torrents[index]?.hash ?? index,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const enableVirtualization = torrents.length > 20;

  const renderColGroup = () => (
    <colgroup>
      {visibleColumns.map((column) => {
        const width = columnWidths[column.id] ?? column.minWidth;

        return (
          <col
            key={column.id}
            style={{ width, minWidth: width }}
          />
        );
      })}
    </colgroup>
  );

  const renderHeaderRow = () => (
    <tr>
      {visibleColumns.map((column) => (
        <SortableTh
          key={column.id}
          column={column}
          columnWidth={columnWidths[column.id] ?? column.minWidth}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={onSort}
          onColumnWidthChange={setColumnWidth}
          onResizeToFit={handleResizeToFit}
          onColumnContextMenu={handleColumnContextMenu}
        />
      ))}
    </tr>
  );

  const handleBlankSpaceContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onBlankSpaceClick) {
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest('tr') || target.closest('thead')) {
      return;
    }

    onBlankSpaceClick();
  }, [onBlankSpaceClick]);

  if (!enableVirtualization) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div
            ref={parentRef}
            className="flex flex-col h-full"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onClick={handleBlankSpaceContainerClick}
            onContextMenu={(e) => {
              if (onRightClick) {
                const target = e.target as HTMLElement;
                const row = target.closest('tr');
                if (row?.hasAttribute('data-index')) {
                  const index = parseInt(row.getAttribute('data-index') || '0');
                  const torrent = torrents[index];
                  if (torrent) {
                    const isSelected = selectedHashes.has(torrent.hash);
                    onRightClick(e, torrent, isSelected);
                  }
                }
              }
            }}
          >
            {/* Single scroll container for horizontal + vertical scroll */}
            <div className="flex-1 min-h-0 overflow-auto">
              {/* Header */}
              <div className="flex-none">
<table className="border-collapse table-fixed" style={{ width: `${tableMinWidth}px` }}>
                  {renderColGroup()}
                  <thead className="sticky top-0 z-10 bg-surface">
                    {renderHeaderRow()}
                  </thead>
                </table>
              </div>

              {/* Body */}
              <div className="relative" style={{ width: `${tableMinWidth}px` }}>
                <table className="border-collapse table-fixed" style={{ width: `${tableMinWidth}px` }} data-testid="torrent-table">
                  {renderColGroup()}
                  <tbody>
                    {torrents.map((torrent, index) => {
                      const isSelected = selectedHashes.has(torrent.hash);
                      return (
                        <TorrentTableRow
                          key={torrent.hash}
                          columns={visibleColumns}
                          columnWidths={columnWidths}
                          torrent={torrent}
                          rowIndex={index}
                          isSelected={isSelected}
                          isFocused={focusedHash === torrent.hash}
                          onClick={onTorrentClick}
                          onDoubleClick={onDoubleClick}
                          style={{ height: `${ROW_HEIGHT}px` }}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeColumn ? (
            <div
            className="shadow-lg border border-primary/30 bg-surface-elevated rounded-md"
              style={{
                width: columnWidths[activeColumn.id] ?? activeColumn.minWidth,
                minWidth: columnWidths[activeColumn.id] ?? activeColumn.minWidth,
                maxWidth: columnWidths[activeColumn.id] ?? activeColumn.minWidth,
              }}
            >
              <div className="flex items-center gap-1 px-1 py-1 text-xs font-medium text-text-primary truncate">
                {activeColumn.label}
              </div>
            </div>
          ) : null}
        </DragOverlay>
        {contextMenu && createPortal(
          <HeaderContextMenu
            activeColumn={COLUMN_MAP[contextMenu.columnId] ?? null}
            allColumns={availableColumns}
            columnVisibility={columnVisibility}
            visibleColumnIds={availableVisibleColumnIds}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={handleCloseContextMenu}
            onMoveColumn={handleMoveColumn}
            onResizeAllToFit={handleResizeAllToFit}
            onResizeToFit={handleResizeToFit}
            onRestoreDefaults={handleRestoreDefaults}
            onToggleColumn={handleToggleColumn}
          />,
          document.body
        )}
        {renderAuditEnabledRef.current ? (
          <TorrentTableRenderAudit
            torrents={torrents}
            selectedHashes={selectedHashes}
            sortField={sortField}
            sortDirection={sortDirection}
            focusedHash={focusedHash}
            columnOrder={columnOrder}
            columnVisibility={columnVisibility}
            columnWidths={columnWidths}
            contextMenuOpen={Boolean(contextMenu)}
            activeColumnId={activeColumn?.id ?? null}
            visibleColumns={visibleColumns}
            tableMinWidth={tableMinWidth}
            queueingEnabled={queueingEnabled}
            availableVisibleColumnIds={availableVisibleColumnIds}
          />
        ) : null}
      </DndContext>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
        <div
          ref={parentRef}
          className="flex flex-col h-full"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={handleBlankSpaceContainerClick}
          onContextMenu={(e) => {
            if (onRightClick) {
              const target = e.target as HTMLElement;
              const row = target.closest('tr');
              if (row?.hasAttribute('data-index')) {
                const index = parseInt(row.getAttribute('data-index') || '0');
                const torrent = torrents[index];
                if (torrent) {
                  const isSelected = selectedHashes.has(torrent.hash);
                  onRightClick(e, torrent, isSelected);
                }
              }
            }
          }}
        >
{/* Single scroll container for horizontal + vertical scroll */}
          <div ref={bodyRef} className="flex-1 min-h-0 overflow-auto">
            {/* Header — sticky so it stays visible when scrolling vertically */}
            <div className="flex-none">
<table className="w-full min-w-0 border-collapse table-fixed" style={{ minWidth: `${tableMinWidth}px` }}>
                  {renderColGroup()}
                  <thead className="sticky top-0 z-10 bg-surface">
                    {renderHeaderRow()}
                  </thead>
                </table>
              </div>

              {/* Body */}
              <div className="relative" style={{ width: `${tableMinWidth}px` }}>
                <table className="border-collapse table-fixed" style={{ width: `${tableMinWidth}px` }} data-testid="torrent-table">
                  {renderColGroup()}
                  <tbody
                    style={{
                      width: `${tableMinWidth}px`,
                      height: `${virtualizer.getTotalSize()}px`,
                      position: 'relative',
                    }}
                  >
                  {virtualRows.map((virtualRow) => {
                    const torrent = torrents[virtualRow.index];
                    const isSelected = selectedHashes.has(torrent.hash);

                    return (
                      <TorrentTableRow
                        key={torrent.hash}
                        columns={visibleColumns}
                        columnWidths={columnWidths}
                        torrent={torrent}
                        rowIndex={virtualRow.index}
                        isSelected={isSelected}
                        isFocused={focusedHash === torrent.hash}
                        onClick={onTorrentClick}
                        onDoubleClick={onDoubleClick}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: `${tableMinWidth}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          height: `${ROW_HEIGHT}px`,
                        }}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeColumn ? (
          <div
            className="shadow-lg border border-primary/30 bg-surface-elevated rounded-md"
            style={{
              width: columnWidths[activeColumn.id] ?? activeColumn.minWidth,
              minWidth: columnWidths[activeColumn.id] ?? activeColumn.minWidth,
              maxWidth: columnWidths[activeColumn.id] ?? activeColumn.minWidth,
            }}
          >
            <div className="flex items-center gap-1 px-1 py-1 text-xs font-medium text-text-primary truncate">
              {activeColumn.label}
            </div>
          </div>
        ) : null}
      </DragOverlay>
      {contextMenu && createPortal(
        <HeaderContextMenu
          activeColumn={COLUMN_MAP[contextMenu.columnId] ?? null}
          allColumns={availableColumns}
          columnVisibility={columnVisibility}
          visibleColumnIds={availableVisibleColumnIds}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onMoveColumn={handleMoveColumn}
          onResizeAllToFit={handleResizeAllToFit}
          onResizeToFit={handleResizeToFit}
          onRestoreDefaults={handleRestoreDefaults}
          onToggleColumn={handleToggleColumn}
        />,
        document.body
      )}
      {renderAuditEnabledRef.current ? (
        <TorrentTableRenderAudit
          torrents={torrents}
          selectedHashes={selectedHashes}
          sortField={sortField}
          sortDirection={sortDirection}
          focusedHash={focusedHash}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          columnWidths={columnWidths}
          contextMenuOpen={Boolean(contextMenu)}
          activeColumnId={activeColumn?.id ?? null}
          visibleColumns={visibleColumns}
          tableMinWidth={tableMinWidth}
          queueingEnabled={queueingEnabled}
          availableVisibleColumnIds={availableVisibleColumnIds}
        />
      ) : null}
    </DndContext>
  );
};
