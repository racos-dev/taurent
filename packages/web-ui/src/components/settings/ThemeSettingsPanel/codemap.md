# ThemeSettingsPanel

## Responsibility

Theme configuration panel with system/manual mode selector, palette list, and light/dark variant toggle.

## Design

`React.memo` component. Uses `getThemeOptions()` from `@taurent/shared/theme/registry` for palette options. System mode follows device preference. Manual mode allows explicit palette and variant selection. Dark-only palettes show a "Dark only" pill and hide variant toggle. Supports custom accent color for the Midnight palette via `accent` prop and `onAccentChange` callback — shows a hex color picker when the active palette is Midnight.

## Flow

All state controlled via props: `mode`, `systemPalette`, `manualPalette`, `manualVariant`, `accent`, and corresponding setters. No internal state.

## Integration

Used by `SettingsScreenBody` for theme configuration.
