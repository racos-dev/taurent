import type { Torrent } from '../types/qbittorrent';
import type { StatusType } from '../components/StatusBadge/types';

export type TorrentDisplayStatus =
  | 'downloading'
  | 'seeding'
  | 'paused'
  | 'completed'
  | 'error'
  | 'checking'
  | 'moving'
  | 'queued';

const STATE_TO_DISPLAY_STATUS: Record<string, TorrentDisplayStatus> = {
  error: 'error',
  missingFiles: 'error',
  uploading: 'seeding',
  stoppedUP: 'completed',
  queuedUP: 'queued',
  stalledUP: 'seeding',
  checkingUP: 'checking',
  forcedUP: 'seeding',
  allocating: 'checking',
  downloading: 'downloading',
  metaDL: 'downloading',
  stoppedDL: 'paused',
  queuedDL: 'queued',
  stalledDL: 'downloading',
  checkingDL: 'checking',
  forcedDL: 'downloading',
  checkingResumeData: 'checking',
  moving: 'moving',
  unknown: 'error',
};

export const getTorrentDisplayStatus = (torrent: Torrent): TorrentDisplayStatus => {
  return STATE_TO_DISPLAY_STATUS[torrent.state] || 'error';
};

export const getStatusLabel = (status: TorrentDisplayStatus): string => {
  const labels: Record<TorrentDisplayStatus, string> = {
    downloading: 'Downloading',
    seeding: 'Seeding',
    paused: 'Paused',
    completed: 'Completed',
    error: 'Error',
    queued: 'Queued',
    checking: 'Checking',
    moving: 'Moving',
  };
  return labels[status];
};

export const TORRENT_STATE_LABELS: Record<string, string> = {
  error: 'Error',
  missingFiles: 'Missing Files',
  uploading: 'Seeding',
  stoppedUP: 'Completed',
  queuedUP: 'Queued',
  stalledUP: 'Stalled',
  checkingUP: 'Checking',
  forcedUP: 'Seeding',
  allocating: 'Allocating',
  downloading: 'Downloading',
  metaDL: 'Metadata DL',
  stoppedDL: 'Paused',
  queuedDL: 'Queued',
  stalledDL: 'Stalled',
  checkingDL: 'Checking',
  forcedDL: 'Downloading',
  checkingResumeData: 'Checking',
  moving: 'Moving',
  unknown: 'Unknown',
};

/**
 * Detailed raw-state labels for detail/state displays.
 * Preserves (DL)/(UP) suffix for states where direction matters.
 * Use getStatusLabel + getTorrentDisplayStatus for normalized summary labels.
 */
export const TORRENT_DETAILED_STATE_LABELS: Record<string, string> = {
  error: 'Error',
  missingFiles: 'Missing Files',
  uploading: 'Seeding',
  stoppedUP: 'Paused (UP)',
  queuedUP: 'Queued (UP)',
  stalledUP: 'Stalled (UP)',
  checkingUP: 'Checking (UP)',
  forcedUP: 'Forced Upload',
  allocating: 'Allocating',
  downloading: 'Downloading',
  metaDL: 'Downloading Metadata',
  stoppedDL: 'Paused (DL)',
  queuedDL: 'Queued (DL)',
  stalledDL: 'Stalled (DL)',
  checkingDL: 'Checking (DL)',
  forcedDL: 'Forced Download',
  checkingResumeData: 'Checking Resume',
  moving: 'Moving',
  unknown: 'Unknown',
};

/**
 * Returns a detailed raw-state label for use in detail/state displays.
 * Unlike getStatusLabel which returns normalized summary labels (e.g. "Seeding"),
 * this preserves direction suffix for stopped/queued/stalled states.
 */
export const getTorrentDetailedStateLabel = (state: string): string => {
  return TORRENT_DETAILED_STATE_LABELS[state] || state;
};

export const formatTorrentStatus = (state: string, torrent?: Torrent): string => {
  if (torrent) {
    const displayStatus = getTorrentDisplayStatus(torrent);
    return getStatusLabel(displayStatus);
  }
  return TORRENT_STATE_LABELS[state] || state;
};

/**
 * Maps TorrentDisplayStatus to StatusType for use with StatusBadge.
 * 'queued' is not in StatusType, so it maps to 'inactive'.
 */
export const toStatusBadgeStatus = (status: TorrentDisplayStatus): StatusType => {
  if (status === 'queued') return 'inactive';
  return status as StatusType;
};

/**
 * Returns Tailwind color classes for a given torrent display status.
 * Supports 'badge', 'progress', and 'bar' variants.
 *
 * Uses dedicated status tokens matching StatusBadge to ensure visual consistency
 * across all themes. Uses pre-defined -15 alpha variant tokens instead of
 * Tailwind opacity modifiers because status tokens are plain var(--color-*) values
 * without rgb channels. Border uses base status color (no alpha) matching StatusBadge.
 */
export const getStatusColorClass = (
  status: TorrentDisplayStatus,
  variant: 'badge' | 'progress' | 'bar'
): string => {
  switch (status) {
    case 'downloading':
      return variant === 'badge'
        ? 'border-status-downloading bg-status-downloading-15 text-status-downloading'
        : 'bg-status-downloading';
    case 'seeding':
    case 'completed':
      return variant === 'badge'
        ? 'border-status-seeding bg-status-seeding-15 text-status-seeding'
        : 'bg-status-seeding';
    case 'error':
      return variant === 'badge'
        ? 'border-error bg-error-20 text-error'
        : 'bg-error';
    case 'checking':
    case 'moving':
      return variant === 'badge'
        ? 'border-status-checking bg-status-checking-15 text-status-checking'
        : 'bg-status-checking';
    case 'paused':
    case 'queued':
    default:
      return variant === 'badge'
        ? 'border-status-paused bg-status-paused-15 text-status-paused'
        : 'bg-status-paused';
  }
};
