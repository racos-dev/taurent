import React, { useState } from 'react';
import { Button, Spinner } from '@taurent/web-ui';
import { Input } from '@taurent/web-ui';
import { ConfirmDialog } from '../../dialogs/ConfirmDialog';
import { MutationErrorBanner } from '../../shared/MutationErrorBanner/MutationErrorBanner';
import { Folder, Plus, Edit2, Trash2, Check, X, ICON_SIZES, cn } from '@taurent/shared';
import type { ManageCategoriesBodyProps } from './types';
import {
  filledVariantClasses,
  surfaceVariantClasses,
  GHOST_DISABLED_CLASSES,
} from '../../primitives/buttonStyles';

export const ManageCategoriesBody = React.memo<ManageCategoriesBodyProps>(({
  variant = 'desktop',
  categories,
  isLoading,
  refetch,
  onCreateCategory,
  onEditCategory,
  onRemoveCategory,
  isCreating = false,
  isEditing = false,
  isRemoving = false,
  mutationError = null,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryPath, setNewCategoryPath] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editSavePath, setEditSavePath] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const categoryList = categories ? Object.values(categories) : [];

  const handleStartEdit = (categoryName: string, savePath: string) => {
    setEditingCategory(categoryName);
    setEditSavePath(savePath ?? '');
  };

  const handleSaveEdit = () => {
    if (editingCategory) {
      onEditCategory(editingCategory, editSavePath);
      setEditingCategory(null);
      setEditSavePath('');
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditSavePath('');
  };

  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;
    if (categoryList.some((c) => c.name === trimmedName)) {
      setCreateError('A category with this name already exists');
      return;
    }
    setCreateError(null);
    onCreateCategory(trimmedName, newCategoryPath.trim());
    setNewCategoryName('');
    setNewCategoryPath('');
  };

  const handleDeleteConfirm = () => {
    if (categoryToDelete) {
      onRemoveCategory(categoryToDelete);
      setCategoryToDelete(null);
    }
  };

  if (variant === 'mobile') {
    return (
      <>
        <div className="flex flex-col gap-3">
          {/* Add Category Section */}
          <div className="p-3 bg-surface rounded-sm border border-border">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Add New Category
            </label>
            <div className="space-y-3">
              <Input
                value={newCategoryName}
                onChange={(v) => { setNewCategoryName(v); setCreateError(null); }}
                placeholder="Category name"
                className="w-full"
              />
              <Input
                value={newCategoryPath}
                onChange={(v) => { setNewCategoryPath(v); setCreateError(null); }}
                placeholder="Save path (optional)"
                className="w-full"
              />
              {createError && (
                <p className="text-xs text-error">{createError}</p>
              )}
              <MutationErrorBanner error={mutationError} />
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim() || isCreating}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm font-medium text-sm transition-colors',
                  filledVariantClasses(
                    'bg-primary',
                    'text-text-on-primary',
                    'enabled:hover:bg-primary-hover',
                    'enabled:active:opacity-90',
                  ),
                )}
              >
                <Plus size={ICON_SIZES.md} />
                Add Category
              </button>
            </div>
          </div>

          {/* Categories List Section */}
          <div className="bg-surface rounded-sm border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                Categories ({categoryList.length})
              </span>
              <button
                onClick={refetch}
                disabled={isLoading}
                className="p-1 enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive rounded-sm transition-colors disabled:cursor-not-allowed"
              >
                <Spinner variant="icon" size="md" />
              </button>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-text-secondary">
                Loading categories...
              </div>
            ) : categoryList.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                No categories defined
              </div>
            ) : (
              <div className="divide-y divide-border">
                {categoryList.map((category) => (
                  <div key={category.name} className="p-3">
                    {editingCategory === category.name ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Folder size={ICON_SIZES.lg} className="text-primary flex-shrink-0" />
                          <span title={category.name} className="text-sm font-medium text-text-primary truncate">
                            {category.name}
                          </span>
                        </div>
                        <Input
                          value={editSavePath}
                          onChange={setEditSavePath}
                          placeholder="Save path"
                          className="w-full"
                          autoFocus
                        />
                        <div className="flex gap-2">
<button
                          onClick={handleCancelEdit}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition-colors',
                              surfaceVariantClasses({
                                bg: 'bg-surface',
                                text: 'text-text-secondary',
                                hoverBg: 'bg-surface-interactive',
                                activeBg: 'bg-surface-interactive',
                              }),
                            )}
                          >
                            <X size={ICON_SIZES.md} />
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={isEditing}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition-colors',
                              filledVariantClasses(
                                'bg-success',
                                'text-text-on-success',
                                'enabled:hover:bg-success/90',
                                'enabled:active:opacity-90',
                              ),
                            )}
                          >
                            <Check size={ICON_SIZES.md} />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <Folder size={ICON_SIZES.lg} className="text-primary flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div title={category.name} className="text-sm font-medium text-text-primary truncate">
                            {category.name}
                          </div>
                          {category.savePath && (
                            <div title={category.savePath} className="text-xs text-text-secondary truncate mt-1">
                              {category.savePath}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleStartEdit(category.name, category.savePath ?? '')}
                            className="p-2 enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive rounded-sm transition-colors"
                          >
                            <Edit2 size={ICON_SIZES.md} className="text-text-muted" />
                          </button>
                          <button
                            onClick={() => setCategoryToDelete(category.name)}
                            className="p-2 enabled:hover:bg-error-20 enabled:active:bg-error-20 rounded-sm transition-colors"
                          >
                            <Trash2 size={ICON_SIZES.md} className="text-error" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {categoryToDelete && (
          <ConfirmDialog
            title="Delete Category"
            message={`Are you sure you want to delete the category "${categoryToDelete}"? Torrents in this category will become uncategorized.`}
            confirmLabel="Delete"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setCategoryToDelete(null)}
            tone="danger"
          />
        )}
      </>
    );
  }

  // Desktop variant
  return (
    <>
      <div className="h-full flex flex-col bg-background">
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-6">
            {/* Add Category Section */}
            <div className="bg-surface p-4 rounded-sm border border-border">
              <h2 className="text-sm font-medium text-text-secondary mb-3">Add New Category</h2>
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(v) => { setNewCategoryName(v); setCreateError(null); }}
                  placeholder="Category name"
                  className="flex-1"
                />
                <Input
                  value={newCategoryPath}
                  onChange={(v) => { setNewCategoryPath(v); setCreateError(null); }}
                  placeholder="Save path (optional)"
                  className="flex-1"
                />
                <Button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim() || isCreating}
                >
                  <Plus size={ICON_SIZES.md} className="mr-1" />
                  Add
                </Button>
              </div>
              {createError && (
                <p className="text-xs text-error mt-1">{createError}</p>
              )}
              <MutationErrorBanner error={mutationError} />
            </div>

            {/* Categories List Section */}
            <div className="bg-surface rounded-sm border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-medium text-text-secondary">
                  Categories ({categoryList.length})
                </h2>
                <button
                  onClick={refetch}
                  disabled={isLoading}
                  className="p-1 enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive rounded-sm transition-colors disabled:cursor-not-allowed"
                >
                  <Spinner variant="icon" size="md" />
                </button>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-text-secondary">
                  Loading categories...
                </div>
              ) : categoryList.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">
                  No categories defined
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {categoryList.map((category) => (
                    <div key={category.name} className="p-3 flex items-center gap-3">
                      <Folder size={ICON_SIZES.lg} className="text-primary flex-shrink-0" />

                      {editingCategory === category.name ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <div title={category.name} className="text-sm font-medium text-text-primary truncate">
                              {category.name}
                            </div>
                            <Input
                              value={editSavePath}
                              onChange={setEditSavePath}
                              className="flex-1 mt-1"
                              placeholder="Save path"
                              autoFocus
                            />
                          </div>
                          <button
                            onClick={handleCancelEdit}
                            className={cn(
                              'p-2 text-error enabled:hover:bg-error-20 enabled:active:bg-error-20 rounded-sm transition-colors',
                              GHOST_DISABLED_CLASSES,
                            )}
                          >
                            <X size={ICON_SIZES.md} />
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={isEditing}
                            className={cn(
                              'p-2 text-success enabled:hover:bg-success-20 enabled:active:bg-success-20 rounded-sm transition-colors',
                              GHOST_DISABLED_CLASSES,
                            )}
                          >
                            <Check size={ICON_SIZES.md} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div title={category.name} className="text-sm font-medium text-text-primary truncate">
                              {category.name}
                            </div>
                            {category.savePath && (
                              <div title={category.savePath} className="text-xs text-text-secondary truncate">
                                {category.savePath}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleStartEdit(category.name, category.savePath ?? '')}
                            className="p-2 enabled:hover:bg-surface-interactive enabled:active:bg-surface-interactive rounded-sm transition-colors"
                          >
                            <Edit2 size={ICON_SIZES.md} className="text-text-muted" />
                          </button>
                          <button
                            onClick={() => setCategoryToDelete(category.name)}
                            disabled={isRemoving}
                            className={cn(
                              'p-2 enabled:hover:bg-error-20 enabled:active:bg-error-20 rounded-sm transition-colors',
                              GHOST_DISABLED_CLASSES,
                            )}
                          >
                            <Trash2 size={ICON_SIZES.md} className="text-error" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {categoryToDelete && (
        <ConfirmDialog
          title="Delete Category"
          message={`Are you sure you want to delete the category "${categoryToDelete}"? Torrents in this category will become uncategorized.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setCategoryToDelete(null)}
          tone="danger"
        />
      )}
    </>
  );
});

ManageCategoriesBody.displayName = 'ManageCategoriesBody';
