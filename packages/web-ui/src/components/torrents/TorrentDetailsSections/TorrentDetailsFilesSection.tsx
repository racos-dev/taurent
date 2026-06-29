import React, { useCallback, useMemo, useRef, useState } from 'react';
import { cn, Icon, formatPriority, formatProgress } from '@taurent/shared';
import { formatAvailabilityPercent, formatBytes } from '@taurent/shared/utils/formatters';
import type { TorrentDetailsFilesSectionProps, FileDisplayRow, FilePriorityTarget, FolderStats, FileTreeNode } from './types';
import { Checkbox } from '../../primitives/Checkbox';
import { Select } from '../../primitives/Select';
import type { SelectOption } from '../../primitives/Select';
import type { TorrentFile } from '@taurent/shared/types/qbittorrent';
import {
  DesktopDetailTable,
  type DesktopDetailTableColumn,
  type DesktopDetailTableSortDirection,
} from './DesktopDetailTable';
import { StateCard } from '../../shared/StateCard';
import { RetryButton } from '../../shared/RetryButton';

function normalizeFileAvailability(availability: number | undefined): number {
  if (availability === undefined || !Number.isFinite(availability) || availability < 0) {
    return -1;
  }
  return availability;
}

function formatFileAvailability(availability: number): string {
  return formatAvailabilityPercent(availability);
}

function averageKnownFileAvailability(files: TorrentFile[]): number {
  const knownValues = files
    .map((file) => normalizeFileAvailability(file.availability))
    .filter((availability) => availability >= 0);

  if (knownValues.length === 0) {
    return -1;
  }

  return knownValues.reduce((sum, availability) => sum + availability, 0) / knownValues.length;
}

function buildFileTree(files: TorrentFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const parts = file.name.split('/');
    let current = root;

    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const pathUpTo = parts.slice(0, index + 1).join('/');
      let found = current.find((node) => node.name === part);

      if (!found) {
        found = {
          name: part,
          path: pathUpTo,
          children: [],
        };
        current.push(found);
      }

      if (index === parts.length - 1) {
        found.file = file;
      }

      current = found.children;
    }
  }

  return root;
}

function getNodeFiles(node: FileTreeNode): TorrentFile[] {
  if (node.file) return [node.file];
  return node.children.flatMap(getNodeFiles);
}

function getFolderStats(node: FileTreeNode): FolderStats {
  const files = getNodeFiles(node);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalDone = files.reduce((sum, file) => sum + file.size * file.progress, 0);
  const progress = totalSize > 0 ? totalDone / totalSize : 0;
  const remaining = totalSize - totalDone;
  const avgAvailability = averageKnownFileAvailability(files);
  const allEnabled = files.every((file) => file.priority > 0);
  const someEnabled = files.some((file) => file.priority > 0);
  const maxPriority = files.reduce((max, file) => Math.max(max, file.priority), 0);

  return {
    totalSize,
    progress,
    remaining,
    avgAvailability,
    allEnabled,
    someEnabled,
    fileCount: files.length,
    maxPriority,
  };
}

function compareValues(a: number | string, b: number | string, direction: DesktopDetailTableSortDirection): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  const result = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

function FileProgressCell({ progress }: { progress: number }) {
  const isComplete = progress >= 1;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-sm bg-surface-elevated">
        <div 
          className={cn("h-full rounded-sm", isComplete ? "bg-success" : "bg-primary")} 
          style={{ width: `${Math.max(0, Math.min(progress, 1)) * 100}%` }} 
        />
      </div>
      <span className="w-10 text-right text-text-secondary">{formatProgress(progress, 0)}</span>
    </div>
  );
}

const PRIORITY_OPTIONS: SelectOption<number>[] = [
  { value: 1, label: 'Normal' },
  { value: 6, label: 'High' },
  { value: 7, label: 'Maximum' },
  { value: 0, label: 'Skip' },
];

const LONG_PRESS_DELAY_MS = 500;

function getPriorityValue(files: TorrentFile[]): number {
  if (files.length === 0) return 1;
  const firstPriority = files[0]?.priority ?? 1;
  return files.every((file) => file.priority === firstPriority) ? firstPriority : -1;
}

function buildPriorityTarget(label: string, files: TorrentFile[]): FilePriorityTarget {
  return {
    label,
    currentPriority: getPriorityValue(files),
    fileIds: files.map((file) => file.index),
  };
}

