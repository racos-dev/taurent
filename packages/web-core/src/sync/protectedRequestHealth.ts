// protectedRequestHealth — shared connected-server outage health signal for
// non-maindata qBittorrent API requests.
//
// Problem: when qBittorrent at localhost:8080 disconnects, protected endpoint
// requests (/api/v2/torrents/files, /api/v2/torrents/properties, etc.) time out,
// but the connected-server unavailable overlay only consumed maindata polling
// health and stayed hidden.
//
// Solution: a small external-store module that tracks consecutive failures for
// protected queries, scoped by serverId + sessionGeneration so stale in-flight
// failures from old sessions cannot poison the current server.
//
// Architecture:
//   React Query cache callbacks (onError/onSuccess)
//     → protectedRequestHealth.reportFailure / reportSuccess()
//     → health store (Map<scopeUid, HealthEntry>)
//     → useProtectedRequestHealth() hook / isProtectedRequestDegraded() helper
//     → MaindataSyncProvider/useMaindataState — combined with maindata sync health
//     → ConnectedServerUnavailableOverlay
//
// Key design constraints (from subtask):
//   - Count only network/timeout/unreachable-style failures (net errors)
//   - Do not count normal domain/API errors (missing torrent data, etc.)
//   - Reset on success for same scope, maindata success, disconnect,
//     or server/session-generation changes
//   - Threshold: 2 consecutive failures → degraded
//   - Scope isolation: serverId + sessionGeneration prevents cross-contamination

import { type QueryKey } from '@tanstack/react-query';
import { RESOURCE } from '../query/keys';
import { useSyncExternalStore } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProtectedRequestHealthStatus = 'idle' | 'healthy' | 'degraded';

/**
 * Shared sync-health model for protected non-maindata qBittorrent API requests.
 * Surfaced through MaindataSyncProvider / useMaindataState().protectedRequestHealth
 *
 * Status transitions (THRESHOLD = 2):
 *   idle → healthy (first success or any protected request success)
 *   idle → degraded (1+ consecutive network errors)
 *   degraded → idle (any protected request success)
 *   Any scope/disconnect → idle (stale failures from old scope are discarded)
 *
 * Note: unlike maindata sync which distinguishes degraded (below threshold) from
 * retrying (at threshold), protected request health uses a single degraded state
 * at the THRESHOLD=2 level since any protected endpoint failure already indicates
 * the server is unreachable.
 */
export interface ProtectedRequestHealth {
  status: ProtectedRequestHealthStatus;
  consecutiveErrorCount: number;
  lastErrorAt: number | null;
  lastSuccessAt: number | null;
}

const IDLE_PROTECTED_REQUEST_HEALTH: ProtectedRequestHealth = Object.freeze({
  status: 'idle',
  consecutiveErrorCount: 0,
  lastErrorAt: null,
  lastSuccessAt: null,
});

// ─── Protected resource classification ───────────────────────────────────────

/**
 * Resources considered "protected" — their failures indicate a
 * connected-server outage rather than a normal domain/API error.
 *
 * Excludes: server-list, user-data, sync-maindata (polled separately),
 * search (auxiliary), and any non-qBittorrent resources.
 *
 * Key shape: [resource, serverId, sessionGeneration, ...detail]
 */
export const PROTECTED_RESOURCES = new Set<string>([
  RESOURCE.CATEGORIES,
  RESOURCE.TAGS,
  RESOURCE.PREFERENCES,
  RESOURCE.TORRENTS,
  RESOURCE.TORRENT_DETAIL,
  RESOURCE.TORRENT_PROPERTIES,
  RESOURCE.TORRENT_TRACKERS,
  RESOURCE.TORRENT_FILES,
  RESOURCE.TORRENT_PEERS,
  RESOURCE.TORRENT_WEBSEEDS,
  RESOURCE.TRANSFER,
  RESOURCE.RSS,
] as const satisfies readonly string[]);

export function isProtectedResource(resource: string): boolean {
  return PROTECTED_RESOURCES.has(resource);
}

// ─── Error classification ─────────────────────────────────────────────────────

