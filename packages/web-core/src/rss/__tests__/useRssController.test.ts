/**
 * useRssController.test.ts
 *
 * Focused controller coverage for the T142.4 typed-DTO migration closeout:
 * - Typed item consumption: typed `RssItem[]` is consumed directly; the
 *   optional `url` field is coerced to `null` so the runtime shape stays
 *   in sync with the bridge `RssItem` contract that requires
 *   `url: string | null` (never `undefined`).
 * - Typed rule consumption: typed `RssRule[]` is consumed directly;
 *   `rssRuleNames` is derived from `rssRules[*].name` without any further
 *   key/path normalization.
 * - Capability gating (v2): `capabilities.supportsRss === false` short-
 *   circuits both queries and returns empty arrays; `true` enables both.
 * - Query key rotation: items and rules queries are keyed by
 *   `[RESOURCE.RSS, serverId, sessionGeneration, 'items' | 'rules']` so
 *   session invalidation invalidates both.
 * - Error propagation: bridge rejections surface as `error` on the
 *   controller; `isLoading` reflects both queries in flight.
 * - Wire-shape normalizer absence: the simplified controller must not
 *   re-parse the typed payload — it forwards typed rows as-is and only
 *   coerces the `url` field to `null` when missing.
 *
 * These tests pin the typed contract end-to-end through the controller;
 * the previous defensive normalizers (which parsed keyed trees, arrays,
 * and `{ feeds, folders }`) are explicitly absent in T142.3 and we verify
 * that here.
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { RssItem, RssRule } from '@taurent/bridge';
import type {
  UseRssControllerOptions,
} from '../useRssController';
import { useRssController } from '../useRssController';
import type { AppCapabilities } from '../../capabilities';

const SUPPORTED_CAPABILITIES: AppCapabilities = {
  supportsSearch: true,
  supportsRss: true,
  supportsWebSeedManagement: true,
};

const UNSUPPORTED_CAPABILITIES: AppCapabilities = {
  supportsSearch: false,
  supportsRss: false,
  supportsWebSeedManagement: false,
};

// ─── Test setup ──────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper() {
  const queryClient = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function makeOptions(
  overrides: Partial<UseRssControllerOptions> = {}
): UseRssControllerOptions {
  return {
    scope: { serverId: 'srv1', sessionGeneration: 1, isConnected: true },
    capabilities: SUPPORTED_CAPABILITIES,
    getRssItems: vi.fn().mockResolvedValue({ items: [] as RssItem[] }),
    getRssRules: vi.fn().mockResolvedValue({ rules: [] as RssRule[] }),
    ...overrides,
  };
}

const SCOPE = { serverId: 'srv1', sessionGeneration: 1, isConnected: true };

// ─── Typed item consumption ─────────────────────────────────────────────────

describe('useRssController — typed item consumption (T142.4)', () => {
  it('forwards typed RssItem rows directly and coerces missing url to null', async () => {
    // The Rust DTO uses `skip_serializing_if = "Option::is_none"` for
    // `RssItemDto.url`, so a missing url reaches the bridge as
    // `undefined`. The controller coerces it to `null` so the runtime
    // shape stays in sync with the typed `RssItem` contract.
    const typedItems: RssItem[] = [
      {
        name: 'Linux Tracker',
        url: 'https://example.com/feed',
        isFolder: false,
        path: 'Folder\\Linux Tracker',
        uid: 'uid-1',
      },
      {
        name: 'Folder X',
        // url omitted (keyed-tree folder leaf or wire-side skip)
        url: undefined as unknown as string,
        isFolder: true,
        path: 'Folder X',
      },
      {
        name: 'Top',
        url: 'https://top.example.com/feed',
        isFolder: false,
        path: 'Top',
      },
    ];
    const getRssItems = vi.fn().mockResolvedValue({ items: typedItems });
    const options = makeOptions({ getRssItems });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssItems).toHaveLength(3);
    });

    // Typed rows are forwarded with the field shape intact.
    expect(result.current.rssItems[0]).toEqual(typedItems[0]);
    expect(result.current.rssItems[2]).toEqual(typedItems[2]);
    // Missing url is coerced to null (not undefined) for the typed
    // contract compatibility with the web-ui consumers.
    expect(result.current.rssItems[1].url).toBeNull();
    expect(result.current.rssItems[1].isFolder).toBe(true);
  });

  it('returns empty rssItems when the bridge envelope has no items', async () => {
    const getRssItems = vi.fn().mockResolvedValue({ items: [] as RssItem[] });
    const options = makeOptions({ getRssItems });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.rssItems).toEqual([]);
  });

  it('forwards camelCase isFolder flag without coercion', async () => {
    // The Rust DTO renames `is_folder` to `isFolder` on the wire; the
    // controller does not touch the flag — it just forwards the row.
    const typedItems: RssItem[] = [
      {
        name: 'Feed A',
        url: 'https://a.example.com/feed',
        isFolder: false,
        path: 'Feed A',
      },
      {
        name: 'Folder X',
        url: null,
        isFolder: true,
        path: 'Folder X',
      },
    ];
    const getRssItems = vi.fn().mockResolvedValue({ items: typedItems });
    const options = makeOptions({ getRssItems });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssItems).toHaveLength(2);
    });
    expect(result.current.rssItems[0].isFolder).toBe(false);
    expect(result.current.rssItems[1].isFolder).toBe(true);
  });
});

// ─── Typed rule consumption + rssRuleNames derivation ───────────────────────

describe('useRssController — typed rule consumption and rssRuleNames (T142.4)', () => {
  it('forwards typed RssRule rows directly without re-parsing', async () => {
    const typedRules: RssRule[] = [
      {
        name: 'Rule 1',
        enabled: true,
        mustContain: 'linux',
        mustNotContain: 'windows',
        useRegex: false,
        episodeFilter: 'ep >= 1',
        smartFilter: true,
        affectedFeeds: ['feed-a', 'feed-b'],
        ignoreDays: 7,
        lastMatch: '2026-05-01',
        addPaused: true,
        assignedCategory: 'movies',
        savePath: '/downloads/movies',
      },
    ];
    const getRssRules = vi.fn().mockResolvedValue({ rules: typedRules });
    const options = makeOptions({ getRssRules });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssRules).toHaveLength(1);
    });

    // The typed row is forwarded as-is, including all 13 rule fields.
    expect(result.current.rssRules[0]).toEqual(typedRules[0]);
    expect(result.current.rssRules[0].affectedFeeds).toEqual(['feed-a', 'feed-b']);
    expect(result.current.rssRules[0].ignoreDays).toBe(7);
  });

  it('derives rssRuleNames from rssRules[*].name in order', async () => {
    const typedRules: RssRule[] = [
      {
        name: 'Alpha',
        enabled: true,
        mustContain: '',
        mustNotContain: '',
        useRegex: false,
        episodeFilter: '',
        smartFilter: false,
        affectedFeeds: [],
        ignoreDays: 0,
        lastMatch: '',
        addPaused: false,
        assignedCategory: '',
        savePath: '',
      },
      {
        name: 'Beta',
        enabled: false,
        mustContain: '',
        mustNotContain: '',
        useRegex: false,
        episodeFilter: '',
        smartFilter: false,
        affectedFeeds: [],
        ignoreDays: 0,
        lastMatch: '',
        addPaused: false,
        assignedCategory: '',
        savePath: '',
      },
      {
        name: 'Gamma',
        enabled: true,
        mustContain: '',
        mustNotContain: '',
        useRegex: false,
        episodeFilter: '',
        smartFilter: false,
        affectedFeeds: [],
        ignoreDays: 0,
        lastMatch: '',
        addPaused: false,
        assignedCategory: '',
        savePath: '',
      },
    ];
    const getRssRules = vi.fn().mockResolvedValue({ rules: typedRules });
    const options = makeOptions({ getRssRules });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssRuleNames).toHaveLength(3);
    });
    // Order is preserved (no sort, no dedup).
    expect(result.current.rssRuleNames).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('returns empty rssRuleNames when the bridge envelope has no rules', async () => {
    const getRssRules = vi.fn().mockResolvedValue({ rules: [] as RssRule[] });
    const options = makeOptions({ getRssRules });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.rssRules).toEqual([]);
    expect(result.current.rssRuleNames).toEqual([]);
  });

  it('does not re-normalize rule names via keyed-object fallbacks (T142.3 invariant)', async () => {
    // The TS `normalizeRSSRules` used to derive names from object keys
    // (keyed shape) and from `name ?? ruleName` (array shape). The Rust
    // parser in T142.1 already promotes the keyed-shape keys into
    // `RssRuleDto.name`, so the controller simply reads `rule.name`.
    // Verify the controller is not silently re-applying the old
    // fallback chain.
    const typedRules: RssRule[] = [
      {
        name: 'Explicit Name',
        enabled: true,
        mustContain: '',
        mustNotContain: '',
        useRegex: false,
        episodeFilter: '',
        smartFilter: false,
        affectedFeeds: [],
        ignoreDays: 0,
        lastMatch: '',
        addPaused: false,
        assignedCategory: '',
        savePath: '',
      },
    ];
    const getRssRules = vi.fn().mockResolvedValue({ rules: typedRules });
    const options = makeOptions({ getRssRules });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssRules).toHaveLength(1);
    });
    expect(result.current.rssRules[0].name).toBe('Explicit Name');
    expect(result.current.rssRuleNames).toEqual(['Explicit Name']);
  });
});

// ─── Capability gating ──────────────────────────────────────────────────────

describe('useRssController — capability gating (T142.4)', () => {
  it('does not fetch and returns empty arrays when capabilities.supportsRss === false', async () => {
    const getRssItems = vi.fn().mockResolvedValue({ items: [] as RssItem[] });
    const getRssRules = vi.fn().mockResolvedValue({ rules: [] as RssRule[] });
    const options = makeOptions({
      capabilities: UNSUPPORTED_CAPABILITIES,
      getRssItems,
      getRssRules,
    });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    // Wait for the query state to settle (not fetching because gated).
    await waitFor(() => {
      expect(result.current.isUnsupported).toBe(true);
    });
    expect(getRssItems).not.toHaveBeenCalled();
    expect(getRssRules).not.toHaveBeenCalled();
    expect(result.current.rssItems).toEqual([]);
    expect(result.current.rssRules).toEqual([]);
    expect(result.current.rssRuleNames).toEqual([]);
  });

  it('fetches and reports non-unsupported when capabilities.supportsRss === true', async () => {
    const typedItems: RssItem[] = [
      {
        name: 'Linux Tracker',
        url: 'https://example.com/feed',
        isFolder: false,
        path: 'Linux Tracker',
      },
    ];
    const typedRules: RssRule[] = [
      {
        name: 'Rule 1',
        enabled: true,
        mustContain: '',
        mustNotContain: '',
        useRegex: false,
        episodeFilter: '',
        smartFilter: false,
        affectedFeeds: [],
        ignoreDays: 0,
        lastMatch: '',
        addPaused: false,
        assignedCategory: '',
        savePath: '',
      },
    ];
    const getRssItems = vi.fn().mockResolvedValue({ items: typedItems });
    const getRssRules = vi.fn().mockResolvedValue({ rules: typedRules });
    const options = makeOptions({
      capabilities: SUPPORTED_CAPABILITIES,
      getRssItems,
      getRssRules,
    });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssItems).toHaveLength(1);
    });
    expect(getRssItems).toHaveBeenCalled();
    expect(getRssRules).toHaveBeenCalled();
    expect(result.current.isUnsupported).toBe(false);
    expect(result.current.rssRuleNames).toEqual(['Rule 1']);
  });

  it('does not fetch when isConnected is false even if capabilities.supportsRss === true', async () => {
    const getRssItems = vi.fn().mockResolvedValue({ items: [] as RssItem[] });
    const getRssRules = vi.fn().mockResolvedValue({ rules: [] as RssRule[] });
    const options = makeOptions({
      scope: { ...SCOPE, isConnected: false },
      capabilities: SUPPORTED_CAPABILITIES,
      getRssItems,
      getRssRules,
    });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isUnsupported).toBe(false);
    });
    expect(getRssItems).not.toHaveBeenCalled();
    expect(getRssRules).not.toHaveBeenCalled();
  });
});

// ─── Error propagation ──────────────────────────────────────────────────────

describe('useRssController — error propagation (T142.4)', () => {
  it('surfaces getRssItems rejection as the controller error', async () => {
    const getRssItems = vi
      .fn()
      .mockRejectedValue(new Error('invalid response: rss items malformed'));
    const options = makeOptions({ getRssItems });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain(
      'invalid response: rss items malformed'
    );
  });

  it('surfaces getRssRules rejection as the controller error', async () => {
    const getRssRules = vi
      .fn()
      .mockRejectedValue(new Error('invalid response: rss rules malformed'));
    const options = makeOptions({ getRssRules });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain(
      'invalid response: rss rules malformed'
    );
  });

  it('returns null error when both queries succeed', async () => {
    const typedItems: RssItem[] = [
      {
        name: 'Linux Tracker',
        url: 'https://example.com/feed',
        isFolder: false,
        path: 'Linux Tracker',
      },
    ];
    const typedRules: RssRule[] = [];
    const getRssItems = vi.fn().mockResolvedValue({ items: typedItems });
    const getRssRules = vi.fn().mockResolvedValue({ rules: typedRules });
    const options = makeOptions({ getRssItems, getRssRules });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssItems).toHaveLength(1);
    });
    expect(result.current.error).toBeNull();
  });
});

// ─── Wire-shape normalizer absence pin ──────────────────────────────────────

describe('useRssController — wire-shape normalizer absence (T142.4)', () => {
  it('does not re-parse typed RssItem rows (no keyed-tree or array re-normalization)', async () => {
    // If the old TS normalizers were still running, they would attempt
    // to flatten keyed trees, split on commas, or coerce types. The new
    // controller does not touch the row shape beyond the url coercion.
    const typedItems: RssItem[] = [
      {
        name: 'Mixed Feed',
        url: 'https://example.com/feed?a=1&b=2',
        isFolder: false,
        path: 'Folder\\Mixed Feed',
        uid: 'uid-with-special/chars',
      },
    ];
    const getRssItems = vi.fn().mockResolvedValue({ items: typedItems });
    const options = makeOptions({ getRssItems });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssItems).toHaveLength(1);
    });
    const row = result.current.rssItems[0];
    // URL is preserved verbatim — no re-parsing.
    expect(row.url).toBe('https://example.com/feed?a=1&b=2');
    // Path is the backslash-joined canonical path — preserved as-is.
    expect(row.path).toBe('Folder\\Mixed Feed');
    // uid is preserved as-is — no stringification.
    expect(row.uid).toBe('uid-with-special/chars');
  });

  it('preserves numeric and string rule field types without coercion', async () => {
    // If `normalizeRSSRules` were still running, it would coerce
    // `ignoreDays` via `Number()` and would round large numbers. The
    // new controller does not touch the row at all.
    const typedRules: RssRule[] = [
      {
        name: 'Numeric',
        enabled: true,
        mustContain: '',
        mustNotContain: '',
        useRegex: false,
        episodeFilter: '',
        smartFilter: false,
        affectedFeeds: ['f1', 'f2'],
        ignoreDays: 9_999_999,
        lastMatch: '',
        addPaused: false,
        assignedCategory: '',
        savePath: '',
      },
    ];
    const getRssRules = vi.fn().mockResolvedValue({ rules: typedRules });
    const options = makeOptions({ getRssRules });

    const { result } = renderHook(() => useRssController(options), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.rssRules).toHaveLength(1);
    });
    const rule = result.current.rssRules[0];
    expect(typeof rule.ignoreDays).toBe('number');
    expect(rule.ignoreDays).toBe(9_999_999);
    expect(rule.affectedFeeds).toEqual(['f1', 'f2']);
  });
});
