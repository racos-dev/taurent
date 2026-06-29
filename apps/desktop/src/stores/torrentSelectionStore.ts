import { create } from 'zustand';

/**
 * Torrent Selection Store (Desktop-only)
 *
 * Manages selection state for the torrent table including:
 * - selectedHashes: Set of currently selected torrent hashes
 * - anchorHash: Shift+click range start anchor
 * - focusedHash: Keyboard navigation target
 * - panelTorrentHash: Detail pane target
 * - visibleHashes: All visible hashes in current filter/sort order (from workspace controller)
 *
 * visibleHashes must be kept in sync with the workspace controller's sortedTorrents
 * output. Desktop callers (HomeScreen) update this via setVisibleHashes whenever
 * the controller's sortedTorrents changes.
 *
 * Range selection and Ctrl+A both use visibleHashes as the canonical ordered list.
 */

export interface TorrentSelectionStore {
  // Selection state
  selectedHashes: Set<string>;
  anchorHash: string | null;
  focusedHash: string | null;
  panelTorrentHash: string | null;

  // Canonical visible order (injected from workspace controller)
  visibleHashes: string[];

  // Selection actions
  selectTorrent: (hash: string, additive: boolean, range: boolean) => void;
  deselectTorrent: (hash: string) => void;
  toggleTorrent: (hash: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setSelectedHashes: (hashes: string[]) => void;
  setAnchorHash: (hash: string | null) => void;
  setFocusedHash: (hash: string | null) => void;
  setPanelTorrentHash: (hash: string | null) => void;
  setVisibleHashes: (hashes: string[]) => void;

  // Getters that need torrent data from shared store
  hasSelection: () => boolean;
  getSelectionCount: () => number;
}

export const useTorrentSelectionStore = create<TorrentSelectionStore>((set, get) => ({
  // Initial state
  selectedHashes: new Set(),
  anchorHash: null,
  focusedHash: null,
  panelTorrentHash: null,
  visibleHashes: [],

  // Selection actions
  selectTorrent: (hash, additive, range) => {
    const { selectedHashes, anchorHash, visibleHashes } = get();
    const newSelection = new Set(additive ? selectedHashes : []);

    if (range && anchorHash && visibleHashes.length > 0) {
      // Range selection: select all between anchor and current in VISIBLE SORTED order
      const anchorIndex = visibleHashes.indexOf(anchorHash);
      const currentIndex = visibleHashes.indexOf(hash);

      if (anchorIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(anchorIndex, currentIndex);
        const end = Math.max(anchorIndex, currentIndex);
        for (let i = start; i <= end; i++) {
          newSelection.add(visibleHashes[i]);
        }
      }
    } else {
      newSelection.add(hash);
    }

    set({
      selectedHashes: newSelection,
      focusedHash: hash,
      ...(!additive && !range && { anchorHash: hash }),
    });
  },

  deselectTorrent: (hash) => {
    const { selectedHashes } = get();
    const newSelection = new Set(selectedHashes);
    newSelection.delete(hash);
    set({ selectedHashes: newSelection });
  },

  toggleTorrent: (hash) => {
    const { selectedHashes } = get();
    if (selectedHashes.has(hash)) {
      get().deselectTorrent(hash);
    } else {
      get().selectTorrent(hash, true, false);
    }
  },

  selectAll: () => {
    const { visibleHashes } = get();
    set({ selectedHashes: new Set(visibleHashes), anchorHash: null, focusedHash: null });
  },

  deselectAll: () => {
    set({ selectedHashes: new Set(), anchorHash: null, focusedHash: null });
  },

  setSelectedHashes: (hashes) => {
    set({ selectedHashes: new Set(hashes) });
  },

  setAnchorHash: (hash) => set({ anchorHash: hash }),

  setFocusedHash: (hash) => set({ focusedHash: hash }),

  setPanelTorrentHash: (hash) => set({ panelTorrentHash: hash }),

  setVisibleHashes: (hashes) => set({ visibleHashes: hashes }),

  hasSelection: () => {
    const { selectedHashes } = get();
    return selectedHashes.size > 0;
  },

  getSelectionCount: () => {
    const { selectedHashes } = get();
    return selectedHashes.size;
  },
}));