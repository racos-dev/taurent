/**
 * Column Registry for Transfers/Workspace Table
 *
 * Canonical source of truth for all table column definitions.
 * Drives header rendering, row cell rendering, and sort behavior.
 * Single source of truth — no hard-coded column definitions in components.
 */

import type { Torrent } from '@taurent/shared';
import {
  formatAvailability,
  formatBoolean,
  formatBytes,
  formatCount,
  formatCountWithTotal,
  formatDate,
  formatDateTime,
  formatDuration,
  formatEta,
  formatPopularity,
  formatProgress,
  formatRatio,
  formatRatioLimit,
  formatReannounce,
  formatSeenComplete,
  formatSpeed,
  formatTags,
  formatTracker,
  formatTransferLimit,
  getTorrentDetailedStateLabel,
} from '@taurent/shared';

// ============================================================================
// Desktop-specific Formatters (not available in shared)
// ============================================================================

/**
 * Desktop-specific torrent state formatter.
 * Uses shared getTorrentDetailedStateLabel for raw-state detail labels.
 */
function formatState(state: string): string {
  return getTorrentDetailedStateLabel(state) || '-';
}

// ============================================================================
// Column Definition Interface
// ============================================================================

export interface ColumnDefinition {
  /** Unique identifier for the column */
  id: string;
  /** Display label for the column header */
  label: string;
  /** Torrent field this column renders */
  field: keyof Torrent;
  /** Function to render the cell value from a torrent */
  formatter: (torrent: Torrent) => React.ReactNode;
  /** Whether column is visible by default */
  defaultVisibility: boolean;
  /** Minimum column width in pixels */
  minWidth: number;
  /** Text alignment for the column */
  align: 'left' | 'center' | 'right';
  /** Whether column supports sorting */
  sortable: boolean;
  /** Whether column width is user-resizable */
  resizable: boolean;
  /**
   * Whether column data is deferred/poor quality.
   * Deferred columns may have unreliable or missing data from qBittorrent.
   */
  deferred: boolean;
}

// ============================================================================
// Default Columns (always available, visible by default)
// ============================================================================

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  {
    id: 'priority',
    label: '#',
    field: 'priority',
    formatter: (torrent) => (torrent.priority > 0 ? String(torrent.priority) : '*'),
    defaultVisibility: true,
    minWidth: 40,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'name',
    label: 'Name',
    field: 'name',
    formatter: (torrent) => torrent.name,
    defaultVisibility: true,
    minWidth: 200,
    align: 'left',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'size',
    label: 'Size',
    field: 'size',
    formatter: (torrent) => formatBytes(torrent.size),
    defaultVisibility: true,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'progress',
    label: 'Progress',
    field: 'progress',
    formatter: (torrent) => formatProgress(torrent.progress),
    defaultVisibility: true,
    minWidth: 128,
    align: 'left',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'num_seeds',
    label: 'Seeds',
    field: 'num_seeds',
    formatter: (torrent) => formatCountWithTotal(torrent.num_seeds, torrent.num_complete),
    defaultVisibility: true,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'num_leechs',
    label: 'Peers',
    field: 'num_leechs',
    formatter: (torrent) => formatCountWithTotal(torrent.num_leechs, torrent.num_incomplete),
    defaultVisibility: true,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'dlspeed',
    label: 'Down Speed',
    field: 'dlspeed',
    formatter: (torrent) => formatSpeed(torrent.dlspeed),
    defaultVisibility: true,
    minWidth: 96,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'upspeed',
    label: 'Up Speed',
    field: 'upspeed',
    formatter: (torrent) => formatSpeed(torrent.upspeed),
    defaultVisibility: true,
    minWidth: 96,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'eta',
    label: 'ETA',
    field: 'eta',
    formatter: (torrent) => formatEta(torrent.eta),
    defaultVisibility: true,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'ratio',
    label: 'Ratio',
    field: 'ratio',
    formatter: (torrent) => formatRatio(torrent.ratio),
    defaultVisibility: true,
    minWidth: 64,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'category',
    label: 'Category',
    field: 'category',
    formatter: (torrent) => torrent.category || '-',
    defaultVisibility: true,
    minWidth: 96,
    align: 'left',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'tags',
    label: 'Tags',
    field: 'tags',
    formatter: (torrent) => formatTags(torrent.tags),
    defaultVisibility: true,
    minWidth: 120,
    align: 'left',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'added_on',
    label: 'Added On',
    field: 'added_on',
    formatter: (torrent) => formatDate(torrent.added_on),
    defaultVisibility: true,
    minWidth: 96,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
];

// ============================================================================
// Optional Columns (available but hidden by default)
// ============================================================================

