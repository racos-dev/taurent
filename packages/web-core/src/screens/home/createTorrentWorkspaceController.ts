// Headless torrent-workspace controller for desktop.
//
// Centralizes torrent list shaping for the desktop workspace:
//
//   - filtered/sorted torrent list
//   - total count and filtered count
//   - whether any filters are active
//   - status counts for sidebar filter buttons
//   - sidebar category/tag/tracker view models (counts + entries)
//   - total download/upload speeds
//   - filter/sort state and setters
//
// App-owned concerns kept in desktop surfaces:
//   - TorrentTable and table mechanics
//   - torrentSelectionStore
//   - context menu and drag/drop behavior
//   - useTransferCommandList
//   - shell chrome / shortcuts / settings window handling
//   - category/tag/tracker management actions and dialog wiring
//
// Usage (desktop HomeScreen):
//   const controller = useTorrentWorkspaceController();
//
// Factory form accepts a bridge adapter and a scope provider so desktop
// can wire in `BridgeAdapter` and `useQBClient` from app code
// (matching the createAddTorrentHook / createTorrentsHook pattern).
//
// The controller subscribes to the Rust-owned `workspace-view-changed` event
// and derives the sorted torrent list, sidebar facets, counts, and totals from
// the engine view.
//
// The optional liveTorrentProvider allows desktop to inject the live torrent
// list from maindata instead of subscribing to full-array Zustand state.
// Default: reads directly from the torrent store state (no subscription).

import { createContext, createElement, useCallback, useContext, useMemo, type ReactNode } from 'react';
import {
  useTorrentStore,
  type SortField,
  type SortDirection,
  type TorrentFilters,
} from '@taurent/shared/stores';
import {
  FILTER_STATUS_TO_FILTER_TYPE,
  type TorrentFilterType,
} from '@taurent/shared';
import type { Torrent } from '@taurent/shared/types/qbittorrent';
import type { WorkspaceView, WorkspaceViewRequest } from '@taurent/bridge/types';
import type { WorkspaceViewBridge } from '../../sync/useWorkspaceView';
import { useWorkspaceView } from '../../sync/useWorkspaceView';

// Re-export for apps that previously imported the type from this module.
export type { WorkspaceViewBridge } from '../../sync/useWorkspaceView';

const LOCALE_FALLBACK = 'en-US';
const WORKSPACE_REQUEST_ID = 'desktop-workspace';
const HASHLESS_SORT_FIELD: SortField = 'added_on';
const HASHLESS_SORT_DIRECTION: SortDirection = 'desc';

function getLocale(): string {
  return typeof navigator !== 'undefined' ? navigator.language : LOCALE_FALLBACK;
}

function mapStatusCounts(view: WorkspaceView | null): Record<TorrentFilterType, number> {
  return { ...view?.status_counts } as Record<TorrentFilterType, number>;
}

function mapSidebarCategories(view: WorkspaceView | null): SidebarCategoryItem[] {
  return view?.sidebar_categories.map((category) => ({
    categoryName: category.name,
    savePath: category.save_path,
    count: category.count,
  })) ?? [];
}

function mapSidebarTags(view: WorkspaceView | null): SidebarTagItem[] {
  return view?.sidebar_tags.map((tag) => ({
    tag: tag.tag,
    count: tag.count,
  })) ?? [];
}

function mapSidebarTrackers(view: WorkspaceView | null): SidebarTrackerEntry[] {
  return view?.sidebar_trackers.map((tracker) => ({
    trackerUrl: tracker.tracker_url,
    hostname: tracker.hostname,
    count: tracker.count,
  })) ?? [];
}

type LiveTorrentProvider = () => Torrent[];

function sumValues(m: Record<string, number> | undefined): number {
  return Object.values(m ?? {}).reduce((acc, n) => acc + n, 0);
}

function createWorkspaceRequest(
  filters: TorrentFilters,
  sortField: SortField,
  sortDirection: SortDirection,
  includeSortedHashes: boolean,
): WorkspaceViewRequest {
  return {
    request_id: WORKSPACE_REQUEST_ID,
    filters: {
      status: FILTER_STATUS_TO_FILTER_TYPE[filters.status],
      category: filters.category,
      tag: filters.tag,
      tracker: filters.tracker,
      search: filters.search,
    },
    sort: includeSortedHashes
      ? { field: sortField, direction: sortDirection }
      : { field: HASHLESS_SORT_FIELD, direction: HASHLESS_SORT_DIRECTION },
    include_sorted_hashes: includeSortedHashes,
    locale: getLocale(),
  };
}

