import React, { useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn, formatBytes, formatCountFraction, formatEta, formatProgress, formatRatio, formatSpeed, Icon, parseTorrentTags, StatusBadge, toStatusBadgeStatus } from '@taurent/shared';
import type { AppIconName } from '@taurent/shared';
import type { SortField } from '@taurent/shared';
import type { Torrent } from '@taurent/shared/types/qbittorrent';
import { getTorrentDisplayStatus, getStatusColorClass } from '@taurent/shared/utils/torrentStatus';
import type {
  HomeScreenProps,
  SortOption,
  FilterSummaryItem,
  BatchActionDescriptor,
} from './types';
import { Pill } from '../../components/primitives/Pill';
import { Button } from '../../components/primitives/Button';
import { SearchBar } from '../../components/primitives/SearchBar';
import { StateCard } from '../../components/shared/StateCard';
import { ActionButton, ActionChip, TorrentActionsBar } from '../../components/torrents/TorrentActions';
import { NumberInputModal } from '../../components/dialogs/NumberInputModal';
import { DeleteTorrentDialog } from '../../components/dialogs/DeleteTorrentDialog';
import { CategorySelectionDialog } from '../../components/dialogs/CategorySelectionDialog';
import { TagSelectionDialog } from '../../components/dialogs/TagSelectionDialog';
import { IconButton } from '../../components/primitives/IconButton';
import {
  filledVariantClasses,
  GHOST_DISABLED_CLASSES,
} from '../../components/primitives/buttonStyles';

// ─── StatItem ──────────────────────────────────────────────────────────────────

interface StatItemProps {
  icon: AppIconName;
  value: string;
}

const StatItem = React.memo<StatItemProps>(({ icon, value }) => (
  <div className="flex items-center gap-1">
    <Icon name={icon} iconSize="xs" className="text-text-muted" strokeWidth={2} />
    <span className="text-xs text-text-secondary">{value}</span>
  </div>
));

StatItem.displayName = 'StatItem';

// ─── SortMenu ──────────────────────────────────────────────────────────────────

interface SortMenuProps {
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  show: boolean;
  align?: 'left' | 'right';
  options: SortOption[];
  onSelect: (field: SortField, order: 'asc' | 'desc') => void;
  onClose: () => void;
}

const SortMenu = React.memo<SortMenuProps>(({ sortBy, sortOrder, show, align = 'left', options, onSelect, onClose }) => {
  if (!show) return null;

  return (
    <div
      className={cn(
        'absolute top-full z-30 mt-2 max-h-[70vh] min-w-44 max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden rounded-md border border-border bg-surface shadow-xl',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => {
            if (sortBy === option.value) {
              onSelect(option.value as SortField, sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
              onSelect(option.value as SortField, option.defaultOrder);
            }
            onClose();
          }}
          className={cn(
            'flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors',
            sortBy === option.value
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-text-primary enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive'
          )}
        >
          <span>{option.label}</span>
          {sortBy === option.value ? (
            <Icon name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} iconSize="md" className="text-primary" />
          ) : null}
        </button>
      ))}
    </div>
  );
});

SortMenu.displayName = 'SortMenu';

// ─── FilterSummaryBar ──────────────────────────────────────────────────────────

interface FilterSummaryBarProps {
  items: FilterSummaryItem[];
  resultCount: number;
  onReset: () => void;
}

