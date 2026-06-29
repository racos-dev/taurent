// Mobile search screen hook — wires useSearchScreenModel to mobile bridge.
//
// Bridges the gap between the web-core screen model and mobile-specific
// adapter wiring. Composes useQBClient + BridgeAdapter.qBClient into
// SearchAdapters, then delegates to useSearchScreenModel.

import { useNavigate } from 'react-router-dom';
import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useQBClient } from '../connection/QBClientProvider';
import {
  useSearchScreenModel,
  createSearchAdapters,
} from '@taurent/web-core';

export function useSearchScreen() {
  const navigate = useNavigate();
  const { serverId, sessionGeneration, isConnected, capabilities } = useQBClient();

  const model = useSearchScreenModel({
    scope: { serverId, sessionGeneration, isConnected },
    isSupported: capabilities?.supportsSearch ?? null,
    adapters: createSearchAdapters(BridgeAdapter.qBClient),
    onAddResult: async (result) => {
      // Navigate to AddTorrentScreen with the search result URL
      navigate(`/add-torrent?mode=magnet&url=${encodeURIComponent(result.fileUrl)}`);
    },
  });

  return model;
}