/**
 * protectedRequestHealth tests
 *
 * Covers:
 * - isNetworkOrTimeoutError classification
 * - isProtectedResource / PROTECTED_RESOURCES coverage
 * - reportFailure increments counter and clears on success
 * - consecutive failure threshold (2) triggers degraded status
 * - scope isolation: serverId + sessionGeneration
 * - old-generation failures do not degrade current scope
 * - domain errors do not degrade health
 * - clearHealthStore resets state
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearHealthStore,
  getProtectedHealth,
  isNetworkOrTimeoutError,
  isProtectedRequestDegraded,
  isProtectedResource,
  reportProtectedFailure,
  reportProtectedSuccess,
} from '../protectedRequestHealth';

afterEach(() => {
  clearHealthStore();
});

// ─── isNetworkOrTimeoutError ───────────────────────────────────────────────────

describe('isNetworkOrTimeoutError', () => {
  it('returns false for null', () => {
    expect(isNetworkOrTimeoutError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isNetworkOrTimeoutError(undefined)).toBe(false);
  });

  it('returns false for normal Error messages', () => {
    expect(isNetworkOrTimeoutError(new Error('Torrent not found'))).toBe(false);
    expect(isNetworkOrTimeoutError(new Error('HTTP 404'))).toBe(false);
    expect(isNetworkOrTimeoutError(new Error('HTTP 400'))).toBe(false);
  });

  it('returns true for AbortError', () => {
    expect(isNetworkOrTimeoutError(new Error('Aborted'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('AbortError'))).toBe(true);
  });

  it('returns true for timeout messages', () => {
    expect(isNetworkOrTimeoutError(new Error('timeout'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('request timed out'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('Connection timed out'))).toBe(true);
  });

  it('returns true for network error messages', () => {
    expect(isNetworkOrTimeoutError(new Error('ECONNREFUSED'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('ENOTFOUND'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('Network Error'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('net::ERR_CONNECTION_REFUSED'))).toBe(true);
  });

  it('returns true for HTTP 5xx errors in message', () => {
    expect(isNetworkOrTimeoutError(new Error('HTTP 500 Internal Server Error'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('HTTP_503'))).toBe(true);
  });

  it('returns true for HTTP 408 / 429 in message', () => {
    expect(isNetworkOrTimeoutError(new Error('HTTP 408'))).toBe(true);
    expect(isNetworkOrTimeoutError(new Error('HTTP_429 Too Many Requests'))).toBe(true);
  });

  it('bounds HTTP status scanning to avoid expensive regex matching', () => {
    const longMessage = `http${'x'.repeat(10_000)}500`;
    expect(isNetworkOrTimeoutError(new Error(longMessage))).toBe(false);
    expect(isNetworkOrTimeoutError(new Error(`request failed: ${'x'.repeat(10_000)} HTTP 503`))).toBe(
      true,
    );
  });

  it('returns false for HTTP 4xx in message (except 408/429)', () => {
    expect(isNetworkOrTimeoutError(new Error('HTTP 401 Unauthorized'))).toBe(false);
    expect(isNetworkOrTimeoutError(new Error('HTTP 403 Forbidden'))).toBe(false);
    expect(isNetworkOrTimeoutError(new Error('HTTP 404 Not Found'))).toBe(false);
  });
});

// ─── isProtectedResource ─────────────────────────────────────────────────────

describe('isProtectedResource', () => {
  it('returns true for categories', () => {
    expect(isProtectedResource('categories')).toBe(true);
  });

  it('returns true for tags', () => {
    expect(isProtectedResource('tags')).toBe(true);
  });

  it('returns true for preferences', () => {
    expect(isProtectedResource('preferences')).toBe(true);
  });

  it('returns true for torrents', () => {
    expect(isProtectedResource('torrents')).toBe(true);
  });

  it('returns true for torrent-detail', () => {
    expect(isProtectedResource('torrent-detail')).toBe(true);
  });

  it('returns true for torrent-properties', () => {
    expect(isProtectedResource('torrent-properties')).toBe(true);
  });

  it('returns true for torrent-trackers', () => {
    expect(isProtectedResource('torrent-trackers')).toBe(true);
  });

  it('returns true for torrent-files', () => {
    expect(isProtectedResource('torrent-files')).toBe(true);
  });

  it('returns true for torrent-peers', () => {
    expect(isProtectedResource('torrent-peers')).toBe(true);
  });

  it('returns true for torrent-webseeds', () => {
    expect(isProtectedResource('torrent-webseeds')).toBe(true);
  });

  it('returns true for transfer', () => {
    expect(isProtectedResource('transfer')).toBe(true);
  });

  it('returns true for rss', () => {
    expect(isProtectedResource('rss')).toBe(true);
  });

  it('returns false for server-list (not a protected resource)', () => {
    expect(isProtectedResource('server-list')).toBe(false);
  });

  it('returns false for sync-maindata (polled separately)', () => {
    expect(isProtectedResource('sync-maindata')).toBe(false);
  });

  it('returns false for search (auxiliary)', () => {
    expect(isProtectedResource('search')).toBe(false);
  });
});

// ─── reportFailure / reportSuccess / scope isolation ─────────────────────────

describe('two protected request timeout/network failures for the same serverId + sessionGeneration produce degraded health', () => {
  it('produces degraded health after 2 consecutive network failures', () => {
    const key = ['torrent-properties', 'srv1', 1, 'abc123'];

    // First failure — not yet degraded
    reportProtectedFailure(key, new Error('ECONNREFUSED'));
    expect(getProtectedHealth('srv1:1')).toMatchObject({
      status: 'degraded',
      consecutiveErrorCount: 1,
    });
    expect(isProtectedRequestDegraded(getProtectedHealth('srv1:1'))).toBe(false);

    // Second consecutive failure — degraded
    reportProtectedFailure(key, new Error('timeout'));
    expect(getProtectedHealth('srv1:1')).toMatchObject({
      status: 'degraded',
      consecutiveErrorCount: 2,
    });
    expect(isProtectedRequestDegraded(getProtectedHealth('srv1:1'))).toBe(true);
  });

  it('maindata health can remain healthy while protected-request health is degraded', () => {
    // This is the core T77.5 regression scenario:
    // maindata polling is still healthy but torrent-properties request fails twice
    const key = ['torrent-files', 'srv1', 1, 'def456'];

    reportProtectedFailure(key, new Error('ECONNREFUSED'));
    reportProtectedFailure(key, new Error('ECONNREFUSED'));

    const health = getProtectedHealth('srv1:1');
    expect(health.status).toBe('degraded');
    expect(health.consecutiveErrorCount).toBe(2);
    // Maindata health is a separate signal — the test just verifies the protected
    // request health is degraded independently.
  });
});

describe('success for the same scope clears protected-request outage health', () => {
  it('single success clears all failure counts', () => {
    const key = ['torrent-properties', 'srv1', 1, 'abc123'];

    reportProtectedFailure(key, new Error('ECONNREFUSED'));
    reportProtectedFailure(key, new Error('timeout'));

    expect(getProtectedHealth('srv1:1').status).toBe('degraded');
    expect(getProtectedHealth('srv1:1').consecutiveErrorCount).toBe(2);

    // Success clears the entry entirely
    reportProtectedSuccess(key);
    expect(getProtectedHealth('srv1:1').status).toBe('idle');
    expect(getProtectedHealth('srv1:1').consecutiveErrorCount).toBe(0);
  });
});

describe('normal/domain errors and stale old-generation failures do not degrade the current scope', () => {
  it('domain errors (HTTP 404, application errors) do not increment failure count', () => {
    const key = ['torrent-properties', 'srv1', 1, 'abc123'];

    // These are domain errors, not network errors — should be ignored
    reportProtectedFailure(key, new Error('HTTP 404 Not Found'));
    reportProtectedFailure(key, new Error('Torrent not found'));
    reportProtectedFailure(key, new Error('HTTP 400 Bad Request'));

    const health = getProtectedHealth('srv1:1');
    // No network errors were counted — health stays idle
    expect(health.status).toBe('idle');
    expect(health.consecutiveErrorCount).toBe(0);
  });

  it('domain errors clear previous network failures so only consecutive network failures degrade', () => {
    const key = ['torrent-properties', 'srv1', 1, 'abc123'];

    reportProtectedFailure(key, new Error('ECONNREFUSED'));
    reportProtectedFailure(key, new Error('HTTP 404 Not Found'));
    reportProtectedFailure(key, new Error('timeout'));

    const health = getProtectedHealth('srv1:1');
    expect(health.status).toBe('degraded');
    expect(health.consecutiveErrorCount).toBe(1);
    expect(isProtectedRequestDegraded(health)).toBe(false);
  });

  it('returns stable snapshots while health has not changed', () => {
    const key = ['torrent-properties', 'srv1', 1, 'abc123'];

    expect(getProtectedHealth('srv1:1')).toBe(getProtectedHealth('srv1:1'));

    reportProtectedFailure(key, new Error('ECONNREFUSED'));
    const firstSnapshot = getProtectedHealth('srv1:1');
    expect(getProtectedHealth('srv1:1')).toBe(firstSnapshot);

    reportProtectedFailure(key, new Error('timeout'));
    expect(getProtectedHealth('srv1:1')).not.toBe(firstSnapshot);
  });

it('old sessionGeneration failures do not affect current generation', () => {
    const oldKey = ['torrent-properties', 'srv1', 0, 'abc123'];

    // Fail twice on the OLD generation
    reportProtectedFailure(oldKey, new Error('ECONNREFUSED'));
    reportProtectedFailure(oldKey, new Error('ECONNREFUSED'));

    // Old generation should be degraded
    expect(getProtectedHealth('srv1:0').status).toBe('degraded');

    // Current generation should be unaffected (idle)
    expect(getProtectedHealth('srv1:1').status).toBe('idle');
  });

  it('different serverId does not share failure state', () => {
    const key1 = ['torrent-properties', 'srv1', 1, 'abc123'];

    reportProtectedFailure(key1, new Error('ECONNREFUSED'));
    reportProtectedFailure(key1, new Error('ECONNREFUSED'));

    expect(getProtectedHealth('srv1:1').status).toBe('degraded');
    // srv2 should be unaffected
    expect(getProtectedHealth('srv2:1').status).toBe('idle');
  });

  it('different serverId does not share failure state', () => {
    const key1 = ['torrent-properties', 'srv1', 1, 'abc123'];

    reportProtectedFailure(key1, new Error('ECONNREFUSED'));
    reportProtectedFailure(key1, new Error('ECONNREFUSED'));

    expect(getProtectedHealth('srv1:1').status).toBe('degraded');
    // srv2 should be unaffected
    expect(getProtectedHealth('srv2:1').status).toBe('idle');
  });
});

describe('clearHealthStore resets all state', () => {
  it('clears all scope entries', () => {
    const key1 = ['torrent-properties', 'srv1', 1, 'abc123'];
    const key2 = ['torrent-files', 'srv2', 1, 'def456'];

    reportProtectedFailure(key1, new Error('ECONNREFUSED'));
    reportProtectedFailure(key1, new Error('ECONNREFUSED'));
    reportProtectedFailure(key2, new Error('timeout'));

    expect(getProtectedHealth('srv1:1').status).toBe('degraded');
    expect(getProtectedHealth('srv2:1').status).toBe('degraded');

    clearHealthStore();

    expect(getProtectedHealth('srv1:1').status).toBe('idle');
    expect(getProtectedHealth('srv2:1').status).toBe('idle');
  });
});

describe('isProtectedRequestDegraded', () => {
  it('returns false for idle status', () => {
    expect(isProtectedRequestDegraded({ status: 'idle', consecutiveErrorCount: 0, lastErrorAt: null, lastSuccessAt: null })).toBe(false);
  });

  it('returns false for healthy status', () => {
    expect(isProtectedRequestDegraded({ status: 'healthy', consecutiveErrorCount: 0, lastErrorAt: null, lastSuccessAt: Date.now() })).toBe(false);
  });

  it('returns true for degraded status', () => {
    expect(isProtectedRequestDegraded({ status: 'degraded', consecutiveErrorCount: 2, lastErrorAt: Date.now(), lastSuccessAt: null })).toBe(true);
  });
});
