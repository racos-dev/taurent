# DropdownMenu

## Responsibility

Text-button trigger that opens a menu-style dropdown panel with action items, separators, and optional shortcut labels.

## Design

Uses `useDropdownPanel` + `DropdownPanel`. Supports both uncontrolled (internal state) and controlled (`open`/`onOpenChange`) modes for menubar coordination. Hover mode enables opening on trigger mouseenter when another menu is already open.

## Flow

1. Click/hover on trigger toggles/opens the menu.
2. Items render as `menuitem` buttons with optional shortcut labels.
3. Clicking an item fires `item.onClick()` and closes the menu (in controlled mode, calls `onOpenChange(false)`).
4. Controlled mode syncs parent state with hook state bidirectionally.

## Integration

Used by desktop app shells for menu bar items and toolbar dropdown menus.
