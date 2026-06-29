// Shared headless session controller for qBittorrent connection lifecycle.
//
// This module contains the runtime-agnostic connection state machine.
// Platform bridges (desktop/mobile) are injected as dependencies, while this
// file depends only on shared bridge event/type contracts and never imports
// @tauri-apps/* or any concrete platform bridge module.
//
// Architecture:
//   Mobile/Desktop QBClientProvider
//         │
//         ├── injects platform-specific bridge + listeners
//         │
//         ▼
//   useSessionController() ◄── shared hook
//         │
//         ├── manages session state machine
//         ├── subscribes to session-changed / resource-invalidated events
//         └── invalidates queries on resource changes
//
// Public API exposed by the controller (shared shape between platforms):
//   connect, disconnect, retry
//   isConnected, isConnecting, isHydrated
//   sessionGeneration, serverId, error, retryState
//
// Platform-specific additions:
//   Providers may extend this shared controller with app-local metadata.
//   Mobile currently adds serverName and serverUrl in its provider wrapper.

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionSnapshot, SessionStatus, RetryState } from '@taurent/bridge/types';
import type { SessionChangedEvent, ResourceInvalidatedEvent } from '@taurent/bridge/events';
import type { UnlistenFn } from '@taurent/bridge/transport';
import { mark } from '@taurent/shared/utils/perfAudit';
import { reportOperationFailure } from '../hooks/operationFailureReporter';

// ---------------------------------------------------------------------------
// Module-scope in-flight connect tracker
//
// Survives StrictMode unmount/remount boundaries (unlike useRef which resets
// on remount). Since there is exactly one useSessionController instance in the
// app, module scope is safe here. On remount, connect() for the same server
// returns the existing promise instead of issuing a second Rust invoke.
// ---------------------------------------------------------------------------

interface InflightConnect {
  serverId: string;
  promise: Promise<void>;
  resolve: (() => void) | null;
  reject: ((err: Error) => void) | null;
}

let _inflightConnect: InflightConnect | null = null;

// Hot-module-reload guard: clear stale module state on HMR so dev reloads
// don't carry over a dangling in-flight promise.
const _importMeta = import.meta as { hot?: { dispose(fn: () => void): void } };
if (_importMeta.hot) {
  _importMeta.hot.dispose(() => {
    _inflightConnect = null;
  });
}

// ---------------------------------------------------------------------------
// Dependency interfaces — platform implementations inject concrete versions
// ---------------------------------------------------------------------------

export interface SessionBridge {
  getSessionSnapshot(): Promise<SessionSnapshot>;
  sessionConnectById(serverId: string): Promise<number>;
  sessionDisconnect(): Promise<number>;
  sessionHealthCheck?(): Promise<boolean>;
}

export interface SessionEventListener {
  createSessionEventListener(
    callback: (event: SessionChangedEvent) => void
  ): Promise<UnlistenFn>;
  createResourceInvalidatedListener(
    callback: (event: ResourceInvalidatedEvent) => void
  ): Promise<UnlistenFn>;
}

export interface QueryInvalidator {
  invalidateOnConnect(serverId: string, sessionGeneration: number): void;
  handleResourceInvalidated(event: ResourceInvalidatedEvent): void;
}

// ---------------------------------------------------------------------------
// Controller state
// ---------------------------------------------------------------------------

export interface SessionControllerState {
  isConnected: boolean;
  isConnecting: boolean;
  isHydrated: boolean;
  sessionGeneration: number;
  serverId: string | null;
  error: string | null;
  retryState: RetryState;
}

