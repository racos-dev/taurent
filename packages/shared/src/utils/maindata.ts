// mergeMaindata — applies a SyncMainData delta onto an accumulated MaindataState.
//
// qBittorrent's /api/v2/sync/maindata returns:
//   - full_update=true  → complete snapshot of all torrents, categories, tags, server_state
//   - full_update=false → delta: only changed entities/fields are present
//
// Delta semantics:
//   torrents          partial map: only changed torrents, with only changed fields
//   torrents_removed  hashes to delete from the map
//   categories        partial map: full category objects for any added/changed categories
//   categories_removed names to delete from the map
//   tags              newly added tags since last sync
//   tags_removed      tags that were deleted since last sync
//   server_state      partial server state update (only changed fields)

import type { SyncMainData, MaindataState, Torrent, Category, SyncServerState } from '../types/qbittorrent';
import { measure } from './perfAudit';

/** Returns true when field-level merge would produce no effective change on `current`. */
function torrentDeltaIsNoop(current: Torrent | undefined, delta: Partial<Torrent>): boolean {
  if (!current) return false;
  for (const key of Object.keys(delta) as Array<keyof Torrent>) {
    if (current[key] !== delta[key]) return false;
  }
  return true;
}

/** Returns true when server_state delta is a no-op (every field unchanged or absent). */
function serverStateDeltaIsNoop(current: SyncServerState | null, delta: Partial<SyncServerState>): boolean {
  if (!current || !delta) return false;
  for (const key of Object.keys(delta) as Array<keyof SyncServerState>) {
    if (current[key] !== delta[key]) return false;
  }
  return true;
}

/**
 * Re-inject `torrent.hash` from the keyed map so React consumers always
 * receive hash-bearing torrent objects.
 *
 * qBittorrent's wire format encodes each torrent's hash only as the
 * keyed-map key, not as a per-row `hash` field. The full-update merge
 * path in `mergeMaindata` and the backend snapshot ingestion in
 * `useMaindataSyncBackend` both call this helper so the React tree
 * observes a single normalization rule for the keyed-map shape.
 */
export function normalizeTorrentMap(
  torrents: Record<string, Torrent> | undefined,
): Record<string, Torrent> {
  if (!torrents) {
    return {};
  }

  const normalized: Record<string, Torrent> = {};

  for (const [hash, torrent] of Object.entries(torrents)) {
    normalized[hash] = { ...torrent, hash };
  }

  return normalized;
}

/**
 * Create an empty MaindataState with safe defaults.
 *
 * Used as a sentinel value when no maindata snapshot is available yet
 * (provider not hydrated). Selectors applied to this sentinel will
 * receive empty collections rather than undefined, avoiding runtime
 * crashes from accessing properties on null/undefined.
 */
export function createEmptyMaindataState(): MaindataState {
  return {
    rid: 0,
    torrents: {},
    categories: {},
    tags: [],
    server_state: null,
  };
}

/**
 * Normalize the envelope fields of a backend-owned maindata snapshot into
 * a `MaindataState` that React can consume directly.
 *
 * Backend snapshots may omit the per-row `hash` field (the hash is the
 * keyed-map key on the wire). This helper centralizes the same envelope
 * handling used by `mergeMaindata` so the renderer-fallback and backend
 * paths cannot drift on the shared torrent-hash normalization.
 */
export function normalizeBackendMaindata(params: {
  rid: number;
  torrents: Record<string, Torrent> | undefined;
  categories: Record<string, Category> | undefined;
  tags: readonly string[] | undefined;
  server_state: SyncServerState | null | undefined;
}): MaindataState {
  return {
    rid: params.rid,
    torrents: normalizeTorrentMap(params.torrents),
    categories: params.categories ?? {},
    tags: params.tags ? [...params.tags].sort() : [],
    server_state: params.server_state ?? null,
  };
}

export function mergeMaindata(
  current: MaindataState | null,
  delta: SyncMainData,
): MaindataState {
  return measure('mergeMaindata', () => {
    if (delta.full_update || !current) {
      // Full snapshot — replace everything
      return {
        rid: delta.rid,
        torrents: normalizeTorrentMap(delta.torrents),
        categories: delta.categories ?? {},
        tags: delta.tags ? [...delta.tags].sort() : [],
        server_state: delta.server_state ?? null,
      };
    }

    // --- Incremental delta merge ---

    // Torrents: only clone/replace the map when at least one entry changes.
    // Skip ref updates for existing entries where all changed fields are identical.
    let torrents = current.torrents;

    if (delta.torrents || delta.torrents_removed?.length) {
      // Check whether any torrent entry actually differs before cloning the map.
      let hasRealChange = false;

      if (delta.torrents_removed?.length) {
        // Deletions are real only when the hash currently exists.
        for (const hash of delta.torrents_removed) {
          if (hash in current.torrents) { hasRealChange = true; break; }
        }
      }

      if (!hasRealChange && delta.torrents) {
        for (const [hash, changed] of Object.entries(delta.torrents)) {
          const existing = current.torrents[hash];
          if (!existing) {
            // New torrent — real add
            hasRealChange = true;
            break;
          }
          // Only a real change if at least one delta field differs from current.
          if (!torrentDeltaIsNoop(existing, changed)) {
            hasRealChange = true;
            break;
          }
          // Fields are identical — preserve existing ref; no need to reassign.
        }
      }

      if (hasRealChange) {
        torrents = { ...current.torrents };
        if (delta.torrents) {
          for (const [hash, changed] of Object.entries(delta.torrents)) {
            const existing = current.torrents[hash];
            // Only create a new torrent object if this is a new entry or a real change.
            // When unchanged, keep the existing ref so consumers that use
            // Object.is() on torrent references don't get a spurious change signal.
            if (!existing || !torrentDeltaIsNoop(existing, changed)) {
              torrents[hash] = { ...(existing ?? {}), ...changed, hash };
            } else {
              torrents[hash] = existing;
            }
          }
        }
        for (const hash of delta.torrents_removed ?? []) {
          delete torrents[hash];
        }
      }
    }

    // Categories: replace per-category entries for any changed ones, remove deleted
    let categories = current.categories;
    if (delta.categories || delta.categories_removed?.length) {
      categories = { ...current.categories };
      if (delta.categories) {
        for (const [name, cat] of Object.entries(delta.categories)) {
          categories[name] = cat;
        }
      }
      for (const name of delta.categories_removed ?? []) {
        delete categories[name];
      }
    }

    // Tags: delta contains newly added tags; tags_removed lists deleted ones
    let tags = current.tags;
    if (delta.tags?.length || delta.tags_removed?.length) {
      const tagSet = new Set(current.tags);
      for (const t of delta.tags ?? []) tagSet.add(t);
      const toRemove = new Set(delta.tags_removed ?? []);
      tags = Array.from(tagSet)
        .filter((t) => !toRemove.has(t))
        .sort();
    }

    // Server state: only create a new object if the delta introduces any real change.
    // Preserving the existing ref avoids unnecessary re-renders for consumers that
    // use Object.is() on the server_state reference.
    let server_state = current.server_state;
    if (delta.server_state && !serverStateDeltaIsNoop(current.server_state, delta.server_state)) {
      server_state = { ...current.server_state, ...delta.server_state };
    }

    return {
      rid: delta.rid,
      torrents,
      categories,
      tags,
      server_state,
    };
  });
}