// ─── Sidebar view-model types ────────────────────────────────────────────────

export interface SidebarCategoryItem {
  categoryName: string;
  savePath: string;
  count: number;
}

export interface SidebarTagItem {
  tag: string;
  count: number;
}

export interface SidebarTrackerEntry {
  trackerUrl: string;
  hostname: string;
  count: number;
}

export interface TorrentWorkspaceControllerResult {
  // ─── Filtered + sorted torrent list ─────────────────────────────
  sortedTorrents: Torrent[];
  /**
   * True while the first Rust workspace view is still pending (i.e. no view
   * has been received yet). Distinguishes the initial load from subsequent
   * recomputes triggered by filter/sort changes, which keep existing rows
   * visible.
   */
  isLoading: boolean;

  // ─── Counts ─────────────────────────────────────────────────────
  totalCount: number;
  filteredCount: number;

  // ─── Filter active ───────────────────────────────────────────────
  isFiltered: boolean;

  // ─── Status counts for sidebar ──────────────────────────────────
  statusCounts: Record<TorrentFilterType, number>;

  // ─── Transfer speeds ─────────────────────────────────────────────
  totalDLSpeed: number;
  totalULSpeed: number;

  // ─── Filter state ────────────────────────────────────────────────
  filters: TorrentFilters;
  setStatusFilter: (status: TorrentFilters['status']) => void;
  setCategoryFilter: (category: string | null) => void;
  setTagFilter: (tag: string | null) => void;
  setTrackerFilter: (tracker: string | null) => void;
  setSearchFilter: (search: string) => void;
  clearFilters: () => void;

  // ─── Sort state ───────────────────────────────────────────────────
  sortField: SortField;
  sortDirection: SortDirection;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;

  // ─── Sidebar view models ──────────────────────────────────────────
  /** Category items with torrent counts, for sidebar categories section. */
  sidebarCategories: SidebarCategoryItem[];
  /** Tag items with torrent counts, for sidebar tags section. */
  sidebarTags: SidebarTagItem[];
  /** Tracker entries with torrent counts, for sidebar trackers section. */
  sidebarTrackers: SidebarTrackerEntry[];
}

interface SharedTorrentWorkspaceView extends TorrentWorkspaceControllerResult {
  totalFilteredForCategories: number;
  totalFilteredForTags: number;
  totalFilteredForTrackers: number;
}

const TorrentWorkspaceViewContext = createContext<SharedTorrentWorkspaceView | null>(null);
TorrentWorkspaceViewContext.displayName = 'TorrentWorkspaceViewContext';

export interface TorrentWorkspaceViewProviderProps {
  children: ReactNode;
  /**
   * Whether the current route needs the sorted torrent list. Routes that only
   * display sidebar/status counts can disable this to skip Rust's hash sort.
   */
  includeSortedHashes?: boolean;
}

function useSharedTorrentWorkspaceView(): SharedTorrentWorkspaceView {
  const context = useContext(TorrentWorkspaceViewContext);
  if (!context) {
    throw new Error('Torrent workspace hooks must be used within TorrentWorkspaceViewProvider');
  }
  return context;
}

/**
 * Shared provider for the desktop workspace projection.
 *
 * It owns the single Rust `set_workspace_view` subscription for the AppShell.
 * Home, Sidebar, and StatusBar consume slices from this context instead of
 * issuing independent IPC calls for the same filter state.
 */
