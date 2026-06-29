// Transfer command list for desktop — builds context-menu / toolbar commands
// from the shared torrent action controller.
//
// Uses the shared useTorrentActionController for pause/resume/delete/reannounce/recheck/
// forceStart/priority mutations. Remains desktop-specific because:
//   - TransferCommand.shape (icon: Lucide, shortcut, destructive, deferred)
//   - clipboard write (copy hash/name/magnet)
//   - confirmation dialogs (delete)

import { useCallback, useMemo } from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  FolderOpen,
  Hash,
  Link2,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  Tag,
  Trash2,
  Type,
} from '@taurent/shared';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { emit } from '@tauri-apps/api/event';
import { useQBClient } from '../../connection';
import { useTorrentActionController, createTorrentActionsAdapters } from '@taurent/web-core/torrents';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useTorrentSelectionStore } from '@/stores';
import { useLiveTorrentsByHash } from './useLiveTorrentsByHash';
import type { Torrent } from '@taurent/shared';
import { openTorrentDeleteDialogWindow } from '../../windows/dialogs/torrentDeleteDialogWindow';
import { openCategorySelectDialogWindow } from '../../windows/dialogs/categorySelectDialogWindow';
import { openTagSelectDialogWindow } from '../../windows/dialogs/tagSelectDialogWindow';
import { openSettingsWindow } from '../../windows/settings/settingsWindow';
import { dirname } from '../../utils/pathMapping';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';

const adapters = createTorrentActionsAdapters(BridgeAdapter);

export interface TransferCommand {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  enabled: boolean;
  destructive?: boolean;
  deferred?: boolean;
  onClick: () => void;
}

export interface UseTransferCommandListReturn {
  commands: TransferCommand[];
  getSelectionHashes: () => string[];
  selectedTorrents: Torrent[];
  hasSelection: boolean;
  selectionCount: number;
  isConnected: boolean;
  isSingleSelection: boolean;
  isMultiSelection: boolean;
  hasPausedSelection: boolean;
  hasRunnableSelection: boolean;
  hasNonForcedSelection: boolean;
  hasForcedRunningSelection: boolean;
}

function isTorrentPaused(state: string): boolean {
  const normalized = state.toLowerCase();
  return normalized.includes('stopped') || normalized.includes('paused');
}

function isTorrentRunning(state: string): boolean {
  return !isTorrentPaused(state);
}


interface UseTransferCommandListOptions {
  /**
   * When provided, the command list operates on these hashes instead of the
   * global selection store. Used by context menus to target the explicit
   * right-click selection (or clicked-torrent fallback) independently of the
   * global selection state.
   */
  explicitHashes?: string[];
}

function toastTransferCommandError(commandId: string, error: unknown) {
  toast.error(formatUserMessageForContext(error, 'torrent-action'), {
    dedupeKey: `desktop-transfer-command:${commandId}`,
  });
}

