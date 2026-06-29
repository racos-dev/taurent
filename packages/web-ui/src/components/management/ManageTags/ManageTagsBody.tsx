import React, { useState } from 'react';
import { Button, Spinner } from '@taurent/web-ui';
import { Input } from '@taurent/web-ui';
import { ConfirmDialog } from '../../dialogs/ConfirmDialog';
import { MutationErrorBanner } from '../../shared/MutationErrorBanner/MutationErrorBanner';
import { Tag, Plus, X, ICON_SIZES, cn } from '@taurent/shared';
import type { ManageTagsBodyProps } from './types';
import {
  filledVariantClasses,
  GHOST_DISABLED_CLASSES,
} from '../../primitives/buttonStyles';

export const ManageTagsBody = React.memo<ManageTagsBodyProps>(({
  variant = 'desktop',
  tags,
  isLoading,
  refetch,
  onCreateTag,
  onDeleteTag,
  isCreating = false,
  isDeleting = false,
  mutationError = null,
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const tagList = tags || [];

  const handleAddTag = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    if (tagList.some((tag) => tag === trimmed)) {
      setCreateError('A tag with this name already exists');
      return;
    }
    setCreateError(null);
    onCreateTag(trimmed);
    setNewTagName('');
  };

  const handleDeleteConfirm = () => {
    if (tagToDelete) {
      onDeleteTag(tagToDelete);
      setTagToDelete(null);
    }
  };

  if (variant === 'mobile') {
    return (
      <>
        <div className="flex flex-col gap-3">
          {/* Add Tag Section */}
          <div className="p-3 bg-surface rounded-sm border border-border">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Add New Tag
            </label>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(v) => { setNewTagName(v); setCreateError(null); }}
                placeholder="Tag name"
                className="flex-1"
              />
              <button
                onClick={handleAddTag}
                disabled={!newTagName.trim() || isCreating}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-sm font-medium text-sm transition-colors',
                  filledVariantClasses(
                    'bg-primary',
                    'text-text-on-primary',
                    'enabled:hover:bg-primary-hover',
                    'enabled:active:opacity-90',
                  ),
                )}
              >
                <Plus size={ICON_SIZES.md} />
                Add
              </button>
            </div>
            {createError && (
              <p className="text-xs text-error mt-1">{createError}</p>
            )}
            <MutationErrorBanner error={mutationError} />
          </div>

          {/* Tags List Section */}
          <div className="bg-surface rounded-sm border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                Tags ({tagList.length})
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
                Loading tags...
              </div>
            ) : tagList.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                No tags defined
              </div>
            ) : (
              <div className="p-3">
                <div className="flex flex-wrap gap-2">
                  {tagList.map((tag: string) => (
                    <div
                      key={tag}
                      className="flex items-center gap-2 px-3 py-2 bg-surface rounded-sm border border-border"
                    >
                      <Tag size={ICON_SIZES.md} className="text-primary" />
                      <span className="text-sm text-text-primary">{tag}</span>
                      <button
                        onClick={() => setTagToDelete(tag)}
                        className="p-1 enabled:hover:bg-error-20 enabled:active:bg-error-20 rounded-sm transition-colors"
                      >
                        <X size={ICON_SIZES.md} className="text-error" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {tagToDelete && (
          <ConfirmDialog
            title="Delete Tag"
            message={`Are you sure you want to delete the tag "${tagToDelete}"? This action cannot be undone.`}
            confirmLabel="Delete"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setTagToDelete(null)}
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
            {/* Add Tag Section */}
            <div className="bg-surface p-4 rounded-sm border border-border">
              <h2 className="text-sm font-medium text-text-secondary mb-3">Add New Tag</h2>
              <div className="flex gap-2">
                <Input
                  value={newTagName}
                  onChange={(v) => { setNewTagName(v); setCreateError(null); }}
                  placeholder="Tag name"
                  className="flex-1"
                />
                <Button
                  onClick={handleAddTag}
                  disabled={!newTagName.trim() || isCreating}
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

            {/* Tags List Section */}
            <div className="bg-surface rounded-sm border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-medium text-text-secondary">
                  Tags ({tagList.length})
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
                  Loading tags...
                </div>
              ) : tagList.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">
                  No tags defined
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {tagList.map((tag: string) => (
                      <div
                        key={tag}
                        className="flex items-center gap-2 px-3 py-2 bg-surface rounded-sm border border-border"
                      >
                        <Tag size={ICON_SIZES.md} className="text-primary" />
                        <span className="text-sm text-text-primary">{tag}</span>
<button
                        onClick={() => setTagToDelete(tag)}
                        disabled={isDeleting}
                        className={cn(
                          'p-1 enabled:hover:bg-error-20 enabled:active:bg-error-20 rounded-sm transition-colors',
                          GHOST_DISABLED_CLASSES,
                        )}
                      >
                        <X size={ICON_SIZES.md} className="text-error" />
                      </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {tagToDelete && (
        <ConfirmDialog
          title="Delete Tag"
          message={`Are you sure you want to delete the tag "${tagToDelete}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setTagToDelete(null)}
          tone="danger"
        />
      )}
    </>
  );
});

ManageTagsBody.displayName = 'ManageTagsBody';
