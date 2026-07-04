/**
 * Search Screen Model Hook
 *
 * Composes `useSearchController` with the mutation/error derivation logic
 * shared by both desktop and mobile SearchScreen wrappers.
 * Leaves `onAddResult` as a required argument so each app can wire its own
 * add-torrent behavior (aux window / navigation) without web-core knowing
 * about Tauri.
 *
 * Usage:
 *   const model = useSearchScreenModel({
 *     scope: { serverId, sessionGeneration, isConnected },
 *     isSupported: capabilities?.supportsSearch ?? null,
 *     adapters: { startSearch, stopSearch, ... },
 *     onAddResult: async (result) => { ... },
 *   });
 */

import { useCallback } from 'react';
import type { QueryScope } from '../query/scope';
import { useSearchController } from './useSearchController';
import type {
  SearchAdapters,
  NormalizedSearchResult,
  NormalizedSearchPlugin,
} from './useSearchController';
import type { SearchSortKey, SearchSortDirection } from './sortSearchResults';

export interface UseSearchScreenModelOptions {
  scope: QueryScope;
  /** Whether the server supports Search. null = unknown, true = supported, false = not */
  isSupported: boolean | null;
  /** Bridge adapters for search operations */
  adapters: SearchAdapters;
  /**
   * Platform-specific callback to add a search result to downloads.
   * Desktop: opens aux add-torrent window.
   * Mobile: navigates to AddTorrentScreen.
   */
  onAddResult: (result: NormalizedSearchResult) => Promise<void>;
}

export interface UseSearchScreenModelResult {
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
  isSearching: boolean;
  searchError: string | null;
  onStartSearch: (currentQuery?: string) => Promise<void>;
  onStopSearch: () => Promise<void>;

  // Results
  searchResults: NormalizedSearchResult[];
  currentResultsTotal: number;
  isLoadingResults: boolean;

  // Result ordering
  sortKey: SearchSortKey;
  sortDirection: SearchSortDirection;
  setSortKey: (key: SearchSortKey) => void;
  setSortDirection: (direction: SearchSortDirection) => void;

  // Plugins
  plugins: NormalizedSearchPlugin[];
  isLoadingPlugins: boolean;
  pluginsError: string | null;
  isPluginActionPending: boolean;
  onEnablePlugin: (name: string, enable: boolean) => Promise<void>;
  onUninstallPlugin: (name: string) => Promise<void>;
  onInstallPlugin: (sourceUrl: string) => Promise<void>;
  onUpdatePlugins: () => Promise<void>;

  // Add result
  onAddResult: (result: NormalizedSearchResult) => Promise<void>;
}

export function useSearchScreenModel({
  scope,
  isSupported,
  adapters,
  onAddResult,
}: UseSearchScreenModelOptions): UseSearchScreenModelResult {
  const controller = useSearchController({
    scope,
    isSupported,
    adapters,
  });

  const handleAddResult = useCallback(
    (result: NormalizedSearchResult) => onAddResult(result),
    [onAddResult],
  );

  return {
    isSupported: controller.isSupported,
    isUnsupported: controller.isUnsupported,
    isCapabilityLoading: controller.isCapabilityLoading,

    query: controller.query,
    setQuery: controller.setQuery,
    selectedCategory: controller.selectedCategory,
    setSelectedCategory: controller.setSelectedCategory,
    selectedPlugins: controller.selectedPlugins,
    setSelectedPlugins: controller.setSelectedPlugins,

    isSearching: controller.isSearching,
    searchError: controller.searchError,
    onStartSearch: controller.startSearch,
    onStopSearch: controller.stopSearch,

    searchResults: controller.searchResults,
    currentResultsTotal: controller.currentResultsTotal,
    isLoadingResults: controller.isLoadingResults,

    sortKey: controller.sortKey,
    sortDirection: controller.sortDirection,
    setSortKey: controller.setSortKey,
    setSortDirection: controller.setSortDirection,

    plugins: controller.plugins,
    isLoadingPlugins: controller.isLoadingPlugins,
    pluginsError: controller.pluginsError,
    isPluginActionPending: controller.isPluginActionPending,
    onEnablePlugin: controller.enablePlugin,
    onUninstallPlugin: controller.uninstallPlugin,
    onInstallPlugin: controller.installPlugin,
    onUpdatePlugins: controller.updatePlugins,

    onAddResult: handleAddResult,
  };
}