export function useTransferCommandList(
  options: UseTransferCommandListOptions = {}
): UseTransferCommandListReturn {
  const { explicitHashes } = options;
  const { isConnected, serverId, sessionGeneration } = useQBClient();

  const actions = useTorrentActionController({
    scope: { serverId, sessionGeneration, isConnected },
    ...adapters,
  });

  const selectedHashes = useTorrentSelectionStore((state) => state.selectedHashes);

  // When explicitHashes is provided (e.g., from a context menu's selectionHashes),
  // operate on that instead of the global store selection. This ensures context-
  // menu lifecycle actions target the correct torrents even when they diverge from
  // the global selection (e.g., right-clicking a non-selected torrent).
  const effectiveHashList = useMemo(
    () => explicitHashes ?? Array.from(selectedHashes),
    [explicitHashes, selectedHashes]
  );

  const hasService = isConnected;
  const hasSelection = effectiveHashList.length > 0;
  const selectionCount = effectiveHashList.length;
  const isSingleSelection = selectionCount === 1;
  const isMultiSelection = selectionCount > 1;

  // Narrow live lookup — re-renders only when the specific torrents change.
  const selectedTorrents = useLiveTorrentsByHash(effectiveHashList);

  const hasPausedSelection = selectedTorrents.some((t) => isTorrentPaused(t.state));
  const hasRunnableSelection = selectedTorrents.some((t) => isTorrentRunning(t.state));
  const hasNonForcedSelection = selectedTorrents.some((t) => !t.force_start);
  // Force-started + running torrents are not paused, but Resume should still be
  // available to let users clear the force-start flag via setForceStart(false).
  const hasForcedRunningSelection = selectedTorrents.some(
    (t) => t.force_start && isTorrentRunning(t.state)
  );

  const targetTorrent = selectedTorrents[0];
  const canCopyTarget = Boolean(targetTorrent);

  const canPause = hasService && hasSelection && hasRunnableSelection;
  const pauseCmd: TransferCommand = {
    id: 'pause',
    label: 'Pause',
    icon: Pause,
    shortcut: 'Ctrl+S',
    enabled: canPause,
    onClick: () => {
      if (!canPause) return;
      void actions.pause.mutateAsync(effectiveHashList).catch((err) => {
        toastTransferCommandError('pause', err);
      });
    },
  };

  const pausedHashes = useMemo(
    () => selectedTorrents.filter((t) => isTorrentPaused(t.state)).map((t) => t.hash),
    [selectedTorrents]
  );
  const forcedRunningHashes = useMemo(
    () => selectedTorrents.filter((t) => t.force_start && isTorrentRunning(t.state)).map((t) => t.hash),
    [selectedTorrents]
  );

  const canResume = hasService && hasSelection && (hasPausedSelection || hasForcedRunningSelection);
  const resumeCmd: TransferCommand = {
    id: 'resume',
    label: 'Resume',
    icon: Play,
    shortcut: 'Enter',
    enabled: canResume,
    onClick: () => {
      if (!canResume) return;
      void Promise.all([
        pausedHashes.length > 0 ? actions.resume.mutateAsync(pausedHashes) : undefined,
        forcedRunningHashes.length > 0
          ? actions.forceStart.mutateAsync({ hashes: forcedRunningHashes, value: false })
          : undefined,
      ]);
    },
  };

  const canRemove = hasService && hasSelection;
  const deleteCmd: TransferCommand = {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    shortcut: 'Delete',
    destructive: true,
    enabled: canRemove,
    onClick: () => {
      if (!canRemove) return;
      void openTorrentDeleteDialogWindow({
        hashes: effectiveHashList,
        count: effectiveHashList.length,
      });
    },
  };

  const canForceStart = hasService && hasSelection && hasNonForcedSelection;
  const forceStartCmd: TransferCommand = {
    id: 'force-start',
    label: 'Force Start',
    icon: Rocket,
    enabled: canForceStart,
    onClick: () => {
      if (!canForceStart) return;
      void actions.forceStart.mutateAsync({ hashes: effectiveHashList, value: true });
    },
  };

  const canRecheck = hasService && hasSelection;
  const recheckCmd: TransferCommand = {
    id: 'recheck',
    label: 'Recheck',
    icon: RefreshCw,
    enabled: canRecheck,
    onClick: () => {
      if (!canRecheck) return;
      void actions.recheck.mutateAsync(effectiveHashList).catch((err) => {
        toastTransferCommandError('recheck', err);
      });
    },
  };

  const canReannounce = hasService && hasSelection;
  const reannounceCmd: TransferCommand = {
    id: 'reannounce',
    label: 'Reannounce',
    icon: RefreshCw,
    enabled: canReannounce,
    onClick: () => {
      if (!canReannounce) return;
      void actions.reannounce.mutateAsync(effectiveHashList);
    },
  };

  const canQueueUp = hasService && hasSelection && Boolean(actions.increasePriority);
  const queueUpCmd: TransferCommand = {
    id: 'queue-up',
    label: 'Queue Up',
    icon: ArrowUp,
    enabled: canQueueUp,
    onClick: () => {
      if (!canQueueUp || !actions.increasePriority) return;
      void actions.increasePriority.mutateAsync(effectiveHashList);
    },
  };

  const canQueueDown = hasService && hasSelection && Boolean(actions.decreasePriority);
  const queueDownCmd: TransferCommand = {
    id: 'queue-down',
    label: 'Queue Down',
    icon: ArrowDown,
    enabled: canQueueDown,
    onClick: () => {
      if (!canQueueDown || !actions.decreasePriority) return;
      void actions.decreasePriority.mutateAsync(effectiveHashList).catch((err) => {
        toastTransferCommandError('queue-down', err);
      });
    },
  };

  const canMoveTop = hasService && hasSelection && Boolean(actions.topPriority);
  const moveTopCmd: TransferCommand = {
    id: 'move-top',
    label: 'Move to Top',
    icon: ArrowUpToLine,
    shortcut: 'Alt+ArrowUp',
    enabled: canMoveTop,
    onClick: () => {
      if (!canMoveTop || !actions.topPriority) return;
      void actions.topPriority.mutateAsync(effectiveHashList);
    },
  };

  const canMoveBottom = hasService && hasSelection && Boolean(actions.bottomPriority);
  const moveBottomCmd: TransferCommand = {
    id: 'move-bottom',
    label: 'Move to Bottom',
    icon: ArrowDownToLine,
    shortcut: 'Alt+ArrowDown',
    enabled: canMoveBottom,
    onClick: () => {
      if (!canMoveBottom || !actions.bottomPriority) return;
      void actions.bottomPriority.mutateAsync(effectiveHashList);
    },
  };

  const copyHashCmd: TransferCommand = {
    id: 'copy-hash',
    label: 'Copy Hash',
    icon: Hash,
    enabled: canCopyTarget && isConnected,
    onClick: () => {
      if (!canCopyTarget || !targetTorrent) return;
      void writeText(targetTorrent.hash);
    },
  };

  const copyNameCmd: TransferCommand = {
    id: 'copy-name',
    label: 'Copy Name',
    icon: Type,
    enabled: canCopyTarget && isConnected,
    onClick: () => {
      if (!canCopyTarget || !targetTorrent) return;
      void writeText(targetTorrent.name);
    },
  };

  const copyMagnetCmd: TransferCommand = {
    id: 'copy-magnet',
    label: 'Copy Magnet URI',
    icon: Link2,
    enabled: canCopyTarget && Boolean(targetTorrent?.magnet_uri) && isConnected,
    onClick: () => {
      if (!canCopyTarget || !targetTorrent?.magnet_uri) return;
      void writeText(targetTorrent.magnet_uri);
    },
  };

  const canOpenFolder = hasService && isSingleSelection;
  const openFolderCmd: TransferCommand = {
    id: 'open-folder',
    label: 'Open Folder',
    icon: FolderOpen,
    enabled: canOpenFolder,
    onClick: () => {
      if (!canOpenFolder || !targetTorrent || !serverId) return;
      const contentPath = targetTorrent.content_path;
      if (!contentPath) return;
      const hash = targetTorrent.hash;
      void (async () => {
        try {
          // Distinguish single-file vs multi-file; revealLocalItem opens the
          // containing folder with the item highlighted.
          const filesResponse = await BridgeAdapter.torrents.getFiles(hash);
          const isSingleFile = Array.isArray(filesResponse) && filesResponse.length === 1;
          const serverPath = isSingleFile ? dirname(contentPath) : contentPath;
          const result = await BridgeAdapter.resolveLocalPath(serverId, serverPath);
          if ('localPath' in result) {
            await BridgeAdapter.revealLocalItem(result.localPath);
          } else {
            await openSettingsWindow('desktop-path-mappings');
            await emit('scroll-to-section', { section: 'desktop-path-mappings' });
          }
        } catch (err) {
          toastTransferCommandError('open-folder', err);
        }
      })();
    },
  };

  const canSetCategory = hasService && hasSelection;
  const setCategoryCmd: TransferCommand = {
    id: 'set-category',
    label: 'Set Category…',
    icon: FolderOpen,
    enabled: canSetCategory,
    onClick: () => {
      if (!canSetCategory) return;
      void openCategorySelectDialogWindow({ hashes: effectiveHashList });
    },
  };

  const canSetTags = hasService && hasSelection;
  const setTagsCmd: TransferCommand = {
    id: 'set-tags',
    label: 'Set Tags…',
    icon: Tag,
    enabled: canSetTags,
    onClick: () => {
      if (!canSetTags) return;
      void openTagSelectDialogWindow({ hashes: effectiveHashList });
    },
  };

  const commands: TransferCommand[] = [
    pauseCmd,
    resumeCmd,
    deleteCmd,
    recheckCmd,
    reannounceCmd,
    forceStartCmd,
    queueUpCmd,
    queueDownCmd,
    moveTopCmd,
    moveBottomCmd,
    copyHashCmd,
    copyNameCmd,
    copyMagnetCmd,
    openFolderCmd,
    setCategoryCmd,
    setTagsCmd,
  ];

  const getSelectionHashes = useCallback(() => effectiveHashList, [effectiveHashList]);

  return {
    commands,
    getSelectionHashes,
    selectedTorrents,
    hasSelection,
    selectionCount,
    isConnected,
    isSingleSelection,
    isMultiSelection,
    hasPausedSelection,
    hasRunnableSelection,
    hasNonForcedSelection,
    hasForcedRunningSelection,
  };
}
