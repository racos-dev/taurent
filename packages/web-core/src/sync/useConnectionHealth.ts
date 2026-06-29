// useConnectionHealth — unified connection health state derived from the
// qBittorrent session and the live sync subsystems.
//
// Combines two existing data sources into a single state machine the UI can
// consume to render connection banners and "reconnected" toast-style cues:
//
//   1. useQBClient()        — app-supplied hook that surfaces the current
//                              session's connected state plus server identity
//                              (serverName / serverUrl). Pass it via options
//                              so web-core stays free of app-specific imports.
//
//   2. useMaindataState()   — backend-owned maindata sync state (syncHealth)
//                              combined with the protected-request outage
//                              signal (protectedRequestHealth). Both already
//                              flow through MaindataSyncProvider.
//
// The derived state is one of:
//
//   disconnected           — session not connected (isConnected === false)
//   connected_unavailable  — at-or-above the unhealthy threshold
//                            (maindata retrying OR protected >=2 errors)
//   connected_degraded     — below-threshold degradation (1 error only)
//   connected_healthy      — no errors on either signal
//
// Two side-channel signals are tracked alongside the state:
//
//   unavailableSinceMs     — timestamp (Date.now()) of the most recent
//                            transition INTO connected_unavailable. Cleared
//                            when leaving that state. Used by the unavailable
//                            overlay to show "unavailable for N seconds".
//
//   reconnected            — true for ~2.5s after recovering from an unhealthy
//                            state that lasted at least RECONNECT_DEBOUNCE_MS.
//                            Used to drive a transient "Reconnected" toast.
//
// Both side-channel signals are updated in a single useEffect so they observe
// a consistent view of the previous state. Two independent effects would race
// on prevStateRef.current and could miss or double-count transitions.

import { useEffect, useRef, useState } from 'react';
import { useMaindataState } from './MaindataSyncProvider';
import {
  isMaindataSyncDegraded,
  type MaindataSyncHealth,
} from './useMaindataSyncBackend';
import {
  isProtectedRequestDegraded,
  type ProtectedRequestHealth,
} from './protectedRequestHealth';

export type ConnectionHealthState =
  | 'disconnected'           // session not connected
  | 'connected_healthy'      // connected, no errors on either health signal
  | 'connected_degraded'     // connected, below-threshold degradation (1 error)
  | 'connected_unavailable'; // connected, at/above threshold (retrying / protected >= 2)

export interface ConnectionHealth {
  /** Unified state machine value. */
  state: ConnectionHealthState;
  /**
   * Stable human-readable identity for the currently connected server.
   * Prefers serverName, falls back to serverUrl, then to fallbackIdentity,
   * finally null. Used for diagnostics and toasts.
   */
  serverIdentity: string | null;
  /**
   * True for ~2.5s after recovering from an unhealthy state that lasted
   * at least RECONNECT_DEBOUNCE_MS. Used for a transient "Reconnected" cue.
   * Quick flaps (< RECONNECT_DEBOUNCE_MS) stay false to avoid spam.
   */
  reconnected: boolean;
  /**
   * Timestamp (Date.now() ms) of the most recent transition INTO
   * connected_unavailable. Null when not currently unavailable.
   */
  unavailableSinceMs: number | null;
  /**
   * Most recent error message from maindata sync (if any). Surfaced for
   * display in connection banners / diagnostics.
   */
  lastErrorMessage: string | null;
}

export interface UseConnectionHealthOptions {
  /**
   * App-supplied hook that returns the current session connection info.
   * `web-core` does not own session state — apps pass their own
   * `useQBClient`-shaped hook so the hook remains portable.
   */
  useQBClient: () => {
    isConnected: boolean;
    serverName: string | null;
    serverUrl: string | null;
  };
  /**
   * Last-resort identity used when both serverName and serverUrl are null.
   * Typically a configured server nickname or display label.
   */
  fallbackIdentity?: string;
}

/** Minimum unhealthy duration before `reconnected` flashes on recovery. */
const RECONNECT_DEBOUNCE_MS = 3000;
/** How long the `reconnected` flag stays true once triggered. */
const RECONNECT_FLASH_MS = 2500;

