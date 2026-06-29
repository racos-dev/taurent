// Add torrent hook factory — creates a platform-specific useAddTorrent hook
// from a bridge adapter + scope provider.
//
// Previously lived in apps/mobile/src/hooks/useAddTorrent.ts. Moved to web-core
// so both platforms can share the same wiring.

import type { AddTorrentOptions } from '@taurent/bridge';
import {
  useAddTorrent as useAddTorrentCore,
  type UseAddTorrentResult,
} from './useAddTorrent';
import type { QBClientContextValue } from '../session';

export interface AddTorrentBridge {
  torrents: {
    addTorrent: (options: AddTorrentOptions) => Promise<unknown>;
  };
}

export function createAddTorrentHook(options: {
  bridge: AddTorrentBridge;
  scopeProvider: () => QBClientContextValue;
}) {
  const { bridge, scopeProvider } = options;

  return function useAddTorrent(): UseAddTorrentResult {
    const { isConnected, serverId, sessionGeneration } = scopeProvider();

    return useAddTorrentCore({
      addTorrentFn: (torrentOptions: AddTorrentOptions) =>
        bridge.torrents.addTorrent(torrentOptions) as Promise<unknown>,
      scope: {
        serverId,
        sessionGeneration,
        isConnected,
      },
    });
  };
}
