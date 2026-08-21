import React, { useMemo } from 'react';
import { cn } from '@taurent/shared';
import {
  useLocalization,
  useTaurentTranslation,
  type LanguagePreference,
} from '@taurent/shared/i18n';
import { Select } from '../../primitives/Select';

export interface LanguageSettingsPanelProps {
  className?: string;
}

export const LanguageSettingsPanel = React.memo<LanguageSettingsPanelProps>(({ className }) => {
  const { preference, setPreference, isChanging } = useLocalization();
  const { t } = useTaurentTranslation('common');
  const options = useMemo(() => [
    { value: 'system' as const, label: t('language.system') },
    { value: 'en' as const, label: t('language.english') },
    { value: 'ro' as const, label: t('language.romanian') },
  ], [t]);

  return (
    <div className={cn('rounded-sm border border-border bg-surface p-3', className)}>
      <Select<LanguagePreference>
        label={t('language.title')}
        value={preference}
        options={options}
        disabled={isChanging}
        dataTestid="language-selector"
        onChange={(value) => void setPreference(value)}
      />
      <p className="mt-2 text-xs text-text-secondary">
        {isChanging ? t('language.changing') : t('language.description')}
      </p>
    </div>
  );
});

LanguageSettingsPanel.displayName = 'LanguageSettingsPanel';
