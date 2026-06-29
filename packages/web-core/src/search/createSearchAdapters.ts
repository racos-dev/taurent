/**
 * Search Adapter Factory
 *
 * Constructs the `SearchAdapters` object expected by `useSearchScreenModel`
 * from a structurally typed qBittorrent client bridge surface.
 *
 * This moves bridge bundle construction from app-level screens into shared
 * web-core, reducing route-level contract knowledge without making web-core
 * depend on any platform-specific Tauri entrypoint.
 *
 * Usage:
 *   const adapters = createSearchAdapters(qBClient);
 *   const model = useSearchScreenModel({ ..., adapters });
 */

import type { QBClientBridge } from '@taurent/bridge';
import type { SearchAdapters } from './useSearchController';

/**
 * Creates a `SearchAdapters`-compatible object from a `QBClientBridge`.
 *
 * The bridge (T141.3) already returns typed search DTOs (`SearchStatus[]`,
 * `SearchResults`, `SearchPlugin[]`, `{ id: number }`, `OperationResponse`),
 * so the adapter methods are passed through directly with no `unknown`
 * coercion and no wire-shape defensive parsing. The `SearchAdapters`
 * interface in `useSearchController.ts` consumes those typed shapes.
 */
export function createSearchAdapters(qBClient: QBClientBridge): SearchAdapters {
  return {
    startSearch: (query, plugins, category) =>
      qBClient.startSearch(query, plugins, category),
    stopSearch: (id) => qBClient.stopSearch(id),
    getSearchStatus: (id) => qBClient.getSearchStatus(id),
    getSearchResults: (id, limit, offset) =>
      qBClient.getSearchResults(id, limit, offset),
    deleteSearch: (id) => qBClient.deleteSearch(id),
    getSearchPlugins: () => qBClient.getSearchPlugins(),
    installSearchPlugin: (sources) => qBClient.installSearchPlugin(sources),
    uninstallSearchPlugin: (names) => qBClient.uninstallSearchPlugin(names),
    enableSearchPlugin: (names, enable) => qBClient.enableSearchPlugin(names, enable),
    updateSearchPlugins: () => qBClient.updateSearchPlugins(),
  };
}