export function createTorrentWorkspaceViewProvider(
  bridge: WorkspaceViewBridge,
  liveTorrentProvider: LiveTorrentProvider = () => useTorrentStore.getState().torrents,
) {
  return function TorrentWorkspaceViewProvider({
    children,
    includeSortedHashes = true,
  }: TorrentWorkspaceViewProviderProps) {
    const torrents = liveTorrentProvider();

    const filters = useTorrentStore((state) => state.filters);
    const sortField = useTorrentStore((state) => state.sortField);
    const sortDirection = useTorrentStore((state) => state.sortDirection);

    const setStatusFilter = useTorrentStore((state) => state.setStatusFilter);
    const setCategoryFilter = useTorrentStore((state) => state.setCategoryFilter);
    const setTagFilter = useTorrentStore((state) => state.setTagFilter);
    const setTrackerFilter = useTorrentStore((state) => state.setTrackerFilter);
    const setSearchFilter = useTorrentStore((state) => state.setSearchFilter);
    const clearFilters = useTorrentStore((state) => state.clearFilters);
    const setSortField = useTorrentStore((state) => state.setSortField);
    const toggleSortDirection = useTorrentStore((state) => state.toggleSortDirection);

    const workspaceRequest = useMemo<WorkspaceViewRequest>(
      () => createWorkspaceRequest(filters, sortField, sortDirection, includeSortedHashes),
      [filters, sortField, sortDirection, includeSortedHashes],
    );

    const rustView = useWorkspaceView(bridge.qBClient, workspaceRequest);
    const view = rustView.view;
    // True only while the first Rust view is pending. Subsequent recomputes
    // (filter/sort changes) keep `rustView.isLoading` true but already have
    // a view, so we report false to avoid hiding existing rows.
    const isLoading = rustView.isLoading && rustView.view === null;

    const sortedTorrents = useMemo<Torrent[]>(() => {
      if (!includeSortedHashes || !view) return [];
      const byHash = new Map<string, Torrent>();
      for (const t of torrents) byHash.set(t.hash, t);
      const out: Torrent[] = [];
      for (const hash of view.sorted_hashes) {
        const t = byHash.get(hash);
        if (t) out.push(t);
      }
      return out;
    }, [includeSortedHashes, view, torrents]);

    const handleSetStatusFilter = useCallback(
      (status: TorrentFilters['status']) => setStatusFilter(status),
      [setStatusFilter],
    );
    const handleSetCategoryFilter = useCallback(
      (category: string | null) => setCategoryFilter(category),
      [setCategoryFilter],
    );
    const handleSetTagFilter = useCallback(
      (tag: string | null) => setTagFilter(tag),
      [setTagFilter],
    );
    const handleSetTrackerFilter = useCallback(
      (tracker: string | null) => setTrackerFilter(tracker),
      [setTrackerFilter],
    );
    const handleSetSearchFilter = useCallback(
      (search: string) => setSearchFilter(search),
      [setSearchFilter],
    );
    const handleClearFilters = useCallback(() => clearFilters(), [clearFilters]);
    const handleSetSortField = useCallback(
      (field: SortField) => setSortField(field),
      [setSortField],
    );
    const handleToggleSortDirection = useCallback(
      () => toggleSortDirection(),
      [toggleSortDirection],
    );

    const contextValue = useMemo<SharedTorrentWorkspaceView>(() => ({
      sortedTorrents,
      isLoading,
      totalCount: view?.total_count ?? 0,
      filteredCount: view?.filtered_count ?? 0,
      isFiltered: view?.is_filtered ?? false,
      statusCounts: mapStatusCounts(view),
      totalDLSpeed: view?.total_dl_speed ?? 0,
      totalULSpeed: view?.total_ul_speed ?? 0,
      filters,
      setStatusFilter: handleSetStatusFilter,
      setCategoryFilter: handleSetCategoryFilter,
      setTagFilter: handleSetTagFilter,
      setTrackerFilter: handleSetTrackerFilter,
      setSearchFilter: handleSetSearchFilter,
      clearFilters: handleClearFilters,
      sortField,
      sortDirection,
      setSortField: handleSetSortField,
      toggleSortDirection: handleToggleSortDirection,
      sidebarCategories: mapSidebarCategories(view),
      sidebarTags: mapSidebarTags(view),
      sidebarTrackers: mapSidebarTrackers(view),
      totalFilteredForCategories: sumValues(view?.category_counts),
      totalFilteredForTags: sumValues(view?.tag_counts),
      totalFilteredForTrackers: sumValues(view?.tracker_counts),
    }), [
      sortedTorrents,
      isLoading,
      view,
      filters,
      handleSetStatusFilter,
      handleSetCategoryFilter,
      handleSetTagFilter,
      handleSetTrackerFilter,
      handleSetSearchFilter,
      handleClearFilters,
      sortField,
      sortDirection,
      handleSetSortField,
      handleToggleSortDirection,
    ]);

    return createElement(TorrentWorkspaceViewContext.Provider, { value: contextValue }, children);
  };
}

/**
 * Headless hook for the desktop torrent workspace.
 *
 * Platform-agnostic — does not import @tauri-apps/* or produce UI.
 * Reads filter/sort state from the shared torrent store.
 *
 * The controller derives the sorted torrent list, status counts, total
 * transfer speeds, sidebar aggregates, and the `isFiltered` flag from the Rust
 * `workspace-view-changed` event.
 *
 * @param bridge - Platform bridge adapter (consumed for capability flag +
 *   workspace view commands). Apps pass the `BridgeAdapter` singleton.
 * @param liveTorrentProvider - Returns the current Torrent[] list. Desktop injects
 *   the live maindata-backed list to avoid full-array Zustand subscription.
 *   Defaults to reading from useTorrentStore.getState().torrents.
 */
