import React from 'react';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import { MutationErrorBanner } from '../../shared/MutationErrorBanner/MutationErrorBanner';
import type { CategorySelectionDialogProps } from './types';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export const CategorySelectionDialog = React.memo<CategorySelectionDialogProps>(({
  categories,
  isPending,
  onCancel,
  onSelect,
  error = null,
}) => {
  const { t } = useTaurentTranslation('dialogs');
  const { t: tCommon } = useTaurentTranslation('common');
  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      title={t('categorySelection.title')}
      description={t('categorySelection.description', { count: categories.length })}
      maxWidth="sm"
      footer={
        <DialogActions
          actions={[{ label: tCommon('actions.cancel'), onClick: onCancel, disabled: isPending }]}
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
          {t('categorySelection.noCategory')}
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
