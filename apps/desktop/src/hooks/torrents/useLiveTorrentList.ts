// useLiveTorrentList — live torrent list from maindata without cloning.
//
// Provides the canonical ordered torrent list for desktop workspace/selection
// consumers without full-array Zustand subscription. Uses useMaindataSelector
// to subscribe only to the torrents map reference, so unrelated maindata
// changes (categories, tags, server_state) do not cause rerenders.
//
// Usage:
//   const torrents = useLiveTorrentList();
//   // returns Torrent[] in insertion order (maindata merge order)
//
// Filtered/sorted desktop views are driven by the Rust workspace projection;
// this hook supplies canonical row objects for hash-to-row mapping.

import { useMemo } from 'react';
import type { Torrent } from '@taurent/shared/types/qbittorrent';
import { count, isPerfAuditEnabled, measure } from '@taurent/shared/utils/perfAudit';
import { useMaindataSelector } from '../../connection';

const EMPTY: Torrent[] = [];

// ─── Identity churn probe ───────────────────────────────────────────────────
//
// Bounded per-instance tracker: stores at most MAX_TRACKED hashes. This keeps
// memory flat while still capturing identity churn direction on every poll.
//
// NOT a React ref — the probe is scoped per useLiveTorrentList() call via
// useMemo(() => createProbe(), []), so each consumer gets its own probe with
// an independent Map. The probe is stable (same object reference) across
// renders and is called from inside a useMemo derivation callback.
//
// Probe semantics:
//   - Classify first against current snapshot, then build next snapshot.
//     No eviction happens during classification, so current-pass results are
//     not corrupted by capacity-based eviction mid-scan.
//   - Next snapshot = most recent MAX_TRACKED unique hashes from the current pass.
//     Items seen earlier in the pass but evicted from the snapshot will be
//     re-classified as 'newHash' on the next pass — this is expected for
//     a bounded sampler and is documented as a known measurement approximation.
//   - O(n) pass over the torrent list on every derivation attempt
//   - Guarded by isPerfAuditEnabled() — near-zero overhead when disabled
//   - count() uses stable keys; counts from all active probe instances
//     accumulate in perfAudit's shared counter store and are flushed every ~30s
//   - NOTE: the probe runs inside a useMemo callback. React StrictMode can
//     invoke useMemo callbacks twice per render in development, which inflates
//     per-flush counter values compared to production.
//
const MAX_TRACKED = 100;

interface IdentityChurnProbe {
  probe(torrents: Torrent[]): void;
  reset(): void;
}

function createIdentityChurnProbe(): IdentityChurnProbe {
  // Maps hash → previous object reference for that hash
  const prevByHash = new Map<string, Torrent>();

  return {
    /**
     * O(n) pass — guarded; returns early when perf-audit is disabled.
     *
     * Classification vs. eviction: this probe classifies every item against the
     * snapshot that existed BEFORE this call, then builds the next snapshot from
     * only the most-recently-seen MAX_TRACKED unique hashes from the current pass.
     * This means mid-scan eviction never corrupts within-pass classification.
     * Items that fall out of the snapshot (because they were seen early in the
     * pass but are not in the last MAX_TRACKED) will register as 'newHash' on
     * the following pass — a known bounded-sample approximation.
     */
    probe(torrents: Torrent[]) {
      if (!isPerfAuditEnabled()) return;

      const n = torrents.length;
      let sameHashDifferentObject = 0;
      let sameHashSameObject = 0;
      let newHash = 0;

      // ── Pass 1: classify against current snapshot (no mutations) ─────────
      for (let i = 0; i < n; i++) {
        const t = torrents[i];
        const prev = prevByHash.get(t.hash);
        if (prev === undefined) {
          newHash++;
        } else if (prev !== t) {
          sameHashDifferentObject++;
        } else {
          sameHashSameObject++;
        }
      }

      // ── Pass 2: build next snapshot from most-recent MAX_TRACKED entries ───
      // Clear first; then add last N unique hashes from the current pass.
      prevByHash.clear();
      // Number of items to keep = min(MAX_TRACKED, n)
      const keepCount = Math.min(MAX_TRACKED, n);
      // Start index of the window we keep (most recent 'keepCount' items)
      const startIdx = Math.max(0, n - keepCount);
      for (let i = startIdx; i < n; i++) {
        prevByHash.set(torrents[i].hash, torrents[i]);
      }

      // count(label, key, n) — stable key strings; n is the increment
      // perfAudit aggregates these and flushes every ~30s
      if (sameHashDifferentObject > 0) {
        count('liveList.identityChurn', 'sameHashDiffObj', sameHashDifferentObject);
      }
      if (sameHashSameObject > 0) {
        count('liveList.identityChurn', 'sameHashSameObj', sameHashSameObject);
      }
      if (newHash > 0) {
        count('liveList.identityChurn', 'newHash', newHash);
      }
    },

    /** Clear snapshot on null/disconnect transitions to avoid stale-session comparisons. */
    reset() {
      prevByHash.clear();
    },
  };
}

// ─── Probe instance scoping ────────────────────────────────────────────────────
//
// The probe is scoped per hook instance using useMemo(() => createProbe(), []).
// This gives one probe per useLiveTorrentList() caller rather than a shared
// global singleton. The probe object itself is stable across renders (same
// reference), so the ESLint react-hooks/refs rule (which targets ref.current
// mutation patterns) does not apply.
//
// Each probe has its own independent Map for identity tracking. However, all
// probes emit to the same count() label ('liveList.identityChurn'), so the
// final counter values in perfAudit reflect the sum of emissions from all
// active probe instances over the flush window.
//
export function useLiveTorrentList(): Torrent[] {
  const torrentMap = useMaindataSelector((s) => s.torrents);

  // Per-instance probe — useMemo([]) gives one probe per call site, not a global.
  // The probe object is stable across renders; it is listed in the derivation
  // useMemo deps so the rule is satisfied without any disable directive.
  const churnProbe = useMemo(() => createIdentityChurnProbe(), []);

  return useMemo(() => {
    if (!torrentMap) {
      churnProbe.reset();
      return EMPTY;
    }
    // Return canonical object references from maindata — no cloning.
    // Keyed on the torrent-map reference so useMemo short-circuits when
    // the map reference hasn't changed (mergeMaindata preserves unchanged entries).
    const result = measure('useLiveTorrentList.ObjectValues', () =>
      Object.values(torrentMap) as Torrent[],
    );

    // Probe identity churn — O(n) but returns immediately when disabled.
    churnProbe.probe(result);

    return result;
  }, [torrentMap, churnProbe]);
}