export function createTorrentWorkspaceController(
  _bridge: WorkspaceViewBridge,
  _liveTorrentProvider: LiveTorrentProvider = () => useTorrentStore.getState().torrents,
) {
  return function useTorrentWorkspaceController(): TorrentWorkspaceControllerResult {
    const workspace = useSharedTorrentWorkspaceView();
    return {
      sortedTorrents: workspace.sortedTorrents,
      isLoading: workspace.isLoading,
      totalCount: workspace.totalCount,
      filteredCount: workspace.filteredCount,
      isFiltered: workspace.isFiltered,
      statusCounts: workspace.statusCounts,
      totalDLSpeed: workspace.totalDLSpeed,
      totalULSpeed: workspace.totalULSpeed,
      filters: workspace.filters,
      setStatusFilter: workspace.setStatusFilter,
      setCategoryFilter: workspace.setCategoryFilter,
      setTagFilter: workspace.setTagFilter,
      setTrackerFilter: workspace.setTrackerFilter,
      setSearchFilter: workspace.setSearchFilter,
      clearFilters: workspace.clearFilters,
      sortField: workspace.sortField,
      sortDirection: workspace.sortDirection,
      setSortField: workspace.setSortField,
      toggleSortDirection: workspace.toggleSortDirection,
      sidebarCategories: workspace.sidebarCategories,
      sidebarTags: workspace.sidebarTags,
      sidebarTrackers: workspace.sidebarTrackers,
    };
  };
}

// ─── Sidebar-only controller ───────────────────────────────────────────────────

export interface TorrentWorkspaceSidebarActiveFilters {
  status: TorrentFilters['status'];
  category: string | null;
  tag: string | null;
  tracker: string | null;
}

export interface TorrentWorkspaceSidebarResult {
  /** Subset of filter state that sidebar buttons and sections need. */
  activeFilters: TorrentWorkspaceSidebarActiveFilters;
  setStatusFilter: (status: TorrentFilters['status']) => void;
  setCategoryFilter: (category: string | null) => void;
  setTagFilter: (tag: string | null) => void;
  setTrackerFilter: (tracker: string | null) => void;
  /**
   * Status counts computed over the currently filtered torrent set.
   * Honors active category/tag/tracker/search filters, but ignores the status filter
   * when computing each status bucket.
   */
  statusCounts: Record<TorrentFilterType, number>;
  sidebarCategories: SidebarCategoryItem[];
  sidebarTags: SidebarTagItem[];
  sidebarTrackers: SidebarTrackerEntry[];
  /**
   * Total count of torrents matching all active filters EXCEPT the category dimension.
   * Used for the "All Categories" row total.
   */
  totalFilteredForCategories: number;
  /**
   * Total count of torrents matching all active filters EXCEPT the tag dimension.
   * Used for the "All Tags" row total.
   */
  totalFilteredForTags: number;
  /**
   * Total count of torrents matching all active filters EXCEPT the tracker dimension.
   * Used for the "All Trackers" row total.
   */
  totalFilteredForTrackers: number;
}

/**
 * Narrow hook for the desktop sidebar.
 *
 * Derives only what Sidebar.tsx consumes:
 *   - four active filter values (status / category / tag / tracker)
 *   - status counts over all torrents
 *   - sidebar view models for categories, tags, trackers
 *
 * Does NOT expose sortedTorrents, filteredCount, speeds, sort state,
 * or the full filters object.
 *
 * Reuses the same canonical derivation as the full controller so
 * semantics stay identical (uncategorized '' preserved, tags trimmed/deduped,
 * trackers sorted by count then hostname).
 *
 * The controller consumes the Rust view for status counts, sidebar view models,
 * and cross-filtered totals (`view.category_counts` summed →
 * `totalFilteredForCategories`, etc.).
 *
 * @param bridge - Platform bridge adapter (consumed for capability flag +
 *   workspace view commands). Apps pass the `BridgeAdapter` singleton.
 * @param liveTorrentProvider - Returns the current Torrent[] list. Desktop injects
 *   the live maindata-backed list to avoid full-array Zustand subscription.
 */
