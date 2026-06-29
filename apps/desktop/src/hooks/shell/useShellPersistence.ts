import { useEffect, useRef } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import {
  useShellStore,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_COLUMN_ORDER,
  DEFAULT_COLUMN_WIDTHS,
  normalizeColumnVisibility,
  normalizeColumnOrder,
  normalizeColumnWidths,
} from '@/stores';

const STORE_PATH = 'shell-state.dat';

const SHELL_STORAGE_KEYS = {
  sidebarWidth: 'sidebarWidth',
  sidebarVisible: 'sidebarVisible',
  propertiesPaneVisible: 'propertiesPaneVisible',
  propertiesPaneHeight: 'propertiesPaneHeight',
  propertiesPaneActiveTab: 'propertiesPaneActiveTab',
  inWindowMenuBarVisible: 'inWindowMenuBarVisible',
  columnVisibility: 'columnVisibility',
  columnOrder: 'columnOrder',
  columnWidths: 'columnWidths',
} as const;

const DEFAULT_SIDEBAR_WIDTH = 256;
const DEFAULT_PROPERTIES_PANE_HEIGHT = 280;

interface PersistedShellState {
  sidebarWidth?: number;
  sidebarVisible?: boolean;
  propertiesPaneVisible?: boolean;
  propertiesPaneHeight?: number;
  propertiesPaneActiveTab?: string;
  inWindowMenuBarVisible?: boolean;
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
}

function validatePersistedState(state: unknown): PersistedShellState {
  if (!state || typeof state !== 'object') {
    return {};
  }

  const persisted = state as Record<string, unknown>;

  const result: PersistedShellState = {};

  if (typeof persisted.sidebarWidth === 'number' && persisted.sidebarWidth > 0) {
    result.sidebarWidth = persisted.sidebarWidth;
  }

  if (typeof persisted.sidebarVisible === 'boolean') {
    result.sidebarVisible = persisted.sidebarVisible;
  }

  if (typeof persisted.propertiesPaneVisible === 'boolean') {
    result.propertiesPaneVisible = persisted.propertiesPaneVisible;
  }

  if (typeof persisted.propertiesPaneHeight === 'number' && persisted.propertiesPaneHeight > 0) {
    result.propertiesPaneHeight = persisted.propertiesPaneHeight;
  }

  if (typeof persisted.propertiesPaneActiveTab === 'string') {
    result.propertiesPaneActiveTab = persisted.propertiesPaneActiveTab;
  }

  if (typeof persisted.inWindowMenuBarVisible === 'boolean') {
    result.inWindowMenuBarVisible = persisted.inWindowMenuBarVisible;
  }

  if (persisted.columnVisibility && typeof persisted.columnVisibility === 'object') {
    result.columnVisibility = persisted.columnVisibility as Record<string, boolean>;
  }

  if (Array.isArray(persisted.columnOrder)) {
    result.columnOrder = persisted.columnOrder.filter((id) => typeof id === 'string');
  }

  if (persisted.columnWidths && typeof persisted.columnWidths === 'object') {
    result.columnWidths = persisted.columnWidths as Record<string, number>;
  }

  return result;
}

