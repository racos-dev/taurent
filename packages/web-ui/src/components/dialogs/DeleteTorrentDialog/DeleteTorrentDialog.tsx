import React from 'react';
import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import type { DeleteTorrentDialogProps } from './types';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export const DeleteTorrentDialog = React.memo<DeleteTorrentDialogProps>(({
  onCancel,
  onDelete,
  isPending = false,
  count = 1,
}) => {
  const { t } = useTaurentTranslation('torrents');
  const { t: tCommon } = useTaurentTranslation('common');

  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      maxWidth="sm"
      footer={
        <DialogActions
          layout="stack"
          actions={[
            {
              label: isPending ? t('actions.deleting') : t('dialogs.delete.only', { count }),
              onClick: () => onDelete(false),
              disabled: isPending,
            },
            {
              label: isPending ? t('actions.deleting') : t('dialogs.delete.withFiles', { count }),
              onClick: () => onDelete(true),
              variant: 'outline',
              disabled: isPending,
              className: 'border-error/30 bg-error/5 text-error hover:border-error/30 hover:bg-error/10',
            },
            { label: tCommon('actions.cancel'), onClick: onCancel, disabled: isPending },
          ]}
        />
      }
    >
      <div className="py-2 border-b border-border">
        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 items-center justify-center text-error">
            <AlertCircle size={ICON_SIZES.md} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-text-primary">
              {t('dialogs.delete.title', { count })}
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              {t('dialogs.delete.choice', { count })}
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
});

DeleteTorrentDialog.displayName = 'DeleteTorrentDialog';