function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    triggeredRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      onLongPress();
    }, LONG_PRESS_DELAY_MS);
  }, [clearTimer, onLongPress]);

  const stop = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!triggeredRef.current) return;
    triggeredRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

  React.useEffect(() => clearTimer, [clearTimer]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onClickCapture: handleClickCapture,
    onContextMenu: handleContextMenu,
  };
}
function DesktopFiles({ files, onFileToggle, onToggleAll, onFilePriority, onFileContextMenu, onFolderContextMenu, onFolderRowClick }: {
  files: TorrentFile[];
  onFileToggle?: (fileIndex: number, enabled: boolean) => void;
  onToggleAll?: (enabled: boolean) => void;
  onFilePriority?: (file: TorrentFile) => void;
  onFileContextMenu?: (event: React.MouseEvent<HTMLTableRowElement>, row: FileDisplayRow) => void;
  onFolderContextMenu?: (event: React.MouseEvent<HTMLTableRowElement>, row: FileDisplayRow) => void;
  onFolderRowClick?: (row: FileDisplayRow) => void;
}) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [sortColumnId, setSortColumnId] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<DesktopDetailTableSortDirection>('asc');
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(tree.filter((node) => node.children.length > 0).map((node) => node.path)));

  React.useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      for (const node of tree) {
        if (node.children.length > 0 && !next.has(node.path)) {
          next.add(node.path);
        }
      }
      return next;
    });
  }, [tree]);

  const handleToggleExpand = useCallback((path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSortChange = useCallback((columnId: string) => {
    if (sortColumnId === columnId) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortColumnId(columnId);
    setSortDirection(columnId === 'name' || columnId === 'priority' ? 'asc' : 'desc');
  }, [sortColumnId]);

  const getRowStats = useCallback((node: FileTreeNode): FolderStats => {
    if (node.file) {
      return {
        totalSize: node.file.size,
        progress: node.file.progress,
        remaining: node.file.size * (1 - node.file.progress),
        avgAvailability: normalizeFileAvailability(node.file.availability),
        allEnabled: node.file.priority > 0,
        someEnabled: node.file.priority > 0,
        fileCount: 1,
        maxPriority: node.file.priority,
      };
    }

    return getFolderStats(node);
  }, []);

  const rows = useMemo<FileDisplayRow[]>(() => {
    function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
      return [...nodes]
        .sort((left, right) => {
          const leftIsFolder = left.children.length > 0;
          const rightIsFolder = right.children.length > 0;

          if (leftIsFolder !== rightIsFolder) {
            return leftIsFolder ? -1 : 1;
          }

          const leftStats = getRowStats(left);
          const rightStats = getRowStats(right);

          const leftValue: string | number = (() => {
            switch (sortColumnId) {
              case 'size':
                return leftStats.totalSize;
              case 'progress':
                return leftStats.progress;
              case 'remaining':
                return leftStats.remaining;
              case 'availability':
                return leftStats.avgAvailability;
              case 'priority':
                return leftStats.maxPriority;
              case 'name':
              default:
                return left.name;
            }
          })();

          const rightValue: string | number = (() => {
            switch (sortColumnId) {
              case 'size':
                return rightStats.totalSize;
              case 'progress':
                return rightStats.progress;
              case 'remaining':
                return rightStats.remaining;
              case 'availability':
                return rightStats.avgAvailability;
              case 'priority':
                return rightStats.maxPriority;
              case 'name':
              default:
                return right.name;
            }
          })();

          return compareValues(leftValue, rightValue, sortDirection);
        })
        .map((node) => (
          node.children.length > 0
            ? { ...node, children: sortNodes(node.children) }
            : node
        ));
    }

    const flatten = (nodes: FileTreeNode[], depth: number): FileDisplayRow[] => (
      nodes.flatMap((node) => {
        const isFolder = node.children.length > 0;
        const row: FileDisplayRow = {
          key: node.path,
          path: node.path,
          depth,
          isFolder,
          node,
          file: node.file,
          stats: getRowStats(node),
        };

        if (!isFolder || !expanded.has(node.path)) {
          return [row];
        }

        return [row, ...flatten(node.children, depth + 1)];
      })
    );

    return flatten(sortNodes(tree), 0);
  }, [expanded, getRowStats, sortColumnId, sortDirection, tree]);

  const allEnabled = files.every((file) => file.priority > 0);
  const someEnabled = files.some((file) => file.priority > 0);

  const columns = useMemo<DesktopDetailTableColumn<FileDisplayRow>[]>(() => [
    {
      id: 'name',
      label: (
        <div className="flex items-center gap-2 pl-1">
          <Checkbox
            checked={allEnabled}
            indeterminate={someEnabled && !allEnabled}
            onChange={(checked) => {
              onToggleAll?.(checked);
            }}
          />
          <span>Name</span>
        </div>
      ),
      width: 360,
      minWidth: 220,
      sortable: true,
      renderCell: (row) => {
        const paddingLeft = row.depth * 16;
        const checked = row.isFolder ? row.stats.allEnabled : Boolean(row.file && row.file.priority > 0);

        return (
          <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft }}>
            <Checkbox
              checked={checked}
              indeterminate={row.isFolder && row.stats.someEnabled && !row.stats.allEnabled}
              onChange={(newChecked) => {
                if (row.isFolder) {
                  for (const file of getNodeFiles(row.node)) {
                    onFileToggle?.(file.index, newChecked);
                  }
                  return;
                }

                if (row.file) {
                  onFileToggle?.(row.file.index, newChecked);
                }
              }}
            />

            {row.isFolder ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleExpand(row.path);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center"
                  title={expanded.has(row.path) ? 'Collapse' : 'Expand'}
                >
                  <Icon
                    name="chevron-down"
                    className={cn(
                      'h-3 w-3 shrink-0 text-text-muted transition-transform',
                      expanded.has(row.path) ? 'rotate-0' : '-rotate-90'
                    )}
                    strokeWidth={2.4}
                  />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFolderRowClick?.(row);
                  }}
                  className="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-hidden text-left text-text-primary"
                  title={row.node.name}
                >
                  <Icon name="folder" className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={2} />
                  <span className="flex min-w-0 items-center overflow-hidden">
                    <span className="truncate font-medium">{row.node.name}</span>
                    <span className="shrink-0 pl-1 text-xs text-text-muted">({row.stats.fileCount})</span>
                  </span>
                </button>
              </>
            ) : (
              <span className="flex min-w-0 items-center gap-2 text-text-primary" title={row.node.name}>
                <Icon name="file" className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={2} />
                <span className="block truncate">{row.node.name}</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'size',
      label: 'Size',
      width: 116,
      minWidth: 92,
      align: 'right',
      sortable: true,
      renderCell: (row) => <span className="text-text-secondary">{formatBytes(row.stats.totalSize)}</span>,
    },
    {
      id: 'progress',
      label: 'Progress',
      width: 136,
      minWidth: 124,
      align: 'right',
      sortable: true,
      renderCell: (row) => <FileProgressCell progress={row.stats.progress} />,
    },
    {
      id: 'remaining',
      label: 'Remaining',
      width: 116,
      minWidth: 100,
      align: 'right',
      sortable: true,
      renderCell: (row) => <span className="text-text-secondary">{formatBytes(row.stats.remaining)}</span>,
    },
    {
      id: 'availability',
      label: 'Availability',
      width: 102,
      minWidth: 90,
      align: 'right',
      sortable: true,
      renderCell: (row) => <span className="text-text-secondary">{formatFileAvailability(row.stats.avgAvailability)}</span>,
    },
    {
      id: 'priority',
      label: 'Priority',
      width: 118,
      minWidth: 104,
      align: 'center',
      sortable: true,
      renderCell: (row) => {
        const filesForRow = row.isFolder ? getNodeFiles(row.node) : row.file ? [row.file] : [];
        const priorities = new Set(filesForRow.map((file) => file.priority));
        const priorityValue = priorities.size === 1 ? (filesForRow[0]?.priority ?? 1) : -1;

        if (row.isFolder) {
          const folderOptions: SelectOption<number>[] = priorityValue === -1
            ? [{ value: -1, label: 'Mixed', disabled: true }, ...PRIORITY_OPTIONS]
            : PRIORITY_OPTIONS;
          return (
            <div className="inline-block" onClick={(e) => e.stopPropagation()}>
              <Select
                value={priorityValue}
                options={folderOptions}
                onChange={(newPriority) => {
                  for (const file of filesForRow) {
                    if (file.priority !== newPriority) {
                      onFilePriority?.({ ...file, priority: newPriority });
                    }
                  }
                }}
              />
            </div>
          );
        }

        if (!row.file) {
          return null;
        }

        return (
          <div className="inline-block" onClick={(e) => e.stopPropagation()}>
            <Select
              value={priorityValue}
              options={PRIORITY_OPTIONS}
              onChange={(newPriority) => {
                if (newPriority !== row.file?.priority && row.file) {
                  onFilePriority?.({ ...row.file, priority: newPriority });
                }
              }}
            />
          </div>
        );
      },
    },
  ], [allEnabled, expanded, handleToggleExpand, onFilePriority, onFileToggle, onToggleAll, someEnabled, onFolderRowClick]);

  const handleRowContextMenu = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: FileDisplayRow) => {
      if (row.isFolder) {
        onFolderContextMenu?.(event, row);
      } else {
        onFileContextMenu?.(event, row);
      }
    },
    [onFileContextMenu, onFolderContextMenu]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DesktopDetailTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        activeRowKey={activeRowKey}
        sortColumnId={sortColumnId}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onRowClick={(row) => { setActiveRowKey(row.key); }}
        onRowContextMenu={handleRowContextMenu}
        getRowClassName={(row) => !row.isFolder && row.file?.priority === 0 ? 'opacity-70' : undefined}
      />
    </div>
  );
}

