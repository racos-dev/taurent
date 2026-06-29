import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isTorrentFilterType, TORRENT_FILTER_OPTIONS as BASE_TORRENT_FILTER_OPTIONS } from '@taurent/shared';
import { Button, FiltersScreenBody, ScreenHeader } from '@taurent/web-ui';
import type { FilterStatusListOption } from '@taurent/web-ui';
import { useFiltersFormState } from '../hooks';
import { useCategories, useCreateCategory, useEditCategory, useRemoveCategories } from '../hooks/useCategories';
import { useTags, useCreateTags, useDeleteTags } from '../hooks/useTags';
import { useTrackerEntries } from '../hooks/useTrackerEntries';
import { useFiltersScreenController } from '@taurent/web-core/screens';
import { Icon } from '../ui/Icon';
import { mobileScreenRootClassName } from '../ui/mobileScreenLayout';

// Mobile-specific: add icons to the shared base options.
const FILTER_ICONS: Record<string, import('../ui/Icon').AppIconName> = {
  all: 'list',
  downloading: 'download',
  seeding: 'upload',
  completed: 'check-circle',
  stopped: 'pause-circle',
  active: 'zap',
  inactive: 'moon',
  running: 'arrow-right',
  stalled: 'alert',
  stalled_uploading: 'upload',
  stalled_downloading: 'download',
  errored: 'x-circle',
};

const TORRENT_FILTER_OPTIONS: readonly {
  value: string;
  label: string;
  icon: import('../ui/Icon').AppIconName;
}[] = BASE_TORRENT_FILTER_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
  icon: FILTER_ICONS[opt.value] ?? 'list',
}));

export function FiltersScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { categories, isLoading: categoriesIsLoading, refetch: refetchCategories } = useCategories();
  const { tags, isLoading: tagsIsLoading, refetch: refetchTags } = useTags();
  const createCategory = useCreateCategory();
  const editCategory = useEditCategory();
  const removeCategories = useRemoveCategories();
  const createTags = useCreateTags();
  const deleteTags = useDeleteTags();
  const { trackerEntries } = useTrackerEntries();

  const formState = useFiltersFormState({
    categories,
    tags,
    createCategory,
    editCategory,
    removeCategories,
    createTags,
    deleteTags,
  });

  const rawFilter = searchParams.get('selectedFilter');
  const initialFilter =
    rawFilter && isTorrentFilterType(rawFilter) && rawFilter !== 'all' ? rawFilter : null;
  const initialCategory = searchParams.get('selectedCategory') ?? null;
  const initialTag = searchParams.get('selectedTag') || null;
  const initialTracker = searchParams.get('selectedTracker') || null;

  const handleClose = (filters: {
    filter: string | null;
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
      filter: initialFilter,
      category: initialCategory,
      tag: initialTag,
      tracker: initialTracker,
    },
    formState,
    trackerEntries,
    onClose: handleClose,
    onClear: handleClear,
  });

  const statusOptions: FilterStatusListOption[] = useMemo(
    () =>
      TORRENT_FILTER_OPTIONS.map((filter) => ({
        label: filter.label,
        value: filter.value,
        icon: <Icon name={filter.icon} iconSize="md" />,
      })),
    []
  );

  const icons = useMemo(
    () => ({
      filter: <Icon name="filter" iconSize="md" />,
      folder: <Icon name="folder" iconSize="md" />,
      tag: <Icon name="tag" iconSize="md" />,
      globe: <Icon name="globe" iconSize="md" />,
      settings: <Icon name="settings" iconSize="md" />,
      chevronLeft: <Icon name="chevron-left" iconSize="md" />,
      x: <Icon name="x" iconSize="md" />,
    }),
    []
  );

  return (
    <div className={mobileScreenRootClassName({ className: 'flex h-full min-h-0 flex-col overflow-hidden' })}>
      <ScreenHeader
        title="Filters"
        variant="mobile"
        onBack={controller.handleClose}
        rightAction={
          controller.hasActiveFilters ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={controller.handleClearFilters}
              aria-label="Clear filters"
            >
              {icons.x}
              Clear
            </Button>
          ) : null
        }
      />

      {/* ── Shared body with centered/padded layout ── */}
      <main className="mx-auto w-full max-w-lg min-h-0 flex-1 overflow-y-auto overscroll-none px-2 pb-[calc(2rem+var(--sab))]">
        <FiltersScreenBody
          selectedFilter={controller.selectedFilter}
          selectedCategory={controller.selectedCategory}
          selectedTag={controller.selectedTag}
          selectedTracker={controller.selectedTracker}
          statusOptions={statusOptions}
          categoryList={controller.formState.categoryList}
          categorySavePaths={controller.formState.categorySavePaths}
          tagList={controller.formState.tagList}
          newCategoryName={controller.formState.newCategoryName}
          setNewCategoryName={controller.formState.setNewCategoryName}
          newCategorySavePath={controller.formState.newCategorySavePath}
          setNewCategorySavePath={controller.formState.setNewCategorySavePath}
          showAddCategory={controller.formState.showAddCategory}
          setShowAddCategory={controller.formState.setShowAddCategory}
          newTagName={controller.formState.newTagName}
          setNewTagName={controller.formState.setNewTagName}
          showAddTag={controller.formState.showAddTag}
          setShowAddTag={controller.formState.setShowAddTag}
          createCategoryIsPending={createCategory.isPending}
          editCategoryIsPending={editCategory.isPending}
          removeCategoriesIsPending={removeCategories.isPending}
          createTagsIsPending={createTags.isPending}
          deleteTagsIsPending={deleteTags.isPending}
          categoryIsLoading={categoriesIsLoading}
          tagIsLoading={tagsIsLoading}
          onRefreshCategories={refetchCategories}
          onRefreshTags={refetchTags}
          trackerEntries={controller.trackerEntries}
          expandedSections={controller.expandedSections}
          onToggleSection={controller.toggleSection}
          onFilterSelect={controller.handleFilterSelect}
          onCategoryChange={controller.handleCategoryChange}
          onTagChange={controller.handleTagChange}
          onTrackerChange={controller.handleTrackerChange}
          onSubmitAddCategory={controller.formState.handleAddCategory}
          onEditCategory={controller.formState.handleEditCategory}
          onSubmitAddTag={controller.formState.handleAddTag}
          confirmDialog={controller.confirmDialog}
          onCategoryLongPress={controller.handleCategoryLongPress}
          onTagLongPress={controller.handleTagLongPress}
          onCloseConfirmDialog={controller.closeConfirmDialog}
          icons={icons}
        />
      </main>
    </div>
  );
}
