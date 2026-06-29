# packages/web-ui/src/components/primitives/

## Responsibility

Low-level, reusable UI controls that form the building blocks for all higher-level domain components. Platform-aware variants for web and native.

## Design

- **Button**: Multi-variant button (`primary`, `secondary`, `danger`, `ghost`, `success`, `warning`, `info`, `neutral`, `outline`) with sizes (`sm`, `md`, `lg`). Loading state shows `Spinner`. Web variant in `Button.web.tsx`. Custom `React.memo` comparator for performance. Density-aware sizing via `BUTTON_CONTROL_SIZE_CLASSES`.
- **Card**: Container with `variant` (elevated/outline/flat), `padding`, and `radius`. Clickable mode renders as a `div[role=button]`. Web variant in `Card.web.tsx`.
- **Checkbox**: Custom checkbox with `checked`, `indeterminate`, and `disabled` states. Uses `aria-checked="mixed"` for indeterminate. Density-aware wrapper via `CHECKBOX_CONTROL_WRAPPER_CLASSES` for mobile touch targets.
- **ContextMenu**: Full context menu system with `ContextMenu`, `useContextMenu`, `ContextMenuPanel`, `ContextMenuItem` (forwardRef), `ContextMenuSeparator`, `ContextMenuGroup`, `ContextMenuSubMenu` (portal-based flyout with viewport-aware positioning), and `SubMenuProvider`. Supports items, separators, groups, nested submenus, keyboard navigation, and viewport-aware positioning.
- **Dropdown**: Generic dropdown infrastructure — `DropdownPanel` (portal-based positioned panel) and `useDropdownPanel` hook (positioning, keyboard nav, typeahead, outside-click, focus management, ARIA wiring).
- **DropdownMenu**: Text-button trigger that opens a menu panel with items and separators. Supports controlled and uncontrolled modes for menubar coordination.
- **FormField**: Label + description + error + children wrapper for form fields.
- **FormSectionTitle**: Simple section header with title and optional subtitle.
- **IconButton**: Icon-only button with `variant` (surface/ghost/outline), `tone` (default/primary/danger), `isActive` highlight, and `loading` state. Density-aware sizing via `HEADER_ICON_BUTTON_SIZE_CLASSES`.
- **Input**: Multi-size text input with label, error, helper text, icon slot, clear button, and controlled/uncontrolled modes. Web variant in `Input.web.tsx`. Density-aware sizing via `INPUT_CONTROL_SIZE_CLASSES` and offset classes for icon/clear buttons.
- **NumberInput**: Numeric input with increment/decrement buttons, min/max clamping, step precision, and custom `React.forwardRef`.
- **Pill**: Inline badge with `tone` variants (default, primary, info, success, warning, danger) and optional icon.
- **ProgressBar**: Animated progress bar with `variant` (default/success/warning/error), `size`, label formats (percentage/fraction/progress/none). Uses `formatProgress` from shared utils. Web variant in `ProgressBar.web.tsx`.
- **SchemeToggle**: Segmented radio control for HTTP/HTTPS scheme selection.
- **SearchBar**: Compact search input wrapper around `Input` with search icon, auto-focus, and clear-on-empty behavior.
- **Select**: Custom dropdown select using `useDropdownPanel` + `DropdownPanel`. Supports options, disabled items, label, error, hidden form input, and right-aligned panel positioning. Density-aware trigger sizing via `SELECT_CONTROL_TRIGGER_SIZE_CLASSES`.
- **TabBar**: Tab switcher with `variant: 'underline' | 'segmented'` (default). Segmented uses CSS grid. Underline uses bottom border indicator. Density-aware item sizing via `TAB_BAR_PILL_ITEM_CLASSES` / `TAB_BAR_UNDERLINE_ITEM_CLASSES`.
- **ToggleSwitch**: Toggle switch with `checked`/`onChange`. Uses CSS transitions for the thumb animation. Density-aware touch target via `TOGGLE_CONTROL_WRAPPER_CLASSES` / `TOGGLE_CONTROL_INNER_CLASSES`.

## Flow

All primitives are controlled components — they receive state via props and call back via callbacks. No internal domain state.

## Integration

Composed by all higher-level components in `components/`, `screens/`, and `settings/`. Exported from `src/index.ts` for direct consumer use.
