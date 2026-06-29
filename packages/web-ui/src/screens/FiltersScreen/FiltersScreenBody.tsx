import type { FiltersScreenBodyProps } from './types';
import {
  FilterStatusList,
  FilterCategorySection,
  FilterTagSection,
  FilterTrackerSection,
  SettingsSection,
  ConfirmDialog,
} from '@taurent/web-ui';

// ─── FiltersScreenBody ────────────────────────────────────────────────────────

export function FiltersScreenBody({
  selectedFilter,
  selectedCategory,
  selectedTag,
  selectedTracker,
  statusOptions,
  categoryList,
  categorySavePaths,
  tagList,
  newCategoryName,
  setNewCategoryName,
  newCategorySavePath,
  setNewCategorySavePath,
  showAddCategory,
  setShowAddCategory,
  newTagName,
  setNewTagName,
  showAddTag,
  setShowAddTag,
  createCategoryIsPending,
  editCategoryIsPending,
  removeCategoriesIsPending,
  createTagsIsPending,
  trackerEntries,
  expandedSections,
  onToggleSection,
  onFilterSelect,
  onCategoryChange,
  onTagChange,
  onTrackerChange,
  categoryIsLoading = false,
  tagIsLoading = false,
  onSubmitAddCategory,
  onEditCategory,
  onSubmitAddTag,
  deleteTagsIsPending = false,
  onRefreshCategories,
  onRefreshTags,
  confirmDialog,
  onCategoryLongPress,
  onTagLongPress,
  onCloseConfirmDialog,
  icons,
}: FiltersScreenBodyProps) {
  return (
    <>
      {/* Status Filters Section */}
      <SettingsSection
        title="Status"
        icon={icons.filter}
        summary={`${selectedFilter || 'all'} selected`}
        expanded={expandedSections.filters}
        onToggle={() => onToggleSection('filters')}
      >
        <FilterStatusList
          options={statusOptions}
          selectedValue={selectedFilter}
          onSelect={onFilterSelect}
        />
      </SettingsSection>

      {/* Categories Section */}
      <SettingsSection
        title="Categories"
        icon={icons.folder}
        summary={`${categoryList.length} total`}
        expanded={expandedSections.categories}
        onToggle={() => onToggleSection('categories')}
      >
        <FilterCategorySection
          title="Categories"
          categories={categoryList}
          categorySavePaths={categorySavePaths}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          onDeleteCategory={() => {}}
          isLoading={categoryIsLoading}
          isDeleting={removeCategoriesIsPending}
          isAdding={createCategoryIsPending}
          isEditing={editCategoryIsPending}
          onRefresh={onRefreshCategories}
          showAddForm={showAddCategory}
          onShowAddForm={setShowAddCategory}
          newCategoryName={newCategoryName}
          onNewCategoryNameChange={setNewCategoryName}
          newCategorySavePath={newCategorySavePath}
          onNewCategorySavePathChange={setNewCategorySavePath}
          onSubmitAdd={onSubmitAddCategory}
          onEditCategory={onEditCategory}
          onCancelAdd={() => {
            setNewCategoryName('');
            setNewCategorySavePath?.('');
          }}
          layout="list"
          enableSavePathManagement={Boolean(onEditCategory)}
          icon={icons.folder}
          onLongPressItem={onCategoryLongPress}
        />
      </SettingsSection>

      {/* Tags Section */}
      <SettingsSection
        title="Tags"
        icon={icons.tag}
        summary={`${tagList.length} total`}
        expanded={expandedSections.tags}
        onToggle={() => onToggleSection('tags')}
      >
        <FilterTagSection
          title="Tags"
          tags={tagList}
          selectedTag={selectedTag}
          onTagChange={onTagChange}
          onDeleteTag={() => {}}
          isLoading={tagIsLoading}
          isDeleting={deleteTagsIsPending}
          isAdding={createTagsIsPending}
          onRefresh={onRefreshTags}
          showAddForm={showAddTag}
          onShowAddForm={setShowAddTag}
          newTagName={newTagName}
          onNewTagNameChange={setNewTagName}
          onSubmitAdd={onSubmitAddTag}
          onCancelAdd={() => {
            setNewTagName('');
          }}
          layout="list"
          icon={icons.tag}
          onLongPressItem={onTagLongPress}
        />
      </SettingsSection>

      {/* Trackers Section */}
      <SettingsSection
        title="Trackers"
        icon={icons.globe}
        summary={`${trackerEntries.length} total`}
        expanded={expandedSections.trackers}
        onToggle={() => onToggleSection('trackers')}
      >
        <FilterTrackerSection
          trackerEntries={trackerEntries}
          selectedTracker={selectedTracker}
          onTrackerChange={onTrackerChange}
          icon={icons.globe}
        />
      </SettingsSection>

      {/* In-app Confirm Dialog (mobile long-press delete) */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={onCloseConfirmDialog}
          tone={confirmDialog.tone ?? 'danger'}
        />
      )}
    </>
  );
}
