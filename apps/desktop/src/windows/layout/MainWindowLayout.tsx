import { type ReactNode } from 'react';
import { useWindowState } from '../../hooks/useWindowState';

interface MainWindowLayoutProps {
  children: ReactNode;
}

/**
 * Root layout for the main application window.
 *
 * The main window starts hidden in tauri.conf.json (`visible: false`) to avoid
 * showing the wrong geometry before state is restored. This component:
 * 1. Restores the last saved position, size, and maximized state via
 *    `tauri-plugin-window-state`.
 * 2. Shows the window only after the restore completes (no geometry flicker).
 *
 * Dialog and auxiliary windows have their own layout components that handle
 * show/restore independently — this component must NOT be used for those.
 */
export function MainWindowLayout({ children }: MainWindowLayoutProps) {
  // No label passed — useWindowState will run the full geometry restore path.
  useWindowState();

  return <>{children}</>;
}
