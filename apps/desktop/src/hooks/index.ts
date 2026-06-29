// Hooks barrel — single source of truth for desktop app hooks.
// Platform-specific wiring for web-core factories lives here.

import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useQBClient } from '../connection/QBClientProvider';
import { createAddTorrentHook } from '@taurent/web-core/torrents';
import {
  createTorrentWorkspaceController,
  createTorrentWorkspaceViewProvider,
  createTorrentWorkspaceListController,
  createTorrentWorkspaceSidebarController,
  createTorrentWorkspaceSummaryController,
} from '@taurent/web-core/screens';
import { useLiveTorrentList } from './torrents/useLiveTorrentList';

// ─── Workspace controllers (narrow, correct wiring) ───────────────────────────

export const TorrentWorkspaceViewProvider = createTorrentWorkspaceViewProvider(
  BridgeAdapter,
  useLiveTorrentList,
);

/**
 * Full workspace controller for legacy callers. The AppShell-level
 * TorrentWorkspaceViewProvider owns the Rust workspace-view subscription;
 * controllers below consume narrow slices from that shared projection.
 */
export const useTorrentWorkspaceController = createTorrentWorkspaceController(
  BridgeAdapter,
  useLiveTorrentList,
);

/**
 * List-only controller for HomeScreen — derives only sorted/filtered torrent list
 * and sort/filter state from the shared AppShell projection.
 */
export const useTorrentWorkspaceListController = createTorrentWorkspaceListController(
  BridgeAdapter,
  useLiveTorrentList,
);

/**
 * Sidebar-only controller — derives only statusCounts and sidebar view models.
 * Does not issue its own Rust workspace-view request.
 */
export const useTorrentWorkspaceSidebarController = createTorrentWorkspaceSidebarController(
  BridgeAdapter,
  useLiveTorrentList,
);

/**
 * Summary-only controller for StatusBar — derives only filteredCount, totalCount,
 * and isFiltered without issuing its own Rust workspace-view request.
 */
export const useTorrentWorkspaceSummaryController = createTorrentWorkspaceSummaryController(
  BridgeAdapter,
  useLiveTorrentList,
);

// ─── Rest of hooks (unchanged) ───────────────────────────────────────────────

export const useAddTorrent = createAddTorrentHook({
  bridge: BridgeAdapter,
  scopeProvider: useQBClient,
});

export {
  useCategories,
  useCreateCategory,
  useRemoveCategories,
  useSetTorrentCategory,
} from './platform/useCategories';
export {
  useTags,
  useCreateTags,
  useDeleteTags,
  useAddTorrentTags,
  useRemoveTorrentTags,
} from './platform/useTags';
export {
  usePreferences,
  useToggleSpeedLimitsMode,
} from './settings/useSettings';
export { useFiltersFormState } from '@taurent/web-core/hooks';