function MobileFileCard({
  file,
  depth = 0,
  onPriority,
  onPriorityTarget,
}: {
  file: TorrentFile;
  depth?: number;
  onPriority?: (file: TorrentFile) => void;
  onPriorityTarget?: (target: FilePriorityTarget) => void;
}) {
  const progress = (file.progress || 0) * 100;
  const barClass = file.is_seed ? 'bg-success' : progress >= 100 ? 'bg-success' : 'bg-primary';
  const longPressHandlers = useLongPress(() => {
    onPriorityTarget?.(buildPriorityTarget(file.name, [file]));
    if (!onPriorityTarget) {
      onPriority?.(file);
    }
  });

  return (
    <div
      className="select-none rounded-sm border border-border bg-surface p-3"
      style={{ marginLeft: depth > 0 ? depth * 16 : undefined }}
      {...longPressHandlers}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <Icon name="file" className="mt-0 h-4 w-4 shrink-0 text-text-muted" strokeWidth={2} />
            <div className="break-words text-sm font-medium text-text-primary">{file.name.split('/').pop() || file.name}</div>
          </div>
          <div className="mt-1 text-xs text-text-secondary">{formatBytes(file.size)}</div>
        </div>
        <span className="rounded-sm bg-surface px-2 py-1 text-xs text-text-secondary">
          {formatPriority(file.priority)}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <span className="rounded-sm bg-surface px-2 py-1">{formatProgress(file.progress)}</span>
        <span className="rounded-sm bg-surface px-2 py-1">Availability {formatFileAvailability(file.availability)}</span>
        {file.is_seed ? <span className="rounded-sm bg-surface px-2 py-1">Seed file</span> : null}
      </div>
    </div>
  );
}

