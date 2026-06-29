// Headless controller for the mobile home torrent workspace.
//
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Centralizes the headless shaping of the mobile home workspace:
//   - sort label derivation
//   - non-default sort signal
//   - summary items (filter/sort summary chips)
//   - result count
//
// App-owned concerns kept in the mobile HomeScreen route:
//   - useNavigate / route transitions
//   - useSearchParams (URL param read)
//   - useSortPreference (mobile app-local storage)
//   - useTorrents (filter/sort derivation via web-core hook)
//   - selection state
//   - show/hide UI toggles
//   - batch actions wiring
//
// Usage (mobile HomeScreen):
//   const controller = useMobileHomeController({
//     sortOptions: SORT_OPTIONS,
//     sortBy,
//     sortOrder,
//     torrents,
//   });
//
// The controller accepts sort config and the already-derived torrents list
// so it can produce sortLabel, hasNonDefaultSort, and summaryItems without
// re-doing the filter/sort derivation that useTorrents handles.
//
// Factory form accepts a scope provider so mobile can wire in useQBClient
// from app code (matching the createTorrentsHook pattern).

import { useMemo } from 'react';
import {
  isTorrentFilterType,
  type SortField,
  type TorrentFilterType,
} from '@taurent/shared';
import type { Torrent } from '@taurent/shared/types/qbittorrent';
import type { QBClientContextValue } from '../../session';
import { formatLabel } from '@taurent/shared';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SortOption {
  value: SortField;
  label: string;
  defaultOrder: 'asc' | 'desc';
}

export interface UseMobileHomeOptions {
  /** The already-derived torrent list (from useTorrents). */
  torrents: Torrent[];
  /** The active status filter (from URL). */
  statusFilter?: TorrentFilterType | string | null;
  /** The active category filter (from URL). */
  category?: string | null;
  /** The active tag filter (from URL). */
  tag?: string | null;
  /** The active tracker filter (from URL). */
  tracker?: string | null;
  /** The active search string. */
  search?: string | null;
}

export interface UseMobileHomeResult {
  // ─── Result count ───────────────────────────────────────────────
  resultCount: number;

  // ─── Filter summary chips ───────────────────────────────────────
  summaryItems: Array<{ label: string; tone?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger' }>;
}

// ─── Factory ───────────────────────────────────────────────────────────────────

/**
 * Headless hook factory for the mobile home torrent workspace.
 *
 * Platform-agnostic — does not import @tauri-apps/* or produce UI.
 * Takes a scope provider (useQBClient from app code) to match the existing
 * factory pattern used by shared hooks and leave room for future
 * connection-aware shaping.
 */
export function createMobileHomeController(
  _scopeProvider: () => QBClientContextValue
) {
  return function useMobileHomeController({
    torrents,
    statusFilter,
    category,
    tag,
    tracker,
    search,
  }: UseMobileHomeOptions): UseMobileHomeResult {
    // ─── Result count ─────────────────────────────────────────────
    const resultCount = torrents.length;

    // ─── Filter summary chips ─────────────────────────────────────
    // Mirror the derivation that HomeScreen currently does inline via useFilterSummary.
    // The controller accepts the raw filter values and produces the formatted summary items.
    const summaryItems = useMemo(() => {
      const items: Array<{ label: string; tone?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger' }> = [];

      if (statusFilter && isTorrentFilterType(statusFilter)) {
        items.push({ label: formatLabel(statusFilter as TorrentFilterType), tone: 'primary' });
      }
      if (category) {
        items.push({ label: `Category: ${category}` });
      }
      if (tag) {
        items.push({ label: `Tag: ${tag}` });
      }
      if (tracker) {
        try {
          const hostname = new URL(tracker).hostname;
          items.push({ label: `Tracker: ${hostname}` });
        } catch {
          items.push({ label: `Tracker: ${tracker}` });
        }
      }
      if (search) {
        items.push({ label: `Search: ${search}` });
      }

      return items;
    }, [statusFilter, category, tag, tracker, search]);

    return {
      resultCount,
      summaryItems,
    };
  };
}
