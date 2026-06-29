// Torrent actions adapter factory — creates the bridge adapter mapping
// for useTorrentActionsCore from a platform BridgeAdapter.
//
// Both desktop and mobile pass identical bridge adapter wiring to useTorrentActionsCore.
// This factory eliminates that duplication.

import type { UseTorrentActionsOptions } from './useTorrentActions';

type TorrentActionsAdapters = Omit<UseTorrentActionsOptions, 'scope'>;

/**
 * Minimal bridge interface for torrent actions.
 * Both DesktopBridge and MobileBridge satisfy this shape.
 */
export interface TorrentActionsBridge {
  torrents: {
    pause: (hashes: string[]) => Promise<unknown>;
    resume: (hashes: string[]) => Promise<unknown>;
    delete: (hashes: string[], deleteFiles: boolean) => Promise<unknown>;
    recheck: (hashes: string[]) => Promise<unknown>;
    reannounce: (hashes: string[]) => Promise<unknown>;
    setForceStart: (hashes: string[], value: boolean) => Promise<unknown>;
    setCategory: (hashes: string[], category: string) => Promise<unknown>;
    addTags: (hashes: string[], tags: string[]) => Promise<unknown>;
    removeTags: (hashes: string[], tags: string[]) => Promise<unknown>;
    setName: (hash: string, name: string) => Promise<unknown>;
    setLocation: (hashes: string[], location: string) => Promise<unknown>;
    increasePriority: (hashes: string[]) => Promise<unknown>;
    decreasePriority: (hashes: string[]) => Promise<unknown>;
    topPriority: (hashes: string[]) => Promise<unknown>;
    bottomPriority: (hashes: string[]) => Promise<unknown>;
    setDownloadLimit: (hashes: string[], limit: number) => Promise<unknown>;
    setUploadLimit: (hashes: string[], limit: number) => Promise<unknown>;
    setFilePriority: (hash: string, ids: number[], priority: number) => Promise<unknown>;
    setAutoManagement: (hashes: string[], enable: boolean) => Promise<unknown>;
    setShareLimits: (hashes: string[], ratioLimit: number, seedingTimeLimit: number) => Promise<unknown>;
    setSequentialDownload: (hashes: string[], value: boolean) => Promise<unknown>;
    setFirstLastPiecePriority: (hashes: string[], value: boolean) => Promise<unknown>;
    setSuperSeeding: (hashes: string[], value: boolean) => Promise<unknown>;
    exportTorrent: (hash: string, savePath: string) => Promise<unknown>;
  };
}

/**
 * Creates the adapter options for useTorrentActionsCore from a platform BridgeAdapter.
 * The returned object can be spread into useTorrentActionsCore({ scope, ...adapters }).
 */
export function createTorrentActionsAdapters(bridge: TorrentActionsBridge): TorrentActionsAdapters {
  return {
    pauseTorrents: async (hashes) => { await bridge.torrents.pause(hashes); },
    resumeTorrents: async (hashes) => { await bridge.torrents.resume(hashes); },
    deleteTorrents: async ({ hashes, deleteFiles }) => { await bridge.torrents.delete(hashes, deleteFiles); },
    recheckTorrents: async (hashes) => { await bridge.torrents.recheck(hashes); },
    reannounceTorrents: async (hashes) => { await bridge.torrents.reannounce(hashes); },
    setForceStart: async ({ hashes, value }) => { await bridge.torrents.setForceStart(hashes, value); },
    setCategory: async ({ hashes, category }) => { await bridge.torrents.setCategory(hashes, category); },
    addTags: async ({ hashes, tags }) => { await bridge.torrents.addTags(hashes, tags); },
    removeTags: async ({ hashes, tags }) => { await bridge.torrents.removeTags(hashes, tags); },
    setName: async ({ hash, name }) => { await bridge.torrents.setName(hash, name); },
    setLocation: async ({ hashes, newLocation }) => { await bridge.torrents.setLocation(hashes, newLocation); },
    increasePriority: async (hashes) => { await bridge.torrents.increasePriority(hashes); },
    decreasePriority: async (hashes) => { await bridge.torrents.decreasePriority(hashes); },
    topPriority: async (hashes) => { await bridge.torrents.topPriority(hashes); },
    bottomPriority: async (hashes) => { await bridge.torrents.bottomPriority(hashes); },
    setDownloadLimit: async ({ hashes, limit }) => { await bridge.torrents.setDownloadLimit(hashes, limit); },
    setUploadLimit: async ({ hashes, limit }) => { await bridge.torrents.setUploadLimit(hashes, limit); },
    setFilePriority: async ({ hash, fileIds, priority }) => { await bridge.torrents.setFilePriority(hash, fileIds, priority); },
    setAutoManagement: async ({ hashes, enable }) => { await bridge.torrents.setAutoManagement(hashes, enable); },
    setShareLimits: async ({ hashes, ratioLimit, seedingTimeLimit }) => { await bridge.torrents.setShareLimits(hashes, ratioLimit, seedingTimeLimit); },
    setSequentialDownload: async ({ hashes, value }) => { await bridge.torrents.setSequentialDownload(hashes, value); },
    setFirstLastPiecePriority: async ({ hashes, value }) => { await bridge.torrents.setFirstLastPiecePriority(hashes, value); },
    setSuperSeeding: async ({ hashes, value }) => { await bridge.torrents.setSuperSeeding(hashes, value); },
    exportTorrent: (async ({ hash, savePath }: { hash: string; savePath: string }) => { await bridge.torrents.exportTorrent(hash, savePath); return undefined as void; }) as (vars: { hash: string; savePath: string }) => Promise<void>,
  };
}
