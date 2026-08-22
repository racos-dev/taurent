import React, { useState, useMemo } from 'react';
import { cn } from '@taurent/shared';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import { MutationErrorBanner } from '../../shared/MutationErrorBanner/MutationErrorBanner';
import type { TagSelectionDialogProps } from './types';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export const TagSelectionDialog = React.memo<TagSelectionDialogProps>(({
  availableTags,
  isPending,
  onCancel,
  onAddTags,
  onRemoveTags,
  assignedTags,
  error = null,
}) => {
  const { t } = useTaurentTranslation('dialogs');
  const { t: tCommon } = useTaurentTranslation('common');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const assignedSet = useMemo(() => assignedTags ?? new Set<string>(), [assignedTags]);

  const handleAdd = () => {
    const toAdd = Array.from(selectedTags).filter((t) => !assignedSet.has(t));
    if (toAdd.length > 0) {
      onAddTags(toAdd);
    }
  };

  const handleRemove = () => {
    const toRemove = Array.from(selectedTags).filter((t) => assignedSet.has(t));
    if (toRemove.length > 0) {
      onRemoveTags(toRemove);
    }
  };

  const canAdd =
    selectedTags.size > 0 &&
    !isPending &&
    Array.from(selectedTags).some((t) => !assignedSet.has(t));

  const canRemove =
    selectedTags.size > 0 &&
    !isPending &&
    Array.from(selectedTags).some((t) => assignedSet.has(t));

  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      title={t('tagSelection.title')}
      description={t('tagSelection.description', { count: availableTags.length })}
      maxWidth="sm"
      footer={
        <>
          <DialogActions
            actions={[
              {
                label: t('tagSelection.add'),
                onClick: handleAdd,
                variant: 'primary',
                disabled: !canAdd,
              },
              {
                label: t('tagSelection.remove'),
                onClick: handleRemove,
                variant: 'outline',
                disabled: !canRemove,
                className: 'border-error/30 bg-error/5 text-error hover:border-error/30 hover:bg-error/10',
              },
            ]}
            className="pb-2"
          />
          <div className="border-t border-border pt-2">
            <DialogActions
              actions={[{ label: tCommon('actions.cancel'), onClick: onCancel, disabled: isPending }]}
              actionClassName="w-full"
            />
          </div>
        </>
      }
    >
      <MutationErrorBanner error={error} />
      <div className="max-h-48 overflow-y-auto py-2">
        {availableTags.length === 0 ? (
          <p className="p-3 text-center text-sm text-text-secondary">{t('tagSelection.noTags')}</p>
        ) : (
          availableTags.map((tag) => {
            const isAssigned = assignedSet.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn('mb-1 w-full rounded-sm border px-2 py-1 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:text-text-disabled',
                  selectedTags.has(tag)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-primary hover:bg-surface-interactive'
                )}
              >
                <span className={isAssigned ? 'font-semibold text-primary' : ''}>
                  #{tag}
                </span>
                {isAssigned && (
                  <span className="ml-auto text-xs text-text-muted">{t('tagSelection.assigned')}</span>
                )}
              </button>
            );
          }
        ))}
      </div>
    </Dialog>
  );
});

TagSelectionDialog.displayName = 'TagSelectionDialog';
