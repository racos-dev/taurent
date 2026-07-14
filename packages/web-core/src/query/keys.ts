// Canonical query key factories — ensures consistent keys across desktop and mobile.
// All keys are scoped by serverId + sessionGeneration to coallesce invalidation
// when the session changes (server switch, reconnect, etc.).
//
// Key shape: [resource, serverId, sessionGeneration, ...detail]
//
// Consumer hooks receive a QueryScope and call the factory to build their key array.

import type { QueryScope } from './scope';

export interface TorrentListKeyParams {
  filter?: string;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
}

/** Base resource names */
export const RESOURCE = {
  CATEGORIES: 'categories',
  TAGS: 'tags',
  PREFERENCES: 'preferences',
  TORRENTS: 'torrents',
  TORRENT_DETAIL: 'torrent-detail',
  TORRENT_PROPERTIES: 'torrent-properties',
  TORRENT_TRACKERS: 'torrent-trackers',
  TORRENT_FILES: 'torrent-files',
  TORRENT_PEERS: 'torrent-peers',
  TORRENT_WEBSEEDS: 'torrent-webseeds',
  TRANSFER: 'transfer',
  SYNC_MAINDATA: 'sync-maindata',
  RSS: 'rss',
  SEARCH: 'search',
  SEARCH_PLUGINS: 'search-plugins',
} as const;

// ---------------------------------------------------------------------------
// Scope-based key factories
// ---------------------------------------------------------------------------

/**
 * Categories list key.
 * Detail overload for a single category name when needed.
 */
export function categoriesKey(scope: QueryScope, categoryName?: string): (string | null | number)[] {
  return categoryName !== undefined
    ? [RESOURCE.CATEGORIES, scope.serverId, scope.sessionGeneration, categoryName]
    : [RESOURCE.CATEGORIES, scope.serverId, scope.sessionGeneration];
}

/** Tags list key */
export function tagsKey(scope: QueryScope): (string | null | number)[] {
  return [RESOURCE.TAGS, scope.serverId, scope.sessionGeneration];
}

/** App-level preferences key */
export function preferencesKey(scope: QueryScope): (string | null | number)[] {
  return [RESOURCE.PREFERENCES, scope.serverId, scope.sessionGeneration];
}

/** Full torrent list key */
export function torrentsKey(scope: QueryScope, params?: TorrentListKeyParams): (string | null | number | boolean | undefined)[] {
  return [
    RESOURCE.TORRENTS,
    scope.serverId,
    scope.sessionGeneration,
    params?.filter,
    params?.category,
    params?.tag,
    params?.sort,
    params?.reverse,
    params?.limit,
    params?.offset,
  ];
}

/** Single torrent detail key (hash is the detail identifier) */
export function torrentDetailKey(scope: QueryScope, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_DETAIL, scope.serverId, scope.sessionGeneration, hash];
}

/** Torrent properties key for a specific hash */
export function torrentPropertiesKey(scope: QueryScope, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_PROPERTIES, scope.serverId, scope.sessionGeneration, hash];
}

/** Torrent trackers key for a specific hash */
export function torrentTrackersKey(scope: QueryScope, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_TRACKERS, scope.serverId, scope.sessionGeneration, hash];
}

/** Torrent files key for a specific hash */
export function torrentFilesKey(scope: QueryScope, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_FILES, scope.serverId, scope.sessionGeneration, hash];
}

/** Torrent peers key for a specific hash */
export function torrentPeersKey(scope: QueryScope, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_PEERS, scope.serverId, scope.sessionGeneration, hash];
}

/** Torrent web seeds key for a specific hash */
export function torrentWebseedsKey(scope: QueryScope, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_WEBSEEDS, scope.serverId, scope.sessionGeneration, hash];
}

/** Transfer query key. Optional detail segments distinguish transfer resources. */
export function transferInfoKey(scope: QueryScope, detail?: string): (string | null | number)[] {
  return detail !== undefined
    ? [RESOURCE.TRANSFER, scope.serverId, scope.sessionGeneration, detail]
    : [RESOURCE.TRANSFER, scope.serverId, scope.sessionGeneration];
}

/**
 * Convenience: build the full categories queryKey matching what useCategories
 * produces — useful in useMutation onSuccess handlers.
 */
export function buildCategoriesKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.CATEGORIES, serverId, sessionGeneration];
}

/**
 * Convenience: build the full tags queryKey matching what useTags produces.
 */
export function buildTagsKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.TAGS, serverId, sessionGeneration];
}

/**
 * Convenience: build the full preferences queryKey.
 */
export function buildPreferencesKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.PREFERENCES, serverId, sessionGeneration];
}

/**
 * Convenience: build the full torrents list queryKey.
 */
export function buildTorrentsKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.TORRENTS, serverId, sessionGeneration];
}

/**
 * Convenience: build the full torrent properties queryKey for a specific hash.
 */
export function buildTorrentPropertiesKey(serverId: string | null, sessionGeneration: number, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_PROPERTIES, serverId, sessionGeneration, hash];
}

/**
 * Convenience: build the full torrent trackers queryKey for a specific hash.
 */
export function buildTorrentTrackersKey(serverId: string | null, sessionGeneration: number, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_TRACKERS, serverId, sessionGeneration, hash];
}

/**
 * Convenience: build the full torrent files queryKey for a specific hash.
 */
export function buildTorrentFilesKey(serverId: string | null, sessionGeneration: number, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_FILES, serverId, sessionGeneration, hash];
}

/**
 * Convenience: build the full torrent web seeds queryKey for a specific hash.
 */
export function buildTorrentWebseedsKey(serverId: string | null, sessionGeneration: number, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_WEBSEEDS, serverId, sessionGeneration, hash];
}

/**
 * Convenience: build the full transfer queryKey.
 * Omitting `detail` returns the transfer-scope prefix for broad invalidation.
 */
export function buildTransferInfoKey(serverId: string | null, sessionGeneration: number, detail?: string): (string | null | number)[] {
  return detail !== undefined
    ? [RESOURCE.TRANSFER, serverId, sessionGeneration, detail]
    : [RESOURCE.TRANSFER, serverId, sessionGeneration];
}

/**
 * Convenience: build the full sync-maindata queryKey.
 * Used to trigger an immediate sync refetch after mutations.
 */
export function buildSyncMaindataKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.SYNC_MAINDATA, serverId, sessionGeneration];
}

/**
 * Convenience: build the full search queryKey.
 */
export function buildSearchKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.SEARCH, serverId, sessionGeneration];
}

/**
 * Convenience: build the full search plugins queryKey.
 */
export function buildSearchPluginsKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.SEARCH_PLUGINS, serverId, sessionGeneration];
}

/**
 * Convenience: build the full torrent peers queryKey for a specific hash.
 */
export function buildTorrentPeersKey(serverId: string | null, sessionGeneration: number, hash: string): (string | null | number)[] {
  return [RESOURCE.TORRENT_PEERS, serverId, sessionGeneration, hash];
}

/**
 * Convenience: build the full RSS items queryKey.
 */
export function buildRSSItemsKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.RSS, serverId, sessionGeneration, 'items'];
}

/**
 * Convenience: build the full RSS rules queryKey.
 */
export function buildRSSRulesKey(serverId: string | null, sessionGeneration: number): (string | null | number)[] {
  return [RESOURCE.RSS, serverId, sessionGeneration, 'rules'];
}
