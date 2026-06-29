# apps/desktop/src/components/SettingsCloseOverlay/

## Responsibility

Overlay prompt displayed when the user attempts to close the Settings window with unsaved changes. Provides three actions: Stay (dismiss overlay), Discard & Close (discard changes and close), and Save & Close (save changes then close).

## Design

- **Composition**: Renders `OverlayPrompt` with `DialogActions` from `@taurent/web-ui` for standardized button layout.
- **Dirty section labels**: Accepts an array of dirty section labels to display which sections have unsaved changes.
- **Async save**: The save action supports an async `onSave` callback with loading state and error display.

## Key Files

- **SettingsCloseOverlay.tsx** — The overlay component.
- **index.ts** — Barrel re-export.

## Integration

- Used by `SettingsScreen` when `showCloseOverlay` is true (triggered by `onCloseRequested` from Tauri).
- Receives `isSaving`, `saveError`, and action callbacks from `SettingsScreen`.
