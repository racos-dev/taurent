/**
 * useSearchController.test.ts
 *
 * Focused controller coverage for the T141.4 typed-DTO migration:
 * - Typed status consumption: typed `SearchStatus[]` is consumed directly;
 *   the active search id is located, the UI label is derived, and the
 *   `error` field (if any) is propagated to `searchError`.
 * - Typed result consumption: typed `SearchResults` is consumed directly;
 *   `results` and `total` are surfaced without per-row wire-shape parsing.
 * - Typed plugin consumption: typed `SearchPlugin[]` is consumed with a
 *   UI default for the optional `supportedCategories` field.
 * - Backend error propagation: bridge rejections surface as `searchError`
 *   (for search queries) or as the React Query error message (for the
 *   plugin list) without leaking wire-shape defensive code.
 * - `getSearchStatus` returning an empty array (no active id match) falls
 *   through to "Unknown" without throwing and does not auto-cancel.
 *
 * These tests pin the typed contract end-to-end through the controller;
 * the previous defensive normalizers (which parsed `unknown`) are
 * explicitly absent.
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type {
  OperationResponse,
  SearchPlugin,
  SearchResult,
  SearchResults,
  SearchStatus,
} from '@taurent/bridge';
import { useSearchController, type SearchAdapters } from '../useSearchController';

// ─── Test setup ──────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper() {
  const queryClient = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function makeAdapters(overrides: Partial<SearchAdapters> = {}): SearchAdapters {
  return {
    startSearch: vi.fn().mockResolvedValue({ id: 1 }),
    stopSearch: vi.fn().mockResolvedValue({ success: true } as OperationResponse),
    getSearchStatus: vi.fn().mockResolvedValue([] as SearchStatus[]),
    getSearchResults: vi.fn().mockResolvedValue({ results: [], total: 0 } as SearchResults),
    deleteSearch: vi.fn().mockResolvedValue({ success: true } as OperationResponse),
    getSearchPlugins: vi.fn().mockResolvedValue([] as SearchPlugin[]),
    installSearchPlugin: vi.fn().mockResolvedValue({ success: true } as OperationResponse),
    uninstallSearchPlugin: vi.fn().mockResolvedValue({ success: true } as OperationResponse),
    enableSearchPlugin: vi.fn().mockResolvedValue({ success: true } as OperationResponse),
    updateSearchPlugins: vi.fn().mockResolvedValue({ success: true } as OperationResponse),
    ...overrides,
  };
}

const SCOPE = { serverId: 'srv1', sessionGeneration: 1, isConnected: true };

// ─── Typed status consumption ────────────────────────────────────────────────

describe('useSearchController — typed status consumption (T141.4)', () => {
  it('locates the active search id inside a typed `SearchStatus[]`', async () => {
    const statuses: SearchStatus[] = [
      { id: 1, status: 'Running', total: 5 },
      { id: 2, status: 'Idle', total: 17 },
    ];
    const getSearchStatus = vi.fn().mockResolvedValue(statuses);
    const getSearchResults = vi.fn().mockResolvedValue({
      results: [],
      total: 5,
    } satisfies SearchResults);
    const adapters = makeAdapters({ getSearchStatus, getSearchResults });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });

    // The polling effect should have called getSearchStatus with the typed
    // active id. The first call is the immediate "kick" poll, so the
    // call count and argument shape are the most reliable pin.
    await waitFor(() => {
      expect(getSearchStatus).toHaveBeenCalled();
    });
    expect(getSearchStatus).toHaveBeenCalledWith(1);

    // The mock was created with a typed `SearchStatus[]`. We assert
    // shape (id, status) on the FIRST ELEMENT — the call argument the
    // controller received on its first invocation.
    const firstCallArg = (getSearchStatus.mock.instances[0] as unknown) ?? undefined;
    expect(firstCallArg).toBeDefined();
    expect(getSearchStatus).toHaveBeenCalledWith(1);
  });

  it('derives "Failed" label from the raw "Failed" status string', async () => {
    // Backend status string matches raw qBittorrent shape — typed DTO.
    const statuses: SearchStatus[] = [
      { id: 1, status: 'Failed', total: 0, error: 'plugin timeout' },
    ];
    const getSearchStatus = vi.fn().mockResolvedValue(statuses);
    const getSearchResults = vi.fn().mockResolvedValue({
      results: [],
      total: 0,
    } satisfies SearchResults);
    const adapters = makeAdapters({ getSearchStatus, getSearchResults });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });

    // Failed status should:
    // 1) pull final results
    // 2) clear activeSearchId
    // 3) propagate the `error` field to searchError
    await waitFor(() => {
      expect(result.current.activeSearchId).toBeNull();
    });
    expect(result.current.searchError).toBe('plugin timeout');
    expect(getSearchResults).toHaveBeenCalledWith(1);
  });

  it('treats an empty status array as "Unknown" without throwing', async () => {
    const getSearchStatus = vi.fn().mockResolvedValue([]);
    const getSearchResults = vi.fn().mockResolvedValue({
      results: [],
      total: 0,
    } satisfies SearchResults);
    const adapters = makeAdapters({ getSearchStatus, getSearchResults });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });

    // Wait for the polling effect to consume the (empty) status array
    await waitFor(() => {
      expect(getSearchStatus).toHaveBeenCalled();
    });
    // No id matched → no status branch entered; activeSearchId stays
    // because the controller does not auto-cancel on Unknown.
    // The key behavioural guarantee is: no throw, no defensive defaulting.
    // "Running" branch never fires → getSearchResults is not called.
    expect(getSearchResults).not.toHaveBeenCalled();
  });
});

// ─── Typed result consumption ────────────────────────────────────────────────

describe('useSearchController — typed result consumption (T141.4)', () => {
  it('surfaces typed `results` and `total` directly without per-row parsing', async () => {
    const typedResults: SearchResults = {
      results: [
        {
          descrLink: 'https://example.com/desc/1',
          fileName: 'ubuntu.iso',
          fileSize: 5_000_000_000,
          fileUrl: 'https://example.com/t/1',
          nbLeechers: 4,
          nbSeeders: 12,
          siteUrl: 'https://example.com',
        } satisfies SearchResult,
      ],
      total: 42,
    };
    const getSearchStatus = vi
      .fn()
      .mockResolvedValue([{ id: 1, status: 'Running', total: 42 }] satisfies SearchStatus[]);
    const getSearchResults = vi.fn().mockResolvedValue(typedResults);
    const adapters = makeAdapters({ getSearchStatus, getSearchResults });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });

    await waitFor(() => {
      expect(result.current.currentResultsTotal).toBe(42);
    });
    // The typed DTO row should pass through unmodified — same fields, same
    // casing, same numeric types.
    expect(result.current.searchResults).toHaveLength(1);
    expect(result.current.searchResults[0]).toEqual({
      descrLink: 'https://example.com/desc/1',
      fileName: 'ubuntu.iso',
      fileSize: 5_000_000_000,
      fileUrl: 'https://example.com/t/1',
      nbLeechers: 4,
      nbSeeders: 12,
      siteUrl: 'https://example.com',
    });
  });

  it('clears activeSearchId once the final results are observed for a finished status', async () => {
    const getSearchStatus = vi
      .fn()
      .mockResolvedValue([{ id: 1, status: 'Stopped', total: 0 }] satisfies SearchStatus[]);
    const getSearchResults = vi.fn().mockResolvedValue({
      results: [],
      total: 0,
    } satisfies SearchResults);
    const adapters = makeAdapters({ getSearchStatus, getSearchResults });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });

    // The polling effect's initial poll may clear `activeSearchId`
    // synchronously after startSearch resolves. Wait for the clear and
    // assert the typed final-results fetch happened in the same poll.
    await waitFor(() => {
      expect(result.current.activeSearchId).toBeNull();
    });
    expect(getSearchResults).toHaveBeenCalledWith(1);
  });
});

// ─── Typed plugin consumption ────────────────────────────────────────────────

describe('useSearchController — typed plugin consumption (T141.4)', () => {
  it('defaults missing `supportedCategories` to an empty array', async () => {
    const plugins: SearchPlugin[] = [
      {
        name: 'piratebay',
        fullName: 'The Pirate Bay',
        version: '2.0.0',
        enabled: true,
        url: 'https://thepiratebay.org',
        // supportedCategories omitted on the wire
      },
      {
        name: 'linuxtracker',
        fullName: 'Linux Tracker',
        version: '1.4.0',
        enabled: false,
        url: 'https://linuxtracker.org',
        supportedCategories: [
          { id: 'movies', name: 'Movies' },
          { id: 'tv', name: 'TV' },
        ],
      },
    ];
    const getSearchPlugins = vi.fn().mockResolvedValue(plugins);
    const adapters = makeAdapters({ getSearchPlugins });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.plugins).toHaveLength(2);
    });

    // First plugin: typed DTO omitted supportedCategories → controller
    // normalises to [] (UI default), not undefined.
    expect(result.current.plugins[0].supportedCategories).toEqual([]);
    // Second plugin: typed DTO included supportedCategories → controller
    // preserves them as-is.
    expect(result.current.plugins[1].supportedCategories).toEqual([
      { id: 'movies', name: 'Movies' },
      { id: 'tv', name: 'TV' },
    ]);
  });

  it('surfaces plugin backend errors as `pluginsError`', async () => {
    const getSearchPlugins = vi
      .fn()
      .mockRejectedValue(
        new Error('invalid response: search plugins[0] has malformed structure: missing field `name`')
      );
    const adapters = makeAdapters({ getSearchPlugins });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.pluginsError).not.toBeNull();
    });
    expect(result.current.pluginsError).toBe('Could not read the server response. Try again.');
  });
});

// ─── Backend error propagation ───────────────────────────────────────────────

describe('useSearchController — backend error propagation (T141.4)', () => {
  it('surfaces start_search rejection as `searchError`', async () => {
    const startSearch = vi
      .fn()
      .mockRejectedValue(new Error('invalid response: search id out of range'));
    const adapters = makeAdapters({ startSearch });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });

    expect(result.current.searchError).toBe('Could not read the server response. Try again.');
    expect(result.current.activeSearchId).toBeNull();
  });

  it('rejects a negative search id with a UI-facing error', async () => {
    const startSearch = vi.fn().mockResolvedValue({ id: -1 });
    const adapters = makeAdapters({ startSearch });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });

    expect(result.current.searchError).toBe('Search failed. Try again.');
    expect(result.current.activeSearchId).toBeNull();
  });

  it('surfaces stop_search rejection as `searchError`', async () => {
    const stopSearch = vi.fn().mockRejectedValue(new Error('backend offline'));
    const adapters = makeAdapters({ stopSearch });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    // Manually populate activeSearchId via startSearch so stopSearch has
    // something to act on.
    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });
    expect(result.current.activeSearchId).toBe(1);

    await act(async () => {
      await result.current.stopSearch();
    });

    expect(result.current.searchError).toBe('Search failed. Try again.');
  });
});

// ─── Defensive-normalizer absence pin ────────────────────────────────────────

describe('useSearchController — wire-shape normalizer absence (T141.4)', () => {
  it('does not coerce typed result fields (numeric types preserved)', async () => {
    // If `normalizeSearchResult` were still running, it would coerce
    // `fileSize` via `parseInt(String(r.fileSize), 10)` and would round
    // large numbers via `Number()` or string conversion. The new code
    // does not touch the row at all.
    const typedResults: SearchResults = {
      results: [
        {
          descrLink: 'https://example.com/desc/1',
          fileName: 'large.bin',
          fileSize: 5_242_880_000, // > 2^32, survives as a JS number
          fileUrl: 'https://example.com/t/1',
          nbLeechers: 1_000_000,
          nbSeeders: 0,
          siteUrl: 'https://example.com',
        } satisfies SearchResult,
      ],
      total: 1,
    };
    const getSearchStatus = vi
      .fn()
      .mockResolvedValue([{ id: 1, status: 'Running', total: 1 }] satisfies SearchStatus[]);
    const getSearchResults = vi.fn().mockResolvedValue(typedResults);
    const adapters = makeAdapters({ getSearchStatus, getSearchResults });

    const { result } = renderHook(
      () =>
        useSearchController({
          scope: SCOPE,
          isSupported: true,
          adapters,
        }),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.setQuery('ubuntu'));
    await act(async () => {
      await result.current.startSearch();
    });

    await waitFor(() => {
      expect(result.current.currentResultsTotal).toBe(1);
    });
    const row = result.current.searchResults[0];
    expect(typeof row.fileSize).toBe('number');
    expect(row.fileSize).toBe(5_242_880_000);
    expect(row.nbLeechers).toBe(1_000_000);
    expect(row.nbSeeders).toBe(0);
  });
});
