// Headless controller for FiltersScreen filter state management.
//
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Owns all filter selection state, URL param initialisation, and
// apply/close/clear navigation callbacks. The route owns header/back
// behaviour and route navigation; this hook provides the state and
// callbacks only.
//
// Usage (mobile FiltersScreen route):
//   const controller = useFiltersScreenController({ initialValues, onClose, onClear });
//
// Usage (desktop FiltersScreen):
//   const controller = useFiltersScreenController({
//     initialValues,
//     onClose: (filters) => { /* navigate */ },
//     onClear: () => { /* navigate */ },
//   });

import { useState, useCallback, useMemo } from 'react';
import type { TorrentFilterType, TrackerEntry } from '@taurent/shared';
import type { UseFiltersFormStateResult } from '../../hooks/useFiltersFormState';

// ─── Input types ───────────────────────────────────────────────────────────────

export interface FiltersScreenInitialValues {
  filter: TorrentFilterType | null;
  category: string | null;
  tag: string | null;
  tracker: string | null;
}

export interface FiltersScreenFormActions {
  createCategory: {
    mutate: (variables: { categoryName: string; savePath?: string }, options?: { onSuccess?: () => void }) => void;
  };
  removeCategories: {
    mutate: (categoryNames: string[], options?: { onSuccess?: () => void }) => void;
  };
  createTags: {
    mutate: (tags: string[], options?: { onSuccess?: () => void }) => void;
  };
  deleteTags: {
    mutate: (tags: string[], options?: { onSuccess?: () => void }) => void;
  };
}

export interface FiltersScreenCategoryTagResult {
  categories: Record<string, import('@taurent/shared').Category> | undefined;
  tags: string[] | undefined;
}

export interface FiltersScreenOptions {
  /** Initial values parsed from URL search params */
  initialValues: FiltersScreenInitialValues;
  /** Category/tag form state (from useFiltersFormState) */
  formState: Pick<
    UseFiltersFormStateResult,
    | 'categoryList'
    | 'categorySavePaths'
    | 'tagList'
    | 'newCategoryName'
    | 'setNewCategoryName'
    | 'newCategorySavePath'
    | 'setNewCategorySavePath'
    | 'showAddCategory'
    | 'setShowAddCategory'
    | 'newTagName'
    | 'setNewTagName'
    | 'showAddTag'
    | 'setShowAddTag'
    | 'handleAddCategory'
    | 'handleEditCategory'
    | 'handleAddTag'
    | 'handleDeleteCategory'
    | 'handleDeleteTag'
  >;
  /** Tracker entries list */
  trackerEntries: TrackerEntry[];
  /** Called when user taps back / apply — receives current filter selections */
  onClose: (filters: FiltersScreenInitialValues) => void;
  /** Called when user clears all filters */
  onClear: () => void;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface FiltersScreenSectionState {
  filters: boolean;
  categories: boolean;
  tags: boolean;
  trackers: boolean;
}

export interface FiltersConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => Promise<void> | void;
}

export interface FiltersScreenControllerResult {
  // ─── Filter selection state ─────────────────────────────────────
  selectedFilter: TorrentFilterType | null;
  selectedCategory: string | null;
  selectedTag: string | null;
  selectedTracker: string | null;

  // ─── Section expand/collapse state ──────────────────────────────
  expandedSections: FiltersScreenSectionState;
  toggleSection: (section: keyof FiltersScreenSectionState) => void;

  // ─── Form state (passthrough from useFiltersFormState) ───────────
  formState: FiltersScreenOptions['formState'];

  // ─── Tracker entries ─────────────────────────────────────────────
  trackerEntries: TrackerEntry[];

  // ─── Active filter flag ──────────────────────────────────────────
  hasActiveFilters: boolean;

  // ─── Filter change handlers ─────────────────────────────────────
  handleFilterSelect: (value: string) => void;
  handleCategoryChange: (category: string | null) => void;
  handleTagChange: (tag: string | null) => void;
  handleTrackerChange: (trackerUrl: string | null) => void;

