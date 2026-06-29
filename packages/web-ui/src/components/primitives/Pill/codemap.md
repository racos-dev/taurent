# Pill

## Responsibility

Inline badge component with semantic tone variants and optional icon.

## Design

`React.memo` component. 6 tones: default, primary, info, success, warning, danger. Each maps to background + text color classes. Renders as `<span>` with inline-flex layout.

## Flow

Pure presentational. No state.

## Integration

Used by `TorrentDetailHeader`, `HomeScreenBody`, `ThemeSettingsPanel`, `SettingsScreenBody`, and other UIs for status badges and labels.
