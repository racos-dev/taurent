import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useLayoutEffect,
  type ComponentType,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@taurent/shared';
import { useSubMenuContext } from './SubMenuProvider';

// ----------------------------------------------------------------
// ChevronRight icon — same shape as desktop implementation
// ----------------------------------------------------------------

function ChevronRight({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6,3 10,8 6,13" />
    </svg>
  );
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface ContextMenuSubMenuProps {
  /** Primary label shown in the trigger row. */
  label: string;
  /** Optional leading icon component. */
  icon?: ComponentType<{ className?: string }>;
  /** Prevents interaction when true. */
  disabled?: boolean;
  /** The menu items rendered inside the flyout. */
  children: ReactNode;
}

// ----------------------------------------------------------------
// Flyout placement
// ----------------------------------------------------------------

const VIEWPORT_PADDING = 8;
const FLYOUT_GAP = 4;
const FLYOUT_WIDTH = 224;

interface FlyoutPlacement {
  left: number;
  top: number;
  maxHeight: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min;
  return Math.min(Math.max(value, min), max);
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export function ContextMenuSubMenu({
  label,
  icon: Icon,
  children,
  disabled = false,
}: ContextMenuSubMenuProps): React.ReactElement {
  const { openSubMenu, scheduleClose, cancelCloseTimer, currentSubMenuId } = useSubMenuContext();

  // Stable id for this trigger
  const triggerId = useId();

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Simple open state
  const [isOpen, setIsOpen] = useState(false);

  // Flyout placement
  const [flyoutPlacement, setFlyoutPlacement] = useState<FlyoutPlacement>({
    left: 0,
    top: 0,
    maxHeight: 0,
  });

  const updatePlacement = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 320;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const opensRight = rect.right + FLYOUT_GAP + FLYOUT_WIDTH + VIEWPORT_PADDING <= viewportWidth;
    const left = opensRight
      ? rect.right + FLYOUT_GAP
      : rect.left - FLYOUT_GAP - FLYOUT_WIDTH;
    const top = clamp(
      rect.top,
      VIEWPORT_PADDING,
      viewportHeight - Math.min(panelHeight, viewportHeight - VIEWPORT_PADDING * 2) - VIEWPORT_PADDING
    );

    setFlyoutPlacement({
      left: clamp(left, VIEWPORT_PADDING, viewportWidth - FLYOUT_WIDTH - VIEWPORT_PADDING),
      top,
      maxHeight: Math.max(viewportHeight - top - VIEWPORT_PADDING, 0),
    });
  }, []);

  useLayoutEffect(() => {
    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    return () => window.removeEventListener('resize', updatePlacement);
  }, [updatePlacement]);

  useLayoutEffect(() => {
    if (!isOpen || currentSubMenuId !== triggerId) return;

    updatePlacement();

    const parentMenu = triggerRef.current?.closest('[data-contextmenu-type="menu"]');
    parentMenu?.addEventListener('scroll', updatePlacement, { passive: true });
    window.addEventListener('scroll', updatePlacement, { passive: true, capture: true });

    return () => {
      parentMenu?.removeEventListener('scroll', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, { capture: true });
    };
  }, [currentSubMenuId, isOpen, triggerId, updatePlacement]);

  // Clear any pending enter timer on unmount
  useEffect(() => {
    return () => {
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current);
        enterTimerRef.current = null;
      }
    };
  }, []);

  // When another submenu opens, close this one
  useEffect(() => {
    if (currentSubMenuId !== triggerId && isOpen) {
      setIsOpen(false);
    }
  }, [currentSubMenuId, triggerId, isOpen]);

  // Focus the first item in the flyout once it opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        const firstItem = panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
        firstItem?.focus();
      });
    }
  }, [isOpen]);

  // ----------------------------------------------------------------
  // Mouse events (trigger)
  // ----------------------------------------------------------------

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    cancelCloseTimer();
    if (currentSubMenuId === triggerId) return;

    enterTimerRef.current = setTimeout(() => {
      if (enterTimerRef.current) {
        updatePlacement(); // re-check placement before showing
        setIsOpen(true);
        openSubMenu(triggerId);
      }
    }, 80);
  }, [disabled, cancelCloseTimer, currentSubMenuId, triggerId, openSubMenu, updatePlacement]);

  const handleMouseLeave = useCallback(() => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    scheduleClose(triggerId);
  }, [scheduleClose, triggerId]);

  // ----------------------------------------------------------------
  // Mouse events (flyout panel)
  // ----------------------------------------------------------------

  const handlePanelMouseEnter = useCallback(() => {
    cancelCloseTimer();
  }, [cancelCloseTimer]);

  const handlePanelMouseLeave = useCallback(() => {
    scheduleClose(triggerId);
  }, [scheduleClose, triggerId]);

  // ----------------------------------------------------------------
  // Keyboard events (trigger)
  // ----------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'ArrowRight' && !isOpen) {
        e.preventDefault();
        updatePlacement();
        setIsOpen(true);
        openSubMenu(triggerId);
      }
      if (e.key === 'ArrowLeft' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    },
    [disabled, isOpen, openSubMenu, triggerId, updatePlacement]
  );

  // ----------------------------------------------------------------
  // Keyboard events (flyout panel)
  // ----------------------------------------------------------------

  const handlePanelKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    },
    []
  );

  const handlePanelBlur = useCallback(
    (_e: React.FocusEvent<HTMLDivElement>) => {
      setIsOpen(false);
    },
    []
  );

  const isThisSubMenuOpen = currentSubMenuId === triggerId;
  const shouldRenderFlyout = isThisSubMenuOpen && isOpen && typeof document !== 'undefined';

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isThisSubMenuOpen}
        aria-disabled={disabled}
        id={`submenu-trigger-${triggerId}`}
        tabIndex={disabled ? -1 : 0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center justify-between px-2 py-1 text-xs select-none cursor-default',
          disabled ? 'cursor-not-allowed text-text-muted' : 'text-text-primary hover:bg-surface-interactive'
        )}
      >
        <span className="flex items-center gap-2 truncate flex-1">
          {Icon && (
            <Icon className="h-4 w-4 shrink-0 text-text-muted" />
          )}
          <span className="truncate" title={label}>{label}</span>
        </span>
        <ChevronRight className="h-3 w-3 shrink-0 text-text-muted ml-2" />
      </div>

      {shouldRenderFlyout
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              data-contextmenu-type="submenu"
              className="fixed z-50 w-56 rounded-md border border-border bg-surface-elevated py-1 shadow-lg select-none overflow-y-auto"
              style={{
                left: flyoutPlacement.left,
                top: flyoutPlacement.top,
                maxHeight: flyoutPlacement.maxHeight,
              }}
              onMouseEnter={handlePanelMouseEnter}
              onMouseLeave={handlePanelMouseLeave}
              onKeyDown={handlePanelKeyDown}
              onBlur={handlePanelBlur}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