export interface SessionController extends SessionControllerState {
  connect: (serverId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  retry: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseSessionControllerOptions {
  /** Platform-specific session bridge */
  bridge: SessionBridge;
  /** Platform-specific event listeners */
  listeners: SessionEventListener;
  /** React Query client for cache invalidation */
  queryClient: QueryClient;
  /** Query invalidation helpers (web-core) */
  invalidator: QueryInvalidator;
  /**
   * Retry configuration.
   * Mobile: simple retry (fixed delay, no backoff) — controller handles delay via setTimeout.
   * Desktop: exponential backoff — performRetry implements its own delay strategy;
   *          controller setTimeout delay is skipped (baseDelayMs = 0).
   */
  retryConfig: {
    maxAttempts: number;
    baseDelayMs: number;
    /**
     * Platform-specific retry implementation.
     * Called by the shared retry() method when retry is triggered.
     * Mobile: single fixed-delay retry (controller adds setTimeout delay).
     * Desktop: exponential backoff with own setTimeout inside performRetry.
     */
    performRetry: (serverId: string, attemptNumber: number) => Promise<void>;
  };
  /**
   * Connection timeout in ms before rejecting the connect promise.
   * Default: 30000 (30s).
   */
  connectTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Internal helper types
// ---------------------------------------------------------------------------

interface ConnectionConfig {
  serverId: string;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Shared session state reconciliation
// ---------------------------------------------------------------------------

function reconcileSessionState(
  status: SessionStatus,
  lastError: string | null | undefined,
  setIsConnected: (v: boolean) => void,
  setIsConnecting: (v: boolean) => void,
  setError: (v: string | null) => void
): void {
  switch (status) {
    case 'connected':
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      break;
    case 'connecting':
      setIsConnected(false);
      setIsConnecting(true);
      setError(null);
      break;
    case 'error':
      setIsConnected(false);
      setIsConnecting(false);
      setError(lastError ?? null);
      break;
    case 'disconnected':
    default:
      setIsConnected(false);
      setIsConnecting(false);
      setError(null);
      break;
  }
}

// ---------------------------------------------------------------------------
// Main controller hook
// ---------------------------------------------------------------------------

export function useSessionController({
  bridge,
  listeners,
  queryClient: _queryClient,
  invalidator,
  retryConfig,
  connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
}: UseSessionControllerOptions): SessionController {
  const { maxAttempts, baseDelayMs, performRetry } = retryConfig;

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const [serverId, setServerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    attemptCount: 0,
    maxAttempts,
    maxAttemptsReached: false,
  });

  // Mutable refs for async callbacks — always current in closures
  const connectionConfigRef = useRef<ConnectionConfig | null>(null);
  const pendingConnectResolveRef = useRef<((value: void) => void) | null>(null);
  const pendingConnectRejectRef = useRef<((err: Error) => void) | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const unlistenFnsRef = useRef<(() => void)[]>([]);
  const isListenersActiveRef = useRef(false);
  const isMountedRef = useRef(true);

  // Tracks whether init() has completed listener registration.
  // Prevents connect() from being called before listeners are ready.
  const isInitCompleteRef = useRef(false);

  // Tracks in-flight retry attempt count for async callbacks.
  // Updated synchronously when retry() is called so callbacks see current value.
  const attemptCountRef = useRef(0);

  // Guard to prevent overlapping retries
  const isRetryingRef = useRef(false);

  // Ref to track connected state in visibilitychange/interval callbacks (avoids stale closures)
  const isConnectedRef = useRef(false);
  // Ref to track retry state in event callbacks (avoids stale closures)
  const retryStateRef = useRef<RetryState>({ isRetrying: false, attemptCount: 0, maxAttempts, maxAttemptsReached: false });

  // -------------------------------------------------------------------------
  // Cleanup helpers
  // -------------------------------------------------------------------------

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const backgroundRetryIntervalRef = useRef<number | null>(null);
  const BACKGROUND_RETRY_INTERVAL_MS = 30_000;

  const clearBackgroundRetry = useCallback(() => {
    if (backgroundRetryIntervalRef.current !== null) {
      window.clearInterval(backgroundRetryIntervalRef.current);
      backgroundRetryIntervalRef.current = null;
    }
  }, []);

  const clearPendingConnect = useCallback(
    (rejectWith?: Error) => {
      if (pendingConnectRejectRef.current) {
        pendingConnectRejectRef.current(rejectWith ?? new Error('Connection cancelled'));
        pendingConnectRejectRef.current = null;
      }
      if (pendingConnectResolveRef.current) {
        pendingConnectResolveRef.current = null;
      }
      clearConnectTimeout();
    },
    [clearConnectTimeout]
  );

  // -------------------------------------------------------------------------
  // Session reconciliation — used by both snapshot init and event handler
  // -------------------------------------------------------------------------

  const reconcile = useCallback(
    (status: SessionStatus, lastError?: string | null) => {
      reconcileSessionState(status, lastError, setIsConnected, setIsConnecting, setError);
      isConnectedRef.current = status === 'connected';
    },
    []
  );

// Keep retryStateRef current — used in event callbacks to avoid stale closures
useEffect(() => {
  retryStateRef.current = retryState;
}, [retryState]);

// -------------------------------------------------------------------------
// Snapshot hydration + event listener setup
// -------------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;
    isMountedRef.current = true;

    async function init() {
      try {
        // Step 1: Register event listeners BEFORE fetching the snapshot so no
        // session-changed events are dropped during the async snapshot call.
        // Previously the snapshot was fetched first; any server switch that completed
        // between the snapshot fetch and listener registration would be silently missed,
        // leaving the settings window with stale session state.
        if (isListenersActiveRef.current) {
          unlistenFnsRef.current.forEach((fn) => fn());
          unlistenFnsRef.current = [];
        }
        isListenersActiveRef.current = true;

        // Track any session-changed event that fires while the snapshot is in-flight.
        // After the snapshot resolves, we compare session_generation values and apply
        // whichever is newer, so a race-time server switch is never lost.
        // Boxed as an object so TypeScript doesn't narrow it to `never` after awaits
        // (CFA doesn't track that callbacks can mutate outer let-variables across await
        // boundaries, but it does preserve object property mutations correctly).
        const latestDuringInit: { event: SessionChangedEvent | null } = { event: null };

        // Register listeners sequentially so we can clean up on partial failure.
        let sessionUnlisten: UnlistenFn | null = null;
        let resourceUnlisten: UnlistenFn | null = null;

        try {
          // session-changed: drives connection state machine
          sessionUnlisten = await listeners.createSessionEventListener(
            (event: SessionChangedEvent) => {
              if (!isMounted) return;

              const wasConnected = isConnectedRef.current;
              const isManualConnectFailure = pendingConnectRejectRef.current !== null;

              latestDuringInit.event = event;
              setSessionGeneration(event.session_generation);
              setServerId(event.server_id);
              reconcile(event.status, event.last_error);

              // Report unexpected connected-session drops into the notification lane.
              // Suppress foreground/manual connect failures because login/add-server
              // flows already surface those inline and they should not become global toasts.
              if (!isManualConnectFailure && wasConnected) {
                if (event.status === 'disconnected' && event.last_error) {
                  reportOperationFailure({
                    operation: 'session-disconnect:',
                    error: event.last_error,
                  });
                } else if (event.status === 'error' && event.last_error) {
                  reportOperationFailure({
                    operation: 'session-error:',
                    error: event.last_error,
                  });
                }
              }

              // Issue 4 fix: preserve retry target whenever server_id is known
              if (event.server_id) {
                connectionConfigRef.current = { serverId: event.server_id };
              }

              // Always invalidate on connect — passive windows such as the settings
              // window are observers that never call connect() themselves, so
              // pendingConnectResolveRef is null in those windows. Moving this outside
              // the pendingConnect guard ensures all queries (preferences, categories,
              // tags, torrents, RSS) are refreshed on every server switch regardless of
              // which window initiated the connection.
              if (event.status === 'connected' && event.server_id) {
                invalidator.invalidateOnConnect(event.server_id, event.session_generation);
              }

              // Resolve/reject pending connect promise — only relevant for windows that
              // called connect() themselves (e.g. the main window, not settings).
              if (event.status === 'connected' && pendingConnectResolveRef.current) {
                clearConnectTimeout();
                pendingConnectResolveRef.current();
                clearPendingConnect();
                setRetryState((prev) => ({
                  ...prev,
                  isRetrying: false,
                  attemptCount: 0,
                  maxAttemptsReached: false,
                }));
              } else if (event.status === 'error' && pendingConnectRejectRef.current) {
                clearConnectTimeout();
                pendingConnectRejectRef.current(new Error(event.last_error || 'Connection failed'));
                clearPendingConnect();
              }
            }
          );
        } catch (err) {
          // Clean up if session listener registration itself fails
          if (isListenersActiveRef.current) {
            unlistenFnsRef.current.forEach((fn) => fn());
            unlistenFnsRef.current = [];
            isListenersActiveRef.current = false;
          }
          throw err;
        }

        try {
          // resource-invalidated: refreshes stale query cache entries
          resourceUnlisten = await listeners.createResourceInvalidatedListener(
            (event: ResourceInvalidatedEvent) => {
              if (!isMounted) return;
              invalidator.handleResourceInvalidated(event);
            }
          );
        } catch (err) {
          // Clean up listeners if resource listener setup fails
          if (sessionUnlisten) {
            sessionUnlisten();
          }
          if (isListenersActiveRef.current) {
            unlistenFnsRef.current.forEach((fn) => fn());
            unlistenFnsRef.current = [];
            isListenersActiveRef.current = false;
          }
          throw err;
        }

        // Store unlisten fns for cleanup
        unlistenFnsRef.current = [sessionUnlisten, resourceUnlisten];

        // Step 2: Fetch snapshot now that listeners are active — no events can be missed.
        const snapshot = await bridge.getSessionSnapshot();

        if (!isMounted) return;

        // Step 3: Apply snapshot state, but only if no newer event arrived during the
        // listener-registration + snapshot-fetch window. session_generation is
        // monotonically increasing, so a higher value in latestDuringInit means the
        // event handler has already applied fresher state and the snapshot is stale.
        // Use optional chaining (-1 sentinel when no event arrived) so the comparison
        // is a simple integer check that TypeScript handles without narrowing issues.
        const latestGen = latestDuringInit.event?.session_generation ?? -1;
        if (snapshot.session_generation >= latestGen) {
          setSessionGeneration(snapshot.session_generation);
          setServerId(snapshot.server_id);
          reconcile(snapshot.status, snapshot.last_error);

          // Issue 4 fix: preserve retry target whenever server_id is known, not only when connected
          if (snapshot.server_id) {
            connectionConfigRef.current = { serverId: snapshot.server_id };

            // T163.3: Invalidate queries when re-hydrating from an already-connected
            // session (e.g. tray resume). Without this, React Query caches for
            // non-maindata resources stay stale because no session-changed event fires.
            if (snapshot.status === 'connected') {
              invalidator.invalidateOnConnect(snapshot.server_id, snapshot.session_generation);
            }
          }
        }
        // If latestDuringInit has a higher session_generation the event handler already
        // applied the correct state — skip the stale snapshot.

        if (!isMounted) return;

        // Step 4: Mark hydrated AFTER listeners are registered and snapshot applied.
        // This ensures connect() cannot be called before event handlers exist.
        isInitCompleteRef.current = true;

        // Determine effective restored connected state after reconciliation
        // (accounts for latestDuringInit race handling — use whichever is newer).
        const effectiveStatus: SessionStatus | null =
          (latestDuringInit.event?.session_generation ?? -1) > snapshot.session_generation
            ? latestDuringInit.event?.status ?? null
            : snapshot.status;

        setIsHydrated(true);
        mark('session.snapshot.resolved');

        // Fire-and-forget post-hydration health check for restored connected sessions.
        // Does not block hydration; only runs once during init/restore.
        if (effectiveStatus === 'connected') {
        bridge.sessionHealthCheck?.().catch((err) => {
          reportOperationFailure({ operation: 'session-health-check:init', error: err });
        });
        }
      } catch (err) {
        if (!isMounted) return;
        // Issue 1 fix: do NOT mark init complete if listeners failed to register.
        // connect() will throw "Session controller is not yet initialized".
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        isInitCompleteRef.current = false;
        setIsHydrated(true);
      }
    }

    init();

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      isInitCompleteRef.current = false;
      // Detach refs from this mount only — do NOT reject the in-flight connect promise.
      // If this is a StrictMode cleanup (immediate remount follows), the module-scope
      // _inflightConnect entry must survive so the remount returns the same promise
      // without issuing a second Rust invoke.
      // Clear the connect timeout to prevent a zombie 30s timer firing after unmount.
      pendingConnectResolveRef.current = null;
      pendingConnectRejectRef.current = null;
      clearConnectTimeout();
      if (isListenersActiveRef.current) {
        unlistenFnsRef.current.forEach((fn) => fn());
        unlistenFnsRef.current = [];
        isListenersActiveRef.current = false;
      }
      clearBackgroundRetry();
    };
  }, [
    bridge,
    listeners,
    reconcile,
    clearConnectTimeout,
    clearPendingConnect,
    clearBackgroundRetry,
    invalidator,
  ]);

