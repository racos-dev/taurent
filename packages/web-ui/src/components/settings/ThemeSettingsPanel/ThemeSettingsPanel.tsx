import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@taurent/shared';
import { getThemeOptions } from '@taurent/shared/theme/registry';
import { normalizeAccent } from '@taurent/shared/theme/accent';
import type { ThemePalette } from '@taurent/shared';
import type { AccentPreference } from '@taurent/shared/theme/types';
import { Pill } from '../../primitives/Pill';
import type { ThemeSettingsPanelProps } from './types';

const themeOptions = getThemeOptions();

export const ThemeSettingsPanel = React.memo<ThemeSettingsPanelProps>(({
  className,
  mode,
  systemPalette,
  manualPalette,
  manualVariant,
  accent,
  onModeChange,
  onSystemPaletteChange,
  onManualPaletteChange,
  onManualVariantChange,
  onAccentChange,
}) => {
  const activeThemePalette = mode === 'system' ? systemPalette : manualPalette;
  const showAccentControl = activeThemePalette === 'midnight';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="rounded-sm border border-border bg-surface p-1">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => onModeChange('system')}
            className={cn(
              'rounded-sm px-3 py-2 text-xs font-medium transition-colors',
              mode === 'system'
                ? 'bg-primary text-text-on-primary'
                : 'text-text-secondary hover:bg-surface-interactive'
            )}
          >
            System
          </button>
          <button
            type="button"
            onClick={() => onModeChange('manual')}
            className={cn(
              'rounded-sm px-3 py-2 text-xs font-medium transition-colors',
              mode === 'manual'
                ? 'bg-primary text-text-on-primary'
                : 'text-text-secondary hover:bg-surface-interactive'
            )}
          >
            Manual
          </button>
        </div>
      </div>

      <div className="rounded-sm border border-border bg-surface px-2 py-2 text-xs text-text-secondary">
        {mode === 'system'
          ? 'Follow the device light or dark setting while keeping your preferred palette family.'
          : 'Lock the app to one palette and choose the exact light or dark variant when available.'}
      </div>

      <div className="space-y-2">
        {themeOptions.map((palette: { palette: ThemePalette; label: string; description: string; darkOnly: boolean }) => {
          const isSelected = activeThemePalette === palette.palette;
          const showVariants = mode === 'manual' && isSelected && !palette.darkOnly;

          return (
            <div key={palette.palette} className="rounded-sm border border-border bg-surface">
              <button
                type="button"
                onClick={() => {
                  if (mode === 'system') {
                    onSystemPaletteChange(palette.palette);
                  } else {
                    onManualPaletteChange(palette.palette);
                    if (palette.darkOnly) {
                      onManualVariantChange('dark');
                    }
                  }
                }}
                className={cn(
                  'w-full rounded-sm px-3 py-2 text-left transition-colors',
                  isSelected ? 'bg-primary/5' : 'hover:bg-surface-interactive'
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-primary bg-primary text-text-on-primary'
                        : 'border-border bg-surface'
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', isSelected ? 'bg-current' : 'bg-transparent')} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text-primary">{palette.label}</div>
                    <div className="mt-1 text-xs text-text-secondary">{palette.description}</div>
                  </div>
                  {palette.darkOnly ? <Pill>Dark only</Pill> : null}
                </div>
              </button>

              {showVariants ? (
                <div className="flex gap-2 px-3 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      onManualPaletteChange(palette.palette);
                      onManualVariantChange('light');
                    }}
                    className={cn(
                      'flex-1 rounded-sm px-3 py-2 text-xs font-medium transition-colors',
                      manualVariant === 'light'
                        ? 'bg-primary text-text-on-primary'
                        : 'border border-border bg-surface text-text-secondary hover:bg-surface-interactive'
                    )}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onManualPaletteChange(palette.palette);
                      onManualVariantChange('dark');
                    }}
                    className={cn(
                      'flex-1 rounded-sm px-3 py-2 text-xs font-medium transition-colors',
                      manualVariant === 'dark'
                        ? 'bg-primary text-text-on-primary'
                        : 'border border-border bg-surface text-text-secondary hover:bg-surface-interactive'
                    )}
                  >
                    Dark
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showAccentControl ? (
        <MidnightAccentControl accent={accent} onAccentChange={onAccentChange} />
      ) : null}
    </div>
  );
});

ThemeSettingsPanel.displayName = 'ThemeSettingsPanel';

// ── Midnight accent sub-component ───────────────────────────────────────────

interface MidnightAccentControlProps {
  accent: AccentPreference;
  onAccentChange: (accent: AccentPreference) => void;
}

const MidnightAccentControl = React.memo<MidnightAccentControlProps>(({
  accent,
  onAccentChange,
}) => {
  const [inputValue, setInputValue] = useState(accent ?? '');

  // Resync inputValue when accent prop changes from external theme sync
  // (e.g., cross-window sync via desktop ThemeChangedEvent).
  useEffect(() => {
    setInputValue(accent ?? '');
  }, [accent]);

  const handleTextChange = useCallback((value: string) => {
    setInputValue(value);
    const normalized = normalizeAccent(value);
    if (normalized) {
      onAccentChange(normalized);
    } else if (value.trim() === '') {
      onAccentChange(null);
    }
  }, [onAccentChange]);

  const handleColorPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeAccent(e.target.value);
    if (normalized) {
      setInputValue(normalized);
      onAccentChange(normalized);
    }
  }, [onAccentChange]);

  const handleReset = useCallback(() => {
    setInputValue('');
    onAccentChange(null);
  }, [onAccentChange]);

  const isValid = normalizeAccent(inputValue) !== null;

  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-text-primary">Midnight accent</div>
        {accent ? (
          <span
            className="inline-block h-3 w-3 rounded-full border border-border"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="mt-1 text-xs text-text-secondary">
        Choose a custom accent color for the Midnight palette, or reset to the default blue.
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="#3b82f6"
            spellCheck={false}
            autoComplete="off"
            className={cn(
              'w-full rounded-sm border bg-background px-3 py-2 text-sm text-text-primary transition-colors',
              'focus-visible:border-border-focus focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none',
              inputValue && !isValid && inputValue.trim() !== ''
                ? 'border-error focus-visible:border-error focus-visible:ring-error'
                : 'border-border-input'
            )}
          />
        </div>
        <label
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface transition-colors hover:bg-surface-interactive"
          aria-label="Pick accent color"
        >
          <input
            type="color"
            value={isValid ? inputValue : '#3b82f6'}
            onChange={handleColorPickerChange}
            className="sr-only"
          />
          <span
            className="block h-5 w-5 rounded-full border border-border"
            style={{ backgroundColor: isValid ? inputValue : undefined }}
          />
        </label>
        {accent ? (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-sm border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-interactive"
          >
            Reset
          </button>
        ) : null}
      </div>
      {inputValue && !isValid && inputValue.trim() !== '' ? (
        <p className="mt-1 text-xs text-error">Enter a valid hex color like #ff6600</p>
      ) : null}
    </div>
  );
});

MidnightAccentControl.displayName = 'MidnightAccentControl';
