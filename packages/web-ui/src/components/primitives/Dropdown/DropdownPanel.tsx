import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@taurent/shared';
import type { DropdownRole, PanelPosition } from './types';

const VIEWPORT_PADDING = 8;

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

function getAriaAttributes(role: DropdownRole): Record<string, unknown> {
  return { role, tabIndex: -1 };
}

/**
 * Thin portal wrapper that renders a positioned panel div into `document.body`.
 * Owns the `createPortal` call so consumers never touch it directly.
 */
export function DropdownPanel({
  isOpen,
  panelPosition,
  role,
  panelRef,
  onBlur,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  children,
  className,
  panelId,
}: DropdownPanelProps): React.ReactElement | null {
  if (!isOpen || !panelPosition || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      id={panelId}
      ref={panelRef}
      {...getAriaAttributes(role)}
      className={cn(
        'fixed z-50 overflow-y-auto overflow-x-hidden rounded-sm border border-border bg-background text-sm text-text-primary shadow-lg outline-none',
        className,
      )}
      style={{
        top: panelPosition.top,
        ...(panelPosition.right !== undefined
          ? { left: 'auto', right: panelPosition.right }
          : { left: panelPosition.left }),
        minWidth: panelPosition.minWidth,
        width: 'max-content',
        maxWidth:
          panelPosition.right !== undefined
            ? `calc(100vw - ${panelPosition.right}px - ${2 * VIEWPORT_PADDING}px)`
            : `calc(100vw - ${panelPosition.left}px - ${VIEWPORT_PADDING}px)`,
        maxHeight: panelPosition.maxHeight,
        fontSize: panelPosition.fontSize,
        lineHeight: panelPosition.lineHeight,
        fontFamily: panelPosition.fontFamily,
        fontWeight: panelPosition.fontWeight,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>,
    document.body,
  );
}
