// Hooks barrel — single source of truth for mobile app hooks.
// Platform-specific wiring for web-core factories lives here.

import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useQBClient, useMaindataState } from '../connection/QBClientProvider';
import { createTorrentsHook } from '@taurent/web-core/hooks';
import { createAddTorrentHook } from '@taurent/web-core/torrents';
import { createMobileHomeController } from '@taurent/web-core/screens';

// Inlined platform wiring — all logic lives in @taurent/web-core.
//
// P2.4 Renderer adoption: `createTorrentsHook` receives the bridge adapter
// directly so it can branch on `bridge.capabilities.supportsWorkspaceViewRust`
// to consume the Rust-owned `workspace-view-changed` event when available.
export const useTorrents = createTorrentsHook(useMaindataState, BridgeAdapter);
export const useMobileHomeController = createMobileHomeController(useQBClient);
export const useAddTorrent = createAddTorrentHook({
  bridge: BridgeAdapter,
  scopeProvider: useQBClient,
});
export type { AddTorrentOptions } from '@taurent/bridge';

export { useTorrentActions } from './useTorrentActions';
export { useSelection } from './useSelection';
export { useSortPreference } from './useSortPreference';
export {
  useTorrentProperties,
  useTorrentTrackers,
  useTorrentFiles,
  useTorrentPeers,
} from './useTorrentDetails';
export {
  usePreferences,
  useUpdatePreference,
  useSetPreferences,
  useSetGlobalDownloadLimit,
  useSetGlobalUploadLimit,
  useToggleSpeedLimitsMode,
} from './useSettings';
export { useFilterState, type FilterState } from './useFilterState';
export type { TorrentFilterType } from '@taurent/shared';
export {
  useCategories,
  useCreateCategory,
  useEditCategory,
  useRemoveCategories,
  useSetTorrentCategory,
} from './useCategories';
export {
  useTags,
  useCreateTags,
  useDeleteTags,
  useAddTorrentTags,
  useRemoveTorrentTags,
} from './useTags';
export { useFiltersFormState } from '@taurent/web-core/hooks';
export { useFilterSummary } from '@taurent/web-core/hooks';

// Screen-model hooks — compose useQBClient + BridgeAdapter + web-core model
export { useSearchScreen } from './useSearchScreen';
export { useRssScreen } from './useRssScreen';
export { useTorrentDetailMutations } from './useTorrentDetailMutations';
export type { UseTorrentDetailMutationsOptions } from './useTorrentDetailMutations';
export { useRemoteShutdownMutation } from './useRemoteShutdown';
