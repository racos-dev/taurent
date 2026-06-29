// Torrent detail hooks factory — creates platform-specific detail hooks
// (properties, trackers, files, peers) from a bridge adapter + scope provider.
//
// Previously lived in apps/mobile/src/hooks/useTorrentDetails.ts. Moved to
// web-core so both platforms can share the same wiring.

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useTorrentProperties as useTorrentPropertiesBase,
  useTorrentTrackers as useTorrentTrackersBase,
  useTorrentFiles as useTorrentFilesBase,
} from './index';
import type { TorrentProperties, Tracker, TorrentFile, SyncTorrentPeers, WebSeed } from '@taurent/shared/types/qbittorrent';
import type { QBClientContextValue } from '../session';
import { torrentPeersKey } from '../query/keys';
import { torrentWebseedsKey } from '../query/keys';

export interface TorrentDetailBridge {
  torrents: {
    // Bridge contract (T140.3): bridge adapters unwrap the Tauri session envelope
    // and expose the Rust-validated plain typed payload. qb-core::dto owns the
    // network-response validation boundary for these endpoints, so no further
    // shape-tolerance is needed at the web-core layer.
    getProperties: (hash: string) => Promise<TorrentProperties>;
    getTrackers: (hash: string) => Promise<Tracker[]>;
    getFiles: (hash: string) => Promise<TorrentFile[]>;
    // Returns typed SyncTorrentPeers delta validated by bridge adapter
    syncTorrentPeers: (hash: string, rid: number) => Promise<SyncTorrentPeers>;
    // Webseeds returns a typed envelope; consumers extract .webseeds
    // Rust-owned DTO (T153): `qb-core::dto::parse_webseeds` validates the payload;
    // `webseeds` is typed as `WebSeed[]` rather than `unknown`.
    getWebSeeds: (hash: string) => Promise<{ webseeds: WebSeed[]; session_generation: number; server_id: string | null }>;
  };
}

export interface PeerRow {
  key: string;
  ip: string;
  port: number;
  client: string;
  progress: number;
  dl_speed: number;
  up_speed: number;
  downloaded: number;
  uploaded: number;
  connection: string;
  flags: string;
  flags_desc: string;
  relevance: number;
  files: string;
  country?: string;
  country_code?: string;
}

/** Apply defaults so partial peer payloads never render NaN / undefined in the UI. */
function normalizePeerRow(peer: PeerRow): PeerRow {
  return {
    key: peer.key,
    ip: peer.ip ?? '',
    port: peer.port ?? 0,
    client: peer.client ?? '',
    progress: peer.progress ?? 0,
    dl_speed: peer.dl_speed ?? 0,
    up_speed: peer.up_speed ?? 0,
    downloaded: peer.downloaded ?? 0,
    uploaded: peer.uploaded ?? 0,
    connection: peer.connection ?? '',
    flags: peer.flags ?? '',
    flags_desc: peer.flags_desc ?? '',
    relevance: peer.relevance ?? 0,
    files: peer.files ?? '',
    country: peer.country,
    country_code: peer.country_code,
  };
}

const ACTIVE_TORRENT_STATES = new Set([
  'downloading', 'uploading', 'stalledDL', 'stalledUP',
  'checkingDL', 'checkingUP', 'queuedDL', 'queuedUP',
]);

const isDevelopmentRuntime = (): boolean => {
  const maybeImportMeta = import.meta as ImportMeta & {
    env?: { DEV?: boolean; MODE?: string };
  };
  if (maybeImportMeta.env?.DEV === true || maybeImportMeta.env?.MODE === 'development') {
    return true;
  }

  const maybeProcess = globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  };
  return maybeProcess.process?.env?.NODE_ENV === 'development';
};

function getDetailPollInterval(
  resourceType: 'properties' | 'files' | 'trackers',
  torrentState: string | null | undefined,
): number {
  const isActive = torrentState != null && ACTIVE_TORRENT_STATES.has(torrentState);

  switch (resourceType) {
    case 'properties':
      return isActive ? 1000 : 5000;
    case 'files':
      return isActive ? 3000 : 10000;
    case 'trackers':
      return isActive ? 5000 : 30000;
    default:
      return 5000;
  }
}

export interface UseTorrentDetailOptions {
  enabled?: boolean;
  getTorrentState?: (hash: string) => string | null | undefined;
}

