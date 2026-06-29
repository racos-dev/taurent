# Tooltip

## Responsibility

A portal-based, viewport-aware tooltip that positions itself relative to an anchor element. Includes a companion `useTooltip` hook for managing hover/focus visibility state.

## Design

- **Tooltip**: Renders via `createPortal` to `document.body`. Uses `ResizeObserver` + `window.resize` listener to recalculate position. Supports optional `shortcut` key display. Fixed positioning with viewport padding clamping.
- **useTooltip**: Manages `isHovered`/`isFocused` state. Returns `anchorRef`, `tooltipProps`, and mouse/focus `handlers`. Optional `dismissOnBlur` mode listens to `visibilitychange` and `window.blur` to dismiss when focus leaves (e.g., Tauri auxiliary window opens).

## Flow

1. Consumer attaches `handlers` (onMouseEnter/Leave, onFocus/Blur) to the trigger element.
2. `useTooltip` toggles `visible` state.
3. `Tooltip` renders the portal when `visible` is true, positioning itself below the anchor with viewport clamping.

## Integration

Exported from `src/index.ts`. Used throughout the UI for keyboard shortcut hints on toolbar buttons and menu items.