  // ─── Long-press delete confirm (mobile) ─────────────────────────
  confirmDialog: FiltersConfirmDialogState | null;
  handleCategoryLongPress: (categoryName: string) => void;
  handleTagLongPress: (tagName: string) => void;
  closeConfirmDialog: () => void;

  // ─── Navigation callbacks ───────────────────────────────────────
  handleClose: () => void;
  handleClearFilters: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFiltersScreenController({
  initialValues,
  formState,
  trackerEntries,
  onClose,
  onClear,
}: FiltersScreenOptions): FiltersScreenControllerResult {
  // ─── Filter selection state ─────────────────────────────────────
  const [selectedFilter, setSelectedFilter] = useState<TorrentFilterType | null>(initialValues.filter);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialValues.category);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialValues.tag);
  const [selectedTracker, setSelectedTracker] = useState<string | null>(initialValues.tracker);

  // ─── Section expand/collapse state ──────────────────────────────
  const [expandedSections, setExpandedSections] = useState<FiltersScreenSectionState>({
    filters: true,
    categories: true,
    tags: true,
    trackers: true,
  });

  // ─── Confirm dialog state (mobile long-press delete) ─────────────
  const [confirmDialog, setConfirmDialog] = useState<FiltersConfirmDialogState | null>(null);

  // ─── Active filter flag ──────────────────────────────────────────
  const hasActiveFilters = useMemo(
    () =>
      selectedFilter !== null ||
      selectedCategory !== null ||
      selectedTag !== null ||
      selectedTracker !== null,
    [selectedFilter, selectedCategory, selectedTag, selectedTracker]
  );

  // ─── Section toggle ──────────────────────────────────────────────
  const toggleSection = useCallback((section: keyof FiltersScreenSectionState) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // ─── Filter change handlers ─────────────────────────────────────
  const handleFilterSelect = useCallback((value: string) => {
    setSelectedFilter(value === 'all' ? null : (value as TorrentFilterType));
  }, []);

  const handleCategoryChange = useCallback((category: string | null) => {
    setSelectedCategory(category);
  }, []);

  const handleTagChange = useCallback((tag: string | null) => {
    setSelectedTag(tag);
  }, []);

  const handleTrackerChange = useCallback((trackerUrl: string | null) => {
    setSelectedTracker(trackerUrl);
  }, []);

  // ─── Long-press delete confirm (mobile) ─────────────────────────
  const handleCategoryLongPress = useCallback(
    (categoryName: string) => {
      setConfirmDialog({
        title: `Delete "${categoryName}"?`,
        message: 'Torrents in this category will become uncategorized. This action cannot be undone.',
        confirmLabel: 'Delete',
        tone: 'danger',
        onConfirm: () => {
          formState.handleDeleteCategory(categoryName);
        },
      });
    },
    [formState]
  );

  const handleTagLongPress = useCallback(
    (tagName: string) => {
      setConfirmDialog({
        title: `Delete "${tagName}"?`,
        message: 'This action cannot be undone.',
        confirmLabel: 'Delete',
        tone: 'danger',
        onConfirm: () => {
          formState.handleDeleteTag(tagName);
        },
      });
    },
    [formState]
  );

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  // ─── Navigation callbacks ───────────────────────────────────────
  const handleClose = useCallback(() => {
    onClose({
      filter: selectedFilter,
      category: selectedCategory,
      tag: selectedTag,
      tracker: selectedTracker,
    });
  }, [onClose, selectedFilter, selectedCategory, selectedTag, selectedTracker]);

  const handleClearFilters = useCallback(() => {
    setSelectedFilter(null);
    setSelectedCategory(null);
    setSelectedTag(null);
    setSelectedTracker(null);
    onClear();
  }, [onClear]);

  return {
    selectedFilter,
    selectedCategory,
    selectedTag,
    selectedTracker,
    expandedSections,
    toggleSection,
    formState,
    trackerEntries,
    hasActiveFilters,
    handleFilterSelect,
    handleCategoryChange,
    handleTagChange,
    handleTrackerChange,
    confirmDialog,
    handleCategoryLongPress,
    handleTagLongPress,
    closeConfirmDialog,
    handleClose,
    handleClearFilters,
  };
}