export function createTorrentDetailHooks(options: {
  bridge: TorrentDetailBridge;
  scopeProvider: () => QBClientContextValue;
}) {
  const { bridge, scopeProvider } = options;

  function useTorrentProperties(hash: string, opts: UseTorrentDetailOptions = {}) {
    const { enabled = true } = opts;
    const { isConnected, isHydrated, serverId, sessionGeneration } = scopeProvider();

    const { properties, isLoading, error, refetch, isFetching, dataUpdatedAt } = useTorrentPropertiesBase<TorrentProperties | null>({
      scope: { serverId, sessionGeneration, isConnected },
      hash,
      queryFn: async (torrentHash) => {
        // Bridge contract (T140.3): plain typed payload, no envelope to unwrap.
        // Rust (qb-core::dto) validates the upstream response, so a direct cast
        // through the concrete bridge return type is safe.
        return await bridge.torrents.getProperties(torrentHash);
      },
      enabled: enabled && isConnected && isHydrated && !!hash && serverId !== null,
      staleTime: 5000,
      retry: 1,
      refetchInterval: isConnected
        ? (query: { state: { status: string } }) => {
            if (query.state.status === 'error') return false;
            const state = opts.getTorrentState?.(hash);
            return getDetailPollInterval('properties', state);
          }
        : false,
    });

    return {
      properties,
      isLoading: isLoading || !isHydrated,
      isFetching,
      error,
      refetch,
      dataUpdatedAt,
    };
  }

  function useTorrentTrackers(hash: string, opts: UseTorrentDetailOptions = {}) {
    const { enabled = true } = opts;
    const { isConnected, isHydrated, serverId, sessionGeneration } = scopeProvider();

    const { trackers, isLoading, error, refetch, isFetching, dataUpdatedAt } = useTorrentTrackersBase<Tracker>({
      scope: { serverId, sessionGeneration, isConnected },
      hash,
      queryFn: async (torrentHash) => {
        // Bridge contract (T140.3): plain typed Tracker[] payload, no envelope to unwrap.
        // Rust (qb-core::dto) validates the upstream response, so a direct cast
        // through the concrete bridge return type is safe.
        return await bridge.torrents.getTrackers(torrentHash);
      },
      enabled: enabled && isConnected && isHydrated && !!hash && serverId !== null,
      staleTime: 10000,
      refetchInterval: isConnected
        ? () => {
            const state = opts.getTorrentState?.(hash);
            return getDetailPollInterval('trackers', state);
          }
        : false,
    });

    return {
      trackers,
      isLoading: isLoading || !isHydrated,
      isFetching,
      error,
      refetch,
      dataUpdatedAt,
    };
  }

  function useTorrentFiles(hash: string, opts: UseTorrentDetailOptions = {}) {
    const { enabled = true } = opts;
    const { isConnected, isHydrated, serverId, sessionGeneration } = scopeProvider();

    const { files, isLoading, error, refetch, isFetching, dataUpdatedAt } = useTorrentFilesBase<TorrentFile>({
      scope: { serverId, sessionGeneration, isConnected },
      hash,
      queryFn: async (torrentHash) => {
        // Bridge contract (T140.3): plain typed TorrentFile[] payload, no envelope to unwrap.
        // Rust (qb-core::dto) validates the upstream response, so a direct cast
        // through the concrete bridge return type is safe.
        return await bridge.torrents.getFiles(torrentHash);
      },
      enabled: enabled && isConnected && isHydrated && !!hash && serverId !== null,
      staleTime: 5000,
      refetchInterval: isConnected
        ? () => {
            const state = opts.getTorrentState?.(hash);
            return getDetailPollInterval('files', state);
          }
        : false,
    });

    // Debug logging for empty-files bug investigation (dev-only to avoid production log noise)
    useEffect(() => {
      if (!isDevelopmentRuntime()) return;

      if (error) {
        console.warn(
          `[useTorrentFiles] hash=${hash.slice(0, 8)}… ERROR: ${error.message}`,
          error,
        );
      } else if (files !== undefined) {
        console.info(
          `[useTorrentFiles] hash=${hash.slice(0, 8)}… file_count=${files.length} isLoading=${isLoading}`,
        );
        if (files.length === 0 && !isLoading) {
          console.warn(
            `[useTorrentFiles] hash=${hash.slice(0, 8)}… returned EMPTY file list (success, not error)`,
          );
        }
      }
    }, [hash, files, error, isLoading]);

    return {
      files,
      isLoading: isLoading || !isHydrated,
      isFetching,
      error,
      refetch,
      dataUpdatedAt,
    };
  }

  function useTorrentPeers(hash: string, opts: UseTorrentDetailOptions = {}) {
    const { enabled = true } = opts;
    const { isConnected, isHydrated, serverId, sessionGeneration } = scopeProvider();

    // RID-based incremental sync state — lives outside the queryFn so it persists
    // across refetches. Resets automatically when the torrent hash changes.
    const peerRidRef = useRef<number>(0);
    const prevHashRef = useRef<string | null>(null);
    const accumulatedPeersRef = useRef<PeerRow[]>([]);

    const { data: peers = [], isLoading, error, refetch, isFetching } = useQuery<PeerRow[]>({
      queryKey: torrentPeersKey({ serverId, sessionGeneration, isConnected }, hash),
      queryFn: async () => {
        if (!hash) return [];

        let shouldSort = false;

        // Detect hash change — reset incremental state so the next fetch is a clean full read
        if (prevHashRef.current !== hash) {
          prevHashRef.current = hash;
          peerRidRef.current = 0;
          accumulatedPeersRef.current = [];
          shouldSort = true;
        }

        const response = await bridge.torrents.syncTorrentPeers(hash, peerRidRef.current);

        // Advance the RID for the next incremental poll
        peerRidRef.current = response.rid;

        // Apply incremental peer updates using qBittorrent sync semantics:
        //   - full_update=true  → replace entire peer list (new torrent or server reset)
        //   - peers_removed     → remove departed peers from accumulation
        //   - peers             → merge new/updated peers into accumulation
        if (response.full_update) {
          accumulatedPeersRef.current = [];
          shouldSort = true;
        }

        if (response.peers_removed) {
          const removedKeys = new Set(response.peers_removed);
          accumulatedPeersRef.current = accumulatedPeersRef.current.filter(
            (p) => !removedKeys.has(p.key)
          );
          if (response.peers_removed.length > 0) {
            shouldSort = true;
          }
        }

        if (response.peers) {
          const incoming = Object.entries(response.peers).map(
            ([key, peer]) => ({ key, ...peer } as PeerRow)
          );
          // Merge: existing peers are updated with only the fields present in the
          // delta payload (partial rows); new peers are inserted as full rows.
          const existingMap = new Map(
            accumulatedPeersRef.current.map((p) => [p.key, p])
          );
          for (const peer of incoming) {
            const existing = existingMap.get(peer.key);
            if (existing) {
              // Merge partial delta onto the accumulated row, then normalize.
              existingMap.set(peer.key, normalizePeerRow({ ...existing, ...peer }));
            } else {
              existingMap.set(peer.key, normalizePeerRow(peer));
            }
          }
          accumulatedPeersRef.current = Array.from(existingMap.values());
          if (incoming.length > 0) {
            shouldSort = true;
          }
        }

        // Sort by download speed descending for display consistency
        if (shouldSort) {
          accumulatedPeersRef.current.sort((left, right) => right.dl_speed - left.dl_speed);
        }

        return accumulatedPeersRef.current;
      },
      enabled: enabled && isConnected && isHydrated && !!hash && serverId !== null,
      // Coordinator manages polling via refetch(); disable built-in polling so
      // the coordinator's rid-based cadence is the only driver when enabled.
      staleTime: 0,
      refetchInterval: false,
    });

    return {
      peers,
      isLoading: isLoading || !isHydrated,
      isFetching,
      error,
      refetch,
    };
  }

  function useTorrentWebSeeds(hash: string, opts: UseTorrentDetailOptions = {}) {
    const { enabled = true } = opts;
    const { isConnected, isHydrated, serverId, sessionGeneration } = scopeProvider();

    const { data: webSeeds = [], isLoading, error, refetch, isFetching } = useQuery<WebSeed[]>({
      queryKey: torrentWebseedsKey({ serverId, sessionGeneration, isConnected }, hash),
      queryFn: async () => {
        if (!hash) return [];
        const response = await bridge.torrents.getWebSeeds(hash);
        return response.webseeds ?? [];
      },
      enabled: enabled && isConnected && isHydrated && !!hash && serverId !== null,
      staleTime: 30000,
      refetchInterval: isConnected ? 60000 : false,
    });

    return {
      webSeeds,
      isLoading: isLoading || !isHydrated,
      isFetching,
      error,
      refetch,
    };
  }

  return {
    useTorrentProperties,
    useTorrentTrackers,
    useTorrentFiles,
    useTorrentPeers,
    useTorrentWebSeeds,
  };
}
