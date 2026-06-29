// Mobile torrent detail mutations — add-tracker and ban-peer.
//
// These mutations are used inside TorrentDetailScreen and need access to
// the current hash and tracker refetch callback. They are composed here so
// TorrentDetailScreen doesn't import BridgeAdapter directly.

import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useQBClient } from '../connection/QBClientProvider';
import {
  useAddTrackers,
  useBanPeersWithPeerInvalidation,
} from '@taurent/web-core/hooks';

export interface UseTorrentDetailMutationsOptions {
  hash: string;
  onRefetchTrackers: () => void | Promise<void>;
}

export interface TorrentDetailMutations {
  addTrackerMutation: ReturnType<typeof useAddTrackers>;
  banPeersMutation: {
    isPending: boolean;
    mutateAsync: (peers: string[]) => Promise<void>;
  };
}

export function useTorrentDetailMutations({
  hash,
  onRefetchTrackers,
}: UseTorrentDetailMutationsOptions): TorrentDetailMutations {
  const { isConnected, serverId, sessionGeneration } = useQBClient();

  const addTrackerMutation = useAddTrackers({
    scope: { serverId, sessionGeneration, isConnected },
    mutationFn: (variables) => BridgeAdapter.torrents.addTrackers(variables.hash, variables.urls),
    onSuccess: () => {
      void onRefetchTrackers();
    },
  });

  const banPeersMutation = useBanPeersWithPeerInvalidation({
    scope: { serverId, sessionGeneration, isConnected },
    mutationFn: (peers) => BridgeAdapter.transfer.banPeers(peers),
    hash,
  });

  // Expose isPending + mutateAsync shape consumed by TorrentDetailScreen.
  // mutateAsync return type is widened to void — the actual value is unused by callers.
  return {
    addTrackerMutation,
    banPeersMutation: {
      isPending: banPeersMutation.isPending,
      mutateAsync: banPeersMutation.mutateAsync as (peers: string[]) => Promise<void>,
    },
  };
}