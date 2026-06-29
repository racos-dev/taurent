/**
 * Search Controller Hook
 *
 * Provides capability-aware Search functionality including:
 * - Search execution with backend-provided ID
 * - Result polling when a search is active
 * - Plugin management (list, enable/disable, install, uninstall, update)
 * - UI-facing mapping of typed bridge search DTOs to normalized shapes
 *
 * Wire-shape parsing for search payloads (status / results / plugins) is now
 * owned by the Rust `qb-core::dto` parsers (T141.1/T141.2); the bridge
 * adapter (T141.3) exposes the typed DTOs and this hook consumes them
 * directly, applying only narrow UI label/casing compatibility.
 *
 * Usage:
 *   const controller = useSearchController({
 *     scope: { serverId, sessionGeneration, isConnected },
 *     isSupported: capabilities?.supportsSearch ?? null,
 *     adapters: {
 *       startSearch: (query, plugins, category) => bridge.qBClient.startSearch(...),
 *       stopSearch: (id) => bridge.qBClient.stopSearch(id),
 *       getSearchStatus: (id?) => bridge.qBClient.getSearchStatus(id),
 *       getSearchResults: (id, limit?, offset?) => bridge.qBClient.getSearchResults(id, limit, offset),
 *       deleteSearch: (id) => bridge.qBClient.deleteSearch(id),
 *       getSearchPlugins: () => bridge.qBClient.getSearchPlugins(),
 *       installSearchPlugin: (sources) => bridge.qBClient.installSearchPlugin(sources),
 *       uninstallSearchPlugin: (names) => bridge.qBClient.uninstallSearchPlugin(names),
 *       enableSearchPlugin: (names, enable) => bridge.qBClient.enableSearchPlugin(names, enable),
 *       updateSearchPlugins: () => bridge.qBClient.updateSearchPlugins(),
 *     },
 *   });
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import type {
  OperationResponse,
  SearchPlugin,
  SearchResult,
  SearchResults,
  SearchStatus,
} from '@taurent/bridge';
import type { QueryScope } from '../query/scope';

// ---------------------------------------------------------------------------
// UI-facing status label
// ---------------------------------------------------------------------------

/**
 * UI-facing status label for a single search. The Rust `SearchStatusDto` and
 * the bridge `SearchStatus` type carry the raw `status` string
 * (e.g. "Running", "Idle", "Stopped", "Paused", "Failed", "Error") exactly
 * as the server returned it. The controller normalises this to a small union
 * of Title-cased labels so consumers can render a stable, comparable value
 * without each screen re-implementing the case/casing map.
 */
export type SearchStatusLabel = 'Idle' | 'Running' | 'Paused' | 'Stopped' | 'Failed' | 'Unknown';

// ---------------------------------------------------------------------------
// Options & Result types
// ---------------------------------------------------------------------------

/**
 * Bridge adapter surface consumed by the search controller.
 *
 * Search DTOs (status / results / plugins) are typed end-to-end: the Rust
 * command returns `qb_core::dto::Search*Dto`, the bridge (T141.3) exposes
 * matching TypeScript interfaces, and this hook consumes those typed shapes
 * directly — no `unknown` coercion, no wire-shape defensive parsing.
 *
 * `startSearch` keeps the existing `{ id: number }` envelope (the Rust
 * command returns a `SearchStartResponse` with extra session context, but
 * the bridge has always discarded that context for the renderer). The
 * typed return means the controller no longer needs to validate the
 * `id` field type, only its sign.
 */
export interface SearchAdapters {
  startSearch: (query: string, plugins: string, category: string) => Promise<{ id: number }>;
  stopSearch: (id: number) => Promise<OperationResponse>;
  getSearchStatus: (id?: number) => Promise<SearchStatus[]>;
  getSearchResults: (id: number, limit?: number, offset?: number) => Promise<SearchResults>;
  deleteSearch: (id: number) => Promise<OperationResponse>;
  getSearchPlugins: () => Promise<SearchPlugin[]>;
  installSearchPlugin: (sources: string) => Promise<OperationResponse>;
  uninstallSearchPlugin: (names: string) => Promise<OperationResponse>;
  enableSearchPlugin: (names: string, enable: boolean) => Promise<OperationResponse>;
  updateSearchPlugins: () => Promise<OperationResponse>;
}

