/**
 * Browser-only theme background runtime resolvers.
 * Uses localStorage and matchMedia — must NOT be imported in Node/Vite config context.
 *
 * Used by apps/desktop/src/windows/auxWindowManager.ts to set the OS-level webview
 * backgroundColor at window creation time, matching the user's current theme.
 */
import type { ThemePalette, ThemeVariant } from './types';
import { resolveThemeClass } from './resolver';
import { getThemeBackground, hexToRgba, DEFAULT_THEME_BACKGROUND } from './background';

function getSystemThemeVariant(): ThemeVariant {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve the current theme's background color from localStorage.
 * Reads the canonical app_theme_mode, app_system_palette, app_manual_palette,
 * and app_manual_variant keys.
 */
export function resolveCurrentThemeBackground(): string {
  try {
    const mode = localStorage.getItem('app_theme_mode');
    let palette: ThemePalette = 'catppuccin';
    let variant: ThemeVariant = getSystemThemeVariant();

    if (mode === 'system') {
      palette = (localStorage.getItem('app_system_palette') ?? 'catppuccin') as ThemePalette;
      variant = getSystemThemeVariant();
    } else if (mode === 'manual') {
      palette = (localStorage.getItem('app_manual_palette') ?? 'catppuccin') as ThemePalette;
      variant = (localStorage.getItem('app_manual_variant') ?? 'dark') as ThemeVariant;
    }

    const themeClass = resolveThemeClass(palette, variant);
    return getThemeBackground(themeClass);
  } catch {
    return DEFAULT_THEME_BACKGROUND;
  }
}

/** Resolve current theme background as an RGBA tuple for Tauri's WebviewWindow backgroundColor. */
export function resolveCurrentThemeBackgroundRgba(): [number, number, number, number] {
  return hexToRgba(resolveCurrentThemeBackground());
}

/** Resolve an OS-scheme background for native window creation/chrome. */
export function resolveSystemThemeBackgroundRgba(): [number, number, number, number] {
  return hexToRgba(getSystemThemeVariant() === 'dark' ? DEFAULT_THEME_BACKGROUND : getThemeBackground('theme-catppuccin-latte'));
}
