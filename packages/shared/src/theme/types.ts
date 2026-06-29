export type ThemePalette = 
  | 'solarized' 
  | 'midnight' 
  | 'catppuccin' 
  | 'nord' 
  | 'dracula' 
  | 'gruvbox' 
  | 'tokyonight' 
  | 'monokai' 
  | 'onedark';

export type ThemeVariant = 'light' | 'dark';

/**
 * A hex color string in #rrggbb format, e.g. `"#ff6600"`.
 * Always lowercase, always 7 characters.
 */
export type AccentHex = `#${string}`;

/**
 * The user's accent preference.
 * - `null` means "no custom accent" (use Midnight's default blue).
 * - An `AccentHex` value represents the chosen accent color.
 */
export type AccentPreference = AccentHex | null;
