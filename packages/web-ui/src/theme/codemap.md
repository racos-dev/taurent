# packages/web-ui/src/theme/

## Responsibility

Theme provider and context for palette/variant management. Controls which color palette and light/dark variant is active, persists preferences to `localStorage`, and applies the resolved theme CSS class to `document.documentElement`.

## Design

- **ThemeProvider**: React context provider initialized synchronously from `localStorage` to prevent flash of wrong theme on first render.
- **ThemeConfig**: Stores `mode` (system/manual), `systemPalette`, `manualPalette`, `manualVariant`, and `accent` (custom hex color or null).
- **System mode**: Listens to `prefers-color-scheme` media query changes via `matchMedia`.
- **Manual mode**: User explicitly selects palette and variant.
- **Dark-only palettes**: Automatically enforce dark variant when a dark-only palette is selected.
- **Accent support**: For the Midnight palette, users can set a custom accent hex color. `deriveMidnightAccentTokens()` from `@taurent/shared/theme/accent` generates CSS custom property overrides (primary, success, warning, error, info, status colors, etc.) that are applied to `document.documentElement.style`. Accent overrides are cleared when switching away from Midnight or when accent is null.
- **First-render skip**: Skips applying theme class on first render since the inline init script in `index.html` already set it synchronously.

## Flow

1. `ThemeProvider` reads saved config from `localStorage` (or falls back to `defaultTheme` prop).
2. `useTheme()` hook exposes `config`, `effectivePalette`, `effectiveVariant`, and setter functions (including `setAccent`).
3. On config change, `saveConfig` writes to `localStorage` and the `useMemo` recomputes `themeClass`.
4. A `useEffect` (skipping first render) calls `applyThemeClass(themeClass)` which sets `document.documentElement.className`.
5. A separate `useEffect` applies or clears accent CSS variable overrides when `effectivePalette === 'midnight'` and `config.accent` is set.

## Integration

- Consumed by `src/index.ts` which re-exports `ThemeProvider`, `useTheme`, and related types.
- Depends on `@taurent/shared/theme/registry` for `isDarkOnlyTheme` and `getThemeOptions`.
- Depends on `@taurent/shared/theme/resolver` for `resolveThemeClass` and `parseThemeId`.
- Apps mount `<ThemeProvider>` at the root before any screen rendering.
