// Torrents module — shared torrent action hooks

export * from './useTorrentActions';
export * from './useAddTorrent';
export { createTorrentActionsAdapters } from './createTorrentActionsAdapters';
export type { TorrentActionsBridge } from './createTorrentActionsAdapters';
export { createAddTorrentHook } from './createAddTorrentHook';
export type { AddTorrentBridge } from './createAddTorrentHook';
export { useTorrentActionController } from './useTorrentActionController';
export type { UseTorrentActionControllerOptions, UseTorrentActionControllerResult } from './useTorrentActionController';