export function useShellPersistence() {
  const storeRef = useRef<Store | null>(null);
  const isInitialized = useRef(false);

  const setSidebarWidth = useShellStore((state) => state.setSidebarWidth);
  const setSidebarVisible = useShellStore((state) => state.setSidebarVisible);
  const setPropertiesPaneVisible = useShellStore((state) => state.setPropertiesPaneVisible);
  const setPropertiesPaneHeight = useShellStore((state) => state.setPropertiesPaneHeight);
  const setPropertiesPaneActiveTab = useShellStore((state) => state.setPropertiesPaneActiveTab);
  const setInWindowMenuBarVisible = useShellStore((state) => state.setInWindowMenuBarVisible);
  const setColumnVisibility = useShellStore((state) => state.setColumnVisibility);
  const setColumnOrder = useShellStore((state) => state.setColumnOrder);
  const setColumnWidths = useShellStore((state) => state.setColumnWidths);

  useEffect(() => {
    let mounted = true;

    const initStore = async () => {
      if (isInitialized.current) return;

      try {
        const store = await Store.load(STORE_PATH, { autoSave: false, defaults: {} });
        if (!mounted) return;

        storeRef.current = store;

        const allKeys = await store.keys();
        const persistedState: Record<string, unknown> = {};

        for (const key of allKeys) {
          const value = await store.get<unknown>(key);
          if (value !== null && value !== undefined) {
            persistedState[key] = value;
          }
        }

        const validated = validatePersistedState(persistedState);

        const normalizedColumnVisibility = normalizeColumnVisibility(validated.columnVisibility);
        const normalizedColumnOrder = normalizeColumnOrder(validated.columnOrder);
        const normalizedColumnWidths = normalizeColumnWidths(validated.columnWidths);

        if (validated.sidebarWidth !== undefined) {
          setSidebarWidth(validated.sidebarWidth);
        } else {
          setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
        }

        if (validated.sidebarVisible !== undefined) {
          setSidebarVisible(validated.sidebarVisible);
        }

        // propertiesPaneVisible is intentionally NOT restored from persisted state — it must
        // start closed on every launch and only open when the user clicks a torrent.

        if (validated.propertiesPaneHeight !== undefined) {
          setPropertiesPaneHeight(validated.propertiesPaneHeight);
        } else {
          setPropertiesPaneHeight(DEFAULT_PROPERTIES_PANE_HEIGHT);
        }

        if (validated.propertiesPaneActiveTab !== undefined) {
          const validTabs = ['overview', 'trackers', 'peers', 'files'];
          const tab = validated.propertiesPaneActiveTab;
          const effectiveTab = tab === 'general' ? 'overview' : tab;
          if (validTabs.includes(effectiveTab)) {
            setPropertiesPaneActiveTab(effectiveTab as 'overview' | 'trackers' | 'peers' | 'files');
          }
        }

        if (validated.inWindowMenuBarVisible !== undefined) {
          setInWindowMenuBarVisible(validated.inWindowMenuBarVisible);
        }

        setColumnVisibility(normalizedColumnVisibility);
        setColumnOrder(normalizedColumnOrder);
        setColumnWidths(normalizedColumnWidths);

        isInitialized.current = true;
      } catch (error) {
        console.error('Failed to load shell state from store:', error);
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
        setSidebarVisible(true);
        setPropertiesPaneVisible(false);
        setPropertiesPaneHeight(DEFAULT_PROPERTIES_PANE_HEIGHT);
        setPropertiesPaneActiveTab('overview');
        setInWindowMenuBarVisible(false);
        setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY });
        setColumnOrder([...DEFAULT_COLUMN_ORDER]);
        setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
        isInitialized.current = true;
      }
    };

    initStore();

    return () => {
      mounted = false;
    };
  }, [setSidebarWidth, setSidebarVisible, setPropertiesPaneVisible, setPropertiesPaneHeight, setPropertiesPaneActiveTab, setInWindowMenuBarVisible, setColumnVisibility, setColumnOrder, setColumnWidths]);

  useEffect(() => {
    const unsubscribe = useShellStore.subscribe(async (state) => {
      if (!storeRef.current || !isInitialized.current) return;

      const store = storeRef.current;

      try {
        store.set(SHELL_STORAGE_KEYS.sidebarWidth, state.sidebarWidth);
        store.set(SHELL_STORAGE_KEYS.sidebarVisible, state.sidebarVisible);
        store.set(SHELL_STORAGE_KEYS.propertiesPaneVisible, state.propertiesPaneVisible);
        store.set(SHELL_STORAGE_KEYS.propertiesPaneHeight, state.propertiesPaneHeight);
        store.set(SHELL_STORAGE_KEYS.propertiesPaneActiveTab, state.propertiesPaneActiveTab);
        store.set(SHELL_STORAGE_KEYS.inWindowMenuBarVisible, state.inWindowMenuBarVisible);
        store.set(SHELL_STORAGE_KEYS.columnVisibility, state.columnVisibility);
        store.set(SHELL_STORAGE_KEYS.columnOrder, state.columnOrder);
        store.set(SHELL_STORAGE_KEYS.columnWidths, state.columnWidths);
        // Debounced save — multiple rapid state changes batch into one write
        await store.save();
      } catch (error) {
        console.error('Failed to persist shell state:', error);
      }
    });

    return unsubscribe;
  }, []);
}
