import { create } from 'zustand';
import type { Torrent, Category } from '../types/qbittorrent';
import type { SortField } from '../utils/sortTorrents';
import type { FilterStatus } from '../utils/torrentFilter';

/**
 * Shared Torrent Store
 *
 * Manages torrent data, categories, tags, filters, and sort state.
 * Selection state has been moved to the desktop torrentSelectionStore.
 */

// Re-export SortField and SortOrder so consumers can import from this module
export type { SortField, SortOrder } from '../utils/sortTorrents';

export type SortDirection = 'asc' | 'desc';

export interface TorrentFilters {
  status: FilterStatus;
  category: string | null;
  tag: string | null;
  tracker: string | null;
  search: string;
}

export interface TorrentStore {
  torrents: Torrent[];
  categories: Category[];
  tags: string[];
  isLoading: boolean;
  error: Error | null;
  lastUpdated: number | null;

  // Filters
  filters: TorrentFilters;

  // Sorting
  sortField: SortField;
  sortDirection: SortDirection;

  // Actions - Data
  setTorrents: (torrents: Torrent[]) => void;
  setCategories: (categories: Category[]) => void;
  setTags: (tags: string[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
  setLastUpdated: (timestamp: number) => void;
  touchLastUpdated: () => void;

  // Actions - Filters
  setStatusFilter: (status: FilterStatus) => void;
  setCategoryFilter: (category: string | null) => void;
  setTagFilter: (tag: string | null) => void;
  setTrackerFilter: (tracker: string | null) => void;
  setSearchFilter: (search: string) => void;
  clearFilters: () => void;

  // Actions - Sorting
  setSortField: (field: SortField) => void;
  setSortDirection: (direction: SortDirection) => void;
  toggleSortDirection: () => void;
}

export const useTorrentStore = create<TorrentStore>((set) => ({
  // Initial state
  torrents: [],
  categories: [],
  tags: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  filters: {
    status: 'all',
    category: null,
    tag: null,
    tracker: null,
    search: '',
  },
  sortField: 'added_on',
  sortDirection: 'desc',

  // Data actions
  setTorrents: (torrents) => set({ torrents, lastUpdated: Date.now() }),
  setCategories: (categories) => set({ categories }),
  setTags: (tags) => set({ tags }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setLastUpdated: (timestamp) => set({ lastUpdated: timestamp }),
  touchLastUpdated: () => set({ lastUpdated: Date.now() }),

  // Filter actions
  setStatusFilter: (status) => {
    set((state) => ({
      filters: { ...state.filters, status },
    }));
  },

  setCategoryFilter: (category) => {
    set((state) => ({
      filters: { ...state.filters, category },
    }));
  },

  setTagFilter: (tag) => {
    set((state) => ({
      filters: { ...state.filters, tag },
    }));
  },

  setTrackerFilter: (tracker) => {
    set((state) => ({
      filters: { ...state.filters, tracker },
    }));
  },

  setSearchFilter: (search) => {
    set((state) => ({
      filters: { ...state.filters, search },
    }));
  },

  clearFilters: () => {
    set({
      filters: {
        status: 'all',
        category: null,
        tag: null,
        tracker: null,
        search: '',
      },
    });
  },

  // Sorting actions
  setSortField: (field) => {
    set({ sortField: field });
  },

  setSortDirection: (direction) => {
    set({ sortDirection: direction });
  },

  toggleSortDirection: () => {
    set((state) => ({
      sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc',
    }));
  },
}));
