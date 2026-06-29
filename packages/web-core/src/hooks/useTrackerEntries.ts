// Tracker entries hook — derives tracker filter data from accumulated maindata sync state.
//
// Platform-agnostic: uses MaindataStateScope (maintained by
// useMaindataSyncBackend (Rust live sync)). Reads torrent tracker field and
// produces a sorted, deduped tracker entry list.

import { useMemo } from 'react';
import type { MaindataStateScope } from '../sync/MaindataSyncProvider';
import type { TrackerEntry } from '@taurent/shared';
import { deriveTrackerEntries } from '@taurent/shared';

export interface UseTrackerEntriesResult {
  trackerEntries: TrackerEntry[];
  isLoading: boolean;
}

/**
 * Factory that creates a platform-specific useTrackerEntries hook.
 * Takes a scope provider (useMaindataState) and returns a zero-argument-style hook.
 */
export function createTrackerEntriesHook(scopeProvider: () => MaindataStateScope) {
  return function useTrackerEntries(): UseTrackerEntriesResult {
    const { isConnected, isHydrated, maindataState } = scopeProvider();

    const trackerEntries = useMemo<TrackerEntry[]>(() => {
      if (!isConnected || !isHydrated || !maindataState) return [];
      return deriveTrackerEntries(Object.values(maindataState.torrents));
    }, [maindataState, isConnected, isHydrated]);

    const isLoading = isConnected && isHydrated && maindataState === null;

    return { trackerEntries, isLoading };
  };
}