export interface UseSearchControllerOptions {
  scope: QueryScope;
  /** Whether the server supports Search. null = unknown, true = supported, false = not */
  isSupported: boolean | null;
  /** Bridge adapters for search operations */
  adapters: SearchAdapters;
}

export interface UseSearchControllerResult {
  // Capability state
  isSupported: boolean | null;
  isUnsupported: boolean;
  isCapabilityLoading: boolean;

  // Query input state
  query: string;
  setQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedPlugins: string[];
  setSelectedPlugins: (plugins: string[]) => void;

  // Search execution
  activeSearchId: number | null;
  isSearching: boolean;
  searchError: string | null;
  startSearch: (currentQuery?: string) => Promise<void>;
  stopSearch: () => Promise<void>;
  deleteSearch: (id: number) => Promise<void>;

  // Current search results (latest fetched)
  searchResults: SearchResults['results'];
  currentResultsTotal: number;
  isLoadingResults: boolean;

  // Plugin list
  plugins: NormalizedSearchPlugin[];
  isLoadingPlugins: boolean;
  pluginsError: string | null;

  // Plugin actions
  enablePlugin: (name: string, enable: boolean) => Promise<void>;
  uninstallPlugin: (name: string) => Promise<void>;
  installPlugin: (sourceUrl: string) => Promise<void>;
  updatePlugins: () => Promise<void>;

  // Mutation states
  isPluginActionPending: boolean;
}

// ---------------------------------------------------------------------------
// UI-facing plugin shape
// ---------------------------------------------------------------------------

/**
 * UI-facing search result row. The Rust `SearchResultDto` and the bridge
 * `SearchResult` type have the same shape as the previous
 * `NormalizedSearchResult`, so this is a type alias kept for backwards
 * compatibility with consumers that imported the legacy name
 * (e.g. `useSearchScreenModel.ts`, `SearchScreenBody.tsx`).
 */
export type NormalizedSearchResult = SearchResult;

/**
 * UI-facing plugin row. The Rust DTO marks `supportedCategories` as
 * `skip_serializing_if = "Vec::is_empty"`, so the bridge exposes it as
 * `supportedCategories?: SearchPluginCategory[]`. The controller guarantees
 * a non-optional `Array` for downstream consumers (notably the shared
 * `SearchScreenBody` which types the field as required) by defaulting the
 * omitted case to `[]`.
 */
export interface NormalizedSearchPlugin {
  name: string;
  fullName: string;
  version: string;
  enabled: boolean;
  url: string;
  supportedCategories: Array<{ id: string; name: string }>;
}

/**
 * Default an optional `supportedCategories` field on a bridge `SearchPlugin`
 * to an empty array. This is a UI-shape compatibility helper, not a
 * wire-shape parser — the typed DTO already enforces the field's shape
 * when present.
 */
function withPluginCategoryDefault(p: SearchPlugin): NormalizedSearchPlugin {
  return {
    name: p.name,
    fullName: p.fullName,
    version: p.version,
    enabled: p.enabled,
    url: p.url,
    supportedCategories: p.supportedCategories ?? [],
  };
}

// ---------------------------------------------------------------------------
// Status label mapping (UI-only)
// ---------------------------------------------------------------------------

/**
 * Map the typed `SearchStatus.status` string to a small union of Title-cased
 * UI labels. The Rust side passes through the raw qBittorrent string
 * ("Running", "Idle", "Stopped", "Paused", "Failed", or "Error"); this
 * helper centralises the casing/aliasing for downstream consumers without
 * re-parsing the wire shape.
 */