/**
 * Returns true when the error is a network/timeout/unreachable-style failure
 * that indicates the server is unavailable, not a normal domain/API error.
 *
 * Excludes:
 *   - HTTP 4xx (except 408 timeout, 429 too many requests)
 *   - Application-level errors (auth failures, missing torrents, etc.)
 *   - null / undefined errors
 *
 * Includes:
 *   - Network errors (ECONNREFUSED, ENOTFOUND, etc.)
 *   - Timeout errors (AbortError, ETIMEDOUT)
 *   - HTTP 5xx
 *   - 408, 429 (server overloaded)
 *   - Generic fetch failures where we can't determine the type
 */
export function isNetworkOrTimeoutError(error: unknown): boolean {
  if (error == null) return false;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // AbortError / timeout
    if (msg === 'aborted' || msg === 'aborterror') return true;

    // Timeout indicators
    if (msg.includes('timeout') || msg.includes('timed out')) return true;

    // Network error indicators
    if (
      msg.includes('econnrefused') ||
      msg.includes('enetunreach') ||
      msg.includes('enotfound') ||
      msg.includes('socket') ||
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('network error') ||
      msg.includes('net::err')
    ) {
      return true;
    }

    // Check for HTTP status in the error message, e.g. "HTTP 500", "HTTP_500",
    // or "HTTP 503". Keep the scan bounded to avoid regex backtracking on
    // untrusted transport/library messages.
    const httpIndex = msg.indexOf('http');
    if (httpIndex !== -1) {
      const httpContext = msg.slice(httpIndex, httpIndex + 80);
      const status = firstThreeDigitNumber(httpContext);
      if (status !== null && (status >= 500 || status === 408 || status === 429)) {
        return true;
      }
    }
  }

  return false;
}

function firstThreeDigitNumber(value: string): number | null {
  for (let index = 0; index <= value.length - 3; index += 1) {
    const first = value.charCodeAt(index);
    const second = value.charCodeAt(index + 1);
    const third = value.charCodeAt(index + 2);

    if (isAsciiDigit(first) && isAsciiDigit(second) && isAsciiDigit(third)) {
      return Number(value.slice(index, index + 3));
    }
  }

  return null;
}

function isAsciiDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

// ─── Health store ─────────────────────────────────────────────────────────────

interface HealthEntry {
  consecutiveErrors: number;
  lastErrorAt: number | null;
  lastSuccessAt: number | null;
  snapshot: ProtectedRequestHealth;
}

// Module-level store. In production web-core this lives on the module singleton;
// in tests it can be reset via clearHealthStore().
const healthStore = new Map<string, HealthEntry>();

const THRESHOLD = 2;

// ─── Subscriber system ────────────────────────────────────────────────────────

// Notifies React consumers when any scope's health changes.
// reportProtectedFailure / reportProtectedSuccess / clearHealthForScope call
// this after mutating the store so useProtectedRequestHealth picks up the new value.
type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

/** Call after any health store mutation to notify React consumers. */
function notifySubscribers(): void {
  subscribers.forEach((cb) => cb());
}

/** Add a subscriber. Returns an unsubscribe function. */
export function subscribeToProtectedHealth(cb: Subscriber): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/**
 * Derive the scope UID from a canonical query key array.
 * Key shape: [resource, serverId, sessionGeneration, ...detail]
 */
function scopeUidFromKey(key: QueryKey): string | null {
  if (!Array.isArray(key) || key.length < 3) return null;
  const serverId = key[1];
  const sessionGeneration = key[2];
  if (typeof serverId !== 'string') return null;
  if (typeof sessionGeneration !== 'number') return null;
  return `${serverId}:${sessionGeneration}`;
}

/** Clear the entire health store (for testing) */
export function clearHealthStore(): void {
  const hadEntries = healthStore.size > 0;
  healthStore.clear();
  if (hadEntries) notifySubscribers();
}

// ─── Report functions (called from React Query cache callbacks) ───────────────

/**
 * Report a protected request failure.
 *
 * Only counts the failure if:
 *   1. The resource is a protected resource
 *   2. The error is a network/timeout/unreachable-style error
 *
 * Silently ignores non-protected resources and domain errors to avoid
 * false positives from normal "not found" responses.
 */
