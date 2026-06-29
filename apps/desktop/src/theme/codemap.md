# apps/desktop/src/theme/

## Responsibility

Provides theme management for the desktop application. Wraps the shared `@taurent/web-ui` ThemeProvider with cross-window synchronization via Tauri events.

## Key Files

- **ThemeProvider.tsx** — Main provider that wraps the shared ThemeProvider and syncs theme changes across desktop windows via `theme-changed` events. Uses `DesktopThemeEventBridge` to listen for incoming theme events and emit outgoing changes, with skip-next-emit guards to prevent echo loops.
- **ThemeSelector.tsx** — Theme selection UI component
- **index.ts** — Re-exports ThemeProvider, useTheme, THEMES, ThemeSelector

## Design Patterns

- **Adapter Pattern**: Wraps `@taurent/web-ui/theme` and keeps desktop-only event syncing out of shared packages
- **Cross-window sync**: `DesktopThemeEventBridge` listens for `theme-changed` events via `createThemeChangedListener` and applies incoming theme changes (palette, variant, mode, accent). Outgoing changes are emitted to all windows, with a signature-based skip-next-emit guard to prevent echo loops.
- **Signature deduplication**: Uses `JSON.stringify` event signatures to detect whether an incoming event matches the current state, preventing redundant updates.
- **Theme List**: THEMES constant provides flat list of all theme options (palette + variant combinations)
- **Temporary storage exception**: Shared theme persistence still lives in the shared ThemeProvider via `localStorage`; future refactors should move backend selection behind a shared storage abstraction instead of adding more direct storage logic in `web-ui`

## Integration

- Uses SharedThemeProvider from `@taurent/web-ui/theme`
- Uses theme helpers from `@taurent/shared/theme/resolver` and `@taurent/shared/theme/registry`
- Owns desktop-only `theme-changed` event sync across Tauri windows
- Used by App.tsx to wrap application with ThemeProvider
- ThemeSelector used by Settings/components/DesktopThemeSettings.tsx for theme preference UI
