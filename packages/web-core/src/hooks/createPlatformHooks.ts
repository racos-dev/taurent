// Combined platform hooks factory — creates all categories, tags, and settings
// hooks from a single bridge adapter + scope provider.
//
// This eliminates the duplicate adapter wiring that previously existed in both
// desktop and mobile apps. Each app calls createPlatformHooks once with its
// platform-specific BridgeAdapter, and gets back zero-argument hooks.

import { createCategoriesHooks, type CategoriesAdapters } from './useCategories';
import { createTagsHooks, type TagsAdapters } from './useTags';
import { createSettingsHooks, type SettingsAdapters } from './useSettings';
import type { Category, Preferences } from '@taurent/shared';
import type { QBClientContextValue } from '../session';

// The bridge's getPreferences returns a wrapped envelope:
// { session_generation, server_id, preferences: <flat Preferences object> }.
// We only need the inner preferences for the query cache.
interface PreferencesEnvelope {
  preferences: Preferences;
}

interface CategoriesEnvelope {
  categories: Record<string, Category>;
}

interface TagsEnvelope {
  tags: string[];
}

/**
 * Minimal bridge interface for platform hooks.
 * Both DesktopBridge and MobileBridge satisfy this shape.
 */
export interface PlatformHooksBridge {
  categories: {
    getCategories: () => Promise<unknown>;
    createCategory: (name: string, savePath: string) => Promise<unknown>;
    editCategory: (name: string, savePath: string) => Promise<unknown>;
    removeCategories: (names: string[]) => Promise<unknown>;
  };
  tags: {
    getTags: () => Promise<unknown>;
    createTags: (tags: string[]) => Promise<unknown>;
    deleteTags: (tags: string[]) => Promise<unknown>;
    addTorrentTags: (hashes: string[], tags: string[]) => Promise<unknown>;
    removeTorrentTags: (hashes: string[], tags: string[]) => Promise<unknown>;
  };
  torrents: {
    setCategory: (hashes: string[], category: string) => Promise<unknown>;
  };
  application: {
    getPreferences: () => Promise<unknown>;
    setPreferences: (prefs: Record<string, unknown>) => Promise<unknown>;
  };
  transfer: {
    setDownloadLimit: (limit: number) => Promise<unknown>;
    setUploadLimit: (limit: number) => Promise<unknown>;
    toggleSpeedLimitsMode: () => Promise<unknown>;
  };
}

export interface CreatePlatformHooksOptions {
  bridge: PlatformHooksBridge;
  scopeProvider: () => QBClientContextValue;
}

export function createPlatformHooks({ bridge, scopeProvider }: CreatePlatformHooksOptions) {
  const categoriesAdapters: CategoriesAdapters = {
    getCategories: () =>
      bridge.categories.getCategories().then((r) => (r as CategoriesEnvelope).categories),
    createCategory: (name, savePath) => bridge.categories.createCategory(name, savePath),
    editCategory: (name, savePath) => bridge.categories.editCategory(name, savePath),
    removeCategories: (names) => bridge.categories.removeCategories(names),
    setTorrentCategory: (hashes, category) => bridge.torrents.setCategory(hashes, category),
  };

  const tagsAdapters: TagsAdapters = {
    getTags: () => bridge.tags.getTags().then((r) => (r as TagsEnvelope).tags),
    createTags: (tags) => bridge.tags.createTags(tags),
    deleteTags: (tags) => bridge.tags.deleteTags(tags),
    addTorrentTags: (hashes, tags) => bridge.tags.addTorrentTags(hashes, tags),
    removeTorrentTags: (hashes, tags) => bridge.tags.removeTorrentTags(hashes, tags),
  };

  const settingsAdapters: SettingsAdapters = {
    getPreferences: () =>
      bridge.application.getPreferences().then((r) => {
        if (r == null || typeof r !== 'object' || !('preferences' in r)) {
          console.error(
            '[createPlatformHooks] getPreferences: response is not a valid PreferencesEnvelope — expected { preferences: Preferences }, got:',
            r,
          );
          throw new Error(
            '[createPlatformHooks] getPreferences: response is not a valid PreferencesEnvelope',
          );
        }
        return (r as PreferencesEnvelope).preferences;
      }),
    setPreferences: (prefs) => bridge.application.setPreferences(prefs),
    setGlobalDownloadLimit: (limit) => bridge.transfer.setDownloadLimit(limit),
    setGlobalUploadLimit: (limit) => bridge.transfer.setUploadLimit(limit),
    toggleSpeedLimitsMode: () => bridge.transfer.toggleSpeedLimitsMode(),
  };

  return {
    ...createCategoriesHooks({ adapters: categoriesAdapters, scopeProvider }),
    ...createTagsHooks({ adapters: tagsAdapters, scopeProvider }),
    ...createSettingsHooks({ adapters: settingsAdapters, scopeProvider }),
  };
}