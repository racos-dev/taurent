// Torrent filter/domain logic — shared across desktop, mobile, and web-core.
// This module contains canonical filter type definitions, state mappings,
// and matching predicates. Pure UI concerns (icons, labels) live in the
// consuming package (desktop/mobile).
//
// Package boundaries:
//   - @taurent/shared: defines TorrentFilterType, FilterStatus, state mappings, matching functions
//   - @taurent/web-core: imports matching functions for server-side filtering
//   - desktop/mobile: import TorrentFilterType and options for UI rendering
//
// Architecture note: web-core is allowed to import from @taurent/shared
// because shared is a pure TypeScript package with no Tauri dependency.
// The accepted coupling is: web-core → shared (not web-core → bridge/desktop).

import type { Torrent } from '../types/qbittorrent';

/**
 * Canonical FilterStatus type used in stores and UI.
 * Defined here (not in store) to avoid circular dependencies.
 */
export type FilterStatus =
  | 'all'
  | 'downloading'
  | 'seeding'
  | 'completed'
  | 'paused'
  | 'stopped'
  | 'resumed'
  | 'stalled'
  | 'stalled_uploading'
  | 'stalled_downloading'
  | 'checking'
  | 'error'
  | 'active'
  | 'inactive'
  | 'running';

export type TorrentFilterType =
  | 'all'
  | 'downloading'
  | 'seeding'
  | 'completed'
  | 'stopped'
  | 'active'
  | 'inactive'
  | 'running'
  | 'stalled'
  | 'stalled_uploading'
  | 'stalled_downloading'
  | 'errored';

/**
 * Canonical mapping from app-level FilterStatus (used in stores/UI)
 * to TorrentFilterType (used for torrent state matching).
 * Exported so desktop/store consumers don't duplicate this mapping.
 */
export const FILTER_STATUS_TO_FILTER_TYPE: Record<FilterStatus, TorrentFilterType> = {
  all: 'all',
  downloading: 'downloading',
  seeding: 'seeding',
  completed: 'completed',
  paused: 'stopped',
  stopped: 'stopped',
  resumed: 'all',
  stalled: 'stalled',
  stalled_uploading: 'stalled_uploading',
  stalled_downloading: 'stalled_downloading',
  checking: 'all',
  error: 'errored',
  active: 'active',
  inactive: 'inactive',
  running: 'running',
};

/**
 * Inverse mapping from TorrentFilterType to FilterStatus.
 * Useful for UI that needs to derive FilterStatus from TorrentFilterType (e.g., sidebar counts).
 */
export const FILTER_TYPE_TO_STATUS: Record<TorrentFilterType, FilterStatus> = {
  all: 'all',
  downloading: 'downloading',
  seeding: 'seeding',
  completed: 'completed',
  stopped: 'stopped',
  active: 'active',
  inactive: 'inactive',
  running: 'running',
  stalled: 'stalled',
  stalled_uploading: 'stalled_uploading',
  stalled_downloading: 'stalled_downloading',
  errored: 'error',
};

const TORRENT_STATES_FOR_FILTER: Record<TorrentFilterType, readonly string[]> = {
  all: [],
  downloading: ['downloading', 'stalledDL', 'metaDL'],
  seeding: ['uploading', 'stalledUP'],
  completed: ['uploading', 'stalledUP', 'queuedUP', 'stoppedUP'],
  stopped: ['stoppedDL', 'stoppedUP'],
  running: ['downloading', 'uploading', 'forcedDL', 'forcedUP'],
  stalled: ['stalledDL', 'stalledUP'],
  stalled_uploading: ['stalledUP'],
  stalled_downloading: ['stalledDL'],
  active: ['downloading', 'stalledDL', 'uploading', 'stalledUP'],
  inactive: ['queuedDL', 'queuedUP', 'stoppedDL', 'stoppedUP'],
  errored: ['error', 'missingFiles'],
};

export const TORRENT_FILTER_OPTIONS = [
  { value: 'all' as TorrentFilterType, label: 'All' },
  { value: 'downloading' as TorrentFilterType, label: 'Downloading' },
  { value: 'seeding' as TorrentFilterType, label: 'Seeding' },
  { value: 'completed' as TorrentFilterType, label: 'Completed' },
  { value: 'stopped' as TorrentFilterType, label: 'Paused' },
  { value: 'active' as TorrentFilterType, label: 'Active' },
  { value: 'inactive' as TorrentFilterType, label: 'Inactive' },
  { value: 'running' as TorrentFilterType, label: 'Running' },
  { value: 'stalled' as TorrentFilterType, label: 'Stalled' },
  { value: 'stalled_uploading' as TorrentFilterType, label: 'Stalled Uploading' },
  { value: 'stalled_downloading' as TorrentFilterType, label: 'Stalled Downloading' },
  { value: 'errored' as TorrentFilterType, label: 'Errored' },
] as const;

export const isTorrentFilterType = (value: string): value is TorrentFilterType => {
  return Object.prototype.hasOwnProperty.call(TORRENT_STATES_FOR_FILTER, value);
};

export const matchesTorrentFilter = (filter: TorrentFilterType, torrent: Torrent): boolean => {
  if (filter === 'all') {
    return true;
  }

  const states = TORRENT_STATES_FOR_FILTER[filter];
  if (!states || states.length === 0) {
    return false;
  }

  return states.includes(torrent.state);
};

export const matchesTorrentSearch = (torrent: Torrent, searchQuery: string): boolean => {
  if (!searchQuery.trim()) {
    return true;
  }

  const normalizedSearch = searchQuery
    .toLowerCase()
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedName = torrent.name
    .toLowerCase()
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ');

  return normalizedName.includes(normalizedSearch);
};

/**
 * Parse a torrent's comma-separated tags string into an array of trimmed, non-empty tags.
 */
export const parseTorrentTags = (tags: string | undefined): string[] => {
  if (!tags) {
    return [];
  }
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

/**
 * Check if a torrent has a specific tag.
 */
export const torrentHasTag = (torrent: Torrent, tag: string): boolean => {
  const torrentTags = parseTorrentTags(torrent.tags);
  return torrentTags.includes(tag);
};

/**
 * Check if a torrent's tracker matches the given tracker URL.
 * Tracker filters are currently URL-based in desktop UI, so use exact normalized matching.
 */
export const matchesTorrentTracker = (torrent: Torrent, trackerFilter: string): boolean => {
  if (!trackerFilter) {
    return true;
  }

  return (torrent.tracker ?? '').trim().toLowerCase() === trackerFilter.trim().toLowerCase();
};
