// MaindataSyncProvider — isolated context for hot maindata sync state.
//
// Splits maindataState out of the broad QB client context so stable useQBClient
// consumers stop re-rendering every 500ms. Only components that actually need
// maindata sync state subscribe to this context.
//
// Architecture:
//   QBClientProvider (stable session/controller/capability/server metadata)
//         └── MaindataSyncProvider (backend-owned sync — maindataState only)
//
// Hot consumers (AppShell, DetailPanel) use useMaindataState() directly.
// Stable consumers (StatusBar, createTorrentWorkspaceController, etc.) continue
// to use useQBClient() and are not dragged into 500ms re-renders.
//
// Two sub-systems share the same provider data:
//   - useMaindataState()  — whole-context subscribe via useContext (legacy)
//   - useMaindataSelector — external-store selector subscribe (current fix)
//
// Backend-owned sync path:
//   The provider uses `useMaindataSyncBackend` as the sole sync source.
//   When `backendBridge` is provided, the Rust sync manager handles polling
//   cadence, backoff, overlap guard, and RID tracking. When absent, the
//   hook returns idle state.

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useMaindataSyncBackend, type MaindataSyncBridgeSurface, type MaindataSyncHealth } from './useMaindataSyncBackend';
import { type MaindataState, createEmptyMaindataState } from '@taurent/shared';
import {
  type ProtectedRequestHealth,
  buildScopeUid,
  useProtectedRequestHealth,
} from './protectedRequestHealth';

/**
 * Alias for the backend-owned sync bridge surface.
 * Compatible with `useMaindataSyncBackend`'s `MaindataSyncBridgeSurface`.
 */
export type MaindataSyncBackendBridge = MaindataSyncBridgeSurface;

export interface MaindataSyncScope {
  serverId: string | null;
  sessionGeneration: number;
  isConnected: boolean;
  isHydrated: boolean;
}

export interface MaindataStateScope {
  isConnected: boolean;
  isHydrated: boolean;
  maindataState: MaindataState | null;
}

export interface MaindataSyncContextValue {
  maindataState: MaindataState | null;
  isConnected: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  syncHealth: MaindataSyncHealth;
  /** Combined outage health: maindata sync + protected request failures */
  protectedRequestHealth: ProtectedRequestHealth;
}

const MaindataSyncContext = createContext<MaindataSyncContextValue | null>(null);
MaindataSyncContext.displayName = 'MaindataSyncContext';

/**
 * Stable store object passed to useSyncExternalStore-based selectors.
 * Exposed via a separate context so selector consumers subscribe to precise
 * snapshot changes rather than whole-context re-renders.
 *
 * The store object itself is stable for the provider's lifetime — getSnapshot
 * reads from a ref so its identity does not change when maindataState updates.
 */
interface MaindataSyncStore {
  getSnapshot: () => MaindataState | null;
  subscribe: (onStoreChange: () => void) => () => void;
}

/**
 * Safe empty shell used when the selector is called with null state
 * (provider not yet hydrated). Replaces the unsafe `{} as MaindataState` cast
 * with a properly typed sentinel that has valid defaults for all fields.
 */
const EMPTY_MAINDATA: MaindataState = Object.freeze(createEmptyMaindataState());

const MaindataSyncStoreContext = createContext<MaindataSyncStore | null>(null);
MaindataSyncStoreContext.displayName = 'MaindataSyncStoreContext';

export interface MaindataSyncProviderProps {
  /** @deprecated Children are passed as the 3rd argument to React.createElement, not here */
  children?: ReactNode;
  scope: MaindataSyncScope;
  /**
   * Backend-owned sync bridge — when provided, enables Rust-managed sync
   * via `useMaindataSyncBackend` as the sole sync source.
   * When absent, the provider returns idle state.
   */
  backendBridge?: MaindataSyncBackendBridge;
}

