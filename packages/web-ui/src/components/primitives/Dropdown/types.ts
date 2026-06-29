/**
 * Shared types for the dropdown primitives layer.
 */

export interface PanelPosition {
  top: number;
  left: number;
  right?: number;
  minWidth: number;
  maxHeight: number;
  fontSize: string;
  lineHeight: string;
  fontFamily: string;
  fontWeight: string;
}

export type DropdownRole = 'listbox' | 'menu';

export interface UseDropdownPanelOptions<T> {
  /** Items to display in the dropdown panel. */
  options: T[];
  /** Extract the display label from an item. Used for typeahead matching. */
  getOptionLabel: (opt: T) => string;
  /** Returns true when an item should not be interactable. Defaults to false. */
  isOptionDisabled?: (opt: T) => boolean;
  /** Called when the user selects an item. */
  onSelect: (opt: T) => void;
  /** ARIA role of the panel. 'listbox' for Select, 'menu' for DropdownMenu. */
  role?: DropdownRole;
  /** ID of the element that labels the panel. */
  labelId?: string;
  enableTypeahead?: boolean;
  enableHoverMode?: boolean;
  /** Disable the trigger. Guards openDropdown. */
  disabled?: boolean;
  /**
   * Initial active index when opening. Defaults to first enabled item (Select).
   * Pass -1 to skip pre-selecting any item (DropdownMenu).
   */
  initialActiveIndex?: number;
  /** Which edge of the trigger to anchor the panel to. 'right' extends leftward. */
  alignment?: 'left' | 'right';
}

export interface UseDropdownPanelReturn {
  /** Ref attached to the trigger button. Required for viewport positioning. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Ref attached to the panel div inside the portal. Used for focus management. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Callback-ref array for item nodes inside the panel. Consumer passes a stable
   * index; the hook stores the node. Used for scroll-into-view.
   */
  optionRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  /** Whether the panel is currently visible. */
  isOpen: boolean;
  /** Index of the currently active (keyboard-focused) item. */
  activeIndex: number;
  /** Viewport-aware position of the panel. null when the panel is closed. */
  panelPosition: PanelPosition | null;
  /** Open the panel. Optionally open with a pre-set active index. */
  openDropdown: (nextActiveIndex?: number) => void;
  /** Close the panel. Optionally re-focus the trigger button. */
  closeDropdown: (focusTrigger?: boolean) => void;
  /** Update the active index directly (used by hover mode and option effects). */
  setActiveIndex: (index: number) => void;
  /**
   * Select an item by index. Calls onSelect, closes the panel.
   * No-op if the item is disabled or out of bounds.
   */
  selectIndex: (index: number) => void;
  /** Keyboard event handler for the panel and trigger. */
  /** Keyboard event handler for the panel and trigger. */
  handleKeyNavigation: (event: React.KeyboardEvent) => void;
  /** Click handler for the trigger button. Toggles open/close. */
  handleTriggerClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Blur handler for the trigger button. */
  handleTriggerBlur: (event: React.FocusEvent<HTMLButtonElement>) => void;
  /** Mouse enter handler for the trigger button. Used for hover-mode menubar navigation. */
  handleTriggerMouseEnter: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Blur handler for the panel. Closes on outside focus. */
  handlePanelBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  /** Returns ARIA attributes object for the trigger button. */
  getTriggerAria: () => Record<string, unknown>;
  /** Returns ARIA attributes object for the panel container div. */
  getPanelAria: () => Record<string, unknown>;
}

export interface DropdownPanelProps {
  /** Whether to render the portal. */
  isOpen: boolean;
  /** Viewport-aware position values. */
  panelPosition: PanelPosition | null;
  /** ARIA role for the panel container. */
  role: DropdownRole;
  /** Ref forwarded to the panel div. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Blur handler for the panel. */
  onBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  /** Mouse enter handler for the panel. Used for menubar hover dismiss coordination. */
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  /** Mouse leave handler for the panel. Used for menubar hover dismiss coordination. */
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  /** Keyboard handler for the panel. */
  onKeyDown: (event: React.KeyboardEvent) => void;
  /** Child elements: option/menu rows rendered by the consumer. */
  children?: React.ReactNode;
  /** Extra class names for the panel container. */
  className?: string;
  /** Unique identifier for the panel element. Used for ARIA aria-controls/activedescendant. */
  panelId?: string;
}
