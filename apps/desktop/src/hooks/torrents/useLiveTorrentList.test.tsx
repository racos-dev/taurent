/**
 * useLiveTorrentList hook tests — browser/component level
 *
 * Tests:
 * - initial null maindata returns []
 * - empty torrents map returns []
 * - setting createMaindataState(3) produces 3 torrents in map insertion order
 * - hook returns non-zero count when state has torrents (via stable DOM output)
 * - unrelated maindata changes (server_state/categories/tags) do NOT cause
 *   useLiveTorrentList hook re-render when the torrents map ref is unchanged
 * - replacing torrents map with modified torrent updates DOM correctly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { useState, useEffect, useRef } from 'react';
import { useLiveTorrentList } from './useLiveTorrentList';
import { createMaindataState } from '../../testing/fixtures/torrent';
import type { MaindataState, Torrent } from '@taurent/shared/types/qbittorrent';

// ─── External store mock ──────────────────────────────────────────────────────
//
// Mirrors the useSyncExternalStore contract used by useMaindataSelector.
// State changes notify subscribers; the selector result determines whether
// the subscriber re-renders (via Object.is comparison).
//
// Listener notifications are wrapped in `act()` so that any React state
// updates triggered by a store change — including those fired from
// `beforeEach`/`afterEach` outside an explicit test-level act() — do not
// produce "not wrapped in act(...)" warnings. Test bodies that already wrap
// `store.setState(...)` in act() end up with a harmless nested act() call,
// which React 19 supports.
class MockStore {
  private _state: MaindataState | null = null;
  private _listeners = new Set<() => void>();

  setState(next: MaindataState | null) {
    this._state = next;
    act(() => {
      this._listeners.forEach((fn) => fn());
    });
  }

  getState() {
    return this._state;
  }

  subscribe(fn: () => void) {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  /** Re-evaluate selector against current state (no internal caching). */
  select<T>(selector: (s: MaindataState | null) => T): T {
    return this._state == null ? (undefined as unknown as T) : selector(this._state);
  }
}

const store = new MockStore();