const FilterSummaryBar = React.memo<FilterSummaryBarProps>(({ items, resultCount, onReset }) => {
  if (items.length === 0) return null;

  return (
    <div className="border-t border-border bg-surface/40 px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap gap-1">
          {items.map((item, index) => (
            <Pill key={`${item.label}-${index}`} tone={item.tone}>{item.label}</Pill>
          ))}
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs text-text-secondary">
            {resultCount} result{resultCount === 1 ? '' : 's'}
          </span>
          <button onClick={onReset} className="text-xs font-medium text-primary enabled:hover:text-primary-hover enabled:active:text-primary-hover">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
});

FilterSummaryBar.displayName = 'FilterSummaryBar';

// ─── TorrentItem ───────────────────────────────────────────────────────────────

interface TorrentItemProps {
  torrent: Torrent;
  isSelected: boolean;
  selectionMode: boolean;
  isStandalone?: boolean;
  onPress: (hash: string) => void;
  onLongPress: (hash: string) => void;
}

export const TorrentItem = React.memo<TorrentItemProps>(({
  torrent,
  isSelected,
  selectionMode,
  isStandalone,
  onPress,
  onLongPress,
}) => {
  const LONG_PRESS_DELAY = 400;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchingRef = useRef(false);
  const didLongPressRef = useRef(false);

  const progress = Math.max(0, Math.min((torrent.progress || 0) * 100, 100));
  const status = getTorrentDisplayStatus(torrent);
  const tags = [...new Set(parseTorrentTags(torrent.tags).slice(0, 2))];

  const clearTouchState = useCallback(() => {
    isTouchingRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    isTouchingRef.current = true;
    didLongPressRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      if (isTouchingRef.current) {
        didLongPressRef.current = true;
        onLongPress(torrent.hash);
      }
    }, LONG_PRESS_DELAY);
  }, [onLongPress, torrent.hash]);

  const handleTouchMove = useCallback(() => {
    isTouchingRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onPress(torrent.hash);
  }, [onPress, torrent.hash]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();

    if (didLongPressRef.current) {
      return;
    }

    didLongPressRef.current = true;
    clearTouchState();
    onLongPress(torrent.hash);
  }, [clearTouchState, onLongPress, torrent.hash]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const progressColorClass = getStatusColorClass(status, 'progress');
  const railColorClass = getStatusColorClass(status, 'bar');
  const textColorClass = progressColorClass.replace('bg-', 'text-');

  return (
    <div className="py-1">
      <div
        className={cn(
          'relative select-none overflow-hidden rounded-sm border bg-surface transition-all duration-200 active:scale-[0.99]',
          isSelected ? 'border-primary/40 bg-primary/5' : 'border-border'
        )}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={clearTouchState}
        onTouchCancel={clearTouchState}
        onTouchMove={handleTouchMove}
      >
        {isSelected ? <div className={`absolute bottom-0 left-0 top-0 w-1 ${railColorClass}`} /> : null}

        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
{selectionMode && !isStandalone ? (
              <div className={cn(
                'mt-1 flex h-5 w-5 items-center justify-center rounded-full border',
                isSelected
                  ? 'border-primary bg-primary text-text-on-primary'
                  : 'border-border bg-surface-interactive text-text-muted'
              )}>
                {isSelected ? (
                  <Icon name="check" iconSize="sm" strokeWidth={2.4} />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                )}
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3
                  className="min-w-0 flex-1 overflow-hidden text-sm font-semibold leading-5 text-text-primary"
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {torrent.name || 'Unknown Torrent'}
                </h3>
                <StatusBadge status={toStatusBadgeStatus(status)} />
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-interactive">
                  <div
                    className={`h-full rounded-full transition-all ${progressColorClass}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className={`min-w-[3rem] text-right text-xs font-semibold ${textColorClass}`}>
                  {formatProgress(torrent.progress, 0)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <StatItem icon="clock" value={formatEta(torrent.eta)} />
                <StatItem icon="download" value={formatSpeed(torrent.dlspeed)} />
                <StatItem icon="upload" value={formatSpeed(torrent.upspeed)} />
                <StatItem icon="ratio" value={formatRatio(torrent.ratio)} />
                <StatItem
                  icon="users"
                  value={formatCountFraction(torrent.num_leechs, torrent.num_seeds)}
                />
                <StatItem
                  icon="hard-drive"
                  value={`${formatBytes(torrent.downloaded)}/${formatBytes(torrent.size)}`}
                />
              </div>

              {(torrent.category || tags.length > 0) ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {torrent.category ? (
                    <Pill
                      tone="primary"
                      icon={<Icon name="folder" iconSize="xs" strokeWidth={2} />}
                    >
                      {torrent.category}
                    </Pill>
                  ) : null}
                  {tags.map((tag: string) => (
                    <Pill
                      key={tag}
                      tone="info"
                      icon={<Icon name="tag" iconSize="xs" strokeWidth={2} />}
                    >
                      #{tag}
                    </Pill>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

TorrentItem.displayName = 'TorrentItem';

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

const TorrentItemSkeleton = React.memo(() => (
  <div className="mx-2 my-1 overflow-hidden rounded-sm border border-border bg-surface px-3 py-2">
    <div className="h-4 w-3/4 rounded-sm bg-surface-interactive" />
    <div className="mt-2 h-1 rounded-full bg-surface-interactive" />
    <div className="mt-2 flex gap-3">
      <div className="h-3 w-16 rounded-sm bg-surface-interactive" />
      <div className="h-3 w-20 rounded-sm bg-surface-interactive" />
      <div className="h-3 w-20 rounded-sm bg-surface-interactive" />
    </div>
  </div>
));

TorrentItemSkeleton.displayName = 'TorrentItemSkeleton';

// ─── Empty State ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onAddTorrent: () => void;
}

const EmptyState = React.memo<EmptyStateProps>(({
  hasActiveFilters,
  onClearFilters,
  onAddTorrent,
}) => {
  const isFiltered = hasActiveFilters;

  return (
    <div className="pb-28 pt-2">
      <StateCard
        className="mx-2 mt-16"
        title={isFiltered ? 'No matches' : 'No torrents yet'}
        message={isFiltered
          ? 'Try clearing your filters.'
          : 'Add a magnet link or a torrent file to get started.'}
        action={
          isFiltered ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="border-primary bg-surface text-primary enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive"
            >
              Clear filters
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onAddTorrent}
            >
              Add torrent
            </Button>
          )
        }
        icon={<Icon name="layers" iconSize="xl" />}
      />
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

// ─── Selection Bar ─────────────────────────────────────────────────────────────

interface SelectionBarProps {
  selectedCount: number;
  isBatchActionPending: boolean;
  onClear: () => void;
  primaryActions: BatchActionDescriptor[];
  secondaryActions: BatchActionDescriptor[];
}

const SelectionBar = React.memo<SelectionBarProps>(({
  selectedCount,
  isBatchActionPending,
  onClear,
  primaryActions,
  secondaryActions,
}) => (
  <div
    className="fixed inset-x-0 z-30 px-2"
    style={{ bottom: 'var(--mobile-tab-bar-safe-height, 0px)', paddingBottom: '1rem' }}
  >
    <div className="overflow-hidden rounded-sm border border-border bg-surface-elevated shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs text-text-secondary">
          {selectedCount} selected
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={isBatchActionPending}
          className={cn(
            'text-xs font-medium text-primary transition-colors enabled:hover:text-primary-hover enabled:active:text-primary-hover',
            GHOST_DISABLED_CLASSES,
          )}
        >
          Clear
        </button>
      </div>

      <TorrentActionsBar
        primaryActions={
          <div className="grid grid-cols-3 gap-2">
            {primaryActions.map((action) => (
              <ActionButton
                key={action.key}
                icon={action.icon}
                label={action.label}
                tone={action.tone}
                onClick={action.onClick}
                disabled={action.disabled}
              />
            ))}
          </div>
        }
        secondaryActions={
          <>
            {secondaryActions.map((action) => (
              <ActionChip
                key={action.key}
                icon={action.icon}
                label={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
              />
            ))}
          </>
        }
      />
    </div>
  </div>
));

SelectionBar.displayName = 'SelectionBar';

// ─── FAB ───────────────────────────────────────────────────────────────────────

interface HomeScreenFabProps {
  showMenu: boolean;
  onToggleMenu: () => void;
  onAddFile: () => void;
  onAddMagnet: () => void;
}

const HomeScreenFab = React.memo<HomeScreenFabProps>(({
  showMenu,
  onToggleMenu,
  onAddFile,
  onAddMagnet,
}) => (
  <div
    className="fixed right-0 z-20"
    style={{ bottom: 'var(--mobile-tab-bar-safe-height, 0px)', paddingBottom: '1rem', paddingRight: '1rem' }}
  >
    <div className="flex flex-col items-end gap-2">
      {showMenu ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onToggleMenu();
              onAddFile();
            }}
            className="rounded-full shadow-lg transition-transform active:scale-95"
          >
            Torrent File
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onToggleMenu();
              onAddMagnet();
            }}
            className="rounded-full shadow-lg transition-transform active:scale-95"
          >
            Magnet Link
          </Button>
        </>
      ) : null}

      <button
        onClick={onToggleMenu}
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full shadow-lg',
          filledVariantClasses(
            'bg-primary',
            'text-text-on-primary',
            'enabled:hover:bg-primary/90',
            'enabled:active:opacity-90',
          ),
        )}
        title="Add Torrent"
      >
        <Icon name={showMenu ? 'x' : 'plus'} iconSize="lg" />
      </button>
    </div>
  </div>
));

HomeScreenFab.displayName = 'HomeScreenFab';

// ─── Main HomeScreenBody ───────────────────────────────────────────────────────

export const HomeScreenBody = React.memo<HomeScreenProps>(({
  // Server / connection
  serverName,
  filter,
  category,
  tag,
  tracker,
  isMobile,
  // Selection
  selectedHashes,
  selectionMode,
  isAllSelected,
  onToggleSelection,
  onClearSelection,
  onToggleAllSelection,
  allHashes,
  // Search & sort
  searchInput,
  onSearchInputChange,
  showSearchBar,
  onToggleSearchBar,
  sortBy,
  sortOrder,
  onSortChange,
  onResetAll,
  sortOptions,
  showSortMenu,
  onToggleSortMenu,
  showFabMenu,
  onToggleFabMenu,
  // Navigation
  onOpenTorrentDetails,
  onOpenFilters,
  onOpenSettings,
  onAddTorrent,
  // Server management
  hasMultipleServers,
  onSwitchServer,
  onLogout,
  // Filter summary
  summaryItems,
  resultCount,
  // Loading / Empty
  isLoading,
  torrents,
  // Batch actions
  primaryBatchActions,
  secondaryBatchActions,
  isBatchActionPending,
  // Modals
  speedLimitModal,
  showDeleteDialog,
  showCategoryDialog,
  showTagsDialog,
  categories,
  tags,
  deleteIsPending,
  setCategoryIsPending,
  addTagsIsPending,
  removeTagsIsPending,
  onApplySpeedLimit,
  onCloseSpeedLimitModal,
  onDeleteSelection,
  onCloseDeleteDialog,
  onSetCategory,
  onCloseCategoryDialog,
  onAddTags,
  onRemoveTags,
  onCloseTagsDialog,
  // Mobile input handler
  onTorrentLongPress,
  // Alt speed limits
  onToggleAltSpeedLimits,
  onLongPressAltSpeedButton,
  altSpeedActive,
  isTogglingAltSpeed,
}) => {
  const hasActiveFilters = Boolean(filter || category || tag || tracker || searchInput);

  // ── Alt speed long-press ────────────────────────────────────────────────
  const altSpeedLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const altSpeedIsTouchingRef = useRef(false);
  const altSpeedDidLongPressRef = useRef(false);

  const clearAltSpeedTouchState = useCallback(() => {
    altSpeedIsTouchingRef.current = false;
    if (altSpeedLongPressTimerRef.current) {
      clearTimeout(altSpeedLongPressTimerRef.current);
      altSpeedLongPressTimerRef.current = null;
    }
  }, []);

  const handleAltSpeedTouchStart = useCallback(() => {
    if (!onLongPressAltSpeedButton) return;

    altSpeedIsTouchingRef.current = true;
    altSpeedDidLongPressRef.current = false;

    altSpeedLongPressTimerRef.current = setTimeout(() => {
      if (altSpeedIsTouchingRef.current) {
        altSpeedDidLongPressRef.current = true;
        onLongPressAltSpeedButton();
      }
    }, 400);
  }, [onLongPressAltSpeedButton]);

  const handleAltSpeedTouchMove = useCallback(() => {
    altSpeedIsTouchingRef.current = false;
    if (altSpeedLongPressTimerRef.current) {
      clearTimeout(altSpeedLongPressTimerRef.current);
      altSpeedLongPressTimerRef.current = null;
    }
  }, []);

  const handleAltSpeedClick = useCallback(() => {
    if (altSpeedDidLongPressRef.current) {
      altSpeedDidLongPressRef.current = false;
      return;
    }
    onToggleAltSpeedLimits?.();
  }, [onToggleAltSpeedLimits]);

  const handleAltSpeedContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();

    if (altSpeedDidLongPressRef.current) {
      return;
    }

    altSpeedDidLongPressRef.current = true;
    clearAltSpeedTouchState();
    onLongPressAltSpeedButton?.();
  }, [clearAltSpeedTouchState, onLongPressAltSpeedButton]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (altSpeedLongPressTimerRef.current) {
        clearTimeout(altSpeedLongPressTimerRef.current);
      }
    };
  }, []);

  const handleTorrentPress = useCallback((hash: string) => {
    if (selectionMode) {
      onToggleSelection(hash);
      return;
    }
    onOpenTorrentDetails(hash);
  }, [onOpenTorrentDetails, selectionMode, onToggleSelection]);

  const handleToggleAll = useCallback(() => {
    onToggleAllSelection(allHashes);
  }, [allHashes, onToggleAllSelection]);

  const allSelected = isAllSelected;
  const contentClassName = cn('pt-2', isMobile ? 'pb-36' : 'pb-28');

  const listParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: torrents.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 88,
    measureElement: (el: HTMLElement) => el.getBoundingClientRect().height,
    overscan: 5,
    enabled: isMobile,
  });

  return (
    <div
      className={cn(
        'bg-background',
        isMobile ? 'mx-auto flex h-dvh max-w-lg flex-col px-2' : 'min-h-full',
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 touch-none select-none border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="pb-2 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-text-primary">
                {selectionMode
                  ? `${selectedHashes.size} Selected`
                  : isMobile
                    ? serverName
                      ? `${serverName} torrents`
                      : 'Torrents'
                    : 'Torrents'}
              </h1>
              {!selectionMode && !isMobile && serverName ? (
                <p className="mt-1 truncate text-xs text-text-muted">{serverName}</p>
              ) : null}
            </div>

            {!selectionMode ? (
              <div className="flex items-center gap-1">
                {isMobile ? (
                  <>
                    <IconButton
                      title="Search"
                      isActive={showSearchBar || Boolean(searchInput)}
                      onClick={onToggleSearchBar}
                    >
                      <Icon name="search" iconSize="md" />
                    </IconButton>
                    <div className="relative">
                      <IconButton
                        title="Sort"
                        isActive={showSortMenu}
                        onClick={onToggleSortMenu}
                      >
                        <Icon name="sort" iconSize="md" />
                      </IconButton>
                      <SortMenu
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        show={showSortMenu}
                        align="right"
                        options={sortOptions}
                        onSelect={onSortChange}
                        onClose={onToggleSortMenu}
                      />
                    </div>
                    <IconButton
                      title="Filters"
                      isActive={Boolean(filter || category || tag || tracker)}
                      onClick={onOpenFilters}
                    >
                      <Icon name="filter" iconSize="md" />
                    </IconButton>
                  </>
                ) : null}
                {!isMobile && (
                  <IconButton title="Settings" onClick={onOpenSettings}>
                    <Icon name="settings" iconSize="md" />
                  </IconButton>
                )}
                {isMobile && onToggleAltSpeedLimits && (
                  <IconButton
                    title={`Alternative speed limits: ${altSpeedActive ? 'ON' : 'OFF'}`}
                    onClick={handleAltSpeedClick}
                    disabled={isTogglingAltSpeed}
                    isActive={altSpeedActive}
                    className={altSpeedActive ? 'text-warning' : ''}
                    style={{ touchAction: 'manipulation' }}
                    onTouchStart={handleAltSpeedTouchStart}
                    onTouchMove={handleAltSpeedTouchMove}
                    onTouchEnd={clearAltSpeedTouchState}
                    onContextMenu={handleAltSpeedContextMenu}
                  >
                    <Icon name="gauge" iconSize="md" />
                  </IconButton>
                )}
                {!isMobile && hasMultipleServers ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSwitchServer}
                    className="px-2 text-text-secondary"
                  >
                    Switch
                  </Button>
                ) : null}
                {!isMobile ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="px-2 text-error enabled:hover:bg-error/10 enabled:active:bg-error/10"
                  >
                    Logout
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleAll}
                  className="bg-surface text-primary enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onClearSelection}
                  className="text-text-secondary enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* ── Action row ─────────────────────────────────────────────────── */}
          {!isMobile ? (
            <div className="mt-3 flex items-center gap-2">
{selectionMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleAll}
                    className="bg-surface text-primary enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onClearSelection}
                    className="text-text-secondary enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <IconButton
                    title="Search"
                    isActive={showSearchBar || Boolean(searchInput)}
                    onClick={onToggleSearchBar}
                  >
                    <Icon name="search" iconSize="md" />
                  </IconButton>

                  <div className="relative">
                    <IconButton
                      title="Sort"
                      isActive={showSortMenu}
                      onClick={onToggleSortMenu}
                    >
                      <Icon name="sort" iconSize="md" />
                    </IconButton>

                    <SortMenu
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      show={showSortMenu}
                      options={sortOptions}
                      onSelect={onSortChange}
                      onClose={onToggleSortMenu}
                    />
                  </div>

                  <IconButton
                    title="Filters"
                    isActive={Boolean(filter || category || tag || tracker)}
                    onClick={onOpenFilters}
                  >
                    <Icon name="filter" iconSize="md" />
                  </IconButton>
                </>
              )}
            </div>
          ) : null}

          {/* ── Search bar ────────────────────────────────────────────────── */}
          {!selectionMode && showSearchBar && (
            <SearchBar
              value={searchInput}
              onChange={onSearchInputChange}
              onClear={() => onSearchInputChange('')}
              placeholder="Search torrents"
            />
          )}
        </div>

        {/* ── Filter summary ─────────────────────────────────────────────── */}
        <FilterSummaryBar
          items={summaryItems}
          resultCount={resultCount}
          onReset={onResetAll}
        />
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className={contentClassName}>
          {Array.from({ length: 4 }).map((_, index) => (
            <TorrentItemSkeleton key={index} />
          ))}
        </div>
      ) : torrents.length === 0 ? (
        <EmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onResetAll}
          onAddTorrent={() => onAddTorrent('magnet')}
        />
      ) : isMobile ? (
        <div ref={listParentRef} className={cn('flex-1 overflow-auto', contentClassName)}>
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const torrent = torrents[virtualRow.index];
              return (
                <div
                  key={torrent.hash}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <TorrentItem
                    torrent={torrent}
                    isSelected={selectedHashes.has(torrent.hash)}
                    selectionMode={selectionMode}
                    onPress={handleTorrentPress}
                    onLongPress={onTorrentLongPress}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={contentClassName}>
          {torrents.map((torrent) => (
            <TorrentItem
              key={torrent.hash}
              torrent={torrent}
              isSelected={selectedHashes.has(torrent.hash)}
              selectionMode={selectionMode}
              onPress={handleTorrentPress}
              onLongPress={onTorrentLongPress}
            />
          ))}
        </div>
      )}

      {/* ── Selection bar / FAB ────────────────────────────────────────────── */}
      {selectionMode && selectedHashes.size > 0 ? (
        <SelectionBar
          selectedCount={selectedHashes.size}
          isBatchActionPending={isBatchActionPending}
          onClear={onClearSelection}
          primaryActions={primaryBatchActions}
          secondaryActions={secondaryBatchActions}
        />
      ) : (
        <HomeScreenFab
          showMenu={showFabMenu}
          onToggleMenu={onToggleFabMenu}
          onAddFile={() => onAddTorrent('file')}
          onAddMagnet={() => onAddTorrent('magnet')}
        />
      )}

      {/* ── Speed Limit Modal ──────────────────────────────────────────────── */}
      {speedLimitModal ? (
        <NumberInputModal
          title={speedLimitModal.type === 'download' ? 'Set Download Speed Limit' : 'Set Upload Speed Limit'}
          subtitle={`${selectedHashes.size} selected torrent${selectedHashes.size === 1 ? '' : 's'}`}
          currentValue={0}
          unitMode="bytes-per-second"
          unitDefault="kb"
          unit="Use 0 for unlimited speed."
          onSubmit={(value) => {
            void onApplySpeedLimit(speedLimitModal.type, value);
          }}
          onCancel={onCloseSpeedLimitModal}
        />
      ) : null}

      {/* ── Delete Dialog ──────────────────────────────────────────────────── */}
      {showDeleteDialog ? (
        <DeleteTorrentDialog
          count={selectedHashes.size}
          isPending={deleteIsPending}
          onCancel={onCloseDeleteDialog}
          onDelete={(deleteFiles) => {
            void onDeleteSelection(deleteFiles);
          }}
        />
      ) : null}

      {/* ── Category Dialog ────────────────────────────────────────────────── */}
      {showCategoryDialog && categories ? (
        <CategorySelectionDialog
          categories={Object.keys(categories)}
          isPending={setCategoryIsPending}
          onCancel={onCloseCategoryDialog}
          onSelect={(category) => {
            void onSetCategory(category);
          }}
        />
      ) : null}

      {/* ── Tags Dialog ────────────────────────────────────────────────────── */}
      {showTagsDialog && tags ? (
        <TagSelectionDialog
          availableTags={tags}
          isPending={addTagsIsPending || removeTagsIsPending}
          onCancel={onCloseTagsDialog}
          onAddTags={(tagsToAdd) => {
            void onAddTags(tagsToAdd);
          }}
          onRemoveTags={(tagsToRemove) => {
            void onRemoveTags(tagsToRemove);
          }}
        />
      ) : null}
    </div>
  );
});

HomeScreenBody.displayName = 'HomeScreenBody';
