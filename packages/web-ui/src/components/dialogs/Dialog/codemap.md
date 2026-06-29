# Dialog

## Responsibility

Core modal dialog shell with backdrop, animated open/close, Escape key handling, body scroll lock, and configurable max width.

## Design

`React.memo` component managing a three-phase lifecycle: `open` → `closing` → `closed`. Uses CSS `data-state` attributes for animation hooks. Backdrop click dismisses. Portal-like rendering via fixed positioning. Fallback timer (300ms) handles cases where `animationend` doesn't fire. Respects `prefers-color-scheme` reduced-motion via `usePrefersReducedMotion()` — when reduced motion is preferred, skips closing animation and unmounts immediately.

## Flow

`isOpen` prop drives phase transitions. `onClose` fires on Escape, backdrop click, or X button. Phase state determines whether the dialog renders or is removed from the DOM.

## Integration

Foundation for all dialog variants. Used directly and composed by `ConfirmDialog`, `InputDialog`, `NumberInputModal`, `DeleteTorrentDialog`, `CategorySelectionDialog`, `TagSelectionDialog`, `FilePriorityDialog`, `PluginInstallDialog`.
