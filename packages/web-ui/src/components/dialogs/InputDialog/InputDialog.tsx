import React from 'react';
import { Dialog } from '../Dialog';
import { DialogActions } from '../DialogActions';
import { Input } from '../../primitives/Input';
import type { InputDialogProps } from './types';

export const InputDialog = React.memo<InputDialogProps>(({
  title,
  description,
  value,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  placeholder,
}) => {
  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      title={title}
      description={description}
      maxWidth="sm"
      footer={
        <DialogActions
          actions={[
            { label: cancelLabel, onClick: onCancel, disabled: isPending },
            {
              label: isPending ? 'Saving...' : submitLabel,
              onClick: onSubmit,
              variant: 'primary',
              disabled: !value.trim() || isPending,
            },
          ]}
        />
      }
    >
      <div className="py-2">
        <Input
          type="text"
          size="sm"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        />
      </div>
    </Dialog>
  );
});

InputDialog.displayName = 'InputDialog';
