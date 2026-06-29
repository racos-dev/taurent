// Headless torrent action controller — centralizes action execution, pending-state
// derivation, and batch/single-torrent orchestration.
 //
 // Platform-agnostic — does not import @tauri-apps/* or produce UI.
 //
 // Usage:
 //   const actions = useTorrentActionController({ scope, ...adapters });
 //   await actions.pause.mutateAsync(['hash1', 'hash2']);
 //   const pending = actions.isActionPending;
 //
 // For screens that need presentation descriptors (icon, label, tone), compose
 // helpers from web-ui instead.

import type { QueryScope } from '../query/scope';
import type { UseTorrentActionsResult } from './useTorrentActions';
import { useTorrentActions } from './useTorrentActions';

export interface UseTorrentActionControllerOptions {
  scope: QueryScope;
  pauseTorrents: (hashes: string[]) => Promise<void>;
  resumeTorrents: (hashes: string[]) => Promise<void>;
  deleteTorrents: (vars: { hashes: string[]; deleteFiles: boolean }) => Promise<void>;
  recheckTorrents: (hashes: string[]) => Promise<void>;
  reannounceTorrents: (hashes: string[]) => Promise<void>;
  setForceStart: (vars: { hashes: string[]; value: boolean }) => Promise<void>;
  setDownloadLimit?: (vars: { hashes: string[]; limit: number }) => Promise<void>;
  setUploadLimit?: (vars: { hashes: string[]; limit: number }) => Promise<void>;
  setFilePriority?: (vars: { hash: string; fileIds: number[]; priority: number }) => Promise<void>;
  setName?: (vars: { hash: string; name: string }) => Promise<void>;
  setLocation?: (vars: { hashes: string[]; newLocation: string }) => Promise<void>;
  increasePriority?: (hashes: string[]) => Promise<void>;
  decreasePriority?: (hashes: string[]) => Promise<void>;
  topPriority?: (hashes: string[]) => Promise<void>;
  bottomPriority?: (hashes: string[]) => Promise<void>;
  setCategory?: (vars: { hashes: string[]; category: string }) => Promise<void>;
  addTags?: (vars: { hashes: string[]; tags: string[] }) => Promise<void>;
  removeTags?: (vars: { hashes: string[]; tags: string[] }) => Promise<void>;
  setAutoManagement?: (vars: { hashes: string[]; enable: boolean }) => Promise<void>;
  setShareLimits?: (vars: { hashes: string[]; ratioLimit: number; seedingTimeLimit: number }) => Promise<void>;
  setSequentialDownload?: (vars: { hashes: string[]; value: boolean }) => Promise<void>;
  setFirstLastPiecePriority?: (vars: { hashes: string[]; value: boolean }) => Promise<void>;
  setSuperSeeding?: (vars: { hashes: string[]; value: boolean }) => Promise<void>;
  exportTorrent?: (vars: { hash: string; savePath: string }) => Promise<void>;
}

/**
 * Headless action controller result.
 *
 * Exposes all mutation objects from useTorrentActions plus a derived
 * `isActionPending` boolean for convenience in UI feedback.
 *
 * Screen-specific presentation (icon/label/tone) is NOT included here —
 * use web-ui model helpers for that.
 */
export interface UseTorrentActionControllerResult extends UseTorrentActionsResult {
  /** True when any mutation is currently in-flight */
  isActionPending: boolean;
}

/**
 * Returns a derived pending flag by checking all mutation isPending flags.
 * Used internally; exposed on the result for consumer convenience.
 */
function computeIsActionPending(actions: UseTorrentActionsResult): boolean {
  return (
    actions.pause.isPending ||
    actions.resume.isPending ||
    actions.delete.isPending ||
    actions.recheck.isPending ||
    actions.reannounce.isPending ||
    actions.forceStart.isPending ||
    actions.setDownloadLimit?.isPending ||
    actions.setUploadLimit?.isPending ||
    actions.setFilePriority?.isPending ||
    actions.rename?.isPending ||
    actions.relocate?.isPending ||
    actions.increasePriority?.isPending ||
    actions.decreasePriority?.isPending ||
    actions.topPriority?.isPending ||
    actions.bottomPriority?.isPending ||
    actions.setCategory?.isPending ||
    actions.addTags?.isPending ||
    actions.removeTags?.isPending ||
    actions.setAutoManagement?.isPending ||
    actions.setShareLimits?.isPending ||
    actions.setSequentialDownload?.isPending ||
    actions.setFirstLastPiecePriority?.isPending ||
    actions.setSuperSeeding?.isPending ||
    actions.exportTorrent?.isPending ||
    false
  );
}

/**
 * Headless torrent action controller.
 *
 * Thin wrapper over useTorrentActions that adds a convenience `isActionPending`
 * flag aggregating all mutation pending states. No presentation, no dialogs,
 * no screen-specific logic.
 */
export function useTorrentActionController(
  options: UseTorrentActionControllerOptions
): UseTorrentActionControllerResult {
  const actions = useTorrentActions(options);
  const isActionPending = computeIsActionPending(actions);

  return {
    ...actions,
    isActionPending,
  };
}