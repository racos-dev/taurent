// Types for the platform-agnostic HomeScreen presentational component.
// All data and callbacks are passed as props — this module has no platform knowledge.

import type { AppIconName } from '@taurent/shared';
import type { SortField } from '@taurent/shared';
import type { Torrent } from '@taurent/shared/types/qbittorrent';

// ─── Sort ─────────────────────────────────────────────────────────────────────

export interface SortOption {
  value: SortField;
  label: string;
  defaultOrder: 'asc' | 'desc';
}

// ─── Filter Summary ────────────────────────────────────────────────────────────

export interface FilterSummaryItem {
  label: string;
  tone?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger';
}

// ─── Batch Actions ─────────────────────────────────────────────────────────────

export interface BatchActionDescriptor {
  key: string;
  icon: AppIconName;
  label: string;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled: boolean;
  onClick: () => void;
}

// ─── Speed Limit Modal ─────────────────────────────────────────────────────────

export interface SpeedLimitModalState {
  type: 'download' | 'upload';
}

// ─── HomeScreen props ─────────────────────────────────────────────────────────

export interface HomeScreenProps {
  // ── Connection / server info ──────────────────────────────────────────────
  serverName: string | null;
  filter: string | null;
  category: string | null;
  tag: string | null;
  tracker: string | null;

  // ── Selection ──────────────────────────────────────────────────────────────
  selectedHashes: Set<string>;
  selectionMode: boolean;
  isAllSelected: boolean;
  onToggleSelection: (hash: string) => void;
  onClearSelection: () => void;
  onToggleAllSelection: (hashes: string[]) => void;
  allHashes: string[];

  // ── Search & Sort ──────────────────────────────────────────────────────────
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  showSearchBar: boolean;
  onToggleSearchBar: () => void;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: SortField, order: 'asc' | 'desc') => void;
  onResetAll: () => void;
  sortOptions: SortOption[];
  showSortMenu: boolean;
  onToggleSortMenu: () => void;
  showFabMenu: boolean;
  onToggleFabMenu: () => void;

  // ── Navigation ────────────────────────────────────────────────────────────
  onOpenTorrentDetails: (hash: string) => void;
  onOpenFilters: () => void;
  onOpenSettings: () => void;
  onAddTorrent: (mode: 'file' | 'magnet') => void;

  // ── Platform ────────────────────────────────────────────────────────────────
  isMobile?: boolean;

  // ── Server management ──────────────────────────────────────────────────────
  hasMultipleServers: boolean;
  onSwitchServer: () => void;
  onLogout: () => void;

  // ── Filter summary ────────────────────────────────────────────────────────
  summaryItems: FilterSummaryItem[];
  resultCount: number;

  // ── Loading / Empty ────────────────────────────────────────────────────────
  isLoading: boolean;
  torrents: Torrent[];

  // ── Batch actions ──────────────────────────────────────────────────────────
  primaryBatchActions: BatchActionDescriptor[];
  secondaryBatchActions: BatchActionDescriptor[];
  isBatchActionPending: boolean;

  // ── Modals (driven by controller state passed directly) ───────────────────
  speedLimitModal: SpeedLimitModalState | null;
  showDeleteDialog: boolean;
  showCategoryDialog: boolean;
  showTagsDialog: boolean;
  categories: Record<string, unknown> | null;
  tags: string[] | null;
  deleteIsPending: boolean;
  setCategoryIsPending: boolean;
  addTagsIsPending: boolean;
  removeTagsIsPending: boolean;
  onApplySpeedLimit: (type: 'download' | 'upload', value: number) => void;
  onCloseSpeedLimitModal: () => void;
  onDeleteSelection: (deleteFiles: boolean) => void;
  onCloseDeleteDialog: () => void;
  onSetCategory: (category: string) => void;
  onCloseCategoryDialog: () => void;
  onAddTags: (tags: string[]) => void;
  onRemoveTags: (tags: string[]) => void;
  onCloseTagsDialog: () => void;

  // ── Long-press handler (mobile-specific input semantics) ──────────────────
  onTorrentLongPress: (hash: string) => void;

  // ── Alt speed limits (mobile header toggle) ──────────────────────────────
  onToggleAltSpeedLimits?: () => void;
  onLongPressAltSpeedButton?: () => void;
  altSpeedActive?: boolean;
  isTogglingAltSpeed?: boolean;
}

// ─── TorrentItem props ─────────────────────────────────────────────────────────

export interface TorrentItemProps {
  torrent: Torrent;
  isSelected: boolean;
  selectionMode: boolean;
  isStandalone?: boolean;
  onPress: (hash: string) => void;
  onLongPress: (hash: string) => void;
}

// ─── StatItem props ────────────────────────────────────────────────────────────

export interface StatItemProps {
  icon: AppIconName;
  value: string;
}

// ─── Sort menu props ───────────────────────────────────────────────────────────

export interface SortMenuProps {
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  show: boolean;
  align?: 'left' | 'right';
  options: SortOption[];
  onSelect: (field: SortField, order: 'asc' | 'desc') => void;
  onClose: () => void;
}

// ─── FAB props ─────────────────────────────────────────────────────────────────

export interface HomeScreenFabProps {
  showMenu: boolean;
  onToggleMenu: () => void;
  onAddFile: () => void;
  onAddMagnet: () => void;
}
