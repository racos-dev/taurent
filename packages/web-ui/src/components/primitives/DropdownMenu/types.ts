/**
 * Types for the DropdownMenu component.
 */

export interface NormalMenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface SeparatorMenuItem {
  separator: true;
}

export type MenuItem = NormalMenuItem | SeparatorMenuItem;

export interface DropdownMenuProps {
  label: string;
  items: MenuItem[];
  dataTestid?: string;
  /** Controlled open state. When provided, the component becomes controlled. */
  open?: boolean;
  /** Callback fired when open state changes. */
  onOpenChange?: (isOpen: boolean) => void;
  /** Called when the mouse enters the dropdown panel. Used for menubar hover dismiss. */
  onPanelMouseEnter?: () => void;
  /** Called when the mouse leaves the dropdown panel. Used for menubar hover dismiss. */
  onPanelMouseLeave?: () => void;
}
