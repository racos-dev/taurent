// Resource invalidation helper — translates resource-invalidated events
// into targeted query invalidations so stale UI data is refreshed without
// a full session teardown.
//
// Importing this from desktop/mobile is safe because web-core has no Tauri
// dependencies and both apps already depend on it through their hooks.

import type { QueryClient } from '@tanstack/react-query';
import type { ResourceInvalidatedEvent } from '@taurent/bridge';
import {
  invalidateCategories,
  invalidateTags,
  invalidatePreferences,
  invalidateTorrents,
  invalidateTorrentProperties,
  invalidateTorrentTrackers,
  invalidateTorrentFiles,
  invalidateTransferInfo,
  invalidateRss,
  invalidateSearch,
  invalidateSearchPlugins,
} from '../query/invalidation';
import { RESOURCE } from '../query/keys';
import type { QueryScope } from '../query/scope';
import type { QueryInvalidator } from './sessionController';

/**
 * Parse a torrent-detail resource string into its base type and hash.
 * Resource strings for detail resources are expected to be formatted as:
 *   "torrent-properties:<hash>"
 *   "torrent-trackers:<hash>"
 *   "torrent-files:<hash>"
 *
 * Returns the base resource name and hash, or null if the format is unexpected.
 */
function parseTorrentDetailResource(
  resource: string
): { base: string; hash: string } | null {
  const colonIdx = resource.indexOf(':');
  if (colonIdx === -1) return null;
  const base = resource.slice(0, colonIdx);
  const hash = resource.slice(colonIdx + 1);
  if (!hash) return null;
  return { base, hash };
}

/**
 * Handle a `resource-invalidated` Tauri event by invalidating the
 * appropriate query cache entries.
 *
 * This function is idempotent — calling it with an event from a stale
 * session_generation is safe because query keys are scoped by generation.
 */
export function handleResourceInvalidated(
  queryClient: QueryClient,
  event: ResourceInvalidatedEvent
): void {
  const { server_id, session_generation, resource } = event;

  // Build a minimal scope for the invalidation helpers.
  // isConnected is set to true because resource-invalidated events are
  // only emitted when the session is connected.
  const scope: QueryScope = {
    serverId: server_id,
    sessionGeneration: session_generation,
    isConnected: true,
  };

  // Try to parse as a torrent-detail resource first (contains a hash suffix)
  const detail = parseTorrentDetailResource(resource);
  if (detail) {
    switch (detail.base) {
      case RESOURCE.TORRENT_PROPERTIES:
        invalidateTorrentProperties(queryClient, scope, detail.hash);
        return;
      case RESOURCE.TORRENT_TRACKERS:
        invalidateTorrentTrackers(queryClient, scope, detail.hash);
        return;
      case RESOURCE.TORRENT_FILES:
        invalidateTorrentFiles(queryClient, scope, detail.hash);
        return;
    }
  }

  // Handle flat resource names
  switch (resource) {
    case RESOURCE.CATEGORIES:
      invalidateCategories(queryClient, scope);
      break;
    case RESOURCE.TAGS:
      invalidateTags(queryClient, scope);
      break;
    case RESOURCE.PREFERENCES:
      invalidatePreferences(queryClient, scope);
      break;
    case RESOURCE.TORRENTS:
    case RESOURCE.TORRENT_DETAIL:
      // TORRENT_DETAIL is treated as a bulk torrent list invalidation
      invalidateTorrents(queryClient, scope);
      break;
    case RESOURCE.TRANSFER:
      invalidateTransferInfo(queryClient, scope);
      break;
    case RESOURCE.SEARCH:
      invalidateSearch(queryClient, scope);
      break;
    case RESOURCE.SEARCH_PLUGINS:
      invalidateSearchPlugins(queryClient, scope);
      break;
    case RESOURCE.RSS:
      invalidateRss(queryClient, scope);
      break;
    default:
      // Unknown resource — log and bail rather than silently ignoring
      console.warn(`[resourceInvalidation] Unknown resource: "${resource}"`);
      break;
  }
}

/**
 * Creates a standard QueryInvalidator that invalidates torrents, preferences,
 * categories, and tags on connect, and delegates resource-invalidated events
 * to handleResourceInvalidated.
 *
 * Both desktop and mobile use this same invalidation strategy.
 */
export function createDefaultInvalidator(queryClient: QueryClient): QueryInvalidator {
  return {
    invalidateOnConnect: (serverId: string, sessionGeneration: number) => {
      const scope: QueryScope = { serverId, sessionGeneration, isConnected: true };
      invalidateTorrents(queryClient, scope);
      invalidatePreferences(queryClient, scope);
      invalidateCategories(queryClient, scope);
      invalidateTags(queryClient, scope);
      invalidateRss(queryClient, scope);
    },
    handleResourceInvalidated: (event) => handleResourceInvalidated(queryClient, event),
  };
}
