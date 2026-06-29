import type { ThemePalette, ThemeVariant, AccentPreference } from '@taurent/shared/theme/types';

export interface ThemeSettingsPanelProps {
  className?: string;
  mode: 'system' | 'manual';
  systemPalette: ThemePalette;
  manualPalette: ThemePalette;
  manualVariant: ThemeVariant;
  accent: AccentPreference;
  onModeChange: (mode: 'system' | 'manual') => void;
  onSystemPaletteChange: (palette: ThemePalette) => void;
  onManualPaletteChange: (palette: ThemePalette) => void;
  onManualVariantChange: (variant: ThemeVariant) => void;
  onAccentChange: (accent: AccentPreference) => void;
}
