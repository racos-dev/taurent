import React, { useState, useCallback } from 'react';
import { cn } from '@taurent/shared';
import { Tag, Plus, X, ICON_SIZES } from '@taurent/shared';
import { ConfirmDialog } from '../../dialogs/ConfirmDialog';
import { Composer } from '../Composer';
import { FilterListItem } from '../FilterListItem';
import { StateCard } from '../../shared/StateCard';
import { Input } from '../../primitives/Input';
import { Button } from '../../primitives/Button';
import { IconButton } from '../../primitives/IconButton';
import { Spinner } from '../../shared/Spinner';
import type { FilterTagSectionProps } from './types';

export const FilterTagSection = React.memo<FilterTagSectionProps>(({
  title = 'Tags',
  tags,
  selectedTag,
  onTagChange,
  onDeleteTag,
  isLoading,
  isDeleting,
  isAdding,
  onRefresh,
  showAddForm,
  onShowAddForm,
  newTagName,
  onNewTagNameChange,
  onSubmitAdd,
  onCancelAdd,
  layout = 'pill',
  icon,
  onLongPressItem,
}) => {
  const [confirmDialog, setConfirmDialog] = useState<{ tagName: string } | null>(null);

  const handleDeletePress = useCallback((tagName: string) => {
    if (onLongPressItem) {
      onLongPressItem(tagName);
    } else {
      setConfirmDialog({ tagName });
    }
  }, [onLongPressItem]);

  const handleConfirmDelete = useCallback(() => {
    if (confirmDialog) {
      onDeleteTag(confirmDialog.tagName);
      setConfirmDialog(null);
    }
  }, [confirmDialog, onDeleteTag]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDialog(null);
  }, []);

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
              title="Refresh tags"
              variant="ghost"
            >
              <Spinner variant="icon" size="sm" />
            </IconButton>
          )}
          <IconButton
            onClick={() => onShowAddForm(!showAddForm)}
            title={showAddForm ? 'Close add tag form' : 'Add tag'}
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
              value={newTagName}
              onChange={onNewTagNameChange}
              placeholder="New tag name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTagName.trim()) onSubmitAdd();
                if (e.key === 'Escape') {
                  onCancelAdd();
                  onShowAddForm(false);
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={() => {
                if (newTagName.trim()) onSubmitAdd();
              }}
              disabled={isAdding || !newTagName.trim()}
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
              title="Cancel add tag"
              variant="ghost"
            >
              <X size={ICON_SIZES.sm} className="text-text-secondary" />
            </IconButton>
          </div>
        </div>
      )}

      {/* Tag list */}
      <div className="flex flex-col">
        {/* "All Tags" item */}
        <button
          onClick={() => onTagChange?.(null)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1 text-xs transition-colors text-left',
            selectedTag === null
              ? 'bg-primary/10 text-primary active:bg-primary/20'
              : 'hover:bg-surface-interactive active:bg-surface-interactive text-text-primary'
          )}
        >
          All Tags
        </button>

        {/* Individual tag items */}
        {tags.map((tag) => (
          <div
            key={tag}
            className={cn(
              'group flex items-center gap-1 px-2 py-1 text-xs transition-colors',
              selectedTag === tag
                ? 'bg-primary/10 text-primary active:bg-primary/20'
                : 'hover:bg-surface-interactive active:bg-surface-interactive text-text-primary'
            )}
          >
            <button
              onClick={() => onTagChange?.(tag)}
              className="flex-1 flex items-center gap-2 text-left"
            >
              <Tag size={ICON_SIZES.sm} />
              <span title={tag} className="truncate">{tag}</span>
            </button>
            <IconButton
              onClick={() => handleDeletePress(tag)}
              disabled={isDeleting}
              title={`Delete ${tag}`}
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
          <span className="px-2 py-1 text-text-muted text-xs">Loading tags...</span>
        )}

        {!isLoading && tags.length === 0 && !showAddForm && (
          <StateCard title="No tags" className="py-2 px-3" />
        )}
      </div>
    </>
  );

  const renderListLayout = () => (
    <>
      {/* "All Tags" list item */}
      <FilterListItem
        label="All Tags"
        icon={icon}
        isSelected={selectedTag === null}
        onPress={() => onTagChange?.(null)}
      />

      {/* Tag list items or empty state */}
      {tags.length === 0 && !showAddForm ? (
        <StateCard
          title={isLoading ? 'Loading tags...' : 'No tags yet'}
          icon={icon}
          className="py-3 px-3"
        />
      ) : (
        tags.map((tag) => (
          <div key={tag} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <FilterListItem
                label={tag}
                icon={icon}
                isSelected={selectedTag === tag}
                isChild={true}
                onLongPress={() => handleDeletePress(tag)}
                onPress={() => onTagChange?.(tag)}
              />
            </div>
            <IconButton
              onClick={() => handleDeletePress(tag)}
              disabled={isDeleting}
              title={`Delete ${tag}`}
              tone="danger"
              variant="ghost"
            >
              <X size={ICON_SIZES.md} />
            </IconButton>
          </div>
        ))
      )}

      {showAddForm ? (
        <Composer
          value={newTagName}
          onChange={onNewTagNameChange}
          onSubmit={onSubmitAdd}
          onCancel={() => {
            onCancelAdd();
            onShowAddForm(false);
          }}
          placeholder="Tag name"
          isPending={isAdding}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onShowAddForm(true)}
            variant="ghost"
            size="sm"
            className="justify-start text-primary"
          >
            <Plus size={ICON_SIZES.md} />
            Add Tag
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      {layout === 'list' ? renderListLayout() : renderPillLayout()}

      {/* Delete confirmation dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={`Delete "${confirmDialog.tagName}"?`}
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

FilterTagSection.displayName = 'FilterTagSection';