function MobileFolderCard({
  row,
  isExpanded,
  onToggle,
  onPriorityTarget,
}: {
  row: FileDisplayRow;
  isExpanded: boolean;
  onToggle: () => void;
  onPriorityTarget?: (target: FilePriorityTarget) => void;
}) {
  const files = useMemo(() => getNodeFiles(row.node), [row.node]);
  const progress = row.stats.progress * 100;
  const priorityValue = getPriorityValue(files);
  const longPressHandlers = useLongPress(() => {
    onPriorityTarget?.(buildPriorityTarget(`${row.node.name} (${row.stats.fileCount} files)`, files));
  });

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} folder ${row.node.name}`}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
      className="w-full select-none rounded-sm border border-border bg-surface p-3 text-left"
      style={{ marginLeft: row.depth > 0 ? row.depth * 16 : undefined }}
      {...longPressHandlers}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Icon
              name="chevron-down"
              className={cn(
                'h-3 w-3 shrink-0 text-text-muted transition-transform',
                isExpanded ? 'rotate-0' : '-rotate-90'
              )}
              strokeWidth={2.4}
            />
            <Icon name="folder" className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={2} />
            <span className="truncate text-sm font-medium text-text-primary">{row.node.name}</span>
            <span className="shrink-0 text-xs text-text-muted">({row.stats.fileCount})</span>
          </div>
          <div className="mt-1 text-xs text-text-secondary">{formatBytes(row.stats.totalSize)}</div>
        </div>
        <span className="rounded-sm bg-surface px-2 py-1 text-xs text-text-secondary">
          {priorityValue === -1 ? 'Mixed' : formatPriority(priorityValue)}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <span className="rounded-sm bg-surface px-2 py-1">{formatProgress(row.stats.progress)}</span>
        <span className="rounded-sm bg-surface px-2 py-1">Availability {formatFileAvailability(row.stats.avgAvailability)}</span>
        <span className="rounded-sm bg-surface px-2 py-1">{row.stats.fileCount} files</span>
      </div>
    </button>
  );
}

function MobileFiles({
  files,
  onFilePriority,
  onFilePriorityTarget,
}: {
  files: TorrentFile[];
  onFilePriority?: (file: TorrentFile) => void;
  onFilePriorityTarget?: (target: FilePriorityTarget) => void;
}) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(tree.filter((node) => node.children.length > 0).map((node) => node.path)));

  React.useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      for (const node of tree) {
        if (node.children.length > 0 && !next.has(node.path)) {
          next.add(node.path);
        }
      }
      return next;
    });
  }, [tree]);

  const toggleFolder = useCallback((path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const rows = useMemo<FileDisplayRow[]>(() => {
    const flatten = (nodes: FileTreeNode[], depth: number): FileDisplayRow[] => (
      nodes.flatMap((node) => {
        const isFolder = node.children.length > 0;
        const row: FileDisplayRow = {
          key: node.path,
          path: node.path,
          depth,
          isFolder,
          node,
          file: node.file,
          stats: node.file
            ? {
              totalSize: node.file.size,
              progress: node.file.progress,
              remaining: node.file.size * (1 - node.file.progress),
              avgAvailability: normalizeFileAvailability(node.file.availability),
              allEnabled: node.file.priority > 0,
              someEnabled: node.file.priority > 0,
              fileCount: 1,
              maxPriority: node.file.priority,
            }
            : getFolderStats(node),
        };

        if (!isFolder || !expanded.has(node.path)) {
          return [row];
        }

        return [row, ...flatten(node.children, depth + 1)];
      })
    );

    return flatten(tree, 0);
  }, [expanded, tree]);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        row.isFolder ? (
          <MobileFolderCard
            key={row.key}
            row={row}
            isExpanded={expanded.has(row.path)}
            onToggle={() => toggleFolder(row.path)}
            onPriorityTarget={onFilePriorityTarget}
          />
        ) : row.file ? (
          <MobileFileCard
            key={`${row.file.index}-${row.path}`}
            file={row.file}
            depth={row.depth}
            onPriority={onFilePriority}
            onPriorityTarget={onFilePriorityTarget}
          />
        ) : null
      ))}
    </div>
  );
}

export const TorrentDetailsFilesSection = React.memo<TorrentDetailsFilesSectionProps>(
  ({ variant = 'desktop', files, isLoading, error, onRetry, onFilePriority, onFilePriorityTarget, onFileToggle, onToggleAll, onFileContextMenu, onFolderContextMenu, onFolderRowClick }) => {
    if (isLoading && !files) {
      if (variant === 'mobile') {
        return (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-sm border border-border bg-surface" />
            ))}
          </div>
        );
      }
      return (
        <div className="rounded-md border border-border bg-surface">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-8 border-b border-border last:border-b-0" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <StateCard
          title="Could not load files"
          action={onRetry ? <RetryButton onClick={onRetry as () => void} /> : undefined}
        />
      );
    }

    if (!files || files.length === 0) {
      if (variant === 'mobile') {
        return (
          <StateCard title="No files available" />
        );
      }
      return (
        <StateCard title="No files available" />
      );
    }

    if (variant === 'mobile') {
      return <MobileFiles files={files} onFilePriority={onFilePriority} onFilePriorityTarget={onFilePriorityTarget} />;
    }

    return <DesktopFiles files={files} onFileToggle={onFileToggle} onToggleAll={onToggleAll} onFilePriority={onFilePriority} onFileContextMenu={onFileContextMenu} onFolderContextMenu={onFolderContextMenu} onFolderRowClick={onFolderRowClick} />;
  }
);

TorrentDetailsFilesSection.displayName = 'TorrentDetailsFilesSection';