/**
 * Provides the accumulated maindata sync state in an isolated context.
 * Only re-renders when the merged maindataState reference actually changes,
 * insulating stable useQBClient consumers from polling-frequency churn.
 *
 * Sync is managed by the Rust backend via `useMaindataSyncBackend` — the
 * backend handles polling cadence, backoff, overlap guard, and RID tracking.
 *
 * Two context values are provided:
 *   - MaindataSyncContext      — whole-context value for useMaindataState()
 *   - MaindataSyncStoreContext — { getSnapshot, subscribe } for useMaindataSelector()
 */
export function MaindataSyncProvider({
  children,
  scope,
  backendBridge,
}: MaindataSyncProviderProps) {
  // Backend-owned sync path: sole sync source.
  // The backend hook manages startMaindataSync/stopMaindataSync lifecycle internally.
  // When backendBridge is absent, the hook returns idle state.
  const backendResult = useMaindataSyncBackend({
    scope: {
      isConnected: scope.isConnected,
      serverId: scope.serverId,
      sessionGeneration: scope.sessionGeneration,
    },
    bridge: backendBridge,
    enabled: true,
  });

  const maindataState = backendResult.maindataState ?? null;
  const isLoading = backendResult.isLoading;
  const isFetching = backendResult.isFetching;
  const isError = backendResult.isError;
  const error = backendResult.error;
  const refetch = backendResult.refetch;
  const syncHealth: MaindataSyncHealth = backendResult.syncHealth;

  // Derive protected-request health for the current scope via useSyncExternalStore
  // so the provider re-renders when protected request health changes (even if
  // the current scope hasn't changed — the health store may have changed).
  const scopeUid = scope.isConnected
    ? buildScopeUid(scope.serverId, scope.sessionGeneration)
    : null;
  const protectedRequestHealth = useProtectedRequestHealth(scopeUid);

  // Canonical context value — used by useMaindataState()
  const contextValue: MaindataSyncContextValue = {
    maindataState,
    isConnected: scope.isConnected,
    isHydrated: scope.isHydrated,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    syncHealth,
    protectedRequestHealth,
  };

  // Mutable set of selector subscriber callbacks.
  // Updated via Set.add / Set.delete (no ref "write during render" concern —
  // the ref itself is stable; only its contents mutates, which is allowed).
  const selectorSubscribersRef = useRef<Set<() => void>>(new Set());

  // Ref holding the latest maindataState — updated in useEffect so that
  // storeGetSnapshot always reads the fresh value while keeping its own
  // identity stable (no closure value in deps).
  const latestMaindataRef = useRef<MaindataState | null>(null);

  const storeSubscribe = useCallback((onStoreChange: () => void): (() => void) => {
    const subs = selectorSubscribersRef.current;
    subs.add(onStoreChange);
    return () => subs.delete(onStoreChange);
  }, []);

  // getSnapshot reads from the ref — its identity never changes even when
  // maindataState updates, so the store object stays referentially stable.
  const storeGetSnapshot = useCallback((): MaindataState | null => latestMaindataRef.current, []);

  // When new data arrives, update the ref and notify all selector subscribers.
  // useEffect runs after the commit phase — safe from the setState-during-render warning.
  useEffect(() => {
    latestMaindataRef.current = maindataState;
  }, [maindataState]);

  const storeNotify = useCallback(() => {
    selectorSubscribersRef.current.forEach((cb) => cb());
  }, []);

  // Notify selector subscribers whenever the effective snapshot changes,
  // including transitions to null (disconnect / reset). Track the previous
  // snapshot value in a ref to avoid ordering/initialization concerns.
  const prevSnapshotRef = useRef<MaindataState | null | undefined>(undefined);
  useEffect(() => {
    const snapshot = maindataState;
    if (!Object.is(snapshot, prevSnapshotRef.current)) {
      prevSnapshotRef.current = snapshot;
      storeNotify();
    }
  }, [maindataState, storeNotify]);

  const store: MaindataSyncStore = useMemo(
    () => ({ getSnapshot: storeGetSnapshot, subscribe: storeSubscribe }),
    [storeSubscribe, storeGetSnapshot],
  );

  return (
    <MaindataSyncContext.Provider value={contextValue}>
      <MaindataSyncStoreContext.Provider value={store}>
        {children}
      </MaindataSyncStoreContext.Provider>
    </MaindataSyncContext.Provider>
  );
}