export function useConnectionHealth({
  useQBClient,
  fallbackIdentity,
}: UseConnectionHealthOptions): ConnectionHealth {
  const { isConnected, serverName, serverUrl } = useQBClient();
  const { syncHealth, protectedRequestHealth } = useMaindataState();

  const serverIdentity =
    serverName ?? serverUrl ?? fallbackIdentity ?? null;

  // ── Derive unified state ────────────────────────────────────────────────────
  //
  // Order matters: at/above threshold (unavailable) is checked before
  // below-threshold (degraded) so the same data point cannot be classified
  // as both. `isMaindataSyncDegraded` is "retrying" (threshold reached);
  // `isProtectedRequestDegraded` is `consecutiveErrorCount >= 2`.
  let state: ConnectionHealthState;
  if (!isConnected) {
    state = 'disconnected';
  } else if (
    isMaindataSyncDegraded(syncHealth) ||
    isProtectedRequestDegraded(protectedRequestHealth)
  ) {
    state = 'connected_unavailable';
  } else if (
    syncHealth.status === 'degraded' ||
    protectedRequestHealth.status === 'degraded'
  ) {
    state = 'connected_degraded';
  } else {
    state = 'connected_healthy';
  }

  // ── Side-channel signals ───────────────────────────────────────────────────
  //
  // Both unavailableSinceMs and reconnected are tracked in ONE effect so they
  // observe a consistent prevState snapshot. prevStateRef.current is updated
  // at the END of the effect so the next run sees this render's state as prev.
  const [unavailableSinceMs, setUnavailableSinceMs] = useState<number | null>(null);
  const [reconnected, setReconnected] = useState(false);

  // Initialize prev to the current state so the very first effect run does not
  // treat the mount as a transition. Without this, an initial mount in
  // connected_unavailable would set unavailableSinceMs to Date.now() spuriously.
  const prevStateRef = useRef<ConnectionHealthState>(state);
  // Timestamp of the most recent transition INTO an unhealthy state.
  // Null when currently healthy / disconnected.
  const unhealthySinceRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevStateRef.current;

    // ── unavailableSinceMs tracking ────────────────────────────────────────
    if (state === 'connected_unavailable' && prev !== 'connected_unavailable') {
      setUnavailableSinceMs(Date.now());
    } else if (state !== 'connected_unavailable' && prev === 'connected_unavailable') {
      setUnavailableSinceMs(null);
    }

    // ── reconnected tracking (debounced) ───────────────────────────────────
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (state === 'connected_unavailable' || state === 'connected_degraded') {
      // Mark when we first entered an unhealthy state in this run of unhealthy
      // transitions. If we're already unhealthy (unhealthySinceRef is set),
      // leave it alone — we want the time of the FIRST transition.
      if (unhealthySinceRef.current === null) {
        unhealthySinceRef.current = Date.now();
      }
    } else if (
      state === 'connected_healthy' &&
      (prev === 'connected_unavailable' || prev === 'connected_degraded')
    ) {
      // Just recovered. If the unhealthy period was long enough, flash
      // `reconnected` for RECONNECT_FLASH_MS. Quick flaps stay silent.
      const since = unhealthySinceRef.current;
      if (since !== null && Date.now() - since >= RECONNECT_DEBOUNCE_MS) {
        setReconnected(true);
        timer = setTimeout(() => setReconnected(false), RECONNECT_FLASH_MS);
      }
      unhealthySinceRef.current = null;
    } else if (state === 'disconnected') {
      // Disconnect resets the unhealthy window — a subsequent reconnect starts
      // a fresh debounce period.
      unhealthySinceRef.current = null;
    }

    // Update prev AFTER reading it so the next effect run sees this render's
    // state as prev. Must happen even when we early-returned via the timer
    // branch — capture-before-update keeps the invariant intact.
    prevStateRef.current = state;

    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [state]);

  const lastErrorMessage: string | null = syncHealth.lastErrorMessage;

  return {
    state,
    serverIdentity,
    reconnected,
    unavailableSinceMs,
    lastErrorMessage,
  };
}

// Re-export types used by the public surface for downstream convenience.
export type { MaindataSyncHealth, ProtectedRequestHealth };
