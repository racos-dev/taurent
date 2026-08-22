/**
 * Canonical shared theme contract.
 *
 * This registry is the single source of truth for:
 * - Which palettes exist and their metadata (label, description, darkOnly)
 * - Which variants each palette supports
 * - The ordered list of resolved theme options for selectors/toggles
 * - Dark-only theme identification
 */

import type { ThemePalette, ThemeVariant } from './types';

export interface ThemePaletteMetadata {
  palette: ThemePalette;
  labelKey: `theme.palettes.${ThemePalette}.label`;
  descriptionKey: `theme.palettes.${ThemePalette}.description`;
  /** Palette only supports dark variant and will ignore system/manual variant selection */
  darkOnly: boolean;
  /** Ordered list of variants this palette supports */
  variants: ThemeVariant[];
}

/**
 * Ordered list of all theme options for use in selectors/toggles.
 * The order here is the canonical display order.
 */
export const THEME_OPTIONS: ThemePaletteMetadata[] = [
  {
    palette: 'catppuccin',
    labelKey: 'theme.palettes.catppuccin.label',
    descriptionKey: 'theme.palettes.catppuccin.description',
    darkOnly: false,
    variants: ['light', 'dark'],
  },
  {
    palette: 'solarized',
    labelKey: 'theme.palettes.solarized.label',
    descriptionKey: 'theme.palettes.solarized.description',
    darkOnly: false,
    variants: ['light', 'dark'],
  },
  {
    palette: 'gruvbox',
    labelKey: 'theme.palettes.gruvbox.label',
    descriptionKey: 'theme.palettes.gruvbox.description',
    darkOnly: false,
    variants: ['light', 'dark'],
  },
  {
    palette: 'midnight',
    labelKey: 'theme.palettes.midnight.label',
    descriptionKey: 'theme.palettes.midnight.description',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'nord',
    labelKey: 'theme.palettes.nord.label',
    descriptionKey: 'theme.palettes.nord.description',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'dracula',
    labelKey: 'theme.palettes.dracula.label',
    descriptionKey: 'theme.palettes.dracula.description',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'tokyonight',
    labelKey: 'theme.palettes.tokyonight.label',
    descriptionKey: 'theme.palettes.tokyonight.description',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'monokai',
    labelKey: 'theme.palettes.monokai.label',
    descriptionKey: 'theme.palettes.monokai.description',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'onedark',
    labelKey: 'theme.palettes.onedark.label',
    descriptionKey: 'theme.palettes.onedark.description',
    darkOnly: true,
    variants: ['dark'],
  },
];

/** Fast lookup map: palette -> metadata */
export const THEME_META_MAP: ReadonlyMap<ThemePalette, ThemePaletteMetadata> = new Map(
  THEME_OPTIONS.map((meta) => [meta.palette, meta])
);

/**
 * All palettes that only support dark variant.
 * Used to skip variant selection UI and enforce dark.
 */
export const DARK_ONLY_PALETTES: ReadonlySet<ThemePalette> = new Set(
  THEME_OPTIONS.filter((m) => m.darkOnly).map((m) => m.palette)
);

/** Returns metadata for a palette, or undefined. */
export function getThemeMetadata(palette: ThemePalette): ThemePaletteMetadata | undefined {
  return THEME_META_MAP.get(palette);
}

/** Returns true if a palette is dark-only. */
export function isDarkOnlyTheme(palette: ThemePalette): boolean {
  return DARK_ONLY_PALETTES.has(palette);
}

/** Returns the ordered list of all palette options. */
export function getThemeOptions(): ThemePaletteMetadata[] {
  return THEME_OPTIONS;
}
