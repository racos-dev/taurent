import { useCallback, useMemo } from 'react';
import { useTorrentStore } from '@taurent/shared/stores';
import {
  matchesTorrentFilter,
  torrentHasTag,
  matchesTorrentTracker,
  FILTER_STATUS_TO_FILTER_TYPE,
  type TorrentFilterType,
  type FilterStatus,
} from '@taurent/shared';
import { useTorrentActions } from '../../hooks/torrents/useTorrentActions';
import { useRemoveCategories } from '../../hooks/platform/useCategories';
import { useDeleteTags } from '../../hooks/platform/useTags';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { emit } from '@tauri-apps/api/event';
import { useQBClient } from '../../connection/QBClientProvider';
import { useLiveTorrentList } from '../../hooks/torrents/useLiveTorrentList';
import { openTorrentDeleteDialogWindow } from '../../windows/dialogs/torrentDeleteDialogWindow';

export function useSidebarActions() {
  // Live torrent list from maindata (no full-array Zustand subscription)
  const torrents = useLiveTorrentList();
  // Categories/tags still come from Zustand (kept mirrored by AppShell)
  const storeCategories = useTorrentStore((state) => state.categories);
  const storeTags = useTorrentStore((state) => state.tags);
  const actions = useTorrentActions();
  const removeCategories = useRemoveCategories();
  const deleteTags = useDeleteTags();
  const { serverId, sessionGeneration } = useQBClient();

  const getHashesByCategory = useCallback(
    (categoryName: string) =>
      torrents.filter((t) => t.category === categoryName).map((t) => t.hash),
    [torrents]
  );

  const getHashesByTag = useCallback(
    (tagName: string) =>
      torrents.filter((t) => torrentHasTag(t, tagName)).map((t) => t.hash),
    [torrents]
  );

  const getHashesByTracker = useCallback(
    (trackerUrl: string) =>
      torrents.filter((t) => matchesTorrentTracker(t, trackerUrl)).map((t) => t.hash),
    [torrents]
  );

  const getHashesByStatus = useCallback(
    (filterType: TorrentFilterType) => {
      if (filterType === 'all') return torrents.map((t) => t.hash);
      return torrents.filter((t) => matchesTorrentFilter(filterType, t)).map((t) => t.hash);
    },
    [torrents]
  );

  const getHashesByFilterStatus = useCallback(
    (status: FilterStatus) => getHashesByStatus(FILTER_STATUS_TO_FILTER_TYPE[status]),
    [getHashesByStatus]
  );

  const resumeTorrents = useCallback(
    (hashes: string[]) => {
      if (hashes.length > 0) actions.resume.mutate(hashes);
    },
    [actions.resume]
  );

  const pauseTorrents = useCallback(
    (hashes: string[]) => {
      if (hashes.length > 0) actions.pause.mutate(hashes);
    },
    [actions.pause]
  );

  const removeTorrents = useCallback(
    (hashes: string[]) => {
      if (hashes.length > 0) {
        void openTorrentDeleteDialogWindow({ hashes, count: hashes.length });
      }
    },
    []
  );

  const removeUnusedCategories = useCallback(() => {
    const categoriesInUse = new Set(torrents.map((t) => t.category));
    const unused = storeCategories
      .filter((c) => c.name !== '' && !categoriesInUse.has(c.name))
      .map((c) => c.name);

    if (unused.length > 0) {
      removeCategories.mutate(unused);
    }
  }, [torrents, storeCategories, removeCategories]);

  const removeUnusedTags = useCallback(() => {
    const tagsInUse = new Set<string>();
    torrents.forEach((t) => {
      if (t.tags) {
        t.tags.split(',').forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) tagsInUse.add(trimmed);
        });
      }
    });

    const unused = storeTags.filter((tag) => !tagsInUse.has(tag));

    if (unused.length > 0) {
      deleteTags.mutate(unused);
    }
  }, [torrents, storeTags, deleteTags]);

  const removeTrackerFromTorrents = useCallback(
    async (trackerUrl: string, hashes: string[]) => {
      for (const hash of hashes) {
        await BridgeAdapter.torrents.removeTrackers(hash, trackerUrl);
      }
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: 'torrents',
      });
    },
    [serverId, sessionGeneration]
  );

  return useMemo(
    () => ({
      getHashesByCategory,
      getHashesByTag,
      getHashesByTracker,
      getHashesByStatus,
      getHashesByFilterStatus,
      resumeTorrents,
      pauseTorrents,
      removeTorrents,
      removeUnusedCategories,
      removeUnusedTags,
      removeTrackerFromTorrents,
    }),
    [
      getHashesByCategory,
      getHashesByTag,
      getHashesByTracker,
      getHashesByStatus,
      getHashesByFilterStatus,
      resumeTorrents,
      pauseTorrents,
      removeTorrents,
      removeUnusedCategories,
      removeUnusedTags,
      removeTrackerFromTorrents,
    ]
  );
}
