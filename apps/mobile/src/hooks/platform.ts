// Mobile platform hooks — single factory call wires BridgeAdapter to all
// categories, tags, and settings hooks via web-core's createPlatformHooks.

import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useQBClient } from '../connection';
import { createPlatformHooks } from '@taurent/web-core/hooks';

export const {
  useCategories,
  useCreateCategory,
  useEditCategory,
  useRemoveCategories,
  useSetTorrentCategory,
  useTags,
  useCreateTags,
  useDeleteTags,
  useAddTorrentTags,
  useRemoveTorrentTags,
  usePreferences,
  useUpdatePreference,
  useSetPreferences,
  useSetGlobalDownloadLimit,
  useSetGlobalUploadLimit,
  useToggleSpeedLimitsMode,
} = createPlatformHooks({ bridge: BridgeAdapter, scopeProvider: useQBClient });