const OPTIONAL_COLUMNS: ColumnDefinition[] = [
  {
    id: 'state',
    label: 'Status',
    field: 'state',
    formatter: (torrent) => formatState(torrent.state),
    defaultVisibility: false,
    minWidth: 96,
    align: 'left',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'total_size',
    label: 'Total Size',
    field: 'total_size',
    formatter: (torrent) => formatBytes(torrent.total_size),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'tracker',
    label: 'Tracker',
    field: 'tracker',
    formatter: (torrent) => formatTracker(torrent.tracker),
    defaultVisibility: false,
    minWidth: 140,
    align: 'left',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'dl_limit',
    label: 'Down Limit',
    field: 'dl_limit',
    formatter: (torrent) => formatTransferLimit(torrent.dl_limit),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'up_limit',
    label: 'Up Limit',
    field: 'up_limit',
    formatter: (torrent) => formatTransferLimit(torrent.up_limit),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'downloaded',
    label: 'Downloaded',
    field: 'downloaded',
    formatter: (torrent) => formatBytes(torrent.downloaded),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'uploaded',
    label: 'Uploaded',
    field: 'uploaded',
    formatter: (torrent) => formatBytes(torrent.uploaded),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'downloaded_session',
    label: 'Session Download',
    field: 'downloaded_session',
    formatter: (torrent) => formatBytes(torrent.downloaded_session),
    defaultVisibility: false,
    minWidth: 96,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'uploaded_session',
    label: 'Session Upload',
    field: 'uploaded_session',
    formatter: (torrent) => formatBytes(torrent.uploaded_session),
    defaultVisibility: false,
    minWidth: 96,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'amount_left',
    label: 'Remaining',
    field: 'amount_left',
    formatter: (torrent) => formatBytes(torrent.amount_left),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'time_active',
    label: 'Time Active',
    field: 'time_active',
    formatter: (torrent) => formatDuration(torrent.time_active),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'seeding_time',
    label: 'Seeding Time',
    field: 'seeding_time',
    formatter: (torrent) => formatDuration(torrent.seeding_time),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'save_path',
    label: 'Save Path',
    field: 'save_path',
    formatter: (torrent) => torrent.save_path || '-',
    defaultVisibility: false,
    minWidth: 180,
    align: 'left',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'completed',
    label: 'Completed',
    field: 'completed',
    formatter: (torrent) => formatBytes(torrent.completed),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'ratio_limit',
    label: 'Ratio Limit',
    field: 'ratio_limit',
    formatter: (torrent) => formatRatioLimit(torrent.ratio_limit),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'completion_on',
    label: 'Completed On',
    field: 'completion_on',
    formatter: (torrent) => formatDate(torrent.completion_on),
    defaultVisibility: false,
    minWidth: 96,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'seen_complete',
    label: 'Last Seen Complete',
    field: 'seen_complete',
    formatter: (torrent) => formatSeenComplete(torrent.seen_complete),
    defaultVisibility: false,
    minWidth: 120,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'last_activity',
    label: 'Last Activity',
    field: 'last_activity',
    formatter: (torrent) => formatDateTime(torrent.last_activity),
    defaultVisibility: false,
    minWidth: 120,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'availability',
    label: 'Availability',
    field: 'availability',
    formatter: (torrent) => formatAvailability(torrent.availability),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'popularity',
    label: 'Popularity',
    field: 'popularity' as keyof Torrent,
    formatter: (torrent) => formatPopularity(torrent.popularity),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: true,
  },
  {
    id: 'download_path',
    label: 'Incomplete Save Path',
    field: 'download_path',
    formatter: (torrent) => torrent.download_path || '-',
    defaultVisibility: false,
    minWidth: 180,
    align: 'left',
    sortable: false,
    resizable: true,
    deferred: false,
  },
  {
    id: 'infohash_v1',
    label: 'Info Hash v1',
    field: 'infohash_v1',
    formatter: (torrent) => torrent.infohash_v1 || '-',
    defaultVisibility: false,
    minWidth: 180,
    align: 'left',
    sortable: false,
    resizable: true,
    deferred: false,
  },
  {
    id: 'infohash_v2',
    label: 'Info Hash v2',
    field: 'infohash_v2',
    formatter: (torrent) => torrent.infohash_v2 || '-',
    defaultVisibility: false,
    minWidth: 180,
    align: 'left',
    sortable: false,
    resizable: true,
    deferred: false,
  },
  {
    id: 'reannounce',
    label: 'Reannounce In',
    field: 'reannounce' as keyof Torrent,
    formatter: (torrent) => formatReannounce(torrent.reannounce),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: false,
    resizable: true,
    deferred: true,
  },
  {
    id: 'isPrivate',
    label: 'Private',
    field: 'isPrivate' as keyof Torrent,
    formatter: (torrent) => (torrent.isPrivate !== undefined ? formatBoolean(torrent.isPrivate) : '-'),
    defaultVisibility: false,
    minWidth: 64,
    align: 'center',
    sortable: false,
    resizable: true,
    deferred: true,
  },
  {
    id: 'force_start',
    label: 'Force Start',
    field: 'force_start',
    formatter: (torrent) => formatBoolean(torrent.force_start),
    defaultVisibility: false,
    minWidth: 80,
    align: 'center',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'num_complete',
    label: 'Seeds (Total)',
    field: 'num_complete',
    formatter: (torrent) => formatCount(torrent.num_complete),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
  {
    id: 'num_incomplete',
    label: 'Peers (Total)',
    field: 'num_incomplete',
    formatter: (torrent) => formatCount(torrent.num_incomplete),
    defaultVisibility: false,
    minWidth: 80,
    align: 'right',
    sortable: true,
    resizable: true,
    deferred: false,
  },
];

// ============================================================================
// Complete Registry
// ============================================================================

export const COLUMN_REGISTRY: ColumnDefinition[] = [...DEFAULT_COLUMNS, ...OPTIONAL_COLUMNS];

// Lookup map for fast access
export const COLUMN_MAP: Record<string, ColumnDefinition> = COLUMN_REGISTRY.reduce(
  (acc, col) => {
    acc[col.id] = col;
    return acc;
  },
  {} as Record<string, ColumnDefinition>
);


// ============================================================================
// Sortable Columns (subset of registry)
// ============================================================================

export const SORTABLE_COLUMNS = COLUMN_REGISTRY.filter((col) => col.sortable);

export const SORTABLE_COLUMN_IDS: string[] = SORTABLE_COLUMNS.map((col) => col.id);

// ============================================================================
// Deferred Columns (columns with poor/unreliable data)
// ============================================================================

export const DEFERRED_COLUMNS = COLUMN_REGISTRY.filter((col) => col.deferred);

export const DEFERRED_COLUMN_IDS: string[] = DEFERRED_COLUMNS.map((col) => col.id);