/**
 * Subscribe to the hot maindata sync state.
 *
 * Use this instead of reading maindataState from useQBClient() — it only
 * re-renders when the accumulated state reference changes, preventing 500ms
 * churn from propagating to stable session consumers.
 *
 * @throws Error if used outside MaindataSyncProvider
 */
export function useMaindataState(): MaindataSyncContextValue {
  const context = useContext(MaindataSyncContext);
  if (!context) {
    throw new Error('useMaindataState must be used within MaindataSyncProvider');
  }
  return context;
}

/**
 * Subscribe to a selected slice of the hot maindata sync state.
 *
 * Only re-renders when the selected slice is referentially unchanged.
 * Uses useSyncExternalStore with an internal selector comparison so React
 * knows when to skip a re-render (same reference = no render).
 *
 * Selector functions must be stable — either defined outside the component
 * or wrapped in useCallback. Passing an inline arrow function on every render
 * will cause unnecessary re-renders.
 *
 * @example
 * // Only rerenders when the "my-cat" category changes
 * const cat = useMaindataSelector((s) => s.categories?.['my-cat']);
 *
 * @example
 * // Only rerenders when the torrents map reference changes
 * const torrents = useMaindataSelector((s) => s.torrents);
 *
 * @throws Error if used outside MaindataSyncProvider
 */
export function useMaindataSelector<T>(selector: (state: MaindataState) => T): T {
  const store = useContext(MaindataSyncStoreContext);
  if (!store) {
    throw new Error('useMaindataSelector must be used within MaindataSyncProvider');
  }

  return useSyncExternalStoreWithSelector(store.subscribe, store.getSnapshot, selector);
}

/* eslint-disable react-hooks/refs -- sanctioned useSyncExternalStore initialisation pattern */
/**
 * useSyncExternalStore-based selector subscription.
 *
 * Follows the React docs "selector-based subscriptions" pattern:
 *   https://react.dev/reference/react/useSyncExternalStore#selecting-a-specific-state-slice
 *
 * subscribeWithSelector calls onStoreChange only when the selected value actually
 * changed (Object.is comparison), preventing unnecessary re-renders.
 *
 * The ref writes during render (latestSelector, latestValueRef) are the sanctioned
 * useSyncExternalStore initialisation pattern documented by React — the store API
 * requires a snapshot to be available synchronously on first call.
 */
function useSyncExternalStoreWithSelector<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => MaindataState | null,
  selector: (state: MaindataState) => T,
): T {
  // Latest selector — updated on every render; used in the subscription
  // callback (runs outside render so safe) and for the first synchronisation.
  const latestSelector = useRef(selector);
  latestSelector.current = selector;

  // Refs for tracking pending updates and the last selected value.
  // These are only written from the subscription callback (outside render).
  const pendingRef = useRef(false);
  const latestValueRef = useRef<T | undefined>(undefined);

  const getSelected = useCallback((): T => {
    const snap = getSnapshot();
    if (snap === null) {
      // Null state: apply selector to EMPTY_MAINDATA so callers receive T
      // (not T | null). Callers that need null-aware behaviour must guard
      // at the call site.
      return latestSelector.current(EMPTY_MAINDATA);
    }
    return latestSelector.current(snap);
  }, [getSnapshot]);

  const subscribeWithSelector = useCallback(
    (onStoreChange: () => void) => {
      return subscribe(() => {
        pendingRef.current = true;
        const next = getSelected();
        pendingRef.current = false;
        if (!Object.is(next, latestValueRef.current)) {
          latestValueRef.current = next;
          onStoreChange();
        }
      });
    },
    [subscribe, getSelected],
  );

  const getServerSnapshot = useCallback((): T => getSelected(), [getSelected]);

  // Synchronous initialisation — call getSnapshot() during render to obtain
  // the first selected value. This is the sanctioned pattern; no ref write.
  const initialValue = getSelected();
  if (!pendingRef.current) {
    latestValueRef.current = initialValue;
  }

  return useSyncExternalStore(subscribeWithSelector, getSelected, getServerSnapshot);
}
