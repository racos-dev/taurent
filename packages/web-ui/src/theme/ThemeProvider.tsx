import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { isDarkOnlyTheme } from '@taurent/shared/theme/registry';
import { resolveThemeClass, parseThemeId } from '@taurent/shared/theme/resolver';
import { deriveMidnightAccentTokens } from '@taurent/shared/theme/accent';
import type { ThemePalette, ThemeVariant, AccentPreference, AccentHex } from '@taurent/shared/theme/types';

export type ThemeMode = 'system' | 'manual';

export interface ThemeConfig {
  mode: ThemeMode;
  systemPalette: ThemePalette;
  manualPalette: ThemePalette;
  manualVariant: ThemeVariant;
  accent: AccentPreference;
}

export interface ThemeContextValue {
  config: ThemeConfig;
  effectivePalette: ThemePalette;
  effectiveVariant: ThemeVariant;
  setMode: (mode: ThemeMode) => void;
  setSystemPalette: (palette: ThemePalette) => void;
  setManualPalette: (palette: ThemePalette) => void;
  setManualVariant: (variant: ThemeVariant) => void;
  setAccent: (accent: AccentPreference) => void;
}

// ── Accent CSS variable helpers ──────────────────────────────────────────

/** CSS custom property names that deriveMidnightAccentTokens can set. */
const ACCENT_CUSTOM_PROPERTIES = [
  // Primary accent tokens
  '--color-primary',
  '--color-primary-hover',
  '--color-primary-light',
  '--color-text-on-primary',
  '--color-primary-rgb',
  '--color-primary-10',
  '--color-primary-20',
  '--color-primary-30',
  '--color-primary-40',
  '--color-state-selected',
  '--color-text-on-primary-rgb',
  // Border focus
  '--color-border-focus',
  // Semantic aliases
  '--color-success',
  '--color-success-rgb',
  '--color-success-20',
  '--color-text-on-success',
  '--color-warning',
  '--color-warning-rgb',
  '--color-warning-20',
  '--color-text-on-warning',
  '--color-error',
  '--color-error-rgb',
  '--color-error-20',
  '--color-text-on-error',
  '--color-info',
  '--color-info-rgb',
  '--color-info-20',
  '--color-text-on-info',
  '--color-text-on-danger',
  // Feature colors
  '--color-download',
  '--color-upload',
  '--color-upload-20',
  '--color-size',
  '--color-ratio',
  '--color-peers',
  '--color-time',
  // Status colors (accent-driven in Midnight)
  '--color-status-downloading',
  '--color-status-downloading-15',
  '--color-status-seeding',
  '--color-status-seeding-15',
  '--color-status-stalled',
  '--color-status-stalled-15',
  '--color-status-queued',
  '--color-status-queued-15',
  '--color-status-checking',
  '--color-status-checking-15',
  '--color-status-metadata',
  '--color-status-metadata-15',
  // Connection status (accent-driven in Midnight)
  '--color-status-connected',
  '--color-status-connected-15',
  '--color-status-firewalled',
  '--color-status-firewalled-15',
  '--color-status-connecting',
  '--color-status-connecting-15',
  '--color-status-reconnecting',
  '--color-status-reconnecting-15',
] as const;

function applyAccentOverrides(accent: AccentHex) {
  const tokens = deriveMidnightAccentTokens(accent);
  const style = document.documentElement.style;
  for (const [prop, value] of Object.entries(tokens)) {
    style.setProperty(prop, value);
  }
}

function clearAccentOverrides() {
  const style = document.documentElement.style;
  for (const prop of ACCENT_CUSTOM_PROPERTIES) {
    style.removeProperty(prop);
  }
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_MODE_KEY = 'app_theme_mode';
const SYSTEM_PALETTE_KEY = 'app_system_palette';
const MANUAL_PALETTE_KEY = 'app_manual_palette';
const MANUAL_VARIANT_KEY = 'app_manual_variant';
const ACCENT_KEY = 'app_accent_hex';

function getSystemScheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function toThemeClass(palette: ThemePalette, variant: ThemeVariant): string {
  return resolveThemeClass(palette, variant);
}

function applyThemeClass(themeClass: string) {
  document.documentElement.className = themeClass;
}

/**
 * Read the saved theme config synchronously from localStorage.
 * localStorage is a synchronous API — no async needed.
 */
function readConfigFromStorage(defaultTheme: string): ThemeConfig {
  try {
    const savedMode = localStorage.getItem(THEME_MODE_KEY);

    if (savedMode) {
      const savedSystemPalette = localStorage.getItem(SYSTEM_PALETTE_KEY);
      const savedManualPalette = localStorage.getItem(MANUAL_PALETTE_KEY);
      const savedManualVariant = localStorage.getItem(MANUAL_VARIANT_KEY) as ThemeVariant | null;
      const savedAccent = localStorage.getItem(ACCENT_KEY);

      return {
        mode: savedMode as ThemeMode,
        systemPalette: savedSystemPalette as ThemePalette ?? 'solarized',
        manualPalette: savedManualPalette as ThemePalette ?? 'solarized',
        manualVariant: savedManualVariant ?? 'dark',
        accent: savedAccent && /^#[0-9a-f]{6}$/i.test(savedAccent) ? savedAccent as AccentPreference : null,
      };
    }
  } catch {
    // ignore storage errors
  }

  // No saved preference — use system mode with the default palette.
  const parsed = parseThemeId(defaultTheme);
  return {
    mode: 'system',
    systemPalette: parsed?.palette ?? 'solarized',
    manualPalette: parsed?.palette ?? 'solarized',
    manualVariant: parsed?.variant ?? 'dark',
    accent: null,
  };
}

export interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
}

