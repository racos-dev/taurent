/**
 * Theme resolver utilities.
 *
 * Handles conversion between:
 * - Theme id strings ("solarized-dark", "theme-solarized-dark", "midnight")
 * - Palette + Variant model used by both apps
 * - Effective class names applied to the DOM
 */

import type { ThemePalette, ThemeVariant } from './types';
import { THEME_OPTIONS, isDarkOnlyTheme } from './registry';

type ThemeId =
  | 'solarized-light'
  | 'solarized-dark'
  | 'midnight'
  | 'catppuccin-latte'
  | 'catppuccin-mocha'
  | 'nord'
  | 'dracula'
  | 'gruvbox-light'
  | 'gruvbox-dark'
  | 'tokyonight'
  | 'monokai'
  | 'onedark';

const THEME_ID_MAP: ReadonlyMap<ThemeId, { palette: ThemePalette; variant: ThemeVariant }> = new Map([
  ['solarized-light', { palette: 'solarized', variant: 'light' }],
  ['solarized-dark', { palette: 'solarized', variant: 'dark' }],
  ['midnight', { palette: 'midnight', variant: 'dark' }],
  ['catppuccin-latte', { palette: 'catppuccin', variant: 'light' }],
  ['catppuccin-mocha', { palette: 'catppuccin', variant: 'dark' }],
  ['nord', { palette: 'nord', variant: 'dark' }],
  ['dracula', { palette: 'dracula', variant: 'dark' }],
  ['gruvbox-light', { palette: 'gruvbox', variant: 'light' }],
  ['gruvbox-dark', { palette: 'gruvbox', variant: 'dark' }],
  ['tokyonight', { palette: 'tokyonight', variant: 'dark' }],
  ['monokai', { palette: 'monokai', variant: 'dark' }],
  ['onedark', { palette: 'onedark', variant: 'dark' }],
]);

/**
 * Parse a theme id or effective theme class into its components.
 * Handles both plain ids ("solarized-dark") and prefixed ids ("theme-solarized-dark").
 *
 * Returns { palette, variant } for resolvable ids, or undefined for unknown ids.
 */
export function parseThemeId(id: string): { palette: ThemePalette; variant: ThemeVariant } | undefined {
  // Strip optional "theme-" prefix
  const stripped = id.startsWith('theme-') ? id.slice(6) : id;

  const resolved = THEME_ID_MAP.get(stripped as ThemeId);
  if (resolved) {
    return resolved;
  }

  // Try to parse "palette-variant" format directly
  const dashIndex = stripped.lastIndexOf('-');
  if (dashIndex > 0) {
    const palettePart = stripped.slice(0, dashIndex) as ThemePalette;
    const variantPart = stripped.slice(dashIndex + 1) as ThemeVariant;

    // Validate both parts
    if (THEME_OPTIONS.some((m) => m.palette === palettePart) && (variantPart === 'light' || variantPart === 'dark')) {
      // For dark-only palettes, variant must be 'dark'
      if (isDarkOnlyTheme(palettePart) && variantPart !== 'dark') {
        return undefined;
      }
      return { palette: palettePart, variant: variantPart };
    }
  }

  return undefined;
}

/**
 * Convert a palette + variant into the effective theme class name applied to DOM.
 * e.g., ('solarized', 'dark') -> 'theme-solarized-dark'
 * e.g., ('catppuccin', 'light') -> 'theme-catppuccin-latte'
 * e.g., ('midnight', 'dark') -> 'theme-midnight'
 */
export function resolveThemeClass(palette: ThemePalette, variant: ThemeVariant): string {
  // Special suffix mapping for palettes with named variants
  if (palette === 'catppuccin') {
    return `theme-catppuccin-${variant === 'dark' ? 'mocha' : 'latte'}`;
  }
  if (palette === 'gruvbox') {
    return `theme-gruvbox-${variant}`;
  }
  // Dark-only palettes don't encode variant in class name
  if (isDarkOnlyTheme(palette)) {
    return `theme-${palette}`;
  }
  return `theme-${palette}-${variant}`;
}

/**
 * Resolve the effective theme class for a desktop theme selection.
 * Accepts a theme id or class name string.
 */
export function resolveEffectiveClass(id: string): string {
  const parsed = parseThemeId(id);
  if (!parsed) {
    // Fallback: return as-is if it looks like a class name
    return id.startsWith('theme-') ? id : `theme-${id}`;
  }
  return resolveThemeClass(parsed.palette, parsed.variant);
}

/**
 * Get the default palette/variant for a new desktop installation.
 */
export function getDefaultThemeSelection(): { palette: ThemePalette; variant: ThemeVariant } {
  return { palette: 'solarized', variant: 'dark' };
}
