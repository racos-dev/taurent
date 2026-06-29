# packages/shared/src/theme/

## Responsibility

Theme system for consistent styling across desktop and mobile apps. Provides CSS color tokens as Tailwind-compatible CSS variables, theme registry with palette metadata (dark-only detection, variant support), theme ID/class resolution, theme helper utilities, accent color normalization and Midnight accent token derivation, and motion constants with reduced-motion detection.

## Key Files

- `types.ts` — `ThemePalette` (9 palettes: solarized, midnight, catppuccin, nord, dracula, gruvbox, tokyonight, monokai, onedark), `ThemeVariant` (`'light' | 'dark'`), `AccentHex` (`#rrggbb` string type), `AccentPreference` (`AccentHex | null` — null means use Midnight's default blue).

- `tokens.ts` — `tailwindColorTokens`: comprehensive record mapping semantic color names to CSS variable references. Categories: surface colors (background, surface, surface-elevated), text colors (text-primary, text-secondary, text-muted), semantic colors (primary, success, warning, error, info with RGB channel variants for opacity), feature colors (download, upload, size, ratio, peers, time), border colors, overlays, interactive states, disabled states, alpha variants, status colors (torrent states and connection states with -15 alpha variants). Uses `<alpha-value>` pattern with separate `-rgb` channel variables for Tailwind JIT opacity computation.

- `registry.ts` — `THEME_OPTIONS`: ordered array of `ThemePaletteMetadata` (palette, label, description, darkOnly, variants). Also exports:
  - `THEME_META_MAP` — fast lookup map: palette → metadata.
  - `DARK_ONLY_PALETTES` — set of palettes that only support dark variant (midnight, nord, dracula, tokyonight, monokai, onedark).
  - `getThemeMetadata(palette)`, `isDarkOnlyTheme(palette)`, `getThemeOptions()`.

- `resolver.ts` — Theme ID resolution utilities:
  - `parseThemeId(id)` — parses `'theme-solarized-dark'` or `'solarized-dark'` into `{ palette, variant }`.
  - `resolveThemeClass(palette, variant)` — converts `{ palette, variant }` to DOM class name (e.g., `'theme-solarized-dark'`, `'theme-catppuccin-mocha'`).
  - `resolveEffectiveClass(id)` — resolves any theme ID/class string to the effective CSS class.
  - `getDefaultThemeSelection()` — returns `{ palette: 'solarized', variant: 'dark' }`.

- `helpers.ts` — Color utility functions:
  - `getColor(key, opacity?)` — returns `'var(--color-primary)'` or `'var(--color-primary-20)'`.
  - `getAlphaColor(key, alpha)` — returns alpha-suffixed CSS variable.
  - `statusColors` — maps status names to color keys (e.g., `downloading → 'download'`).
  - `getStatusColor(status)` — returns color key for a status.

- `accent.ts` — Accent color normalization and Midnight accent token derivation (Node-safe, no browser globals):
  - `normalizeAccent(value)` — normalizes a user-supplied color string to canonical `#rrggbb` hex (case-insensitive, with/without `#`). Returns `null` for invalid input.
  - `isAccentValue(value)` — type guard for valid `AccentHex` strings.
  - `deriveMidnightAccentTokens(accent)` — derives a full `Record<string, string>` of CSS custom-property overrides from a chosen accent hex. Covers primary tokens, semantic aliases (success/warning/error/info), feature colors, border-focus, state-selected, text-on-color tokens, RGB/alpha aliases, and accent-driven status/connection tokens.
  - `getContrastText(bgHex)` — WCAG AA contrast text selector (`#000000` for light backgrounds, `#ffffff` for dark) using relative luminance threshold ~0.179.
  - `serializeAccentCss(accent)` — serializes the full override map to a `:root{...}` CSS string for inline `<style>` injection.
  - Internal helpers: `sRGBtoLin`, `relativeLuminance`, `hexToRgb`, `rgbToHex`, `mixHex`, `darken`, `toRgbSpace`, `toRgbaString`.

- `background.ts` — Node-safe static data and generators (no browser globals):
  - `THEME_BACKGROUND_COLORS` — maps theme class names to hex background colors.
  - `DEFAULT_THEME_BACKGROUND` — `'#002b36'` (solarized-dark).
  - `hexToRgba(hex)` — converts hex to RGBA tuple for Tauri's Color type.
  - `getThemeBackground(themeClass)` — lookup with fallback.
  - `generateThemeBackgroundStyles()` — generates CSS rules for per-theme backgrounds (used by Vite plugin).
  - `generateThemeInitScript()` — generates inline `<script>` body for theme initialization from localStorage before any JS bundle loads.
  - `generateAccentInitScript()` — generates inline `<script>` body that reads a saved accent from `localStorage('app_accent_hex')` and applies core CSS custom-property overrides (`--color-primary`, `--color-primary-rgb`, `--color-text-on-primary`, `--color-border-focus`) to `document.documentElement.style` when the active theme is `theme-midnight`. Prevents flash of default accent before React hydrates.

- `backgroundRuntime.ts` — Browser-only runtime resolver (uses `localStorage`, `matchMedia`):
  - `resolveCurrentThemeBackground()` — reads current theme from localStorage and returns hex color.
  - `resolveCurrentThemeBackgroundRgba()` — returns RGBA tuple for Tauri's `WebviewWindow.backgroundColor`.

- `motion.ts` — Tailwind-compatible motion constants and reduced-motion hook:
  - `motion.duration` — `fast` (150ms), `normal` (200ms), `slow` (300ms).
  - `motion.easing` — `out`, `default`.
  - `motion.scale` — `button` (0.98), `card` (0.99).
  - `motion.transition` — `colors`, `transform`, `all`.
  - `usePrefersReducedMotion()` — React hook that reads the `prefers-reduced-motion: reduce` media query. Returns `true` when the user has requested reduced motion. SSR-safe (returns `false` when `window` is unavailable). Subscribes to preference changes and cleans up on unmount.

- `themes.css` — CSS file with actual theme color values (referenced by background.ts).

- `index.ts` — Re-exports `motion` and all exports from `accent.ts`.

## Design

- **CSS variable tokens**: Colors reference `var(--color-*)` for theming flexibility.
- **Dark-only detection**: Some palettes (midnight, nord, dracula, tokyonight, monokai, onedark) only support dark variant — the registry and resolver enforce this.
- **Legacy ID mapping**: Converts old desktop theme IDs to the palette+variant model used by both apps.
- **Dual background resolution**: `background.ts` (Node-safe, for build-time injection) and `backgroundRuntime.ts` (browser-only, for runtime resolution).
- **Pre-init scripts**: `generateThemeInitScript()` runs before React hydration to prevent flash-of-wrong-theme; `generateAccentInitScript()` runs as a companion to prevent flash-of-default-accent for Midnight users with a custom accent.
- **Accent color system**: `accent.ts` provides the full pipeline from user input normalization → WCAG-aware contrast derivation → Midnight token map generation → CSS serialization. Node-safe for build-time injection; consumed by both the pre-init script and the React accent provider.
- **Reduced-motion awareness**: `usePrefersReducedMotion` lets UI components conditionally disable animations based on user OS preference.

## Integration

- Tailwind configs import `tailwindColorTokens` into `theme.extend.colors`.
- Desktop ThemeProvider uses `resolver.ts` for theme class generation.
- Mobile uses `registry.ts` and `types.ts` for theme picker.
- Desktop Vite config uses `background.ts` to inject `<style>` and `<script>` (theme init + accent init) into HTML at build time.
- Desktop `auxWindowManager` uses `backgroundRuntime.ts` to set OS-level webview background color.
- `motion` and `usePrefersReducedMotion` exported from `packages/shared/src/theme/index.ts` and consumed by both apps.
- Accent functions (`normalizeAccent`, `isAccentValue`, `deriveMidnightAccentTokens`, `getContrastText`, `serializeAccentCss`) exported from `packages/shared/src/index.ts` and consumed by desktop settings accent picker and theme providers.
