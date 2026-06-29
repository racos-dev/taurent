// useWorkspaceView — Rust-owned workspace view projection hook.
//
// Consumes the Rust `workspace-view-changed` event and returns the latest
// computed view. The hook is designed to be called from inside a React
// component factory (e.g. `createTorrentWorkspaceController`).
//
// The hook does not gate on the bridge capability itself — callers must
// do that themselves and only call this hook when the capability is
// enabled. The hook assumes the bridge exposes the workspace view methods.
//
// Wire field names use snake_case to match the Rust `WorkspaceViewRequest` /
// `WorkspaceView` structs (P2.3-TS).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceView, WorkspaceViewRequest } from '@taurent/bridge/types';

/**
 * Minimal bridge surface the workspace view hook requires.
 *
 * Structurally compatible with the `qBClient` slice of `QBClientBridge`,
 * `DesktopBridge.qBClient`, and `MobileBridge.qBClient` — any of those can
 * be passed in by callers.
 */
export interface WorkspaceViewClientBridge {
  setWorkspaceView(request: WorkspaceViewRequest): Promise<WorkspaceView>;
  addWorkspaceViewListener(handler: (event: WorkspaceView) => () => void): () => void;
}

/**
 * Bridge surface consumed by workspace-view-aware web-core factories.
 *
 * Structurally compatible with `DesktopBridge` and `MobileBridge` — both
 * expose a `qBClient` slice that includes the workspace view command and event
 * listener.
 * Apps can therefore pass the `BridgeAdapter` singleton directly without
 * any wrapper, mirroring the `createAddTorrentHook({ bridge: BridgeAdapter })`
 * pattern.
 */
export interface WorkspaceViewBridge {
  qBClient: WorkspaceViewClientBridge;
}

export interface UseWorkspaceViewResult {
  /** The latest view from the Rust engine, or `null` while loading. */
  view: WorkspaceView | null;
  /** `true` until `setWorkspaceView` resolves. */
  isLoading: boolean;
  /** Last error message, or `null` on success. */
  error: string | null;
  /** Re-issue `setWorkspaceView` with the current request. */
  refresh: () => Promise<void>;
}

/**
 * Subscribe to the Rust workspace-view engine and return the latest view.
 *
 * Behaviour:
   *   - On mount / request change, issues `setWorkspaceView` so the backend
   *     has the latest request.
 *   - Subscribes to `workspace-view-changed` events; updates the local
 *     `view` only when the event matches the active `request_id`.
 *   - Returns a stable `refresh` that re-issues `setWorkspaceView`.
 *
 * @param bridge - The `qBClient` slice of the bridge adapter (or any
 *   structurally compatible object exposing the workspace view methods).
 * @param request - The active `WorkspaceViewRequest`. The `request_id` is
 *   used for correlation; the engine echoes it back on every view.
 */
export function useWorkspaceView(
  bridge: WorkspaceViewClientBridge,
  request: WorkspaceViewRequest,
): UseWorkspaceViewResult {
  const [view, setView] = useState<WorkspaceView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<WorkspaceViewRequest>(request);

  // Keep the latest request in a ref so the listener and `refresh` always see
  // the current filters / sort / locale.
  // mount) and `refresh` always see the current filters / sort / locale.
  // Updated in an effect (not during render) to satisfy react-hooks/refs.
  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await bridge.setWorkspaceView(requestRef.current);
      setView(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [bridge]);

  useEffect(() => {
    // Keep the current view visible while the new request is computed so filter
    // changes update in place instead of blanking the workspace.
    setIsLoading(true);
    let cancelled = false;

    void (async () => {
      try {
        const result = await bridge.setWorkspaceView(request);
        if (cancelled) return;
        setView(result);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    })();

    // Subscribe to engine events. The bridge interface declares the
    // handler as `(event) => () => void` (a no-op unsubscriber); the
    // helpers accept `(event) => void` directly. Returning a no-op
    // function here keeps both shapes satisfied.
    const unsubscribe = bridge.addWorkspaceViewListener((event) => {
      if (event.request_id === requestRef.current.request_id) {
        setView(event);
        setError(null);
        setIsLoading(false);
      }
      return () => {};
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bridge, request]);

  return { view, isLoading, error, refresh };
}
