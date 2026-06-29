// Shared torrent list hook — reads from accumulated maindata sync state.
//
// Platform-agnostic: uses MaindataStateScope (maintained by
// useMaindataSyncBackend (Rust live sync)). Applies client-side filtering and
// sorting — no separate HTTP polling needed.
//
// Previously lived in apps/mobile/src/hooks/useTorrents.ts. Moved to web-core
// so both platforms can share the same hook via createTorrentsHook factory.
//
// The hook subscribes to the Rust-owned `workspace-view-changed` event and
// derives the sorted torrent list from the engine's `sorted_hashes`.

import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceViewRequest } from '@taurent/bridge/types';
import type { Torrent } from '@taurent/shared/types/qbittorrent';
import type { TorrentFilterType } from '@taurent/shared';
import {
  isTorrentFilterType,
  isValidSortField,
} from '@taurent/shared';
import type { MaindataStateScope } from '../sync/MaindataSyncProvider';
import {
  useWorkspaceView,
  type UseWorkspaceViewResult,
  type WorkspaceViewBridge,
} from '../sync/useWorkspaceView';

export type { WorkspaceViewBridge } from '../sync/useWorkspaceView';

/**
 * Disabled-rustView sentinel used when the renderer is not connected or not
 * hydrated yet. The Rust workspace view is meaningless in those states
 * (there is no maindata to filter), so we substitute a no-op so the second
 * clause of the `isLoading` derivation does not fire on the initial render.
 *
 * `useWorkspaceView` is still called below to keep the rules of hooks happy
 * (hooks must run in the same order on every render) — only its result is
 * substituted.
 */
const NOOP_RUST_VIEW: UseWorkspaceViewResult = {
  view: null,
  isLoading: false,
  error: null,
  refresh: () => Promise.resolve(),
};

export interface UseTorrentsOptions {
  filter?: TorrentFilterType | string;
  category?: string;
  tag?: string;
  tracker?: string;
  search?: string;
  sort?: string;
  reverse?: boolean;
  enabled?: boolean;
}

export interface UseTorrentsResult {
  torrents: Torrent[];
  isLoading: boolean;
  isFetching: boolean;
  /** Last Rust workspace view error message, or `null` on success. */
  error: string | null;
  refetch: () => Promise<void>;
  dataUpdatedAt: number;
}

/**
 * Factory that creates a platform-specific useTorrents hook.
 *
 * Takes a scope provider (useMaindataState) and a `WorkspaceViewBridge`.
 * The bridge is used to consume the Rust workspace view.
 */
export function createTorrentsHook(
  scopeProvider: () => MaindataStateScope,
  bridge: WorkspaceViewBridge,
) {
  return function useTorrents(options: UseTorrentsOptions = {}): UseTorrentsResult {
    const { filter, category, tag, tracker, search, sort, reverse, enabled = true } = options;
    const { isConnected, isHydrated, maindataState } = scopeProvider();

    const torrentsMap = maindataState?.torrents;

    // ─── Rust workspace view request ───────────────────────────────────
    const workspaceRequest = useMemo<WorkspaceViewRequest>(() => {
      const sortField = sort && isValidSortField(sort) ? sort : 'added_on';
      return {
        request_id: 'torrents',
        filters: {
          status:
            filter && filter !== 'all' && isTorrentFilterType(filter) ? filter : 'all',
          category: category ?? null,
          tag: tag ?? null,
          tracker: tracker ?? null,
          search: search ?? '',
        },
        sort: {
          field: sortField,
          direction: reverse ? 'desc' : 'asc',
        },
        include_sorted_hashes: true,
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
      };
    }, [filter, category, tag, tracker, search, sort, reverse]);

    const rustView = useWorkspaceView(bridge.qBClient, workspaceRequest);
    // Substitute a no-op when the renderer has no connection or has not yet
    // hydrated — useWorkspaceView still runs above (rules of hooks) but its
    // state is not meaningful. Without this guard the second clause of the
    // isLoading derivation fires on the initial render and the UI shows a
    // loading spinner when it should just render an empty list.
    const effectiveRustView: UseWorkspaceViewResult =
      isConnected && isHydrated ? rustView : NOOP_RUST_VIEW;

    const rustSortedTorrents = useMemo<Torrent[]>(() => {
      if (!effectiveRustView.view || !torrentsMap) return [];
      const result: Torrent[] = [];
      for (const hash of effectiveRustView.view.sorted_hashes) {
        const t = torrentsMap[hash];
        if (t) result.push(t);
      }
      return result;
    }, [effectiveRustView.view, torrentsMap]);

    const [rustError, setRustError] = useState<string | null>(null);
    useEffect(() => {
      setRustError(effectiveRustView.error);
    }, [effectiveRustView.error]);

    const torrents: Torrent[] = rustSortedTorrents;
    const isLoading =
      (isConnected && isHydrated && maindataState === null) ||
      (effectiveRustView.isLoading && effectiveRustView.view === null);

    return {
      torrents: enabled ? torrents : [],
      isLoading,
      isFetching: false,
      error: rustError,
      refetch: () => Promise.resolve(),
      dataUpdatedAt: maindataState ? Date.now() : 0,
    };
  };
}
