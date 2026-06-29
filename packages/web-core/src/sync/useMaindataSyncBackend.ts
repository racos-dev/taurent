// useMaindataSyncBackend — backend-owned live sync via snapshot + event contract.
//
// Receives `maindata-sync-changed` events from the Rust-owned sync manager,
// coalesces revision updates, fetches current snapshots via getMaindataSnapshot(),
// and drops stale-session snapshots/events using session_generation guards.
//
// This hook is intentionally backend-only: the renderer poller
// (`useMaindataSync`) has been removed. Provider-level wiring
// (see `MaindataSyncProvider`) selects between the backend hook and
// any future alternative — not the hook itself — and the connected desktop
// main window always picks the backend path. A failed initial snapshot
// surfaces as `isError` / `error` / degraded `syncHealth` so callers can
// decide whether to unmount and re-mount via the provider.
//
// Architecture:
//   Backend (Rust/qb-tauri) owns:
//     - Polling cadence, backoff, overlap guard, RID tracking
//     - Accumulated maindata state (MaindataAccumulator)
//     - Sync health state (SyncHealthState: idle/healthy/degraded/retrying)
//     - maindata-sync-changed event emission
//
//   Renderer (web-core) receives:
//     - Lightweight sync-changed events (revision, rid, health, changed_resources)
//     - Full accumulated snapshot on demand via getMaindataSnapshot()
//
// Usage:
//   const result = useMaindataSyncBackend({
//     scope: { serverId, sessionGeneration, isConnected },
//     bridge: { getMaindataSnapshot, getMaindataSyncStatus, startMaindataSync, stopMaindataSync, addMaindataSyncListener },
//   });

import { useCallback, useEffect, useRef, useState } from 'react';
import { mark } from '@taurent/shared/utils/perfAudit';
import { createLogger } from '@taurent/shared/utils/logger';
import { mergeMaindata, normalizeBackendMaindata } from '@taurent/shared/utils/maindata';
import type {
  MaindataSyncChangedEvent,
  MaindataSnapshotResponse,
  MaindataSyncHealth as RustMaindataSyncHealth,
} from '@taurent/bridge/types';
import type { Category, MaindataState, SyncMainData, SyncServerState, Torrent } from '@taurent/shared';
import type { QueryScope } from '../query/scope';

const logger = createLogger({ component: 'maindataSyncBackend' });

// ─── Health model (web-core shape — mirrors Rust SyncHealthState) ─────────────

export type MaindataSyncHealthStatus = 'idle' | 'healthy' | 'degraded' | 'retrying';

/**
 * Web-core sync health model.
 * Mirrors the Rust MaindataSyncHealth shape but uses camelCase keys.
 * Surfaced through MaindataSyncProvider / useMaindataState().
 */
export interface MaindataSyncHealth {
  status: MaindataSyncHealthStatus;
  consecutiveErrorCount: number;
  lastSuccessfulSyncAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
}

export function isMaindataSyncDegraded(health: MaindataSyncHealth): boolean {
  return health.status === 'retrying';
}

// ─── Bridge surface ─────────────────────────────────────────────────────────────

export interface MaindataSyncBridgeSurface {
  /** Fetch the current accumulated maindata snapshot from the backend. */
  getMaindataSnapshot(): Promise<MaindataSnapshotResponse>;
  /** Fetch the current sync health without a snapshot. */
  getMaindataSyncStatus(): Promise<RustMaindataSyncHealth>;
  /** Start the Rust-owned sync manager for the current serverId. */
  startMaindataSync(): Promise<void>;
  /** Stop the Rust-owned sync manager for the given serverId. */
  stopMaindataSync(serverId: string): Promise<void>;
  /** Subscribe to maindata-sync-changed events. Returns unsubscribe fn. */
  addMaindataSyncListener(handler: (event: MaindataSyncChangedEvent) => void): () => void;
}

