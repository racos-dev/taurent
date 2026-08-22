import React from 'react';
import { ThemeSettingsPanel } from '@taurent/web-ui';
import { useTheme } from '@taurent/web-ui/theme';
import { useTaurentTranslation } from '@taurent/shared/i18n';

export const DesktopThemeSettings = React.memo(() => {
  const { config, setMode, setSystemPalette, setManualPalette, setManualVariant, setAccent } = useTheme();
  const { t } = useTaurentTranslation('settings');

  return (
    <div className="rounded-sm border border-border bg-surface px-2 py-2">
      <p className="mb-2 text-xs font-medium text-text-muted">{t('appearance')}</p>
      <ThemeSettingsPanel
        mode={config.mode}
        systemPalette={config.systemPalette}
        manualPalette={config.manualPalette}
        manualVariant={config.manualVariant}
        accent={config.accent}
        onModeChange={setMode}
        onSystemPaletteChange={setSystemPalette}
        onManualPaletteChange={setManualPalette}
        onManualVariantChange={setManualVariant}
        onAccentChange={setAccent}
      />
    </div>
  );
});

DesktopThemeSettings.displayName = 'DesktopThemeSettings';
