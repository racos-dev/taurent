import React from 'react';
import { cn, FilePriority } from '@taurent/shared';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import type { FilePriorityDialogProps } from './types';

const PRIORITIES = [
  { value: FilePriority.DoNotDownload, label: 'Do Not Download' },
  { value: FilePriority.Normal, label: 'Normal' },
  { value: FilePriority.High, label: 'High' },
  { value: FilePriority.Maximal, label: 'Maximal' },
];

export const FilePriorityDialog = React.memo<FilePriorityDialogProps>(({
  fileName,
  currentPriority,
  onSubmit,
  onCancel,
  isPending,
}) => {
  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      maxWidth="sm"
      footer={
        <DialogActions
          actions={[{ label: 'Cancel', onClick: onCancel, disabled: isPending }]}
          actionClassName="w-full"
        />
      }
    >
      <div className="shrink-0 border-b border-border py-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xs font-medium text-text-primary">File Priority</h3>
            <p className="mt-1 truncate text-xs text-text-secondary" title={fileName}>{fileName}</p>
          </div>
        </div>
      </div>
      <div className="space-y-1 py-2">
        {PRIORITIES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onSubmit(item.value)}
            disabled={isPending}
            className={cn('w-full rounded-sm px-2 py-1 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:text-text-disabled',
              currentPriority === item.value
                ? 'bg-primary/10 text-primary'
                : 'text-text-primary hover:bg-surface-interactive'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </Dialog>
  );
});

FilePriorityDialog.displayName = 'FilePriorityDialog';
