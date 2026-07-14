/**
 * Search result sorting
 *
 * Pure, side-effect-free helpers for ordering the search-result rows returned
 * by the backend. qBittorrent returns results in plugin-emission order, which
 * is rarely what a user wants — sorting by seeder count (or size/name) makes
 * the list far more useful. The logic lives here (headless) so both the
 * desktop and mobile SearchScreens share identical, unit-tested behaviour.
 */

import type { SearchResult } from '@taurent/bridge';

/** Field a search-result list can be ordered by. */
export type SearchSortKey = 'seeders' | 'leechers' | 'size' | 'name';

/** Sort direction. `desc` places the largest / highest value first. */
export type SearchSortDirection = 'asc' | 'desc';

/** Default ordering: most seeders first, the most common torrent-picking heuristic. */
export const DEFAULT_SEARCH_SORT_KEY: SearchSortKey = 'seeders';
export const DEFAULT_SEARCH_SORT_DIRECTION: SearchSortDirection = 'desc';

function compareByKey(a: SearchResult, b: SearchResult, key: SearchSortKey): number {
  switch (key) {
    case 'name':
      // Locale-aware, case-insensitive, and digit-aware so "file2" < "file10".
      return a.fileName.localeCompare(b.fileName, undefined, {
        sensitivity: 'base',
        numeric: true,
      });
    case 'size':
      return a.fileSize - b.fileSize;
    case 'leechers':
      return a.nbLeechers - b.nbLeechers;
    case 'seeders':
      return a.nbSeeders - b.nbSeeders;
  }
}

/**
 * Return a new array of `results` ordered by `sortKey`/`direction`.
 *
 * The input is never mutated. The sort is stable (relies on the ES2019+
 * `Array.prototype.sort` stability guarantee), so rows that compare equal keep
 * their original relative order. Numeric comparisons treat qBittorrent's
 * `-1` "unknown" sentinel as an ordinary small value, which naturally sorts
 * such rows to the bottom in descending order.
 */
export function sortSearchResults(
  results: readonly SearchResult[],
  sortKey: SearchSortKey,
  direction: SearchSortDirection,
): SearchResult[] {
  const directionMultiplier = direction === 'asc' ? 1 : -1;
  return [...results].sort(
    (a, b) => compareByKey(a, b, sortKey) * directionMultiplier,
  );
}
