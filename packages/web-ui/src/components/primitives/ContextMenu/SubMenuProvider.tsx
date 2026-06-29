import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Context exposed by SubMenuProvider for coordinating open/close of submenus.
 */
export interface SubMenuContextValue {
  openSubMenu: (id: string) => void;
  closeSubMenu: () => void;
  /** Schedules a 120 ms close — allows the mouse to travel from parent item to submenu flyout. */
  scheduleClose: (id: string) => void;
  /** Cancels any pending scheduled close (e.g. on mouse-enter of flyout). */
  cancelCloseTimer: () => void;
  currentSubMenuId: string | null;
}

const SubMenuContextImpl = createContext<SubMenuContextValue | null>(null);

/**
 * Returns the SubMenuContext — throws if called outside SubMenuProvider.
 */
export function useSubMenuContext(): SubMenuContextValue {
  const ctx = React.useContext(SubMenuContextImpl);
  if (!ctx) {
    throw new Error('useSubMenuContext must be used within SubMenuProvider');
  }
  return ctx;
}

export interface SubMenuProviderProps {
  children: ReactNode;
}

/**
 * Wraps a context menu that may contain submenu items.
 * Provides close-delay coordination between the parent trigger and flyouts.
 *
 * Key stability properties:
 * - Shared close timer is cancelled when entering any trigger/flyout.
 * - Opening a new submenu immediately closes the old one (no delay).
 * - Stale enter-timer callbacks check currentSubIdRef before rendering.
 */
export function SubMenuProvider({ children }: SubMenuProviderProps): React.ReactElement {

  const [currentSubMenuId, setCurrentSubMenuId] = useState<string | null>(null);
  const currentSubIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSubMenu = useCallback(() => {
    currentSubIdRef.current = null;
    setCurrentSubMenuId(null);

  }, []);

  const openSubMenu = useCallback((id: string) => {
    // Cancel pending close timer for the old submenu
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    currentSubIdRef.current = id;
    setCurrentSubMenuId(id);

  }, []);

  const cancelCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback((id: string) => {
    cancelCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      if (currentSubIdRef.current === id) {
        closeSubMenu();
      }
    }, 120);
  }, [cancelCloseTimer, closeSubMenu]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <SubMenuContextImpl.Provider
      value={{ openSubMenu, closeSubMenu, scheduleClose, cancelCloseTimer, currentSubMenuId }}
    >
      {children}
    </SubMenuContextImpl.Provider>
  );
}
