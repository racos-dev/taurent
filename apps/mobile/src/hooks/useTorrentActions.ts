// Mobile torrent actions — delegates to useTorrentActionController.
//
// Bridge adapter wiring is delegated to web-core's createTorrentActionsAdapters.
// Returns mutation objects plus isActionPending convenience flag.
// Mobile-friendly aliases are preserved (delete → remove, forceStart → setForceStart).

import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useQBClient } from '../connection/QBClientProvider';
import {
  useTorrentActionController,
  createTorrentActionsAdapters,
} from '@taurent/web-core/torrents';

const adapters = createTorrentActionsAdapters(BridgeAdapter);

function requireAction<T>(action: T | undefined, name: string): T {
  if (action === undefined) {
    throw new Error(`Torrent action "${name}" is not available in the current mobile bridge`);
  }

  return action;
}

export function useTorrentActions() {
  const { isConnected, serverId, sessionGeneration } = useQBClient();

  const actions = useTorrentActionController({
    scope: { serverId, sessionGeneration, isConnected },
    ...adapters,
  });

  return {
    pause: actions.pause,
    resume: actions.resume,
    delete: actions.delete,
    recheck: actions.recheck,
    reannounce: actions.reannounce,
    forceStart: actions.forceStart,
    setForceStart: actions.forceStart,
    setDownloadLimit: requireAction(actions.setDownloadLimit, 'setDownloadLimit'),
    setUploadLimit: requireAction(actions.setUploadLimit, 'setUploadLimit'),
    setFilePriority: requireAction(actions.setFilePriority, 'setFilePriority'),
    setCategory: requireAction(actions.setCategory, 'setCategory'),
    addTags: requireAction(actions.addTags, 'addTags'),
    removeTags: requireAction(actions.removeTags, 'removeTags'),
    rename: requireAction(actions.rename, 'rename'),
    relocate: requireAction(actions.relocate, 'relocate'),
    increasePriority: requireAction(actions.increasePriority, 'increasePriority'),
    decreasePriority: requireAction(actions.decreasePriority, 'decreasePriority'),
    topPriority: requireAction(actions.topPriority, 'topPriority'),
    bottomPriority: requireAction(actions.bottomPriority, 'bottomPriority'),
    isActionPending: actions.isActionPending,
  };
}
