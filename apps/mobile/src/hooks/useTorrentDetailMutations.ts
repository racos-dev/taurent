// Mobile torrent detail mutations — add-tracker, web seeds, and ban-peer.
//
// These mutations are used inside TorrentDetailScreen and need access to
// the current hash and tracker refetch callback. They are composed here so
// TorrentDetailScreen doesn't import BridgeAdapter directly.

import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useMutation } from '@tanstack/react-query';
import type { WebSeed } from '@taurent/shared/types/qbittorrent';
import { useQBClient } from '../connection/QBClientProvider';
import {
  useAddTrackers,
  useBanPeersWithPeerInvalidation,
} from '@taurent/web-core/hooks';

export interface UseTorrentDetailMutationsOptions {
  hash: string;
  onRefetchTrackers: () => void | Promise<void>;
  onRefetchWebSeeds?: () => void | Promise<void>;
}

export interface TorrentDetailMutations {
  addTrackerMutation: ReturnType<typeof useAddTrackers>;
  banPeersMutation: {
    isPending: boolean;
    mutateAsync: (peers: string[]) => Promise<void>;
  };
  addHttpSourcesMutation: {
    isPending: boolean;
    mutateAsync: (urls: string) => Promise<void>;
  };
  editHttpSourceMutation: {
    isPending: boolean;
    mutateAsync: (variables: { seed: WebSeed; newUrl: string }) => Promise<void>;
  };
  removeHttpSourceMutation: {
    isPending: boolean;
    mutateAsync: (seed: WebSeed) => Promise<void>;
  };
}

export function useTorrentDetailMutations({
  hash,
  onRefetchTrackers,
  onRefetchWebSeeds,
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

  const addHttpSourcesMutation = useMutation({
    mutationFn: (urls: string) => BridgeAdapter.torrents.addWebSeeds(hash, urls),
    onSuccess: () => {
      void onRefetchWebSeeds?.();
    },
  });

  const editHttpSourceMutation = useMutation({
    mutationFn: (variables: { seed: WebSeed; newUrl: string }) =>
      BridgeAdapter.torrents.editWebSeed(hash, variables.seed.url, variables.newUrl),
    onSuccess: () => {
      void onRefetchWebSeeds?.();
    },
  });

  const removeHttpSourceMutation = useMutation({
    mutationFn: (seed: WebSeed) => BridgeAdapter.torrents.removeWebSeeds(hash, seed.url),
    onSuccess: () => {
      void onRefetchWebSeeds?.();
    },
  });

  // Expose isPending + mutateAsync shape consumed by TorrentDetailScreen.
  // React Query returns the bridge operation response; screen handlers only need completion.
  return {
    addTrackerMutation,
    banPeersMutation: {
      isPending: banPeersMutation.isPending,
      mutateAsync: async (peers: string[]) => {
        await banPeersMutation.mutateAsync(peers);
      },
    },
    addHttpSourcesMutation: {
      isPending: addHttpSourcesMutation.isPending,
      mutateAsync: async (urls: string) => {
        await addHttpSourcesMutation.mutateAsync(urls);
      },
    },
    editHttpSourceMutation: {
      isPending: editHttpSourceMutation.isPending,
      mutateAsync: async (variables: { seed: WebSeed; newUrl: string }) => {
        await editHttpSourceMutation.mutateAsync(variables);
      },
    },
    removeHttpSourceMutation: {
      isPending: removeHttpSourceMutation.isPending,
      mutateAsync: async (seed: WebSeed) => {
        await removeHttpSourceMutation.mutateAsync(seed);
      },
    },
  };
}
