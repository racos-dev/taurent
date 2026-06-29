import React, { useCallback, useState } from 'react';
import { cn, Check, Edit2, Folder, Plus, X, ICON_SIZES } from '@taurent/shared';
import { ConfirmDialog } from '../../dialogs/ConfirmDialog';
import { Composer } from '../Composer';
import { FilterListItem } from '../FilterListItem';
import { StateCard } from '../../shared/StateCard';
import { Input } from '../../primitives/Input';
import { Button } from '../../primitives/Button';
import { IconButton } from '../../primitives/IconButton';
import { Spinner } from '../../shared/Spinner';
import type { FilterCategorySectionProps } from './types';

export const FilterCategorySection = React.memo<FilterCategorySectionProps>(({
  title = 'Categories',
  categories,
  categorySavePaths = {},
  selectedCategory,
  onCategoryChange,
  onDeleteCategory,
  isLoading,
  isDeleting,
  isAdding,
  isEditing = false,
  onRefresh,
  showAddForm,
  onShowAddForm,
  newCategoryName,
  onNewCategoryNameChange,
  newCategorySavePath = '',
  onNewCategorySavePathChange,
  onSubmitAdd,
  onCancelAdd,
  onEditCategory,
  layout = 'pill',
  enableSavePathManagement = false,
  icon,
  onLongPressItem,
}) => {
  const [confirmDialog, setConfirmDialog] = useState<{ categoryName: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editSavePath, setEditSavePath] = useState('');

  const handleDeletePress = useCallback((categoryName: string) => {
    if (onLongPressItem) {
      onLongPressItem(categoryName);
    } else {
      setConfirmDialog({ categoryName });
    }
  }, [onLongPressItem]);

  const handleConfirmDelete = useCallback(() => {
    if (confirmDialog) {
      onDeleteCategory(confirmDialog.categoryName);
      setConfirmDialog(null);
    }
  }, [confirmDialog, onDeleteCategory]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const handleStartEdit = useCallback((categoryName: string) => {
    setEditingCategory(categoryName);
    setEditSavePath(categorySavePaths[categoryName] ?? '');
  }, [categorySavePaths]);

  const handleCancelEdit = useCallback(() => {
    setEditingCategory(null);
    setEditSavePath('');
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingCategory || !onEditCategory) return;
    onEditCategory(editingCategory, editSavePath, {
      onSuccess: handleCancelEdit,
    });
  }, [editSavePath, editingCategory, handleCancelEdit, onEditCategory]);

  const handleCategoryAddCancel = useCallback(() => {
    onCancelAdd();
    onNewCategorySavePathChange?.('');
    onShowAddForm(false);
  }, [onCancelAdd, onNewCategorySavePathChange, onShowAddForm]);

  const renderManagedAddForm = () => (
    <div className="flex flex-col gap-2 px-2 py-2">
      <Input
        type="text"
        size="sm"
        value={newCategoryName}
        onChange={onNewCategoryNameChange}
        placeholder="Category name"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && newCategoryName.trim()) onSubmitAdd();
          if (e.key === 'Escape') handleCategoryAddCancel();
        }}
      />
      <Input
        type="text"
        size="sm"
        value={newCategorySavePath}
        onChange={(value) => onNewCategorySavePathChange?.(value)}
        placeholder="Save path (optional)"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && newCategoryName.trim()) onSubmitAdd();
          if (e.key === 'Escape') handleCategoryAddCancel();
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCategoryAddCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onSubmitAdd}
          disabled={!newCategoryName.trim() || isAdding}
          className="flex-1"
        >
          {isAdding ? 'Adding...' : 'Add'}
        </Button>
      </div>
    </div>
  );

  const renderPillLayout = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xs font-medium text-text-secondary">
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <IconButton
              onClick={onRefresh}
              loading={isLoading}
              disabled={isLoading}
              title="Refresh categories"
              variant="ghost"
            >
              <Spinner variant="icon" size="sm" />
            </IconButton>
          )}
          <IconButton
            onClick={() => onShowAddForm(!showAddForm)}
            title={showAddForm ? 'Close add category form' : 'Add category'}
            variant="ghost"
            isActive={showAddForm}
          >
            <Plus size={ICON_SIZES.sm} className="text-text-secondary" />
          </IconButton>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-1 p-2 border border-border rounded-sm">
          <div className="flex gap-1">
            <Input
              type="text"
              size="sm"
              value={newCategoryName}
              onChange={onNewCategoryNameChange}
              placeholder="New category name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCategoryName.trim()) onSubmitAdd();
                if (e.key === 'Escape') {
                  onCancelAdd();
                  onShowAddForm(false);
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={() => {
                if (newCategoryName.trim()) onSubmitAdd();
              }}
              disabled={isAdding || !newCategoryName.trim()}
              loading={isAdding}
              size="sm"
              variant="primary"
            >
              Add
            </Button>
            <IconButton
              onClick={() => {
                onCancelAdd();
                onShowAddForm(false);
              }}
              title="Cancel add category"
              variant="ghost"
            >
              <X size={ICON_SIZES.sm} className="text-text-secondary" />
            </IconButton>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="space-y-1">
        {/* "All Categories" pill */}
        <button
          onClick={() => onCategoryChange?.(null)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1 text-xs transition-colors',
            selectedCategory === null
              ? 'bg-primary/10 text-primary active:bg-primary/20'
              : 'hover:bg-surface-interactive active:bg-surface-interactive text-text-primary'
          )}
        >
          <Folder size={ICON_SIZES.sm} />
          <span title="All Categories" className="flex-1 truncate text-left">All Categories</span>
        </button>

        {/* Individual category pills */}
        {categories.map((category) => (
          <div
            key={category}
            className={cn(
              'group flex items-center gap-2 px-2 py-1 text-xs transition-colors',
              selectedCategory === category
                ? 'bg-primary/10 text-primary active:bg-primary/20'
                : 'hover:bg-surface-interactive active:bg-surface-interactive text-text-primary'
            )}
          >
            <button
              onClick={() => onCategoryChange?.(category)}
              className="flex-1 flex items-center gap-2 text-left"
            >
              <Folder size={ICON_SIZES.sm} />
              <span title={category} className="flex-1 truncate">{category}</span>
            </button>
            <IconButton
              onClick={() => handleDeletePress(category)}
              disabled={isDeleting}
              title={`Delete ${category}`}
              tone="danger"
              variant="ghost"
              className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X size={ICON_SIZES.sm} />
            </IconButton>
          </div>
        ))}

        {/* Loading / empty states */}
        {isLoading && (
          <div className="px-2 py-1 text-text-muted text-xs">Loading categories...</div>
        )}

        {!isLoading && categories.length === 0 && !showAddForm && (
          <StateCard title="No categories" className="py-2 px-3" />
        )}
      </div>
    </>
  );

  const renderListLayout = () => (
    <>
      {/* "All Categories" list item */}
      <FilterListItem
        label="All Categories"
        icon={icon ?? <Folder size={ICON_SIZES.md} />}
        isSelected={selectedCategory === null}
        onPress={() => onCategoryChange?.(null)}
      />

      {/* Category list items or empty state */}
      {categories.length === 0 && !showAddForm ? (
        <StateCard
          title={isLoading ? 'Loading categories...' : 'No categories yet'}
          icon={icon ?? <Folder size={ICON_SIZES.lg} />}
          className="py-3 px-3"
        />
      ) : (
        categories.map((category) => {
          const savePath = categorySavePaths[category] ?? '';

          if (enableSavePathManagement && editingCategory === category) {
            return (
              <div key={category} className="rounded-sm border border-border bg-background p-2">
                <div className="mb-2 flex min-w-0 items-center gap-2">
                  <span className="text-primary">{icon ?? <Folder size={ICON_SIZES.md} />}</span>
                  <span title={category} className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                    {category}
                  </span>
                </div>
                <Input
                  value={editSavePath}
                  onChange={setEditSavePath}
                  placeholder="Save path"
                  size="sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="flex-1"
                  >
                    <X size={ICON_SIZES.md} />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isEditing}
                    className="flex-1"
                  >
                    <Check size={ICON_SIZES.md} />
                    Save
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div key={category} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <FilterListItem
                  label={category}
                  icon={icon ?? <Folder size={ICON_SIZES.md} />}
                  isSelected={selectedCategory === category}
                  isChild={true}
                  onLongPress={() => handleDeletePress(category)}
                  onPress={() => onCategoryChange?.(category)}
                />
                {enableSavePathManagement && savePath ? (
                  <div title={savePath} className="ml-8 truncate px-2 pb-1 text-xs text-text-secondary">
                    {savePath}
                  </div>
                ) : null}
              </div>
              {enableSavePathManagement && onEditCategory ? (
                <IconButton
                  onClick={() => handleStartEdit(category)}
                  disabled={isEditing}
                  title={`Edit ${category}`}
                  variant="ghost"
                >
                  <Edit2 size={ICON_SIZES.md} />
                </IconButton>
              ) : null}
              <IconButton
                onClick={() => handleDeletePress(category)}
                disabled={isDeleting}
                title={`Delete ${category}`}
                tone="danger"
                variant="ghost"
              >
                <X size={ICON_SIZES.md} />
              </IconButton>
            </div>
          );
        })
      )}

      {showAddForm ? (
        enableSavePathManagement ? (
          renderManagedAddForm()
        ) : (
          <Composer
            value={newCategoryName}
            onChange={onNewCategoryNameChange}
            onSubmit={onSubmitAdd}
            onCancel={() => {
              onCancelAdd();
              onShowAddForm(false);
            }}
            placeholder="Category name"
            isPending={isAdding}
          />
        )
      ) : (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onShowAddForm(true)}
            variant="ghost"
            size="sm"
            className="justify-start text-primary"
          >
            <Plus size={ICON_SIZES.md} />
            Add Category
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      {layout === 'list' ? renderListLayout() : renderPillLayout()}

      {/* Delete confirmation dialog - only shown when not using onLongPressItem (desktop pattern) */}
      {confirmDialog && (
        <ConfirmDialog
          title={`Delete "${confirmDialog.categoryName}"?`}
          message="This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          tone="danger"
        />
      )}
    </>
  );
});

FilterCategorySection.displayName = 'FilterCategorySection';
