/**
 * Shared types for the context menu primitives layer.
 */

import React from 'react';

/** Single character type for optional text/icon display. */
type ItemIcon = React.ComponentType<{ className?: string }>;

/**
 * Normal context menu item.
 */
export interface ContextMenuItemType {
  kind: 'item';
  id: string;
  label: string;
  icon?: ItemIcon;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}

/**
 * Separator line, optionally with a label.
 */
export interface ContextMenuSeparatorType {
  kind: 'separator';
  id: string;
  label?: string;
}

/**
 * Group of items under a shared heading.
 */
export interface ContextMenuGroupType {
  kind: 'group';
  id: string;
  label?: string;
  items: ContextMenuItem[];
}

/**
 * Sub-menu that expands to reveal more items.
 */
export interface ContextMenuSubMenuType {
  kind: 'submenu';
  id: string;
  label: string;
  icon?: ItemIcon;
  disabled?: boolean;
  children: ContextMenuItem[];
}

/** Union of all context menu item shapes. */
export type ContextMenuItem =
  | ContextMenuItemType
  | ContextMenuSeparatorType
  | ContextMenuGroupType
  | ContextMenuSubMenuType;

/** Viewport-aware position for the panel. */
export interface PanelPosition {
  top: number;
  left: number;
  maxHeight: number;
}

export interface UseContextMenuOptions {
  /** Horizontal position from the triggering click (px). */
  x: number;
  /** Vertical position from the triggering click (px). */
  y: number;
  /** Items to render in the menu. */
  items: ContextMenuItem[];
  /** Unique identifier for an item. */
  /** Returns true when an item should not be keyboard-navigable. */
  isItemDisabled: (item: ContextMenuItem) => boolean;
  /** Called when the user selects an item or presses Enter. */
  onSelect: (item: ContextMenuItem) => void;
  /** Called when the menu is dismissed by interaction or Escape. */
  onClose: () => void;
}

export interface UseContextMenuReturn {
  /** Ref attached to the panel element. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Viewport-clamped position for the panel. null when the panel is closed. */
  panelPosition: PanelPosition | null;
  /** Whether the panel is currently visible. */
  isOpen: boolean;
  /** Index of the currently active (keyboard-focused) item. */
  activeIndex: number;

  /** Keyboard event handler for the panel. */
  handlePanelBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  /** Callback-ref for items inside the panel. */
  registerItemRef: (index: number) => (node: HTMLElement | null) => void;
}