// ─── Mock the '../../connection' module ──────────────────────────────────────
vi.mock('../../connection', () => ({
  useMaindataSelector: (selector: (s: MaindataState | null) => unknown) => {
    const [, forceUpdate] = useState(0);
    const selectorRef = useRef(selector);
    const selectedRef = useRef<unknown>(store.select(selector));
    selectorRef.current = selector;

    useEffect(() => {
      const unsub = store.subscribe(() => {
        const next = store.select(selectorRef.current);
        if (!Object.is(selectedRef.current, next)) {
          selectedRef.current = next;
          forceUpdate((n) => n + 1);
        }
      });
      return unsub;
    }, []);

    selectedRef.current = store.select(selector);
    return selectedRef.current;
  },
}));

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('useLiveTorrentList', () => {
  beforeEach(() => {
    // Unmount any components left behind by the previous test so that
    // their store subscriptions are released before the next test mounts
    // fresh ones. This keeps the per-test MockStore listener set empty
    // and prevents cross-test cross-talk via the store.
    cleanup();
    store.setState(null);
  });

  afterEach(() => {
    // Unmount rendered components first so subsequent store notifications
    // do not trigger React state updates on already-orphaned components.
    cleanup();
    store.setState(null);
  });

  it('returns [] when maindata is null', () => {
    const HookConsumer = () => {
      const resolved = useLiveTorrentList();
      return <div data-testid="captured">{resolved.length}</div>;
    };

    act(() => { store.setState(null); });
    const { container } = render(<HookConsumer />);
    expect(container.querySelector('[data-testid="captured"]')?.textContent).toBe('0');
  });

  it('returns [] when torrents map is empty', () => {
    const HookConsumer = () => {
      const resolved = useLiveTorrentList();
      return <div data-testid="captured">{resolved.length}</div>;
    };

    act(() => { store.setState(createMaindataState(0)); });
    const { container } = render(<HookConsumer />);
    expect(container.querySelector('[data-testid="captured"]')?.textContent).toBe('0');
  });

  it('returns 3 torrents in map insertion order from createMaindataState(3)', () => {
    const HookConsumer = () => {
      const resolved = useLiveTorrentList();
      return <div data-testid="captured">{resolved.length}</div>;
    };

    act(() => { store.setState(createMaindataState(3)); });
    const { container } = render(<HookConsumer />);
    expect(container.querySelector('[data-testid="captured"]')?.textContent).toBe('3');

    const NamesHook = () => {
      const result = useLiveTorrentList();
      return <div data-testid="names">{result.map((t) => t.name).join('|')}</div>;
    };
    const namesRender = render(<NamesHook />);
    expect(namesRender.container.querySelector('[data-testid="names"]')?.textContent).toBe(
      'Torrent 1|Torrent 2|Torrent 3',
    );
  });

  it('preserves canonical torrent object refs for the same torrents map', () => {
    const state = createMaindataState(5);
    act(() => { store.setState(state); });

    const snapshots: Torrent[][] = [];

    const HookConsumer = () => {
      const result = useLiveTorrentList();
      useEffect(() => {
        snapshots.push(result);
      }, [result]);
      return <div data-testid="count">{result.length}</div>;
    };

    render(<HookConsumer />);

    const baseline = snapshots.length;
    act(() => {
      store.setState({
        ...state,
        torrents: state.torrents,
        tags: ['unrelated-change'],
      });
    });

    expect(snapshots).toHaveLength(baseline);
    expect(snapshots[0]?.[0]).toBe(Object.values(state.torrents)[0]);
  });

  it('does NOT re-render when unrelated maindata fields change (same torrents map ref)', () => {
    const state = createMaindataState(3);
    act(() => { store.setState(state); });

    const snapshots: Torrent[][] = [];

    const HookConsumer = () => {
      const result = useLiveTorrentList();
      useEffect(() => {
        snapshots.push(result);
      }, [result]);
      return <div data-testid="captured">{result.length}</div>;
    };

    render(<HookConsumer />);
    const baseline = snapshots.length;

    // New state: same torrents ref, different server_state/categories/tags
    const updatedState: MaindataState = {
      ...state,
      server_state: { ...state.server_state, dl_info_speed: 999 * 1024 } as MaindataState['server_state'],
      categories: { ...state.categories },
      tags: ['new-tag'],
    };
    updatedState.torrents = state.torrents; // same ref

    act(() => { store.setState(updatedState); });

    // No new renders — torrents map ref unchanged, useMemo short-circuits
    expect(snapshots).toHaveLength(baseline);
    expect(snapshots[0]).toHaveLength(3);
  });

  it('replaces torrents map with modified torrent: preserves unchanged refs and replaces changed ref', () => {
    const state = createMaindataState(5);
    act(() => { store.setState(state); });

    const snapshots: Torrent[][] = [];

    const HookConsumer = () => {
      const result = useLiveTorrentList();
      useEffect(() => {
        snapshots.push(result);
      }, [result]);
      return (
        <div>
          <span data-testid="count">{result.length}</span>
          <span data-testid="names">{result.map((t) => t.name).join(',')}</span>
        </div>
      );
    };

    const { container } = render(<HookConsumer />);
    const baseline = snapshots.length;

    // Build new torrents map: same hashes, but index 1 gets a new object
    const newTorrentsMap: Record<string, Torrent> = {};
    for (const h of Object.keys(state.torrents)) {
      newTorrentsMap[h] = state.torrents[h];
    }
    const modifiedHash = Object.keys(state.torrents)[1];
    newTorrentsMap[modifiedHash] = {
      ...newTorrentsMap[modifiedHash],
      name: 'Modified Torrent',
    };

    const newState: MaindataState = { ...state, torrents: newTorrentsMap };

    // Update to new state
    act(() => { store.setState(newState); });

    const namesText = container.querySelector('[data-testid="names"]')?.textContent ?? '';
    expect(snapshots).toHaveLength(baseline + 1);
    const firstResult = snapshots[0];
    const latestResult = snapshots[snapshots.length - 1];
    expect(latestResult).not.toBe(firstResult);
    expect(latestResult).toHaveLength(5);
    expect(latestResult[0]).toBe(firstResult[0]);
    expect(latestResult[1]).not.toBe(firstResult[1]);
    expect(latestResult[2]).toBe(firstResult[2]);
    expect(latestResult[3]).toBe(firstResult[3]);
    expect(latestResult[4]).toBe(firstResult[4]);
    expect(namesText).toContain('Modified Torrent');
  });
});
