import { type ComponentType } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  RotateCcw,
} from '@taurent/shared';
import type { ColumnDefinition } from '@/stores';
import { cn } from '@taurent/shared';
import { useContextMenu, ContextMenuPanel } from '@taurent/web-ui';

export type ColumnMoveDirection = 'start' | 'left' | 'right' | 'end';

interface HeaderContextMenuProps {
  activeColumn: ColumnDefinition | null;
  allColumns: ColumnDefinition[];
  columnVisibility: Record<string, boolean>;
  visibleColumnIds: string[];
  x: number;
  y: number;
  onClose: () => void;
  onMoveColumn: (columnId: string, direction: ColumnMoveDirection) => void;
  onResizeAllToFit: () => void;
  onResizeToFit: (columnId: string) => void;
  onRestoreDefaults: () => void;
  onToggleColumn: (columnId: string) => void;
}

export function HeaderContextMenu({
  activeColumn,
  allColumns,
  columnVisibility,
  visibleColumnIds,
  x,
  y,
  onClose,
  onMoveColumn,
  onResizeAllToFit,
  onResizeToFit,
  onRestoreDefaults,
  onToggleColumn,
}: HeaderContextMenuProps) {
  const { panelRef, panelPosition, isOpen, handlePanelBlur } = useContextMenu({
    x,
    y,
    items: [],
    isItemDisabled: () => false,
    onSelect: () => {},
    onClose,
  });

  const visibleColumnCount = visibleColumnIds.length;
  const activeVisibleIndex = activeColumn ? visibleColumnIds.indexOf(activeColumn.id) : -1;

  return (
    <ContextMenuPanel
      panelRef={panelRef}
      panelPosition={panelPosition}
      isOpen={isOpen}
      onBlur={handlePanelBlur}
      className="w-72"
    >
      {/* Resize options */}
      {activeColumn ? (
        <div className="border-b border-border px-1 pb-1">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onResizeToFit(activeColumn.id);
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1 text-left text-sm text-text-primary transition-colors hover:bg-surface-interactive"
          >
            <Columns3 className="h-4 w-4 text-text-muted" />
            <span>Resize to fit</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onResizeAllToFit();
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1 text-left text-sm text-text-primary transition-colors hover:bg-surface-interactive"
          >
            <Columns3 className="h-4 w-4 text-text-muted" />
            <span>Resize all to fit</span>
          </button>
        </div>
      ) : null}

      {/* Move options */}
      {activeColumn ? (
        <div className="border-b border-border px-2 py-1">
          <div className="grid grid-cols-2 gap-1">
            <HeaderMenuButton
              label="Move first"
              icon={ChevronsLeft}
              disabled={activeVisibleIndex <= 0}
              onClick={() => {
                onMoveColumn(activeColumn.id, 'start');
                onClose();
              }}
            />
            <HeaderMenuButton
              label="Move left"
              icon={ChevronLeft}
              disabled={activeVisibleIndex <= 0}
              onClick={() => {
                onMoveColumn(activeColumn.id, 'left');
                onClose();
              }}
            />
            <HeaderMenuButton
              label="Move right"
              icon={ChevronRight}
              disabled={activeVisibleIndex < 0 || activeVisibleIndex >= visibleColumnCount - 1}
              onClick={() => {
                onMoveColumn(activeColumn.id, 'right');
                onClose();
              }}
            />
            <HeaderMenuButton
              label="Move last"
              icon={ChevronsRight}
              disabled={activeVisibleIndex < 0 || activeVisibleIndex >= visibleColumnCount - 1}
              onClick={() => {
                onMoveColumn(activeColumn.id, 'end');
                onClose();
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Column visibility toggles */}
      <div className="max-h-80 overflow-auto px-1 py-1">
        {allColumns.map((column) => {
          const isVisible = columnVisibility[column.id];
          const isLastVisibleColumn = isVisible && visibleColumnCount === 1;

          return (
            <button
              key={column.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={isVisible}
              disabled={isLastVisibleColumn}
              onClick={() => onToggleColumn(column.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2 py-1 text-left text-sm transition-colors',
                isLastVisibleColumn
                  ? 'cursor-not-allowed text-text-muted'
                  : 'text-text-primary hover:bg-surface-interactive'
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-sm border border-border',
                  isVisible ? 'bg-primary text-text-on-primary' : 'bg-background text-transparent'
                )}
              >
                <Check className="h-3 w-3" />
              </span>
              <span className="min-w-0 flex-1 truncate">{column.label}</span>
            </button>
          );
        })}
      </div>

      {/* Restore defaults */}
      <div className="border-t border-border px-1 pt-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onRestoreDefaults();
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-md px-2 py-1 text-left text-sm text-text-primary transition-colors hover:bg-surface-interactive"
        >
          <RotateCcw className="h-4 w-4 text-text-muted" />
          <span>Restore defaults</span>
        </button>
      </div>
    </ContextMenuPanel>
  );
}

interface HeaderMenuButtonProps {
  disabled?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

function HeaderMenuButton({ disabled = false, icon: Icon, label, onClick }: HeaderMenuButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors select-none',
        disabled
          ? 'cursor-not-allowed text-text-muted'
          : 'text-text-primary hover:bg-surface-interactive'
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}