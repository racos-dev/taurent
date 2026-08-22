import React, { useState } from 'react';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import { NumberInput } from '../../primitives/NumberInput';
import { Button } from '../../primitives/Button';
import type { TransferSettingsPanelProps } from './types';
import { cn } from '@taurent/shared';
import { useLocalization, useTaurentTranslation } from '@taurent/shared/i18n';

export const TransferSettingsPanel = React.memo<TransferSettingsPanelProps>(({
  preferences,
  onToggleAltSpeedLimits,
  onSave,
  isSaving,
}) => {
  const { locale } = useLocalization();
  const { t } = useTaurentTranslation('settings');
  const { t: tCommon } = useTaurentTranslation('common');
  const dlLimit = (preferences?.dl_limit as number) ?? 0;
  const upLimit = (preferences?.up_limit as number) ?? 0;
  const useAltSpeed = (preferences?.use_alt_speed_limits as boolean) ?? false;

  const [stagedDlLimit, setStagedDlLimit] = useState(dlLimit);
  const [stagedUpLimit, setStagedUpLimit] = useState(upLimit);

  // Sync local state when preferences change from outside (e.g., server switch)
  React.useEffect(() => {
    setStagedDlLimit(dlLimit);
    setStagedUpLimit(upLimit);
  }, [dlLimit, upLimit]);

  const handleSave = () => {
    if (onSave) {
      onSave({ dl_limit: stagedDlLimit, up_limit: stagedUpLimit });
    }
  };
  const formatSpeedInKB = (value: number) => `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(value / 1024)} KB/s`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-text-primary">{t('transfer.alternativeLimits')}</div>
          <div className="mt-1 text-xs text-text-secondary">
            {t(useAltSpeed ? 'transfer.active' : 'transfer.inactive')}
          </div>
        </div>
        <ToggleSwitch checked={useAltSpeed} onChange={onToggleAltSpeedLimits} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">
          {t('transfer.downloadLimit')}
        </label>
        <div className="flex gap-2">
          <NumberInput
            value={stagedDlLimit}
            unitMode="bytes-per-second"
            unitDefault="kb"
            onValueChange={setStagedDlLimit}
            placeholder={t('transfer.zeroUnlimited')}
            className={cn(
              'flex-1 rounded-sm border border-border bg-background px-3 py-2 text-xs text-text-primary',
              'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
            )}
          />
          <span className="self-center text-xs text-text-secondary">
            {stagedDlLimit > 0 ? formatSpeedInKB(stagedDlLimit) : tCommon('values.unlimited')}
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">
          {t('transfer.uploadLimit')}
        </label>
        <div className="flex gap-2">
          <NumberInput
            value={stagedUpLimit}
            unitMode="bytes-per-second"
            unitDefault="kb"
            onValueChange={setStagedUpLimit}
            placeholder={t('transfer.zeroUnlimited')}
            className={cn(
              'flex-1 rounded-sm border border-border bg-background px-3 py-2 text-xs text-text-primary',
              'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
            )}
          />
          <span className="self-center text-xs text-text-secondary">
            {stagedUpLimit > 0 ? formatSpeedInKB(stagedUpLimit) : tCommon('values.unlimited')}
          </span>
        </div>
      </div>

      <Button variant="primary" size="sm" className="w-full" loading={isSaving} onClick={handleSave}>
        {t(isSaving ? 'transfer.saving' : 'transfer.save')}
      </Button>
    </div>
  );
});

TransferSettingsPanel.displayName = 'TransferSettingsPanel';
