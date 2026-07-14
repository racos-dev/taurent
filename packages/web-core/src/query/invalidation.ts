// Invalidation helpers — centralize the side-band rules for when
// category / tag / preferences / torrent data must be evicted.
//
// These are plain functions that take a QueryClient and scope,
// then call invalidateQueries with the correct key pattern.
// App-local mutations call these instead of re-defining the key inline.
//
// Architecture note: the sync/maindata query is now the primary data source for
// torrents, categories, and tags. When those entities change, invalidating the
// sync-maindata key triggers an immediate re-poll so the UI updates promptly
// instead of waiting for the next 3-second interval.

import type { QueryClient } from '@tanstack/react-query';
import type { QueryScope } from './scope';
import {
  buildCategoriesKey,
  buildTagsKey,
  buildPreferencesKey,
  buildTorrentsKey,
  buildTorrentPropertiesKey,
  buildTorrentTrackersKey,
  buildTorrentFilesKey,
  buildTorrentWebseedsKey,
  buildTorrentPeersKey,
  buildTransferInfoKey,
  buildSyncMaindataKey,
  buildRSSItemsKey,
  buildRSSRulesKey,
  buildSearchKey,
  buildSearchPluginsKey,
} from './keys';

/** Trigger an immediate re-poll of the sync/maindata endpoint. */
function invalidateSyncMaindata(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({
    queryKey: buildSyncMaindataKey(scope.serverId, scope.sessionGeneration),
  });
}

/**
 * Invalidate all category queries for the given scope.
 * Call after create/edit/remove category.
 */
export function invalidateCategories(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildCategoriesKey(scope.serverId, scope.sessionGeneration) });
  invalidateSyncMaindata(queryClient, scope);
}

/**
 * Invalidate all tag queries for the given scope.
 * Call after create/delete tag.
 */
export function invalidateTags(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildTagsKey(scope.serverId, scope.sessionGeneration) });
  invalidateSyncMaindata(queryClient, scope);
}

/**
 * Invalidate all preferences queries for the given scope.
 * Call after setPreferences / setGlobalDownloadLimit / setGlobalUploadLimit.
 */
export function invalidatePreferences(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildPreferencesKey(scope.serverId, scope.sessionGeneration) });
}

/**
 * Invalidate all torrent list queries for the given scope and trigger a sync
 * refetch so the UI reflects mutation results without waiting for the next
 * 3-second poll interval.
 *
 * Call after any operation that changes torrent state: setTorrentCategory,
 * addTorrentTags, removeTorrentTags, pause, resume, delete, recheck, etc.
 */
export function invalidateTorrents(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildTorrentsKey(scope.serverId, scope.sessionGeneration) });
  invalidateSyncMaindata(queryClient, scope);
}

/**
 * Invalidate both categories and torrents.
 * Used after removeCategories (categories are removed and affected torrents need refresh).
 */
export function invalidateCategoriesAndTorrents(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildCategoriesKey(scope.serverId, scope.sessionGeneration) });
  queryClient.invalidateQueries({ queryKey: buildTorrentsKey(scope.serverId, scope.sessionGeneration) });
  invalidateSyncMaindata(queryClient, scope);
}

/**
 * Invalidate both tags and torrents.
 * Used after deleteTags.
 */
export function invalidateTagsAndTorrents(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildTagsKey(scope.serverId, scope.sessionGeneration) });
  queryClient.invalidateQueries({ queryKey: buildTorrentsKey(scope.serverId, scope.sessionGeneration) });
  invalidateSyncMaindata(queryClient, scope);
}

/**
 * Invalidate torrent properties for a specific hash.
 * Call after setName, setLocation, or other property-affecting mutations.
 */
export function invalidateTorrentProperties(queryClient: QueryClient, scope: QueryScope, hash: string): void {
  queryClient.invalidateQueries({ queryKey: buildTorrentPropertiesKey(scope.serverId, scope.sessionGeneration, hash) });
}

/**
 * Invalidate torrent trackers for a specific hash.
 * Call after reannounce.
 */
export function invalidateTorrentTrackers(queryClient: QueryClient, scope: QueryScope, hash: string): void {
  queryClient.invalidateQueries({ queryKey: buildTorrentTrackersKey(scope.serverId, scope.sessionGeneration, hash) });
}

/**
 * Invalidate torrent files for a specific hash.
 * Call after setFilePriority.
 */
export function invalidateTorrentFiles(queryClient: QueryClient, scope: QueryScope, hash: string): void {
  queryClient.invalidateQueries({ queryKey: buildTorrentFilesKey(scope.serverId, scope.sessionGeneration, hash) });
}

/**
 * Invalidate torrent web seeds for a specific hash.
 * Call after add/edit/remove web seed operations.
 */
export function invalidateTorrentWebseeds(queryClient: QueryClient, scope: QueryScope, hash: string): void {
  queryClient.invalidateQueries({ queryKey: buildTorrentWebseedsKey(scope.serverId, scope.sessionGeneration, hash) });
}

/**
 * Invalidate all torrent detail resources (properties, trackers, files) for a specific hash.
 * Use when a mutation affects multiple detail views.
 */
export function invalidateTorrentDetails(queryClient: QueryClient, scope: QueryScope, hash: string): void {
  invalidateTorrentProperties(queryClient, scope, hash);
  invalidateTorrentTrackers(queryClient, scope, hash);
  invalidateTorrentFiles(queryClient, scope, hash);
  invalidateTorrentWebseeds(queryClient, scope, hash);
}

/**
 * Invalidate transfer info for the given scope.
 * Call after toggleSpeedLimitsMode, setDownloadLimit, setUploadLimit, banPeers.
 * Also triggers a sync/maindata re-poll so server_state (speeds, alt limits) updates immediately.
 */
export function invalidateTransferInfo(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildTransferInfoKey(scope.serverId, scope.sessionGeneration) });
  invalidateSyncMaindata(queryClient, scope);
}

/**
 * Invalidate torrent peers for a specific hash.
 * Call after banPeers or any peer-affecting mutation.
 */
export function invalidateTorrentPeers(queryClient: QueryClient, scope: QueryScope, hash: string): void {
  queryClient.invalidateQueries({ queryKey: buildTorrentPeersKey(scope.serverId, scope.sessionGeneration, hash) });
}

/**
 * Invalidate all search queries for the given scope.
 * Call after startSearch, stopSearch, deleteSearch.
 */
export function invalidateSearch(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildSearchKey(scope.serverId, scope.sessionGeneration) });
}

/**
 * Invalidate all search plugin queries for the given scope.
 * Call after installSearchPlugin, uninstallSearchPlugin, enableSearchPlugin, updateSearchPlugins.
 */
export function invalidateSearchPlugins(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildSearchPluginsKey(scope.serverId, scope.sessionGeneration) });
}

/**
 * Invalidate both RSS items and rules queries for the given scope.
 * Call after any RSS mutation: add/edit/remove feed, create/edit/rename/remove rule.
 */
export function invalidateRss(queryClient: QueryClient, scope: QueryScope): void {
  queryClient.invalidateQueries({ queryKey: buildRSSItemsKey(scope.serverId, scope.sessionGeneration) });
  queryClient.invalidateQueries({ queryKey: buildRSSRulesKey(scope.serverId, scope.sessionGeneration) });
}