  // Visibility recovery: probe health when user returns to the app after backgrounding
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isMountedRef.current || !isInitCompleteRef.current) return;

      if (isConnectedRef.current) {
        // Connected but may have stale auth — probe silently
        bridge.sessionHealthCheck?.().catch((err) => {
          reportOperationFailure({ operation: 'session-health-check:visibility', error: err });
        });
      }
      // Note: background retry is handled by the dedicated background retry effect
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [bridge]);

  // Background retry: after max attempts are exhausted, keep trying every 30s
  // until the server comes back. Self-cancels when connection is restored.
  useEffect(() => {
    if (!retryState.maxAttemptsReached) {
      clearBackgroundRetry();
      return;
    }

    backgroundRetryIntervalRef.current = window.setInterval(() => {
      if (!isMountedRef.current || !connectionConfigRef.current) return;
      // Reset attempt counter so exponential backoff gets a fresh run
      attemptCountRef.current = 0;
      setRetryState({ isRetrying: false, attemptCount: 0, maxAttempts, maxAttemptsReached: false });
      const sid = connectionConfigRef.current.serverId;
      performRetry(sid, 1).catch((err) => {
        reportOperationFailure({ operation: 'session-retry:background', error: err });
      });
    }, BACKGROUND_RETRY_INTERVAL_MS);

    return clearBackgroundRetry;
  }, [retryState.maxAttemptsReached, maxAttempts, performRetry, clearBackgroundRetry]);

  // -------------------------------------------------------------------------
  // connect
  // -------------------------------------------------------------------------

  const connect = useCallback(
    async (sid: string): Promise<void> => {
      // Guard: do not allow connect() before listeners are ready
      if (!isInitCompleteRef.current) {
        throw new Error('Session controller is not yet initialized');
      }

      // Deduplicate: if an in-flight connect for the same server already exists
      // (survives StrictMode unmount/remount), reattach this mount's refs to it
      // and return the existing promise — no second Rust invoke.
      if (_inflightConnect?.serverId === sid) {
        pendingConnectResolveRef.current = _inflightConnect.resolve;
        pendingConnectRejectRef.current = _inflightConnect.reject;
        return _inflightConnect.promise;
      }

      // Different server: cancel the previous in-flight connect.
      if (_inflightConnect) {
        _inflightConnect.reject?.(new Error('Superseded by connect to different server'));
        _inflightConnect = null;
      }

      connectionConfigRef.current = { serverId: sid };
      setIsConnecting(true);
      setError(null);
      clearRetryTimeout();
      clearConnectTimeout();

      // Capture resolve/reject from the Promise executor (runs synchronously) so we can
      // store them on the entry without a circular null! assignment.
      let _resolve!: () => void;
      let _reject!: (err: Error) => void;

      const rawPromise = new Promise<void>((res, rej) => {
        _resolve = res;
        _reject = rej;
        pendingConnectResolveRef.current = res;
        pendingConnectRejectRef.current = rej;

        // Safety timeout: reject if no session-changed event arrives within the configured window
        connectTimeoutRef.current = window.setTimeout(() => {
          if (pendingConnectResolveRef.current === res) {
            pendingConnectResolveRef.current = null;
            pendingConnectRejectRef.current = null;
            setIsConnecting(false);
            setError('Connection timeout - no session-changed event received');
            rej(new Error('Connection timeout - no session-changed event received'));
          }
        }, connectTimeoutMs);

        bridge
          .sessionConnectById(sid)
          .then(() => {
            // Wait for session-changed event to confirm connected state
          })
          .catch((err) => {
            clearConnectTimeout();
            setIsConnecting(false);
            setError(err instanceof Error ? err.message : 'Connection failed');
            rej(err);
            clearPendingConnect();
          });
      });

      // Promise executor is synchronous — _resolve and _reject are guaranteed set here.
      const entry: InflightConnect = {
        serverId: sid,
        resolve: _resolve,
        reject: _reject,
        promise: rawPromise.finally(() => {
          // Clear module-scope entry once the promise settles (success or failure)
          if (_inflightConnect === entry) _inflightConnect = null;
        }),
      };

      _inflightConnect = entry;
      return entry.promise;
    },
    [bridge, clearRetryTimeout, clearConnectTimeout, clearPendingConnect, connectTimeoutMs]
  );

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------

  const disconnect = useCallback(async (): Promise<void> => {
    clearRetryTimeout();
    // Issue 3 fix: reject any pending connect promise on disconnect
    clearPendingConnect(new Error('Disconnected'));

    try {
      await bridge.sessionDisconnect();
    } catch (err) {
      // Log but don't throw — disconnect should always succeed
      console.error('[SessionController] Disconnect failed:', err);
    }

    setIsConnected(false);
    setIsConnecting(false);
    setServerId(null);
    setError(null);
    setRetryState({ isRetrying: false, attemptCount: 0, maxAttempts, maxAttemptsReached: false });
    connectionConfigRef.current = null;
  }, [bridge, clearRetryTimeout, clearPendingConnect, maxAttempts]);

  // -------------------------------------------------------------------------
  // retry
  // -------------------------------------------------------------------------

  const retry = useCallback(async (): Promise<void> => {
    if (!connectionConfigRef.current) {
      throw new Error('No server to retry');
    }

    // Prevent overlapping retries
    if (isRetryingRef.current) {
      return;
    }

    // Don't trigger retry while an initial connect is in progress
    if (_inflightConnect !== null) {
      return;
    }

    const { serverId: sid } = connectionConfigRef.current;
    const currentAttempt = attemptCountRef.current + 1;

    // Enforce maxAttempts
    if (currentAttempt > maxAttempts) {
      setRetryState((prev) => ({
        ...prev,
        isRetrying: false,
        maxAttemptsReached: true,
      }));
      return;
    }

    // Update attempt count synchronously so async callbacks see the current value
    attemptCountRef.current = currentAttempt;
    isRetryingRef.current = true;

    setRetryState((prev) => ({
      ...prev,
      isRetrying: true,
      attemptCount: currentAttempt,
      maxAttemptsReached: false,
    }));

    // Schedule retry via platform-specific performRetry.
    // Desktop performRetry handles its own exponential backoff delay internally.
    // Mobile performRetry is called after controller's baseDelayMs timeout.
    retryTimeoutRef.current = window.setTimeout(async () => {
      try {
        await performRetry(sid, currentAttempt);
      } catch (err) {
        console.error('[SessionController] Retry failed:', err);
        // Issue 5 fix: reset retry state on retry failure so caller can evaluate terminal state
        setRetryState((prev) => ({
          ...prev,
          isRetrying: false,
        }));
      } finally {
        // Reset retry guard after performRetry completes (success or failure).
        // On failure, caller can call retry() again up to maxAttempts.
        isRetryingRef.current = false;
      }
    }, baseDelayMs);
  }, [maxAttempts, performRetry, baseDelayMs]);

  // -------------------------------------------------------------------------
  // Return controller interface
  // -------------------------------------------------------------------------

  return useMemo(
    (): SessionController => ({
      connect,
      disconnect,
      retry,
      isConnected,
      isConnecting,
      isHydrated,
      sessionGeneration,
      serverId,
      error,
      retryState,
    }),
    [
      connect,
      disconnect,
      retry,
      isConnected,
      isConnecting,
      isHydrated,
      sessionGeneration,
      serverId,
      error,
      retryState,
    ]
  );
}
