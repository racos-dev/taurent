/**
 * Desktop Filters Screen — Phase 6.
 *
 * Wires the shared FiltersScreenBody to desktop-specific data sources
 * (useFiltersScreenController from web-core + useFiltersFormState +
 * useTrackerEntries for capability).
 *
 * Uses the same controller/body pattern as mobile so both platforms share
 * the same filter state machine and body rendering.
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Download, Upload, CheckCircle, Pause, Zap, Moon, AlertCircle } from '@taurent/shared';
import { FiltersScreenBody } from '@taurent/web-ui';
import { TORRENT_FILTER_OPTIONS, type TorrentFilterType } from '@taurent/shared';
import { useFiltersScreenController } from '@taurent/web-core/screens';
import {
  useFiltersFormState,
  useCategories,
  useCreateCategory,
  useRemoveCategories,
  useTags,
  useCreateTags,
  useDeleteTags,
} from '../hooks';
import { useTrackerEntries } from '../hooks/useTrackerEntries';
import { ScreenHeader } from '@taurent/web-ui';
import { openConfirmDialogWindow } from '../windows/dialogs/confirmDialogWindow';

const FILTER_ICONS: Record<TorrentFilterType, React.ComponentType<{ className?: string }>> = {
  all: Filter,
  downloading: Download,
  seeding: Upload,
  completed: CheckCircle,
  stopped: Pause,
  active: Zap,
  inactive: Moon,
  running: Zap,
  stalled: AlertCircle,
  stalled_uploading: Upload,
  stalled_downloading: Download,
  errored: AlertCircle,
};

export function FiltersScreen() {
  const navigate = useNavigate();

  const { categories } = useCategories();
  const { tags } = useTags();
  const createCategory = useCreateCategory();
  const removeCategories = useRemoveCategories();
  const createTags = useCreateTags();
  const deleteTags = useDeleteTags();
  const { trackerEntries } = useTrackerEntries();

  const formState = useFiltersFormState({
    categories,
    tags,
    createCategory,
    removeCategories,
    createTags,
    deleteTags,
  });

  const handleClose = (filters: {
    filter: TorrentFilterType | null;
    category: string | null;
    tag: string | null;
    tracker: string | null;
  }) => {
    const params = new URLSearchParams();
    if (filters.category !== null) params.set('selectedCategory', filters.category);
    if (filters.tag) params.set('selectedTag', filters.tag);
    if (filters.filter && filters.filter !== 'all') params.set('selectedFilter', filters.filter);
    if (filters.tracker) params.set('selectedTracker', filters.tracker);
    const queryString = params.toString();
    navigate(`/?${queryString}`);
  };

  const handleClear = () => {
    navigate('/');
  };

  const controller = useFiltersScreenController({
    initialValues: {
      filter: 'all',
      category: null,
      tag: null,
      tracker: null,
    },
    formState,
    trackerEntries,
    onClose: handleClose,
    onClear: handleClear,
  });

  // Desktop: intercept long-press to open window dialog instead of in-app overlay
  const handleCategoryLongPressDesktop = useCallback(
    (categoryName: string) => {
      void openConfirmDialogWindow({ name: categoryName, type: 'category' });
      controller.closeConfirmDialog();
    },
    [controller]
  );

  const handleTagLongPressDesktop = useCallback(
    (tagName: string) => {
      void openConfirmDialogWindow({ name: tagName, type: 'tag' });
      controller.closeConfirmDialog();
    },
    [controller]
  );

  const statusOptions = useMemo(
    () =>
      TORRENT_FILTER_OPTIONS.map((filter) => {
        const IconComp = FILTER_ICONS[filter.value as TorrentFilterType];
        return {
          label: filter.label,
          value: filter.value,
          icon: <IconComp className="w-5 h-5" />,
        };
      }),
    []
  );

  const icons = useMemo(
    () => ({
      filter: <Filter className="w-5 h-5" />,
      folder: <Filter className="w-5 h-5" />,
      tag: <Filter className="w-5 h-5" />,
      globe: <Filter className="w-5 h-5" />,
      settings: <Filter className="w-5 h-5" />,
    }),
    []
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <ScreenHeader title="Filters" variant="desktop" onBack={() => navigate('/')} />

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto">
          <FiltersScreenBody
            selectedFilter={controller.selectedFilter}
            selectedCategory={controller.selectedCategory}
            selectedTag={controller.selectedTag}
            selectedTracker={controller.selectedTracker}
            statusOptions={statusOptions}
            categoryList={controller.formState.categoryList}
            tagList={controller.formState.tagList}
            newCategoryName={controller.formState.newCategoryName}
            setNewCategoryName={controller.formState.setNewCategoryName}
            showAddCategory={controller.formState.showAddCategory}
            setShowAddCategory={controller.formState.setShowAddCategory}
            newTagName={controller.formState.newTagName}
            setNewTagName={controller.formState.setNewTagName}
            showAddTag={controller.formState.showAddTag}
            setShowAddTag={controller.formState.setShowAddTag}
            createCategoryIsPending={createCategory.isPending}
            removeCategoriesIsPending={removeCategories.isPending}
            createTagsIsPending={createTags.isPending}
            trackerEntries={controller.trackerEntries}
            expandedSections={controller.expandedSections}
            onToggleSection={controller.toggleSection}
            onFilterSelect={controller.handleFilterSelect}
            onCategoryChange={controller.handleCategoryChange}
            onTagChange={controller.handleTagChange}
            onTrackerChange={controller.handleTrackerChange}
            onSubmitAddCategory={controller.formState.handleAddCategory}
            onSubmitAddTag={controller.formState.handleAddTag}
            confirmDialog={null}
            onCategoryLongPress={handleCategoryLongPressDesktop}
            onTagLongPress={handleTagLongPressDesktop}
            onCloseConfirmDialog={controller.closeConfirmDialog}
            icons={icons}
          />
        </div>
      </div>
    </div>
  );
}
