import { type ReactNode, useEffect, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createSessionEventListener } from '@taurent/bridge/transport/tauri';
import type { SessionChangedEvent } from '@taurent/bridge/events';

interface DialogWindowLayoutProps {
  label: string;
  children: ReactNode;
}

/**
 * Minimal layout for small, non-resizable dialog windows.
 * Unlike AuxWindowLayout it does NOT restore geometry state — the window
 * size is fixed at creation time.
 *
 * Also closes the window when the desktop session disconnects or errors,
 * preventing stale action dialogs from being left on screen after a
 * server/session change.
 */
export function DialogWindowLayout({ label, children }: DialogWindowLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isPrebakeLaunch = searchParams.get('__prebake') === '1';

  useLayoutEffect(() => {
    // The DOM for the dialog or its Suspense fallback has been committed before
    // this layout effect runs. Show from here, rather than from tauri://created,
    // so a cold webview never exposes an empty document.
    //
    // If this window was pre-baked, keep it hidden until a user-triggered open.
    const wasPrebaked = isPrebakeLaunch || sessionStorage.getItem(`prebaking:${label}`);
    if (wasPrebaked) {
      sessionStorage.removeItem(`prebaking:${label}`);
      void getCurrentWindow().hide();
      return;
    }

    void getCurrentWindow().show();
  }, [label, isPrebakeLaunch]);

  // Support singleton re-use: update search params when caller sends a new payload
  useEffect(() => {
    const unlisten = listen<{ route: string; payload: Record<string, string> }>(
      `${label}:navigate`,
      (event) => {
        const cleanPayload = { ...event.payload.payload };
        delete cleanPayload.__prebake;
        setSearchParams(cleanPayload, { replace: true });
      }
    );
    void unlisten.then(() => {
      void emit(`${label}:ready`);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [label, setSearchParams]);

  // Close the window when session disconnects or errors so stale action dialogs
  // are not left hanging after a server/session change.
  useEffect(() => {
    let unlistenSession: Promise<() => void> | null = null;

    async function setupSessionListener() {
      unlistenSession = createSessionEventListener(async (event: SessionChangedEvent) => {
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
  }, []);

  return (
    <div className="h-screen flex flex-col bg-surface text-text-primary">
      {children}
    </div>
  );
}
