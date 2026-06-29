import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@taurent/shared';
import type { PanelPosition } from './types';


export interface ContextMenuPanelProps {
  /** When "submenu", adds a data attribute so parent dismiss logic can skip submenu DOM. */
  dataContextMenuType?: 'menu' | 'submenu';
  /** Ref attached to the panel div. Used for focus management. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Viewport-aware position values. null when the panel is closed. */
  panelPosition: PanelPosition | null;
  /** Whether the panel is currently visible. */
  isOpen: boolean;
  /** Keyboard event handler for the panel. Optional — submenus use this for Escape/ArrowLeft handling. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  /** Child elements: rows rendered by the consumer. */
  children?: React.ReactNode;
  /** Extra class names for the panel container. */
  className?: string;
  /** Mouse enter handler for the panel. Used by submenu to cancel close timers. */
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Mouse leave handler for the panel. Used by submenu to schedule close. */
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * Thin portal wrapper that renders a positioned panel div into `document.body`.
 * Owns the `createPortal` call so consumers never touch it directly.
 */
export function ContextMenuPanel({
  dataContextMenuType,
  panelRef,
  panelPosition,
  isOpen,
  onKeyDown,
  onBlur,
  children,
  className,
  onMouseEnter,
  onMouseLeave,
}: ContextMenuPanelProps): React.ReactElement | null {
  if (!isOpen || !panelPosition || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      tabIndex={-1}
      data-contextmenu-type={dataContextMenuType}
      className={cn(
        'fixed z-40 rounded-md border border-border bg-surface-elevated py-1 shadow-lg select-none max-h-[80vh] overflow-y-auto',
        className,
      )}
      style={{
        top: panelPosition.top,
        left: panelPosition.left,
        maxHeight: panelPosition.maxHeight,
      }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
}