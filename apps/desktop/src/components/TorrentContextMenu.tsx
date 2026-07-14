import { useMemo, useCallback } from 'react';
import {
  FolderOpen,
  Play,
  Pause,
  Rocket,
  Tag,
  Trash2,
  Type,
  RefreshCw,
  Copy,
  HardDrive,
  ArrowUpFromLine,
  ArrowDownFromLine,
  Download,
} from '@taurent/shared';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useQBClient } from '../connection';
import { useTransferCommandList } from '../hooks/torrents/useTransferCommandList';
import { useCategories, useSetTorrentCategory } from '../hooks';
import { useTags, useAddTorrentTags, useRemoveTorrentTags } from '../hooks';
import { useTorrentActions } from '../hooks/torrents/useTorrentActions';
import { getTorrentDisplayStatus, parseTorrentTags } from '@taurent/shared';
import { pickSavePath } from '../platform';
import { openTorrentTextDialogWindow } from '../windows/dialogs/torrentTextDialogWindow';
import { openTorrentNumericDialogWindow } from '../windows/dialogs/torrentNumericDialogWindow';
import { openTorrentShareLimitsDialogWindow } from '../windows/dialogs/torrentShareLimitsDialogWindow';
import { openCreateDialogWindow } from '../windows/dialogs/createDialogWindow';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import type { Torrent } from '@taurent/shared';
import { ContextMenu } from '@taurent/web-ui';
import type { ContextMenuItem as TContextMenuItem } from '@taurent/web-ui';
import type React from 'react';


function CheckIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

interface TorrentContextMenuProps {
  x: number;
  y: number;
  torrent: Torrent;
  selectedHashes: Set<string>;
  onClose: () => void;
}

type DialogType =
  | 'rename'
  | 'setLocation'
  | 'limitDownload'
  | 'limitUpload'
  | 'newCategory'
  | 'addTag'
  | 'shareLimits';

