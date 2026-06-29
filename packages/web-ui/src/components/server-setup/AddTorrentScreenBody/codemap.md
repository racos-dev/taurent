# AddTorrentScreenBody

## Responsibility

Full add-torrent form with magnet link/file upload modes, destination settings, and advanced options.

## Design

`React.memo` component with `variant: 'desktop' | 'mobile'`. Mobile shows collapsible sections (Source, Destination, Advanced Options) with toggle switches. Desktop shows a unified dense form with all options visible, including rate limits, content layout, stop condition, and tag input. Uses `Select`, `Input`, `NumberInput`, `Checkbox`, `DialogActions`. Density-aware via `BUTTON_CONTROL_SIZE_CLASSES` and `HEADER_ICON_BUTTON_SIZE_CLASSES` from `controlSizing`.

## Flow

All form state is controlled via props. Mode switching, file picking, tag toggling, and option changes all call parent callbacks. Submit calls `onSubmit()`. Cancel calls `onCancel()`.

## Integration

Exported from `src/index.ts`. Used by desktop and mobile add-torrent screens.
