// useLiveTorrentsByHash — narrow multi-hash ordered lookup backed by hot maindata sync.
//
// Subscribes ONLY to the torrents map slice from maindata, then extracts the
// specific hashes in a useMemo. Returns the canonical Torrent object references
// from maindata (no cloning), preserving input order and tolerating missing
// hashes. Re-renders only when any of those specific torrents change.
//
// Use this instead of useTorrentStore((s) => s.torrents.filter(...)) for
// multi-hash lookups. Avoids subscribing to the full torrents array.

import { useMemo } from 'react';
import type { Torrent } from '@taurent/shared/types/qbittorrent';
import { useMaindataSelector } from '../../connection';

export function useLiveTorrentsByHash(hashes: string[]): Torrent[] {
  const torrentMap = useMaindataSelector((s) => s.torrents);

  return useMemo(() => {
    if (!torrentMap || !hashes.length) return [];
    return hashes
      .map((hash) => torrentMap[hash])
      .filter((t): t is Torrent => Boolean(t));
  }, [hashes, torrentMap]);
}