export function ThemeProvider({ children, defaultTheme = 'solarized-dark' }: ThemeProviderProps) {
  // Initialize synchronously from localStorage — no async effect needed.
  // This ensures the initial themeClass matches what the inline init script set,
  // preventing any flash of a wrong theme on first render.
  const [config, setConfig] = useState<ThemeConfig>(() => readConfigFromStorage(defaultTheme));
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() => getSystemScheme());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemScheme(event.matches ? 'dark' : 'light');
    };

    setSystemScheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const saveConfig = useCallback((newConfig: ThemeConfig) => {
    try {
      localStorage.setItem(THEME_MODE_KEY, newConfig.mode);
      localStorage.setItem(SYSTEM_PALETTE_KEY, newConfig.systemPalette);
      localStorage.setItem(MANUAL_PALETTE_KEY, newConfig.manualPalette);
      localStorage.setItem(MANUAL_VARIANT_KEY, newConfig.manualVariant);
      if (newConfig.accent) {
        localStorage.setItem(ACCENT_KEY, newConfig.accent);
      } else {
        localStorage.removeItem(ACCENT_KEY);
      }
    } catch (error) {
      console.error('Failed to save theme config:', error);
    }
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setConfig((prev) => {
      const newConfig = { ...prev, mode };
      saveConfig(newConfig);
      return newConfig;
    });
  }, [saveConfig]);

  const setSystemPalette = useCallback((palette: ThemePalette) => {
    setConfig((prev) => {
      const newConfig = { ...prev, systemPalette: palette };
      saveConfig(newConfig);
      return newConfig;
    });
  }, [saveConfig]);

  const setManualPalette = useCallback((palette: ThemePalette) => {
    setConfig((prev) => {
      const newConfig = { ...prev, manualPalette: palette };
      // For dark-only themes, enforce dark variant
      if (isDarkOnlyTheme(palette)) {
        newConfig.manualVariant = 'dark';
      }
      saveConfig(newConfig);
      return newConfig;
    });
  }, [saveConfig]);

  const setManualVariant = useCallback((variant: ThemeVariant) => {
    setConfig((prev) => {
      const newConfig = { ...prev, manualVariant: variant };
      saveConfig(newConfig);
      return newConfig;
    });
  }, [saveConfig]);

  const setAccent = useCallback((accent: AccentPreference) => {
    setConfig((prev) => {
      const newConfig = { ...prev, accent };
      saveConfig(newConfig);
      return newConfig;
    });
  }, [saveConfig]);

  const { effectivePalette, effectiveVariant, themeClass } = useMemo(() => {
    const palette = config.mode === 'system' ? config.systemPalette : config.manualPalette;

    // Dark-only palettes always use dark variant
    if (isDarkOnlyTheme(palette)) {
      return {
        effectivePalette: palette,
        effectiveVariant: 'dark' as ThemeVariant,
        themeClass: toThemeClass(palette, 'dark'),
      };
    }

    // Palettes with light/dark variants
    const variant = config.mode === 'system' ? systemScheme : config.manualVariant;
    return {
      effectivePalette: palette,
      effectiveVariant: variant,
      themeClass: toThemeClass(palette, variant),
    };
  }, [config, systemScheme]);

  // Skip applying the theme class on the very first render: the inline init script
  // in index.html already set the correct class synchronously before React loaded.
  // Only apply when the user actively changes their theme after mount.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    applyThemeClass(themeClass);
  }, [themeClass]);

  // Apply or clear accent CSS variable overrides when the effective palette
  // or accent preference changes. Only applies when the palette is Midnight
  // and a custom accent is set. The inline init script handles pre-React flash
  // prevention with a minimal token subset; this effect applies the full set
  // on first mount and on every subsequent change.
  useEffect(() => {
    if (effectivePalette === 'midnight' && config.accent) {
      applyAccentOverrides(config.accent);
    } else {
      clearAccentOverrides();
    }
  }, [effectivePalette, config.accent]);

  return (
    <ThemeContext.Provider
      value={{
        config,
        effectivePalette,
        effectiveVariant,
        setMode,
        setSystemPalette,
        setManualPalette,
        setManualVariant,
        setAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
