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
 *     capabilities: { supportsSearch, supportsRss, supportsWebSeedManagement },
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
import type { AppCapabilities } from '../capabilities';

export interface UseSearchScreenModelOptions {
  scope: QueryScope;
  /**
   * Server capabilities (Rust-resolved, camelCase).
   * The screen model surfaces `isSupported` / `isUnsupported` derived from
   * `capabilities.supportsSearch` and the scope's `isConnected` state.
   */
  capabilities: AppCapabilities;
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
  // Capability state. `isSupported` keeps the legacy `boolean | null` shape
  // (offline → `null`, supported → `true`, unsupported → `false`) so the
  // shared `SearchScreenBody` continues to render the correct empty state.
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
  capabilities,
  adapters,
  onAddResult,
}: UseSearchScreenModelOptions): UseSearchScreenModelResult {
  const controller = useSearchController({
    scope,
    capabilities,
    adapters,
  });

  const handleAddResult = useCallback(
    (result: NormalizedSearchResult) => onAddResult(result),
    [onAddResult],
  );

  // Reconstruct the legacy tri-state `isSupported: boolean | null` so the
  // existing `SearchScreenBody` keeps rendering the correct empty state:
  //   - disconnected (`!scope.isConnected`) → null → "Connect to a server"
  //   - connected + supportsSearch         → true  → normal search UI
  //   - connected + !supportsSearch        → false → "Search not available"
  const isOffline = !scope.isConnected;
  const isSupported = isOffline ? null : controller.isSupported;
  const isUnsupported = !isOffline && !controller.isSupported;
  // No capability-loading state in v2 — capabilities arrive with the session snapshot.
  const isCapabilityLoading = false;

  return {
    isSupported,
    isUnsupported,
    isCapabilityLoading,

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
