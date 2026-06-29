// Types for the platform-agnostic FiltersScreenBody component.
// All data and callbacks are passed as props — this module has no platform knowledge.

import type { ReactNode } from 'react';
import type { TorrentFilterType, TrackerEntry } from '@taurent/shared';

// ─── Filter selection state passed from controller ────────────────────────────

export interface FiltersScreenBodyFilterState {
  selectedFilter: TorrentFilterType | null;
  selectedCategory: string | null;
  selectedTag: string | null;
  selectedTracker: string | null;
}

// ─── Section state ───────────────────────────────────────────────────────────

export interface FiltersScreenBodySectionState {
  filters: boolean;
  categories: boolean;
  tags: boolean;
  trackers: boolean;
}

// ─── Confirm dialog state ────────────────────────────────────────────────────

export interface FiltersScreenBodyConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => Promise<void> | void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FiltersScreenBodyProps {
  // ── Filter selection state ────────────────────────────────────────
  selectedFilter: TorrentFilterType | null;
  selectedCategory: string | null;
  selectedTag: string | null;
  selectedTracker: string | null;

  // ── Status filter options (platform icons mapped) ──────────────────
  statusOptions: {
    value: string;
    label: string;
    icon?: React.ReactNode;
  }[];

  // ── Category/tag data ───────────────────────────────────────────────
  categoryList: string[];
  categorySavePaths?: Record<string, string>;
  tagList: string[];

  // ── Category/tag form state ─────────────────────────────────────────
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  newCategorySavePath?: string;
  setNewCategorySavePath?: (savePath: string) => void;
  showAddCategory: boolean;
  setShowAddCategory: (show: boolean) => void;
  newTagName: string;
  setNewTagName: (name: string) => void;
  showAddTag: boolean;
  setShowAddTag: (show: boolean) => void;

  // ── Category/tag mutation state ────────────────────────────────────
  categoryIsLoading?: boolean;
  tagIsLoading?: boolean;
  createCategoryIsPending: boolean;
  editCategoryIsPending?: boolean;
  removeCategoriesIsPending: boolean;
  createTagsIsPending: boolean;
  deleteTagsIsPending?: boolean;
  onRefreshCategories?: () => void;
  onRefreshTags?: () => void;

  // ── Tracker entries ────────────────────────────────────────────────
  trackerEntries: TrackerEntry[];

  // ── Section expand/collapse state ────────────────────────────────
  expandedSections: FiltersScreenBodySectionState;
  onToggleSection: (section: keyof FiltersScreenBodySectionState) => void;

  // ── Filter change handlers ─────────────────────────────────────────
  onFilterSelect: (value: string) => void;
  onCategoryChange: (category: string | null) => void;
  onTagChange: (tag: string | null) => void;
  onTrackerChange: (trackerUrl: string | null) => void;

  // ── Category/tag add handlers ───────────────────────────────────────
  onSubmitAddCategory: () => void;
  onEditCategory?: (categoryName: string, savePath: string, options?: { onSuccess?: () => void }) => void;
  onSubmitAddTag: () => void;

  // ── Long-press delete confirm (mobile) ────────────────────────────
  confirmDialog: FiltersScreenBodyConfirmDialog | null;
  onCategoryLongPress: (categoryName: string) => void;
  onTagLongPress: (tagName: string) => void;
  onCloseConfirmDialog: () => void;

  // ── Icons (passed in from shell to avoid platform leakage) ────────
  icons: {
    filter: ReactNode;
    folder: ReactNode;
    tag: ReactNode;
    globe: ReactNode;
    settings: ReactNode;
  };

}
