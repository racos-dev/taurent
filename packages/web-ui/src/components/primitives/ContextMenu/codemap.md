# ContextMenu

## Responsibility

Full-featured context menu system with items, separators, groups, nested submenus, keyboard navigation, viewport-aware positioning, and ARIA support.

## Design

- **ContextMenu**: Top-level composed component. Maps `ContextMenuItem[]` (union of item/separator/group/submenu types) to appropriate sub-components.
- **useContextMenu**: Hook managing `activeIndex`, `panelPosition`, `panelRef`, `registerItemRef`, and `handlePanelBlur`. Handles viewport clamping and keyboard navigation.
- **ContextMenuPanel**: Portal-based positioned panel (similar to `DropdownPanel`).
- **ContextMenuItem**: Single menu item with icon, label, shortcut, and destructive styling. Uses `forwardRef` for keyboard navigation integration.
- **ContextMenuSeparator**: Separator line with optional label.
- **ContextMenuGroup**: Grouped items under a shared heading.
- **ContextMenuSubMenu**: Expandable submenu with child items. Renders flyout via `createPortal`, with viewport-aware placement, keyboard navigation (ArrowRight/ArrowLeft), and mouse hover delay (80ms open timer).
- **SubMenuProvider**: React context for coordinating submenu open/close state.

## Flow

1. Parent provides `x`, `y` (click coordinates), `items[]`, and `onClose`.
2. `ContextMenu` wires `useContextMenu` hook and renders `ContextMenuPanel`.
3. Items are mapped to appropriate sub-components based on `kind` discriminator.
4. Click/Enter triggers `item.onClick()` + `onClose()`. Escape dismisses.

## Integration

Used by `HomeScreenBody` for torrent row context menus and by desktop app shells for right-click menus.
