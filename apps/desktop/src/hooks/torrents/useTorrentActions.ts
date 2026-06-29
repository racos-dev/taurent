// Desktop torrent actions — thin wrapper around web-core's generic useTorrentActions.
//
// Bridge adapter wiring is delegated to web-core's createTorrentActionsAdapters.
// Desktop-specific return type mapping (rename, moveToTop, etc.) is preserved.

import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useQBClient } from '../../connection';
import {
  useTorrentActions as useTorrentActionsCore,
  createTorrentActionsAdapters,
  type UseTorrentActionsResult,
} from '@taurent/web-core/torrents';

// Re-export options type

/**
 * Desktop torrent actions return shape.
 *
 * Desktop always provides all priority/category/tag operations, so these are
 * typed as required rather than optional (unlike the capability-gated web-core
 * result which marks them as potentially undefined).
 */
type UseDesktopTorrentActionsReturn = Omit<UseTorrentActionsResult, 'delete' | 'setCategory' | 'addTags' | 'removeTags' | 'increasePriority' | 'decreasePriority' | 'topPriority' | 'bottomPriority' | 'rename' | 'relocate' | 'setAutoManagement' | 'setShareLimits' | 'setSequentialDownload' | 'setFirstLastPiecePriority' | 'setSuperSeeding' | 'exportTorrent'> & {
  remove: UseTorrentActionsResult['delete'];
  setCategory: NonNullable<UseTorrentActionsResult['setCategory']>;
  addTags: NonNullable<UseTorrentActionsResult['addTags']>;
  removeTags: NonNullable<UseTorrentActionsResult['removeTags']>;
  increasePriority: NonNullable<UseTorrentActionsResult['increasePriority']>;
  decreasePriority: NonNullable<UseTorrentActionsResult['decreasePriority']>;
  moveToTop: NonNullable<UseTorrentActionsResult['topPriority']>;
  moveToBottom: NonNullable<UseTorrentActionsResult['bottomPriority']>;
  setName: NonNullable<UseTorrentActionsResult['rename']>;
  setLocation: NonNullable<UseTorrentActionsResult['relocate']>;
  setDownloadLimit: NonNullable<UseTorrentActionsResult['setDownloadLimit']>;
  setUploadLimit: NonNullable<UseTorrentActionsResult['setUploadLimit']>;
  setFilePriority: NonNullable<UseTorrentActionsResult['setFilePriority']>;
  setAutoManagement: NonNullable<UseTorrentActionsResult['setAutoManagement']>;
  setShareLimits: NonNullable<UseTorrentActionsResult['setShareLimits']>;
  setSequentialDownload: NonNullable<UseTorrentActionsResult['setSequentialDownload']>;
  setFirstLastPiecePriority: NonNullable<UseTorrentActionsResult['setFirstLastPiecePriority']>;
  setSuperSeeding: NonNullable<UseTorrentActionsResult['setSuperSeeding']>;
  exportTorrent: NonNullable<UseTorrentActionsResult['exportTorrent']>;
};

const adapters = createTorrentActionsAdapters(BridgeAdapter);

export function useTorrentActions(): UseDesktopTorrentActionsReturn {
  const { isConnected, serverId, sessionGeneration } = useQBClient();

  const result = useTorrentActionsCore({
    scope: { serverId, sessionGeneration, isConnected },
    ...adapters,
  });

  return {
    // Always-available shared mutations
    pause: result.pause,
    resume: result.resume,
    forceStart: result.forceStart,
    remove: result.delete,
    recheck: result.recheck,
    reannounce: result.reannounce,
    // Desktop always provides these
    setCategory: result.setCategory!,
    addTags: result.addTags!,
    removeTags: result.removeTags!,
    setName: result.rename!,
    setLocation: result.relocate!,
    increasePriority: result.increasePriority!,
    decreasePriority: result.decreasePriority!,
    moveToTop: result.topPriority!,
    moveToBottom: result.bottomPriority!,
    setDownloadLimit: result.setDownloadLimit!,
    setUploadLimit: result.setUploadLimit!,
    setFilePriority: result.setFilePriority!,
    setAutoManagement: result.setAutoManagement!,
    setShareLimits: result.setShareLimits!,
    setSequentialDownload: result.setSequentialDownload!,
    setFirstLastPiecePriority: result.setFirstLastPiecePriority!,
    setSuperSeeding: result.setSuperSeeding!,
    exportTorrent: result.exportTorrent!,
  };
}

