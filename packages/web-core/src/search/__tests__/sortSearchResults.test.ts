import { describe, it, expect } from 'vitest';
import type { SearchResult } from '@taurent/bridge';
import {
  sortSearchResults,
  DEFAULT_SEARCH_SORT_KEY,
  DEFAULT_SEARCH_SORT_DIRECTION,
} from '../sortSearchResults';

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    descrLink: '',
    fileName: 'file',
    fileSize: 0,
    fileUrl: '',
    nbLeechers: 0,
    nbSeeders: 0,
    siteUrl: '',
    ...overrides,
  };
}

const names = (results: readonly SearchResult[]) => results.map((r) => r.fileName);

describe('sortSearchResults', () => {
  it('sorts by seeders descending', () => {
    const results = [
      makeResult({ fileName: 'a', nbSeeders: 5 }),
      makeResult({ fileName: 'b', nbSeeders: 50 }),
      makeResult({ fileName: 'c', nbSeeders: 12 }),
    ];
    expect(names(sortSearchResults(results, 'seeders', 'desc'))).toEqual(['b', 'c', 'a']);
  });

  it('sorts by seeders ascending', () => {
    const results = [
      makeResult({ fileName: 'a', nbSeeders: 5 }),
      makeResult({ fileName: 'b', nbSeeders: 50 }),
      makeResult({ fileName: 'c', nbSeeders: 12 }),
    ];
    expect(names(sortSearchResults(results, 'seeders', 'asc'))).toEqual(['a', 'c', 'b']);
  });

  it('sorts by leechers', () => {
    const results = [
      makeResult({ fileName: 'a', nbLeechers: 3 }),
      makeResult({ fileName: 'b', nbLeechers: 1 }),
      makeResult({ fileName: 'c', nbLeechers: 9 }),
    ];
    expect(names(sortSearchResults(results, 'leechers', 'desc'))).toEqual(['c', 'a', 'b']);
    expect(names(sortSearchResults(results, 'leechers', 'asc'))).toEqual(['b', 'a', 'c']);
  });

  it('sorts by size', () => {
    const results = [
      makeResult({ fileName: 'a', fileSize: 5_000 }),
      makeResult({ fileName: 'b', fileSize: 5_000_000_000 }),
      makeResult({ fileName: 'c', fileSize: 500 }),
    ];
    expect(names(sortSearchResults(results, 'size', 'desc'))).toEqual(['b', 'a', 'c']);
    expect(names(sortSearchResults(results, 'size', 'asc'))).toEqual(['c', 'a', 'b']);
  });

  it('sorts by name case-insensitively and numerically', () => {
    const results = [
      makeResult({ fileName: 'Zeta' }),
      makeResult({ fileName: 'alpha' }),
      makeResult({ fileName: 'file10' }),
      makeResult({ fileName: 'file2' }),
    ];
    // Ascending: case-insensitive alpha order, digits compared numerically.
    expect(names(sortSearchResults(results, 'name', 'asc'))).toEqual([
      'alpha',
      'file2',
      'file10',
      'Zeta',
    ]);
    expect(names(sortSearchResults(results, 'name', 'desc'))).toEqual([
      'Zeta',
      'file10',
      'file2',
      'alpha',
    ]);
  });

  it('does not mutate the input array', () => {
    const results = [
      makeResult({ fileName: 'a', nbSeeders: 1 }),
      makeResult({ fileName: 'b', nbSeeders: 2 }),
    ];
    const snapshot = names(results);
    sortSearchResults(results, 'seeders', 'desc');
    expect(names(results)).toEqual(snapshot);
  });

  it('is stable for equal keys', () => {
    const results = [
      makeResult({ fileName: 'first', nbSeeders: 10 }),
      makeResult({ fileName: 'second', nbSeeders: 10 }),
      makeResult({ fileName: 'third', nbSeeders: 10 }),
    ];
    expect(names(sortSearchResults(results, 'seeders', 'desc'))).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('treats -1 unknown sentinels as smallest and sorts them last when descending', () => {
    const results = [
      makeResult({ fileName: 'known', nbSeeders: 4 }),
      makeResult({ fileName: 'unknown', nbSeeders: -1 }),
      makeResult({ fileName: 'more', nbSeeders: 8 }),
    ];
    expect(names(sortSearchResults(results, 'seeders', 'desc'))).toEqual([
      'more',
      'known',
      'unknown',
    ]);
  });

  it('handles empty input', () => {
    expect(sortSearchResults([], 'seeders', 'desc')).toEqual([]);
  });

  it('exposes sensible defaults', () => {
    expect(DEFAULT_SEARCH_SORT_KEY).toBe('seeders');
    expect(DEFAULT_SEARCH_SORT_DIRECTION).toBe('desc');
  });
});