export function reportProtectedFailure(queryKey: QueryKey, error: unknown): void {
  const uid = scopeUidFromKey(queryKey);
  if (!uid) return;

  const resource = Array.isArray(queryKey) ? (queryKey[0] as string) : null;
  if (!resource || !isProtectedResource(resource)) return;

  if (!isNetworkOrTimeoutError(error)) {
    const hadEntry = healthStore.has(uid);
    healthStore.delete(uid);
    if (hadEntry) notifySubscribers();
    return;
  }

  const entry = healthStore.get(uid) ?? {
    consecutiveErrors: 0,
    lastErrorAt: null,
    lastSuccessAt: null,
    snapshot: IDLE_PROTECTED_REQUEST_HEALTH,
  };

  entry.consecutiveErrors += 1;
  entry.lastErrorAt = Date.now();
  // Do NOT clear lastSuccessAt on failure. This timestamp is consumed by
  // buildProtectedHealthSnapshot(entry) when deriving status, and stale failures
  // from prior connections are primarily isolated by scopeUidFromKey()
  // (serverId + sessionGeneration scoping).

  entry.snapshot = buildProtectedHealthSnapshot(entry);
  healthStore.set(uid, entry);
  notifySubscribers();
}

/**
 * Report a protected request success.
 *
 * Resets the failure counter for this scope so that a single success
 * clears the degraded state (consistent with maindata sync behavior).
 *
 * Also resets on non-protected resources since a success in any request
 * means the server is reachable.
 */
export function reportProtectedSuccess(queryKey: QueryKey): void {
  const uid = scopeUidFromKey(queryKey);
  if (!uid) return;

  // Clear the health entry on any protected resource success.
  // This ensures that a success for a different protected resource (not the
  // one that failed) still clears the outage state.
  const hadEntry = healthStore.has(uid);
  healthStore.delete(uid);
  if (hadEntry) notifySubscribers();
}

/** Clear health for a specific scope UID (on disconnect/session change) */
export function clearHealthForScope(scopeUid: string): void {
  const hadEntry = healthStore.has(scopeUid);
  healthStore.delete(scopeUid);
  if (hadEntry) notifySubscribers();
}

// ─── Derived health ───────────────────────────────────────────────────────────

function buildProtectedHealthSnapshot(entry: HealthEntry): ProtectedRequestHealth {
  if (entry.consecutiveErrors === 0) {
    return {
      status: 'healthy',
      consecutiveErrorCount: 0,
      lastErrorAt: entry.lastErrorAt,
      lastSuccessAt: entry.lastSuccessAt,
    };
  }

  return {
    status: 'degraded',
    consecutiveErrorCount: entry.consecutiveErrors,
    lastErrorAt: entry.lastErrorAt,
    lastSuccessAt: entry.lastSuccessAt,
  };
}

/**
 * Returns the health for the given scope UID.
 */
export function getProtectedHealth(scopeUid: string): ProtectedRequestHealth {
  const entry = healthStore.get(scopeUid);
  if (!entry) {
    return IDLE_PROTECTED_REQUEST_HEALTH;
  }
  return entry.snapshot;
}

/**
 * Build the scope UID from serverId + sessionGeneration.
 * Use this for hook consumers to derive the current scope.
 */
export function buildScopeUid(serverId: string | null, sessionGeneration: number): string | null {
  if (serverId === null) return null;
  return `${serverId}:${sessionGeneration}`;
}

/**
 * Returns true when the protected request health status indicates the
 * connected-server unavailable overlay should be shown.
 *
 * Mirrors the isMaindataSyncDegraded() threshold: both use 2 consecutive
 * failures as the boundary between degraded/below-threshold and
 * retrying/above-threshold states.
 *
 * One-error degraded is below threshold (below-threshold degraded helper
 * returns false); two-error degraded is at/above threshold.
 */
export function isProtectedRequestDegraded(health: ProtectedRequestHealth): boolean {
  return health.consecutiveErrorCount >= THRESHOLD;
}

// ─── React hook ────────────────────────────────────────────────────────────────

/**
 * Returns the current protected request health for the given scope.
 * Re-renders whenever any protected request health changes (including for
 * other scopes) — callers who scope by serverId:sessionGeneration are
 * naturally insulated from stale cross-scope health.
 *
 * Used internally by MaindataSyncProvider; exposed publicly for any consumer
 * that needs to subscribe to the protected-request outage signal.
 */
export function useProtectedRequestHealth(scopeUid: string | null): ProtectedRequestHealth {
  return useSyncExternalStore(
    subscribeToProtectedHealth,
    () => (scopeUid === null ? IDLE_PROTECTED_REQUEST_HEALTH : getProtectedHealth(scopeUid)),
    () => (scopeUid === null ? IDLE_PROTECTED_REQUEST_HEALTH : getProtectedHealth(scopeUid)),
  );
}