export function createTorrentWorkspaceSidebarController(
  _bridge: WorkspaceViewBridge,
  _liveTorrentProvider: LiveTorrentProvider = () => useTorrentStore.getState().torrents,
) {
  return function useTorrentWorkspaceSidebarController(): TorrentWorkspaceSidebarResult {
    const workspace = useSharedTorrentWorkspaceView();
    return {
      activeFilters: {
        status: workspace.filters.status,
        category: workspace.filters.category,
        tag: workspace.filters.tag,
        tracker: workspace.filters.tracker,
      },
      setStatusFilter: workspace.setStatusFilter,
      setCategoryFilter: workspace.setCategoryFilter,
      setTagFilter: workspace.setTagFilter,
      setTrackerFilter: workspace.setTrackerFilter,
      statusCounts: workspace.statusCounts,
      sidebarCategories: workspace.sidebarCategories,
      sidebarTags: workspace.sidebarTags,
      sidebarTrackers: workspace.sidebarTrackers,
      totalFilteredForCategories: workspace.totalFilteredForCategories,
      totalFilteredForTags: workspace.totalFilteredForTags,
      totalFilteredForTrackers: workspace.totalFilteredForTrackers,
    };
  };
}

// ─── List-only controller (HomeScreen only) ──────────────────────────────────

export interface TorrentWorkspaceListResult {
  /** Filtered and sorted torrent list for the table. */
  sortedTorrents: Torrent[];
  /**
   * True while the first Rust workspace view is still pending. Used to gate
   * the loading spinner so the empty-state doesn't flash during the initial
   * view load.
   */
  isLoading: boolean;
  /** Full filters object — drives the "has active filters" check. */
  filters: TorrentFilters;
  clearFilters: () => void;
  sortField: SortField;
  sortDirection: SortDirection;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;
}

/**
 * Narrow hook for HomeScreen — exposes only list/sort/filter state.
 *
 * Derives the sorted list from the Rust view's `sorted_hashes`. Does NOT expose
 * sidebar aggregates, speeds, counts, or status counts.
 *
 * @param bridge - Platform bridge adapter (consumed for capability flag +
 *   workspace view commands). Apps pass the `BridgeAdapter` singleton.
 * @param liveTorrentProvider - Returns the current Torrent[] list. Desktop injects
 *   the live maindata-backed list to avoid full-array Zustand subscription.
 */
export function createTorrentWorkspaceListController(
  _bridge: WorkspaceViewBridge,
  _liveTorrentProvider: LiveTorrentProvider = () => useTorrentStore.getState().torrents,
) {
  return function useTorrentWorkspaceListController(): TorrentWorkspaceListResult {
    const workspace = useSharedTorrentWorkspaceView();
    return {
      sortedTorrents: workspace.sortedTorrents,
      isLoading: workspace.isLoading,
      filters: workspace.filters,
      clearFilters: workspace.clearFilters,
      sortField: workspace.sortField,
      sortDirection: workspace.sortDirection,
      setSortField: workspace.setSortField,
      toggleSortDirection: workspace.toggleSortDirection,
    };
  };
}

// ─── Summary-only controller (StatusBar only) ─────────────────────────────────

export interface TorrentWorkspaceSummaryResult {
  totalCount: number;
  filteredCount: number;
  isFiltered: boolean;
}

/**
 * Narrow hook for components that only need torrent counts and filter state.
 * Derives only the three fields StatusBar requires — no sorted list,
 * sidebar view models, or transfer speeds.
 *
 * Consumes `view.filtered_count`, `view.total_count`, and `view.is_filtered`
 * from the Rust engine.
 *
 * @param bridge - Platform bridge adapter (consumed for capability flag +
 *   workspace view commands). Apps pass the `BridgeAdapter` singleton.
 * @param liveTorrentProvider - Returns the current Torrent[] list. Desktop injects
 *   the live maindata-backed list to avoid full-array Zustand subscription.
 */
export function createTorrentWorkspaceSummaryController(
  _bridge: WorkspaceViewBridge,
  _liveTorrentProvider: LiveTorrentProvider = () => useTorrentStore.getState().torrents,
) {
  return function useTorrentWorkspaceSummaryController(): TorrentWorkspaceSummaryResult {
    const workspace = useSharedTorrentWorkspaceView();
    return {
      totalCount: workspace.totalCount,
      filteredCount: workspace.filteredCount,
      isFiltered: workspace.isFiltered,
    };
  };
}
