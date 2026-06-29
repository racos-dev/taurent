import React from 'react';
import { AlertCircle, ICON_SIZES } from '@taurent/shared';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import type { DeleteTorrentDialogProps } from './types';

export const DeleteTorrentDialog = React.memo<DeleteTorrentDialogProps>(({
  onCancel,
  onDelete,
  isPending = false,
  count = 1,
}) => {
  const noun = count === 1 ? 'torrent' : `${count} torrents`;

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
              label: isPending ? 'Deleting...' : `Delete ${count === 1 ? 'torrent' : 'torrents'} only`,
              onClick: () => onDelete(false),
              disabled: isPending,
            },
            {
              label: isPending ? 'Deleting...' : `Delete ${count === 1 ? 'torrent' : 'torrents'} and files`,
              onClick: () => onDelete(true),
              variant: 'outline',
              disabled: isPending,
              className: 'border-error/30 bg-error/5 text-error hover:border-error/30 hover:bg-error/10',
            },
            { label: 'Cancel', onClick: onCancel, disabled: isPending },
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
              Delete {noun}
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Choose whether to remove only the {count === 1 ? 'torrent entry' : 'torrent entries'} or also delete the downloaded files.
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
});

DeleteTorrentDialog.displayName = 'DeleteTorrentDialog';
