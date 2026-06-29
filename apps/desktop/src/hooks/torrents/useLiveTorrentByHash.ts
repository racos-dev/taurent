// useLiveTorrentByHash — narrow single-torrent lookup backed by hot maindata sync.
//
// Subscribes ONLY to the torrents map slice from maindata, then extracts the
// specific hash in a useMemo. Re-renders only when that specific torrent
// object changes — not on unrelated maindata changes (categories, tags,
// server_state, etc.).
//
// Use this instead of useTorrentStore((s) => s.torrents.find(...)) for
// single-hash lookups. Avoids subscribing to the full torrents array.

import { useMemo } from 'react';
import type { Torrent } from '@taurent/shared/types/qbittorrent';
import { useMaindataSelector } from '../../connection';

export function useLiveTorrentByHash(hash: string | null): Torrent | undefined {
  const torrentMap = useMaindataSelector((s) => s.torrents);

  return useMemo(() => {
    if (!hash || !torrentMap) return undefined;
    return torrentMap[hash] ?? undefined;
  }, [hash, torrentMap]);
}