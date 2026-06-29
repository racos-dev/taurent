# apps/desktop/src/components/OverlayPrompt/

## Responsibility

Reusable blocking overlay prompt component that renders a centered modal dialog with a backdrop blur. Used as the foundation for confirmation prompts that block user interaction until dismissed.

## Design

- **Generic container**: `OverlayPrompt` accepts an icon, title, description, optional error, and children (typically action buttons). It renders a full-screen backdrop with a centered card.
- **ARIA compliant**: Uses `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby` for screen reader accessibility.
- **Visual pattern**: Follows the `ConnectedServerUnavailableOverlay` visual pattern — icon container with configurable color, bordered card, and slot for action buttons.

## Key Files

- **OverlayPrompt.tsx** — The base overlay component.
- **index.ts** — Barrel re-export.

## Integration

- Used by `SettingsCloseOverlay` for unsaved-changes confirmation.
- Used by `ConnectedServerUnavailableOverlay` in layouts for server unavailability.
- Can be composed with `DialogActions` from `@taurent/web-ui` for standardized button layouts.
