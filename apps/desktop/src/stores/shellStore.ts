import { create } from 'zustand';
import { COLUMN_MAP, COLUMN_REGISTRY } from './columnRegistry';

// Shell state types
export type PropertiesPaneTab = 'overview' | 'trackers' | 'peers' | 'files' | 'httpSources';


interface ShellState {
  // Sidebar
  sidebarWidth: number;
  sidebarVisible: boolean;

  // Properties pane (Detail Panel)
  propertiesPaneVisible: boolean;
  propertiesPaneHeight: number;
  propertiesPaneActiveTab: PropertiesPaneTab;

  // In-window menubar (macOS only — hidden by default, toggled via View menu)
  inWindowMenuBarVisible: boolean;

  // Column preferences (workspace)
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
}

export interface ShellStore extends ShellState {
  // Sidebar actions
  setSidebarWidth: (width: number) => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;

  // Properties pane actions
  setPropertiesPaneVisible: (visible: boolean) => void;
  setPropertiesPaneHeight: (height: number) => void;
  setPropertiesPaneActiveTab: (tab: PropertiesPaneTab) => void;
  togglePropertiesPane: () => void;

  // In-window menubar actions (macOS only)
  setInWindowMenuBarVisible: (visible: boolean) => void;
  toggleInWindowMenuBarVisible: () => void;

  // Column preference actions
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnWidths: (widths: Record<string, number>) => void;
  setColumnWidth: (columnId: string, width: number) => void;
}

// Default values
export const DEFAULT_SIDEBAR_WIDTH = 256;
export const DEFAULT_PROPERTIES_PANE_HEIGHT = 280;

const CUSTOMIZABLE_COLUMNS = COLUMN_REGISTRY.filter((column) => !column.deferred);
const CUSTOMIZABLE_COLUMN_IDS = CUSTOMIZABLE_COLUMNS.map((column) => column.id);

// Default column configuration
export const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = CUSTOMIZABLE_COLUMNS.reduce(
  (acc, column) => {
    acc[column.id] = column.defaultVisibility;
    return acc;
  },
  {} as Record<string, boolean>
);

export const DEFAULT_COLUMN_ORDER: string[] = [...CUSTOMIZABLE_COLUMN_IDS];

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = CUSTOMIZABLE_COLUMNS.reduce(
  (acc, column) => {
    acc[column.id] = column.minWidth;
    return acc;
  },
  {} as Record<string, number>
);

export function normalizeColumnVisibility(visibility?: Record<string, boolean>): Record<string, boolean> {
  const normalized = { ...DEFAULT_COLUMN_VISIBILITY };

  if (!visibility) {
    return normalized;
  }

  for (const columnId of CUSTOMIZABLE_COLUMN_IDS) {
    const value = visibility[columnId];
    if (typeof value === 'boolean') {
      normalized[columnId] = value;
    }
  }

  if (!CUSTOMIZABLE_COLUMN_IDS.some((columnId) => normalized[columnId])) {
    const fallbackColumnId = DEFAULT_COLUMN_ORDER[0];
    if (fallbackColumnId) {
      normalized[fallbackColumnId] = true;
    }
  }

  return normalized;
}

export function normalizeColumnOrder(order?: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const columnId of order ?? []) {
    if (!CUSTOMIZABLE_COLUMN_IDS.includes(columnId) || seen.has(columnId)) {
      continue;
    }

    seen.add(columnId);
    normalized.push(columnId);
  }

  for (const columnId of DEFAULT_COLUMN_ORDER) {
    if (seen.has(columnId)) {
      continue;
    }

    seen.add(columnId);
    normalized.push(columnId);
  }

  return normalized;
}

export function normalizeColumnWidths(widths?: Record<string, number>): Record<string, number> {
  const normalized = { ...DEFAULT_COLUMN_WIDTHS };

  if (!widths) {
    return normalized;
  }

  for (const columnId of CUSTOMIZABLE_COLUMN_IDS) {
    const width = widths[columnId];
    const minWidth = COLUMN_MAP[columnId]?.minWidth ?? DEFAULT_COLUMN_WIDTHS[columnId];

    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      normalized[columnId] = Math.max(minWidth, Math.round(width));
    }
  }

  return normalized;
}

export const useShellStore = create<ShellStore>((set) => ({
  // Initial state
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  sidebarVisible: true,
  propertiesPaneVisible: false,
  propertiesPaneHeight: DEFAULT_PROPERTIES_PANE_HEIGHT,
  propertiesPaneActiveTab: 'overview',

  // In-window menubar: hidden by default on macOS (native app menu handles it);
  // visible by default on Windows/Linux (no native app menu, so menubar is needed).
  // Detected at runtime using navigator.platform.
  inWindowMenuBarVisible: !/mac/i.test(typeof navigator !== 'undefined' ? navigator.platform : ''),

  // Column preferences initial state
  columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
  columnOrder: [...DEFAULT_COLUMN_ORDER],
  columnWidths: { ...DEFAULT_COLUMN_WIDTHS },

  // Sidebar actions
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

  // Properties pane actions
  setPropertiesPaneVisible: (visible) => set({ propertiesPaneVisible: visible }),
  setPropertiesPaneHeight: (height) => set({ propertiesPaneHeight: height }),
  setPropertiesPaneActiveTab: (tab) => set({ propertiesPaneActiveTab: tab }),
  togglePropertiesPane: () => set((state) => ({ propertiesPaneVisible: !state.propertiesPaneVisible })),

  // In-window menubar actions
  setInWindowMenuBarVisible: (visible) => set({ inWindowMenuBarVisible: visible }),
  toggleInWindowMenuBarVisible: () => set((state) => ({ inWindowMenuBarVisible: !state.inWindowMenuBarVisible })),

  // Column preference actions
  setColumnVisibility: (visibility) => set({ columnVisibility: visibility }),
  setColumnOrder: (order) => set({ columnOrder: order }),
  setColumnWidths: (widths) => set({ columnWidths: widths }),
  setColumnWidth: (columnId, width) => set((state) => ({
    columnWidths: { ...state.columnWidths, [columnId]: width },
  })),
}));
