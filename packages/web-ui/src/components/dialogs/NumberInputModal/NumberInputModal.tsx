import React, { useState } from 'react';
import { Dialog } from '../Dialog';
import { NumberInput } from '../../primitives/NumberInput';
import { DialogActions } from '../DialogActions';
import type { NumberInputModalProps } from './types';

export const NumberInputModal = React.memo<NumberInputModalProps>(({
  title,
  subtitle,
  currentValue,
  onSubmit,
  onCancel,
  unit,
  unitMode,
  unitDefault,
  submitLabel = 'Set',
  cancelLabel = 'Cancel',
}) => {
  const [textValue, setTextValue] = useState(String(currentValue));
  const [unitValue, setUnitValue] = useState(currentValue);
  const submitValue = unitMode ? unitValue : Number.parseInt(textValue, 10) || 0;

  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      title={title}
      description={subtitle}
      maxWidth="sm"
      footer={
        <DialogActions
          actions={[
            { label: cancelLabel, onClick: onCancel },
            {
              label: submitLabel,
              onClick: () => onSubmit(submitValue),
              variant: 'primary',
            },
          ]}
        />
      }
    >
      <div className="py-2 space-y-2">
        <NumberInput
          value={unitMode ? unitValue : textValue}
          unitMode={unitMode}
          unitDefault={unitDefault}
          onValueChange={setUnitValue}
          onChange={(event) => {
            if (unitMode) {
              setUnitValue(Number.parseInt(event.target.value, 10) || 0);
              return;
            }
            setTextValue(event.target.value);
          }}
          className="w-full"
          autoFocus
        />
        {unit ? <p className="text-xs text-text-secondary">{unit}</p> : null}
      </div>
    </Dialog>
  );
});

NumberInputModal.displayName = 'NumberInputModal';
