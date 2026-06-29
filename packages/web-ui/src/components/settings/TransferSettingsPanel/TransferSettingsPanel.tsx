import React, { useState } from 'react';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import { NumberInput } from '../../primitives/NumberInput';
import { Button } from '../../primitives/Button';
import type { TransferSettingsPanelProps } from './types';
import { cn, formatSpeedInKB } from '@taurent/shared';

export const TransferSettingsPanel = React.memo<TransferSettingsPanelProps>(({
  preferences,
  onToggleAltSpeedLimits,
  onSave,
  isSaving,
}) => {
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-text-primary">Alternative speed limits</div>
          <div className="mt-1 text-xs text-text-secondary">
            {useAltSpeed ? 'Currently active' : 'Currently inactive'}
          </div>
        </div>
        <ToggleSwitch checked={useAltSpeed} onChange={onToggleAltSpeedLimits} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">
          Download limit
        </label>
        <div className="flex gap-2">
          <NumberInput
            value={stagedDlLimit}
            unitMode="bytes-per-second"
            unitDefault="kb"
            onValueChange={setStagedDlLimit}
            placeholder="0 = unlimited"
            className={cn(
              'flex-1 rounded-sm border border-border bg-background px-3 py-2 text-xs text-text-primary',
              'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
            )}
          />
          <span className="self-center text-xs text-text-secondary">
            {stagedDlLimit > 0 ? formatSpeedInKB(stagedDlLimit) : 'Unlimited'}
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">
          Upload limit
        </label>
        <div className="flex gap-2">
          <NumberInput
            value={stagedUpLimit}
            unitMode="bytes-per-second"
            unitDefault="kb"
            onValueChange={setStagedUpLimit}
            placeholder="0 = unlimited"
            className={cn(
              'flex-1 rounded-sm border border-border bg-background px-3 py-2 text-xs text-text-primary',
              'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
            )}
          />
          <span className="self-center text-xs text-text-secondary">
            {stagedUpLimit > 0 ? formatSpeedInKB(stagedUpLimit) : 'Unlimited'}
          </span>
        </div>
      </div>

      <Button variant="primary" size="sm" className="w-full" loading={isSaving} onClick={handleSave}>{isSaving ? 'Saving Transfer Settings...' : 'Save Transfer Settings'}</Button>
    </div>
  );
});

TransferSettingsPanel.displayName = 'TransferSettingsPanel';