export function TorrentContextMenu({
  x,
  y,
  torrent,
  selectedHashes,
  onClose,
}: TorrentContextMenuProps) {



  // Compute selection hashes
  const selectionHashes = useMemo(() => {
    if (selectedHashes.size > 0) {
      return Array.from(selectedHashes);
    }
    return [torrent.hash];
  }, [selectedHashes, torrent.hash]);

  const { commands, selectedTorrents, hasSelection, isConnected: hasService } = useTransferCommandList({ explicitHashes: selectionHashes });

  const targetTorrent = selectedTorrents.find((item) => item.hash === torrent.hash) ?? torrent;

  // Compute display status for each selected torrent
  const selectedDisplayStatuses = useMemo(() => {
    return selectedTorrents.map((t) => getTorrentDisplayStatus(t));
  }, [selectedTorrents]);

  const hasDownloadingSelection = selectedDisplayStatuses.some((s) => s === 'downloading');
  const hasSeedingSelection = selectedDisplayStatuses.some((s) => s === 'seeding' || s === 'completed');
  const hasIncompleteSelection = selectedTorrents.some((t) => t.progress < 1);
  const isDownloadingSelection = hasDownloadingSelection && !hasSeedingSelection;
  const isSeedingSelection = hasSeedingSelection && !hasDownloadingSelection;
  const isMixedDownloadingAndSeedingSelection = hasDownloadingSelection && hasSeedingSelection;

  // Capabilities
  const { capabilities } = useQBClient();

  // Torrent actions
  const actions = useTorrentActions();

  // Category hooks
  const { categories } = useCategories();

  const setTorrentCategory = useSetTorrentCategory();

  // Tag hooks
  const { tags } = useTags();

  const addTorrentTags = useAddTorrentTags();
  const removeTorrentTags = useRemoveTorrentTags();

  const openDialog = useCallback((type: DialogType) => {
    if (type === 'rename') {
      void openTorrentTextDialogWindow({
        type: 'rename',
        value: targetTorrent.name,
        hashes: selectionHashes,
      });
    } else if (type === 'setLocation') {
      void openTorrentTextDialogWindow({
        type: 'setLocation',
        value: targetTorrent.save_path ?? '',
        hashes: selectionHashes,
      });
    } else if (type === 'limitDownload') {
      void BridgeAdapter.torrents.getDownloadLimit(selectionHashes).then((result) => {
        const raw = (result as { limit?: number })?.limit;
        const value = typeof raw === 'number' ? raw : 0;
        void openTorrentNumericDialogWindow({
          type: 'download',
          value,
          hashes: selectionHashes,
        });
      });
    } else if (type === 'limitUpload') {
      void BridgeAdapter.torrents.getUploadLimit(selectionHashes).then((result) => {
        const raw = (result as { limit?: number })?.limit;
        const value = typeof raw === 'number' ? raw : 0;
        void openTorrentNumericDialogWindow({
          type: 'upload',
          value,
          hashes: selectionHashes,
        });
      });
    } else if (type === 'shareLimits') {
      void openTorrentShareLimitsDialogWindow({
        ratio: targetTorrent.max_ratio ?? -2,
        seedingTime: targetTorrent.max_seeding_time ?? -2,
        hashes: selectionHashes,
      });
    } else if (type === 'newCategory') {
      void openCreateDialogWindow({ type: 'category', hashes: selectionHashes });
    } else if (type === 'addTag') {
      void openCreateDialogWindow({ type: 'tag', hashes: selectionHashes });
    }

    // Close menu after opening window
    onClose();
  }, [selectionHashes, targetTorrent, onClose]);

  const handleAction = useCallback((action?: () => void) => {
    action?.();
    onClose();
  }, [onClose]);

  const handleCopyToClipboard = useCallback((value: string) => {
    void writeText(value);
    onClose();
  }, [onClose]);

  // ----------------------------------------------------------------
  // Computed states for submenus
  // ----------------------------------------------------------------

  // Current category check: enabled when ANY selected torrent has a non-empty category
  // (Reset is available whenever any item has a category to clear)
  const canResetCategory = useMemo(() => {
    return selectedTorrents.some((t) => Boolean(t.category));
  }, [selectedTorrents]);

  // Active category: show checkmark when all selected share the same category
  const currentCategory = useMemo(() => {
    const cats = selectedTorrents.map((t) => t.category).filter(Boolean);
    if (cats.length > 0 && cats.length === selectedTorrents.length && cats.every((c) => c === cats[0])) {
      return cats[0] as string;
    }
    return null;
  }, [selectedTorrents]);

  // Shared tags: checked when ALL selected torrents have the tag
  const sharedTags = useMemo(() => {
    if (selectedTorrents.length === 0) return [];
    const first = parseTorrentTags(selectedTorrents[0].tags);
    return first.filter((tag) =>
      selectedTorrents.every((t) => parseTorrentTags(t.tags).includes(tag))
    );
  }, [selectedTorrents]);

  // Union of all tags across selection (for Remove All)
  const allTagsInSelection = useMemo(() => {
    const all = new Set<string>();
    selectedTorrents.forEach((t) =>
      parseTorrentTags(t.tags).forEach((tag) => all.add(tag))
    );
    return all;
  }, [selectedTorrents]);

  // Command lookups
  const resumeCmd = commands.find((c) => c.id === 'resume');
  const pauseCmd = commands.find((c) => c.id === 'pause');
  const deleteCmd = commands.find((c) => c.id === 'delete');
  const forceStartCmd = commands.find((c) => c.id === 'force-start');
  const recheckCmd = commands.find((c) => c.id === 'recheck');
  const reannounceCmd = commands.find((c) => c.id === 'reannounce');
  const copyHashCmd = commands.find((c) => c.id === 'copy-hash');
  const copyNameCmd = commands.find((c) => c.id === 'copy-name');
  const copyMagnetCmd = commands.find((c) => c.id === 'copy-magnet');
  const openFolderCmd = commands.find((c) => c.id === 'open-folder');

  // ----------------------------------------------------------------
  // Derived toggle states for torrent properties
  // ----------------------------------------------------------------

  // auto_tmm: enabled when ALL selected torrents have auto_tmm === true
  const isAutoTmmEnabled = useMemo(() => {
    return selectedTorrents.every((t) => t.auto_tmm === true);
  }, [selectedTorrents]);

  // seq_dl: enabled when ALL selected torrents have seq_dl === true
  const isSeqDlEnabled = useMemo(() => {
    return selectedTorrents.every((t) => t.seq_dl === true);
  }, [selectedTorrents]);

  // f_l_piece_prio: enabled when ALL selected torrents have f_l_piece_prio === true
  const isFirstLastPrioEnabled = useMemo(() => {
    return selectedTorrents.every((t) => t.f_l_piece_prio === true);
  }, [selectedTorrents]);

  // super_seeding: enabled when ALL selected torrents have super_seeding === true
  const isSuperSeedingEnabled = useMemo(() => {
    return selectedTorrents.every((t) => t.super_seeding === true);
  }, [selectedTorrents]);

  // ----------------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------------

  const isSingle = selectionHashes.length === 1;

  const activeCategoryList = useMemo(() => {
    return categories ? Object.keys(categories) : [];
  }, [categories]);

  // Capability gating — use command.enabled where available; fall back to hasService && hasSelection
  const canSetLocation = hasService && hasSelection;
  const canRename = hasService && isSingle && capabilities.supportsFileRenaming;
  const canSetDownloadLimit = hasService && hasSelection;
  const canSetUploadLimit = hasService && hasSelection;

  const handleToggleAutoTmm = useCallback(() => {
    // Toggle OFF if all on (want to disable), toggle ON if any off (want to enable)
    const targetValue = !isAutoTmmEnabled;
    void actions.setAutoManagement?.mutate({ hashes: selectionHashes, enable: targetValue });
    onClose();
  }, [selectionHashes, isAutoTmmEnabled, actions, onClose]);

  const handleToggleSeqDl = useCallback(() => {
    const targetValue = !isSeqDlEnabled;
    void actions.setSequentialDownload?.mutate({ hashes: selectionHashes, value: targetValue });
    onClose();
  }, [selectionHashes, isSeqDlEnabled, actions, onClose]);

  const handleToggleFirstLastPrio = useCallback(() => {
    const targetValue = !isFirstLastPrioEnabled;
    void actions.setFirstLastPiecePriority?.mutate({ hashes: selectionHashes, value: targetValue });
    onClose();
  }, [selectionHashes, isFirstLastPrioEnabled, actions, onClose]);

  const handleToggleSuperSeeding = useCallback(() => {
    const targetValue = !isSuperSeedingEnabled;
    void actions.setSuperSeeding?.mutate({ hashes: selectionHashes, value: targetValue });
    onClose();
  }, [selectionHashes, isSuperSeedingEnabled, actions, onClose]);

  const handleExportTorrent = useCallback(async () => {
    if (!isSingle) return;
    const hash = selectionHashes[0];
    const defaultName = `${targetTorrent.name}.torrent`;
    const savePath = await pickSavePath(defaultName);
    if (!savePath) return;
    void actions.exportTorrent?.mutateAsync({ hash, savePath })
      .catch((err) => { toast.error(formatUserMessageForContext(err, 'torrent-action')); });
    onClose();
  }, [isSingle, selectionHashes, targetTorrent, actions, onClose]);

  const items: TContextMenuItem[] = useMemo(() => [
    // Multi-selection count header
    ...(!isSingle
      ? [{ kind: 'separator' as const, id: 'selection-count', label: `${selectionHashes.length} torrents selected` }]
      : []),

    // Start / Pause / Force Start
    { kind: 'item', id: 'start', label: 'Start', icon: Play, disabled: !resumeCmd?.enabled, onClick: () => handleAction(resumeCmd?.onClick) },
    { kind: 'item', id: 'pause', label: 'Pause', icon: Pause, disabled: !pauseCmd?.enabled, onClick: () => handleAction(pauseCmd?.onClick) },
    { kind: 'item', id: 'force-start', label: 'Force Start', icon: Rocket, disabled: !forceStartCmd?.enabled, onClick: () => handleAction(forceStartCmd?.onClick) },

    { kind: 'separator', id: 'sep-actions' },

    // Remove
    { kind: 'item', id: 'remove', label: 'Remove', icon: Trash2, destructive: true, disabled: !deleteCmd?.enabled, onClick: () => handleAction(deleteCmd?.onClick) },

    { kind: 'separator', id: 'sep-remove' },

    // Set Location
    { kind: 'item', id: 'set-location', label: 'Set Location...', icon: HardDrive, disabled: !canSetLocation, onClick: () => openDialog('setLocation') },

    // Rename — single selection only
    ...(!isSingle ? [] : [
      { kind: 'item' as const, id: 'rename', label: 'Rename...', icon: Type, disabled: !canRename, onClick: () => openDialog('rename') },
    ]),

    { kind: 'separator', id: 'sep-rename' },

    // Category submenu
    {
      kind: 'submenu',
      id: 'submenu-category',
      label: 'Category',
      icon: FolderOpen,
      children: [
        { kind: 'item', id: 'cat-new', label: 'New...', disabled: !hasSelection, onClick: () => openDialog('newCategory') },
        { kind: 'item', id: 'cat-reset', label: 'Reset', disabled: !canResetCategory, onClick: () => { setTorrentCategory.mutate({ hashes: selectionHashes, category: '' }); onClose(); } },
        ...(activeCategoryList.length > 0
          ? [
              { kind: 'separator' as const, id: 'cat-sep' },
              ...activeCategoryList.map((cat) => ({
                kind: 'item' as const,
                id: `cat-${cat}`,
                label: cat,
                icon: currentCategory === cat ? CheckIcon : undefined,
                onClick: () => { setTorrentCategory.mutate({ hashes: selectionHashes, category: cat }); onClose(); },
              })),
            ]
          : []),
      ],
    },

    // Tags submenu
    {
      kind: 'submenu',
      id: 'submenu-tags',
      label: 'Tags',
      icon: Tag,
      children: [
        { kind: 'item', id: 'tag-add', label: 'Add...', disabled: !hasSelection, onClick: () => openDialog('addTag') },
        { kind: 'item', id: 'tag-remove-all', label: 'Remove All', disabled: allTagsInSelection.size === 0, onClick: () => { if (allTagsInSelection.size > 0) { removeTorrentTags.mutate({ hashes: selectionHashes, tags: Array.from(allTagsInSelection) }); onClose(); } } },
        ...(tags && tags.length > 0
          ? [
              { kind: 'separator' as const, id: 'tag-sep' },
              ...tags.map((tag) => ({
                kind: 'item' as const,
                id: `tag-${tag}`,
                label: tag,
                icon: sharedTags.includes(tag) ? CheckIcon : undefined,
                onClick: () => { if (sharedTags.includes(tag)) { removeTorrentTags.mutate({ hashes: selectionHashes, tags: [tag] }); } else { addTorrentTags.mutate({ hashes: selectionHashes, tags: [tag] }); } onClose(); },
              })),
            ]
          : []),
      ],
    },

    // Automatic Torrent Management
    { kind: 'item', id: 'auto-tmm', label: 'Automatic Torrent Management', icon: isAutoTmmEnabled ? CheckIcon : undefined, disabled: !hasService || !hasSelection, onClick: handleToggleAutoTmm },

    { kind: 'separator', id: 'sep-auto-tmm' },

    // Limit Download Rate (only when selection has incomplete torrents)
    ...(hasIncompleteSelection
      ? [{ kind: 'item' as const, id: 'limit-download', label: 'Limit Download Rate...', icon: ArrowDownFromLine, disabled: !canSetDownloadLimit, onClick: () => openDialog('limitDownload') }]
      : []),

    // Limit Upload Rate
    { kind: 'item', id: 'limit-upload', label: 'Limit Upload Rate...', icon: ArrowUpFromLine, disabled: !canSetUploadLimit, onClick: () => openDialog('limitUpload') },

    // Limit Share Ratio
    { kind: 'item', id: 'share-limits', label: 'Limit Share Ratio...', disabled: !hasService || !hasSelection, onClick: () => openDialog('shareLimits') },

    // Sequential download / first-last pieces (only when downloading or mixed)
    ...((isDownloadingSelection || isMixedDownloadingAndSeedingSelection)
      ? [
          { kind: 'item' as const, id: 'seq-dl', label: 'Download in Sequential Order', icon: isSeqDlEnabled ? CheckIcon : undefined, disabled: !hasService || !hasSelection, onClick: handleToggleSeqDl },
          { kind: 'item' as const, id: 'first-last', label: 'Download First and Last Pieces First', icon: isFirstLastPrioEnabled ? CheckIcon : undefined, disabled: !hasService || !hasSelection, onClick: handleToggleFirstLastPrio },
        ]
      : []),

    { kind: 'separator', id: 'sep-sequential' },

    // Force Recheck / Reannounce
    { kind: 'item', id: 'force-recheck', label: 'Force Recheck', icon: RefreshCw, disabled: !recheckCmd?.enabled, onClick: () => handleAction(recheckCmd?.onClick) },
    { kind: 'item', id: 'force-reannounce', label: 'Force Reannounce', icon: RefreshCw, disabled: !reannounceCmd?.enabled, onClick: () => handleAction(reannounceCmd?.onClick) },

    // Super Seeding (only when seeding selection)
    ...(isSeedingSelection
      ? [{ kind: 'item' as const, id: 'super-seeding', label: 'Super Seeding Mode', icon: isSuperSeedingEnabled ? CheckIcon : undefined, disabled: !hasService || !hasSelection, onClick: handleToggleSuperSeeding }]
      : []),

    { kind: 'separator', id: 'sep-super-seeding' },

    // Copy submenu
    {
      kind: 'submenu',
      id: 'submenu-copy',
      label: 'Copy',
      icon: Copy,
      children: [
        { kind: 'item', id: 'copy-hash', label: 'Hash', disabled: !copyHashCmd?.enabled, onClick: () => handleAction(copyHashCmd?.onClick) },
        { kind: 'item', id: 'copy-name', label: 'Name', disabled: !copyNameCmd?.enabled, onClick: () => handleAction(copyNameCmd?.onClick) },
        { kind: 'item', id: 'copy-magnet', label: 'Magnet URI', disabled: !copyMagnetCmd?.enabled, onClick: () => handleAction(copyMagnetCmd?.onClick) },
        { kind: 'item', id: 'copy-path', label: 'Content Path', disabled: !targetTorrent.content_path, onClick: () => handleCopyToClipboard(targetTorrent.content_path!) },
      ],
    },

    // Open Folder
    { kind: 'item', id: 'open-folder', label: 'Open Folder', icon: FolderOpen, disabled: !openFolderCmd?.enabled, onClick: () => handleAction(openFolderCmd?.onClick) },

    // Export .torrent — single selection only
    { kind: 'item', id: 'export-torrent', label: 'Export .torrent', icon: Download, disabled: !hasService || !isSingle, onClick: handleExportTorrent },
  ], [
    isSingle, selectionHashes, resumeCmd, pauseCmd, forceStartCmd, deleteCmd, handleAction,
    canSetLocation, canRename, openDialog, hasSelection, canResetCategory, setTorrentCategory,
    onClose, activeCategoryList, currentCategory, tags, allTagsInSelection, addTorrentTags,
    removeTorrentTags, sharedTags, hasService, handleToggleAutoTmm, isAutoTmmEnabled,
    hasIncompleteSelection, canSetDownloadLimit, canSetUploadLimit,
    isDownloadingSelection, isMixedDownloadingAndSeedingSelection,
    isSeqDlEnabled, isFirstLastPrioEnabled, handleToggleSeqDl, handleToggleFirstLastPrio,
    recheckCmd, reannounceCmd, isSeedingSelection, isSuperSeedingEnabled, handleToggleSuperSeeding,
    copyHashCmd, copyNameCmd, copyMagnetCmd, targetTorrent, handleCopyToClipboard,
    openFolderCmd, handleExportTorrent,
  ]);

  return <ContextMenu x={x} y={y} onClose={onClose} items={items} width="w-56" />;
}
