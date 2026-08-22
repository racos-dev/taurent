import React, { useState } from 'react';
import { Dialog } from '../Dialog';
import { NumberInput } from '../../primitives/NumberInput';
import { DialogActions } from '../DialogActions';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export interface SpeedLimitsModalProps {
  downloadLimit: number;
  uploadLimit: number;
  onSubmit: (downloadBytes: number, uploadBytes: number) => void;
  onCancel: () => void;
}

export const SpeedLimitsModal = React.memo<SpeedLimitsModalProps>(({
  downloadLimit,
  uploadLimit,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTaurentTranslation('dialogs');
  const { t: tCommon } = useTaurentTranslation('common');
  const [dlValue, setDlValue] = useState(downloadLimit);
  const [ulValue, setUlValue] = useState(uploadLimit);

  const handleSubmit = () => {
    onSubmit(dlValue, ulValue);
  };

  return (
    <Dialog isOpen={true} title={t('speedLimits.title')} onClose={onCancel} maxWidth="sm">
      <div className="space-y-4 py-2">
        <div>
          <label className="mb-1 block text-sm text-text-secondary">{t('speedLimits.download')}</label>
          <NumberInput
            value={dlValue}
            unitMode="bytes-per-second"
            unitDefault="kb"
            onValueChange={setDlValue}
            min={0}
            className="w-full"
            autoFocus
          />
          <p className="mt-1 text-xs text-text-muted">{t('speedLimits.unlimitedHint')}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-secondary">{t('speedLimits.upload')}</label>
          <NumberInput
            value={ulValue}
            unitMode="bytes-per-second"
            unitDefault="kb"
            onValueChange={setUlValue}
            min={0}
            className="w-full"
          />
          <p className="mt-1 text-xs text-text-muted">{t('speedLimits.unlimitedHint')}</p>
        </div>
      </div>
      <DialogActions
        actions={[
          { label: tCommon('actions.cancel'), onClick: onCancel },
          { label: tCommon('actions.set'), onClick: handleSubmit, variant: 'primary' },
        ]}
      />
    </Dialog>
  );
});

SpeedLimitsModal.displayName = 'SpeedLimitsModal';
