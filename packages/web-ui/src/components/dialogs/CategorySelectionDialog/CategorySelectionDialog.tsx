import React from 'react';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import { MutationErrorBanner } from '../../shared/MutationErrorBanner/MutationErrorBanner';
import type { CategorySelectionDialogProps } from './types';

export const CategorySelectionDialog = React.memo<CategorySelectionDialogProps>(({
  categories,
  isPending,
  onCancel,
  onSelect,
  error = null,
}) => {
  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      title="Set Category"
      description={`Select a category for the selected torrent${categories.length === 1 ? '' : 's'}.`}
      maxWidth="sm"
      footer={
        <DialogActions
          actions={[{ label: 'Cancel', onClick: onCancel, disabled: isPending }]}
          actionClassName="w-full"
        />
      }
    >
      <MutationErrorBanner error={error} />
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <button
          type="button"
          onClick={() => onSelect('')}
          disabled={isPending}
          className="mb-1 w-full rounded-sm border border-border px-2 py-1 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-interactive disabled:cursor-not-allowed disabled:text-text-disabled"
        >
          No Category
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            disabled={isPending}
            className="mb-1 w-full rounded-sm border border-border px-2 py-1 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-interactive disabled:cursor-not-allowed disabled:text-text-disabled"
          >
            {category}
          </button>
        ))}
      </div>
    </Dialog>
  );
});

CategorySelectionDialog.displayName = 'CategorySelectionDialog';
