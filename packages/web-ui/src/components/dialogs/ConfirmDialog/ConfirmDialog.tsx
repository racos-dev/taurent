import React, { useState } from 'react';
import { cn, AlertCircle, ICON_SIZES } from '@taurent/shared';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import type { ConfirmDialogProps } from './types';

export const ConfirmDialog = React.memo<ConfirmDialogProps>(({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'danger',
  confirmLoadingLabel = 'Working...',
  cancelLabel = 'Cancel',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    try {
      setIsSubmitting(true);
      await onConfirm();
      onCancel();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      onCancel();
    } finally {
      setIsSubmitting(false);
    }
  }

  const iconClasses =
    tone === 'danger'
      ? 'bg-error/10 text-error'
      : 'bg-primary/10 text-primary';

  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      maxWidth="sm"
      footer={
        <DialogActions
          actions={[
            { label: cancelLabel, onClick: onCancel, disabled: isSubmitting },
            {
              label: isSubmitting ? confirmLoadingLabel : confirmLabel,
              onClick: handleConfirm,
              variant: tone === 'danger' ? 'danger' : 'primary',
              disabled: isSubmitting,
            },
          ]}
        />
      }
    >
      <div className="py-2 border-b border-border">
        <div className="flex items-start gap-2">
          <div className={cn('flex h-6 w-6 items-center justify-center', iconClasses)}>
            <AlertCircle size={ICON_SIZES.md} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-text-primary">{title}</h3>
            <p className="mt-1 text-xs text-text-secondary">{message}</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';