function toStatusLabel(raw: string | undefined | null): SearchStatusLabel {
  if (typeof raw !== 'string') return 'Unknown';
  const lower = raw.toLowerCase();
  if (lower === 'idle') return 'Idle';
  if (lower === 'running') return 'Running';
  if (lower === 'paused') return 'Paused';
  if (lower === 'stopped') return 'Stopped';
  if (lower === 'failed' || lower === 'error') return 'Failed';
  return 'Unknown';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const SEARCH_QUERY_KEY_PREFIX = 'search';
const SEARCH_STATUS_POLL_INTERVAL_MS = 2000;
const SEARCH_ERROR_THRESHOLD = 5;

export function useSearchController({
  scope,
  isSupported,
  adapters,
}: UseSearchControllerOptions): UseSearchControllerResult {
  const { isConnected, serverId } = scope;
  const queryClient = useQueryClient();

  // ─── Query input state ──────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);

  // ─── Active search state ────────────────────────────────────────────────
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults['results']>([]);
  const [currentResultsTotal, setCurrentResultsTotal] = useState(0);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isPluginActionPending, setIsPluginActionPending] = useState(false);

  // Error counter to stop polling after repeated failures
  const searchErrorCountRef = useRef(0);

  // ─── Capability state ───────────────────────────────────────────────────
  const isCapabilityLoading = isSupported === null && isConnected;

  // ─── Stop search if scope changes or disconnected ──────────────────────
  useEffect(() => {
    if (!isConnected && activeSearchId !== null) {
      setActiveSearchId(null);
      setSearchResults([]);
      setSearchError(null);
      searchErrorCountRef.current = 0;
    }
  }, [isConnected, activeSearchId]);

  // ─── Poll search results when active ────────────────────────────────────
  useEffect(() => {
    if (activeSearchId === null) return;

    let cancelled = false;
    // pollInterval is assigned in the body of pollResults on threshold
    // breach, so the closure must use a mutable holder.
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function pollResults() {
      if (cancelled || activeSearchId === null) return;
      setIsLoadingResults(true);
      try {
        // Rust normalises the single-object/array/null response shape into
        // a typed `SearchStatus[]`, so the controller just consumes the
        // array and looks up the active search id.
        const statuses = await adapters.getSearchStatus(activeSearchId);
        const currentStatus = statuses.find((s) => s.id === activeSearchId);
        const statusLabel = toStatusLabel(currentStatus?.status);

        if (statusLabel === 'Running') {
          // Fetch results
          const resultsResp = await adapters.getSearchResults(activeSearchId);
          if (!cancelled) {
            // Typed DTO: no shape coercion, no per-row normalisation.
            setSearchResults(resultsResp.results);
            setCurrentResultsTotal(resultsResp.total);
          }
        } else if (
          statusLabel === 'Idle' ||
          statusLabel === 'Stopped' ||
          statusLabel === 'Failed'
        ) {
          // Search finished, fetch final results
          const resultsResp = await adapters.getSearchResults(activeSearchId);
          if (!cancelled) {
            setSearchResults(resultsResp.results);
            setCurrentResultsTotal(resultsResp.total);
            setActiveSearchId(null);
          }
        }

        if (cancelled) return;
        if (currentStatus?.error) {
          setSearchError(currentStatus.error);
        }
        searchErrorCountRef.current = 0;
      } catch (err) {
        if (!cancelled) {
          searchErrorCountRef.current += 1;
          setSearchError(formatUserMessageForContext(err, 'search'));
          if (searchErrorCountRef.current >= SEARCH_ERROR_THRESHOLD) {
            if (pollInterval !== null) {
              clearInterval(pollInterval);
            }
            setActiveSearchId(null);
            setSearchError('Search failed. Try again.');
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingResults(false);
        }
      }
    }

    // Initial poll
    void pollResults();

    // Poll every 2 seconds while active
    pollInterval = setInterval(() => {
      void pollResults();
    }, SEARCH_STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollInterval !== null) {
        clearInterval(pollInterval);
      }
    };
  }, [activeSearchId, adapters]);

  // ─── Start search ────────────────────────────────────────────────────────
  // currentQuery: optional override when caller has a more recent value than hook state
  const startSearchFn = useCallback(async (currentQuery?: string) => {
    const queryText = currentQuery !== undefined ? currentQuery : query;
    if (!queryText.trim()) {
      setSearchError('Please enter a search query');
      return;
    }

    setSearchError(null);
    setSearchResults([]);
    setCurrentResultsTotal(0);
    searchErrorCountRef.current = 0;

    // The bridge returns a typed `{ id: number }` envelope on success; the
    // Rust side rejects the request via the rejected promise (string
    // `BackendError::to_string()`) on failure. The only client-side
    // validation left is the sign of the id.
    try {
      const response = await adapters.startSearch(
        queryText.trim(),
        selectedPlugins.join('|'),
        selectedCategory,
      );
      if (typeof response.id === 'number' && response.id >= 0) {
        setActiveSearchId(response.id);
      } else {
        setSearchError(formatUserMessageForContext(new Error(`Backend returned invalid search ID: ${String(response.id)}`), 'search'));
      }
    } catch (err) {
      setSearchError(formatUserMessageForContext(err, 'search'));
    }
  }, [adapters, query, selectedPlugins, selectedCategory]);

  // ─── Stop search ────────────────────────────────────────────────────────
  const stopSearchFn = useCallback(async () => {
    if (activeSearchId === null) return;
    try {
      await adapters.stopSearch(activeSearchId);
      setActiveSearchId(null);
    } catch (err) {
      setSearchError(formatUserMessageForContext(err, 'search'));
    }
  }, [adapters, activeSearchId]);

  // ─── Delete search ───────────────────────────────────────────────────────
  const deleteSearchFn = useCallback(
    async (id: number) => {
      try {
        await adapters.deleteSearch(id);
        queryClient.invalidateQueries({ queryKey: [SEARCH_QUERY_KEY_PREFIX, 'status'] });
      } catch (err) {
        setSearchError(formatUserMessageForContext(err, 'search'));
      }
    },
    [adapters, queryClient]
  );

  // ─── Plugin list query ─────────────────────────────────────────────────
  const pluginsQuery = useQuery<NormalizedSearchPlugin[], Error>({
    queryKey: [SEARCH_QUERY_KEY_PREFIX, 'plugins', serverId, scope.sessionGeneration],
    queryFn: async () => {
      // Bridge returns a typed `SearchPlugin[]`; only UI-facing default for
      // the optional `supportedCategories` is needed.
      const plugins = await adapters.getSearchPlugins();
      return plugins.map(withPluginCategoryDefault);
    },
    enabled: isConnected && isSupported === true,
    staleTime: 30000, // 30 seconds
  });

  // ─── Plugin actions ─────────────────────────────────────────────────────
  const enablePluginFn = useCallback(
    async (name: string, enable: boolean) => {
      setIsPluginActionPending(true);
      try {
        await adapters.enableSearchPlugin(name, enable);
        queryClient.invalidateQueries({ queryKey: [SEARCH_QUERY_KEY_PREFIX, 'plugins'] });
      } finally {
        setIsPluginActionPending(false);
      }
    },
    [adapters, queryClient]
  );

  const uninstallPluginFn = useCallback(
    async (name: string) => {
      setIsPluginActionPending(true);
      try {
        await adapters.uninstallSearchPlugin(name);
        queryClient.invalidateQueries({ queryKey: [SEARCH_QUERY_KEY_PREFIX, 'plugins'] });
      } finally {
        setIsPluginActionPending(false);
      }
    },
    [adapters, queryClient]
  );

  const installPluginFn = useCallback(
    async (sourceUrl: string) => {
      setIsPluginActionPending(true);
      try {
        await adapters.installSearchPlugin(sourceUrl);
        queryClient.invalidateQueries({ queryKey: [SEARCH_QUERY_KEY_PREFIX, 'plugins'] });
      } finally {
        setIsPluginActionPending(false);
      }
    },
    [adapters, queryClient]
  );

  const updatePluginsFn = useCallback(async () => {
    setIsPluginActionPending(true);
    try {
      await adapters.updateSearchPlugins();
      queryClient.invalidateQueries({ queryKey: [SEARCH_QUERY_KEY_PREFIX, 'plugins'] });
    } finally {
      setIsPluginActionPending(false);
    }
  }, [adapters, queryClient]);

  // ─── Derive searching state ──────────────────────────────────────────────
  const isSearching = activeSearchId !== null;

  return {
    isSupported,
    isUnsupported: isSupported === false,
    isCapabilityLoading,

    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    selectedPlugins,
    setSelectedPlugins,

    activeSearchId,
    isSearching,
    searchError,
    startSearch: startSearchFn,
    stopSearch: stopSearchFn,
    deleteSearch: deleteSearchFn,

    searchResults,
    currentResultsTotal,
    isLoadingResults,

    plugins: pluginsQuery.data ?? [],
    isLoadingPlugins: pluginsQuery.isLoading,
    pluginsError: pluginsQuery.error ? formatUserMessageForContext(pluginsQuery.error, 'search') : null,

    enablePlugin: enablePluginFn,
    uninstallPlugin: uninstallPluginFn,
    installPlugin: installPluginFn,
    updatePlugins: updatePluginsFn,

    isPluginActionPending,
  };
}
