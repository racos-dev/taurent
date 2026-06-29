import { ReactNode, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createSessionEventListener } from '@taurent/bridge/transport/tauri';
import { useWindowState } from '../../hooks/useWindowState';
import type { ResourceInvalidatedEvent } from '@taurent/bridge/events';
import type { SessionChangedEvent } from '@taurent/bridge/events';

interface AuxWindowLayoutProps {
  /** Label used for event targeting */
  label: string;
  /** Content to render */
  children: ReactNode;
  /** Optional handler for resource-invalidated events */
  onResourceInvalidated?: (payload: ResourceInvalidatedEvent) => void;
  /** Whether to close the window automatically when the session is lost */
  closeOnSessionLoss?: boolean;
}

/**
 * Reusable layout for auxiliary windows.
 * - useWindowState restores geometry/maximized state then shows the window
 * - Listens for Tauri navigate events with payloads (for re-opening with data)
 * - Emits resource-invalidated to main session if handler provided
 * - Closes the window when the desktop session disconnects or errors so stale
 *   action windows are not left hanging after a server/session change.
 */
export function AuxWindowLayout({
  label,
  children,
  onResourceInvalidated,
  closeOnSessionLoss = true,
}: AuxWindowLayoutProps) {
  const [, setSearchParams] = useSearchParams();

  // Restore window state and show — only the aux window itself does this.
  // Passes `label` so useWindowState can skip geometry restore for fixed-size windows.
  useWindowState({ label });

  // Listen for navigation events from the manager when a new payload arrives
  // These are Tauri events, not DOM events
  useEffect(() => {
    const unlisten = listen<{ route: string; payload: Record<string, string> }>(
      `${label}:navigate`,
      (event) => {
        setSearchParams(event.payload.payload);
      }
    );

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [label, setSearchParams]);

  // Listen for resource-invalidated events from main session
  useEffect(() => {
    if (!onResourceInvalidated) return;

    const unlisten = listen<ResourceInvalidatedEvent>('resource-invalidated', (event) => {
      onResourceInvalidated(event.payload);
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [onResourceInvalidated]);

  // Close the window when session disconnects or errors so stale action windows
  // are not left hanging after a server/session change.
  useEffect(() => {
    let unlistenSession: Promise<() => void> | null = null;

    if (!closeOnSessionLoss) {
      return;
    }

    async function setupSessionListener() {
      unlistenSession = createSessionEventListener(async (event: SessionChangedEvent) => {
        // Close the window when the session transitions to disconnected or error,
        // unless the current server in the window matches the incoming server
        // (i.e. a different session for the same server is being established).
        if (event.status === 'disconnected' || event.status === 'error') {
          await getCurrentWindow().close();
        }
      });
    }

    setupSessionListener();

    return () => {
      if (unlistenSession) {
        void unlistenSession.then((fn) => fn());
      }
    };
  }, [closeOnSessionLoss]);

  return (
    <div className="h-screen flex flex-col bg-background text-text-primary">
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
