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
  label: string;
  description: string;
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
    palette: 'solarized',
    label: 'Solarized',
    description: 'Classic precision color scheme',
    darkOnly: false,
    variants: ['light', 'dark'],
  },
  {
    palette: 'catppuccin',
    label: 'Catppuccin',
    description: 'Soothing pastel theme',
    darkOnly: false,
    variants: ['light', 'dark'],
  },
  {
    palette: 'gruvbox',
    label: 'Gruvbox',
    description: 'Retro groove colors',
    darkOnly: false,
    variants: ['light', 'dark'],
  },
  {
    palette: 'midnight',
    label: 'Midnight',
    description: 'Pure black with blue accent',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'nord',
    label: 'Nord',
    description: 'Arctic north-bluish',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'dracula',
    label: 'Dracula',
    description: 'Dark with vibrant colors',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'tokyonight',
    label: 'Tokyo Night',
    description: 'Dark blue urban theme',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'monokai',
    label: 'Monokai',
    description: 'Classic vibrant theme',
    darkOnly: true,
    variants: ['dark'],
  },
  {
    palette: 'onedark',
    label: 'One Dark',
    description: 'Atom editor inspired',
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
