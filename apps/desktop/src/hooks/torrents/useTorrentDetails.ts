// Desktop torrent detail hooks — delegates to web-core's createTorrentDetailHooks factory.
// Re-export only; all logic lives in @taurent/web-core.

import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useQBClient } from '../../connection/QBClientProvider';
import { createTorrentDetailHooks } from '@taurent/web-core/hooks';

export const {
  useTorrentProperties,
  useTorrentTrackers,
  useTorrentFiles,
  useTorrentPeers,
  useTorrentWebSeeds,
} = createTorrentDetailHooks({ bridge: BridgeAdapter, scopeProvider: useQBClient });