export interface UseMaindataSyncBackendOptions {
  scope: QueryScope;
  /** The backend-owned sync bridge surface. When undefined, the hook returns idle state. */
  bridge?: MaindataSyncBridgeSurface;
  /**
   * When false, the hook returns idle state without setting up any backend sync.
   * Default: true
   */
  enabled?: boolean;
}

// ─── Result interface ───────────────────────────────────────────────────────────

export interface UseMaindataSyncBackendResult {
  maindataState: MaindataState | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  syncHealth: MaindataSyncHealth;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const IDLE_HEALTH: MaindataSyncHealth = Object.freeze({
  status: 'idle',
  consecutiveErrorCount: 0,
  lastSuccessfulSyncAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
});

// ─── Health conversion: Rust bridge type → web-core type ───────────────────────

function convertRustHealth(rust: RustMaindataSyncHealth): MaindataSyncHealth {
  return {
    status: rust.state,
    consecutiveErrorCount: rust.consecutive_errors,
    // Rust timestamps are Unix seconds; web-core expects milliseconds (Date.now())
    lastSuccessfulSyncAt: rust.last_success_ts != null ? rust.last_success_ts * 1000 : null,
    lastErrorAt: rust.last_error_ts != null ? rust.last_error_ts * 1000 : null,
    lastErrorMessage: rust.last_error_message,
  };
}

// ─── Delta application ─────────────────────────────────────────────────────────

/**
 * Resource keys that may appear in a `maindata-sync-changed` event's
 * `changed_resources` array. Used as a defensive whitelist when applying
 * the embedded raw qBittorrent delta — `mergeMaindata` already short-circuits
 * on absent fields, but explicit whitelisting matches the wire contract
 * documented in the event payload and protects against field drift between
 * Rust and the renderer.
 */
const SYNC_DELTA_RESOURCE_KEYS = [
  'torrents',
  'torrents_removed',
  'categories',
  'categories_removed',
  'tags',
  'tags_removed',
  'server_state',
] as const;
type SyncDeltaResourceKey = (typeof SYNC_DELTA_RESOURCE_KEYS)[number];

function isSyncDeltaResourceKey(value: string): value is SyncDeltaResourceKey {
  return (SYNC_DELTA_RESOURCE_KEYS as readonly string[]).includes(value);
}

function isPlainObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Apply a raw maindata delta (as embedded in the `maindata-sync-changed` event
 * payload) directly to the current accumulated state, skipping the
 * `getMaindataSnapshot()` IPC round-trip.
 *
 * The embedded `delta` mirrors the qBittorrent `/sync/maindata` wire format
 * — the same shape that `mergeMaindata` already understands — minus the
 * meta flags (`rid`, `full_update`) which we supply from the event.
 *
 * Returns `null` when no current state exists; the caller must fall back to
 * a full snapshot fetch in that case (we cannot merge a delta onto a null
 * base, and the delta cannot bootstrap a full state by itself).
 */
export function applyDeltaToState(
  current: MaindataState | null,
  delta: Record<string, unknown>,
  changedResources: readonly string[],
  fallbackRid: number,
): MaindataState | null {
  if (!current) return null;

  // Construct a SyncMainData-shaped envelope. The raw delta carries the
  // qBittorrent fields directly; we only need to supply `rid` (event-level
  // rid is the safe fallback) and force `full_update: false` so
  // `mergeMaindata` runs the incremental merge branch.
  const syncDelta: SyncMainData = {
    rid: typeof delta.rid === 'number' ? delta.rid : fallbackRid,
    full_update: delta.full_update === true,
  };

  // Whitelist delta fields by `changed_resources`. This is defensive:
  // `mergeMaindata` already handles undefined/absent fields, but the
  // whitelist mirrors the wire contract and avoids feeding unannounced
  // fields into the merge path.
  for (const key of changedResources) {
    if (!isSyncDeltaResourceKey(key)) continue;
    if (!(key in delta)) continue;
    switch (key) {
      case 'torrents':
        if (isPlainObjectRecord(delta.torrents)) {
          syncDelta.torrents = delta.torrents as Record<string, Torrent>;
        }
        break;
      case 'torrents_removed':
        if (Array.isArray(delta.torrents_removed)) {
          syncDelta.torrents_removed = delta.torrents_removed as string[];
        }
        break;
      case 'categories':
        if (isPlainObjectRecord(delta.categories)) {
          syncDelta.categories = delta.categories as Record<string, Category>;
        }
        break;
      case 'categories_removed':
        if (Array.isArray(delta.categories_removed)) {
          syncDelta.categories_removed = delta.categories_removed as string[];
        }
        break;
      case 'tags':
        if (Array.isArray(delta.tags)) {
          syncDelta.tags = delta.tags as string[];
        }
        break;
      case 'tags_removed':
        if (Array.isArray(delta.tags_removed)) {
          syncDelta.tags_removed = delta.tags_removed as string[];
        }
        break;
      case 'server_state':
        if (isPlainObjectRecord(delta.server_state)) {
          syncDelta.server_state = delta.server_state as unknown as SyncServerState;
        }
        break;
    }
  }

  return mergeMaindata(current, syncDelta);
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useMaindataSyncBackend({
  scope,
  bridge,
  enabled = true,
}: UseMaindataSyncBackendOptions): UseMaindataSyncBackendResult {
  const { isConnected, serverId, sessionGeneration } = scope;

  // Accumulated maindata state — written only on valid snapshot reception
  const maindataStateRef = useRef<MaindataState | null>(null);
  const [maindataState, setMaindataState] = useState<MaindataState | null>(null);

  const setAccumulatedMaindataState = useCallback((nextState: MaindataState | null) => {
    maindataStateRef.current = nextState;
    setMaindataState(nextState);
  }, []);

  // Whether the initial snapshot has been fetched (survives re-renders)
  const initialSnapshotFetchedRef = useRef(false);

  // Last processed revision — used to coalesce events and discard stale ones
  const lastRevisionRef = useRef<number>(-1);

  // Track current scope to detect resets
  const sessionGenerationRef = useRef<number>(sessionGeneration);
  const serverIdRef = useRef<string | null>(serverId);

  // Pending in-flight snapshot fetch (to avoid concurrent fetches)
  const pendingSnapshotRef = useRef<Promise<MaindataSnapshotResponse> | null>(null);

  // ── Health state (render-facing) ────────────────────────────────────────────
  const [syncHealth, setSyncHealth] = useState<MaindataSyncHealth>(() =>
    isConnected && serverId !== null
      ? { status: 'healthy', consecutiveErrorCount: 0, lastSuccessfulSyncAt: null, lastErrorAt: null, lastErrorMessage: null }
      : IDLE_HEALTH,
  );

  // Mutable ref for use in async callbacks that run outside render
  const syncHealthRef = useRef<MaindataSyncHealth>(syncHealth);

  useEffect(() => {
    syncHealthRef.current = syncHealth;
  }, [syncHealth]);

  // ── Loading/fetching/error state ────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ── Reset on scope change ───────────────────────────────────────────────────
  useEffect(() => {
    const newUid = `${serverId}:${sessionGeneration}`;
    const oldUid = `${serverIdRef.current}:${sessionGenerationRef.current}`;
    if (newUid !== oldUid) {
      // Scope changed — reset all mutable state so no stale data surfaces
      setAccumulatedMaindataState(null);
      initialSnapshotFetchedRef.current = false;
      lastRevisionRef.current = -1;
      pendingSnapshotRef.current = null;
      setSyncHealth(
        isConnected && serverId !== null
          ? { status: 'healthy', consecutiveErrorCount: 0, lastSuccessfulSyncAt: null, lastErrorAt: null, lastErrorMessage: null }
          : IDLE_HEALTH,
      );
      setIsLoading(false);
      setIsFetching(false);
      setIsError(false);
      setError(null);
      sessionGenerationRef.current = sessionGeneration;
      serverIdRef.current = serverId;
    }
  }, [isConnected, serverId, sessionGeneration, setAccumulatedMaindataState]);

  // ── Snapshot fetch helper ───────────────────────────────────────────────────
  const fetchSnapshot = useCallback(
    async (): Promise<MaindataSnapshotResponse | null> => {
      if (!bridge || !enabled) return null;
      let snapshotPromise = pendingSnapshotRef.current;
      if (!snapshotPromise) {
        snapshotPromise = bridge.getMaindataSnapshot();
        pendingSnapshotRef.current = snapshotPromise;
      }

      const snapshot = await snapshotPromise;

      // Guard: discard snapshots from stale sessions
      if (snapshot.session_generation !== sessionGenerationRef.current) {
        return null;
      }
      if (snapshot.server_id !== serverIdRef.current) {
        return null;
      }

      pendingSnapshotRef.current = null;

      // Update revision tracking
      if (snapshot.revision > lastRevisionRef.current) {
        lastRevisionRef.current = snapshot.revision;
      }

      // Update accumulated state. Reuse the shared backend-snapshot normalizer
      // so backend snapshots/events inject `torrent.hash` from the keyed map
      // before React consumes them — mirrors the normalization `mergeMaindata`
      // applies to renderer-fallback deltas and keeps the two paths from
      // drifting on torrent-hash injection.
      setAccumulatedMaindataState(normalizeBackendMaindata({
        rid: snapshot.rid,
        torrents: snapshot.maindata.torrents,
        categories: snapshot.maindata.categories,
        tags: snapshot.maindata.tags,
        server_state: snapshot.maindata.server_state,
      }));

      // Update health
      const health = convertRustHealth(snapshot.health);
      setSyncHealth(health);
      syncHealthRef.current = health;

      setIsError(false);
      setError(null);

      mark('maindata.first.merged');

      return snapshot;
    },
    [bridge, enabled, setAccumulatedMaindataState],
  );

  // ── Event handler: maindata-sync-changed ────────────────────────────────────
  const handleSyncChanged = useCallback(
    async (event: MaindataSyncChangedEvent) => {
      // Discard events from stale/other sessions
      if (event.session_generation !== sessionGenerationRef.current) return;
      if (event.server_id !== serverIdRef.current) return;

      // Update health immediately from event payload
      const eventHealth = convertRustHealth(event.health);
      setSyncHealth(eventHealth);
      syncHealthRef.current = eventHealth;

      // Discard events with revision we've already processed
      if (event.revision <= lastRevisionRef.current && event.revision > 0) return;

      // Process a new revision.
      if (event.revision > lastRevisionRef.current) {
        lastRevisionRef.current = event.revision;

        // ── Fast path: delta embedded in event ─────────────────────────
        // When Rust embeds the raw qBittorrent delta in the event payload
        // (under the 256KB size threshold), we can apply it directly and
        // skip the getMaindataSnapshot() IPC round-trip entirely.
        //
        // Falls through to the snapshot path when:
        //   - event.delta is null (Rust omitted the field — e.g., health
        //     transitions, suppressed events, or threshold dropouts), or
        //   - applyDeltaToState returns null because there is no current
        //     state to merge onto (initial bootstrap — the delta cannot
        //     reconstruct the full snapshot by itself).
        if (event.delta != null) {
          const mergedState = applyDeltaToState(
            maindataStateRef.current,
            event.delta,
            event.changed_resources,
            event.rid,
          );
          if (mergedState != null) {
            setAccumulatedMaindataState(mergedState);
            setIsError(false);
            setError(null);
            mark('maindata.delta.applied');
            return;
          }
        }

        // ── Slow path: fetch full snapshot ─────────────────────────────
        setIsFetching(true);

        try {
          await fetchSnapshot();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const current = syncHealthRef.current;
          const consecutiveErrorCount = current.consecutiveErrorCount + 1;
          const status: MaindataSyncHealthStatus =
            consecutiveErrorCount >= 2 ? 'retrying' : consecutiveErrorCount > 0 ? 'degraded' : 'healthy';
          const newHealth: MaindataSyncHealth = {
            status,
            consecutiveErrorCount,
            lastSuccessfulSyncAt: current.lastSuccessfulSyncAt,
            lastErrorAt: Date.now(),
            lastErrorMessage: errMsg,
          };
          setSyncHealth(newHealth);
          syncHealthRef.current = newHealth;
          setIsError(true);
          setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
          setIsFetching(false);
        }
      }
    },
    [fetchSnapshot, setAccumulatedMaindataState],
  );

  // ── Subscribe to sync-changed events and start/stop sync manager ─────────────
  useEffect(() => {
    if (!isConnected || serverId === null || !bridge || !enabled) return;

    // Capture serverId at effect registration time so cleanup always stops the
    // correct sync manager even after a server switch updates serverIdRef.
    const registeredServerId = serverId;

    // Subscribe to events
    const unsubscribe = bridge.addMaindataSyncListener(handleSyncChanged);

    // Start the Rust sync manager
    bridge.startMaindataSync().catch((err) => {
      logger.warn('startMaindataSync failed', { error: String(err) });
    });

    return () => {
      unsubscribe();
      if (registeredServerId) {
        bridge.stopMaindataSync(registeredServerId).catch(() => {
          // Ignore stop errors during unmount
        });
      }
    };
  }, [isConnected, serverId, handleSyncChanged, bridge, enabled]);

  // ── Initial snapshot fetch on mount ────────────────────────────────────────
  useEffect(() => {
    if (!isConnected || serverId === null || !bridge || !enabled) return;
    if (initialSnapshotFetchedRef.current) return;

    initialSnapshotFetchedRef.current = true;
    setIsLoading(true);

    bridge
      .getMaindataSnapshot()
      .then((snapshot) => {
        // Guard: discard stale session snapshots
        if (snapshot.session_generation !== sessionGenerationRef.current) return;
        if (snapshot.server_id !== serverIdRef.current) return;

        lastRevisionRef.current = snapshot.revision;
        // Reuse the shared backend-snapshot normalizer so the initial
        // snapshot writes hash-bearing torrents into React state on first
        // mount, matching the post-event refresh path above.
        setAccumulatedMaindataState(normalizeBackendMaindata({
          rid: snapshot.rid,
          torrents: snapshot.maindata.torrents,
          categories: snapshot.maindata.categories,
          tags: snapshot.maindata.tags,
          server_state: snapshot.maindata.server_state,
        }));

        const health = convertRustHealth(snapshot.health);
        setSyncHealth(health);
        syncHealthRef.current = health;
        setIsError(false);
        setError(null);
        mark('maindata.first.merged');
      })
      .catch((err) => {
        // Backend-owned sync has no inline renderer-poller fallback: a
        // failed initial snapshot surfaces as `isError` / degraded
        // `syncHealth` so the provider can decide whether to unmount the
        // backend hook and re-mount the renderer poller instead. The
        // previous `if (fallbackSyncFn && !initialSnapshotFetchedRef.current)`
        // branch was dead — the ref is set to `true` right above and the
        // body never called the fallback — so it has been removed.
        setIsError(true);
        setError(err instanceof Error ? err : new Error(String(err)));
        const errMsg = err instanceof Error ? err.message : String(err);
        setSyncHealth({
          status: 'degraded',
          consecutiveErrorCount: 1,
          lastSuccessfulSyncAt: null,
          lastErrorAt: Date.now(),
          lastErrorMessage: errMsg,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isConnected, serverId, bridge, enabled, setAccumulatedMaindataState]);

  // ── refetch ─────────────────────────────────────────────────────────────────
  const refetch = useCallback(async (): Promise<void> => {
    setIsFetching(true);
    try {
      const snapshot = await fetchSnapshot();
      if (snapshot === null) {
        // Stale — silently complete
        return;
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsFetching(false);
    }
  }, [fetchSnapshot]);

  return {
    maindataState,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    syncHealth,
  };
}
