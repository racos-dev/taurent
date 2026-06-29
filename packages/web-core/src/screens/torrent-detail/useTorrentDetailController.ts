// Headless controller for TorrentDetailScreen orchestration.
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Extracts tab state, file sorting/preview logic, action handlers,
// dialog state, tracker-add flow, and delete/back navigation callbacks
// from the mobile TorrentDetailScreen route into a reusable shared hook.
//
// Usage (mobile TorrentDetailScreen):
//   const controller = useTorrentDetailController({
//     hash,
//     torrent,
//     files,
//     actions: useTorrentActions(),
//     addTrackerMutation,
//     onNavigateBack: () => navigate('/'),
//   });

import { useMemo, useState, useCallback } from 'react';
import type { TorrentFile } from '@taurent/shared/types/qbittorrent';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DetailTab = 'overview' | 'trackers' | 'peers' | 'files' | 'httpSources';

export interface TorrentDetailControllerActions {
  pause: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  resume: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  delete: { isPending: boolean; mutateAsync: (vars: { hashes: string[]; deleteFiles: boolean }) => Promise<unknown> };
  recheck: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  reannounce: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  setForceStart: { isPending: boolean; mutateAsync: (vars: { hashes: string[]; value: boolean }) => Promise<unknown> };
  setDownloadLimit?: { isPending: boolean; mutateAsync: (vars: { hashes: string[]; limit: number }) => Promise<unknown> };
  setUploadLimit?: { isPending: boolean; mutateAsync: (vars: { hashes: string[]; limit: number }) => Promise<unknown> };
  setFilePriority?: { isPending: boolean; mutateAsync: (vars: { hash: string; fileIds: number[]; priority: number }) => Promise<unknown> };
  rename?: { isPending: boolean; mutate: (vars: { hash: string; name: string }, opts?: { onSuccess?: () => void }) => void };
  relocate?: { isPending: boolean; mutate: (vars: { hashes: string[]; newLocation: string }, opts?: { onSuccess?: () => void }) => void };
  increasePriority?: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  decreasePriority?: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
}

export interface BanPeersMutation {
  isPending: boolean;
  mutateAsync: (peers: string[]) => Promise<unknown>;
}

export interface AddTrackerMutation {
  isPending: boolean;
  mutate: (vars: { hash: string; urls: string }, opts?: { onSuccess?: () => void }) => void;
}

export interface TorrentDetailControllerOptions {
  /** Torrent hash from route params */
  hash: string;
  /** Current torrent object (from torrent list) */
  torrent: { hash: string; name: string; force_start: boolean; dl_limit?: number; up_limit?: number } | null;
  /** File list from useTorrentFiles */
  files: TorrentFile[] | null;
  /** Derived display status string */
  displayStatus: string | null;
  /** Action mutations from useTorrentActions() */
  actions: TorrentDetailControllerActions;
  /** Add trackers mutation from useAddTrackers() */
  addTrackerMutation: AddTrackerMutation;
  /** Ban peers mutation from useBanPeersWithPeerInvalidation() */
  banPeersMutation?: BanPeersMutation;
  /** Called by the delete handler after successful deletion */
  onNavigateBack: () => void;
}

export interface TorrentDetailControllerResult {
  // ─── Tab state ───────────────────────────────────────────────────────────
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;

  // ─── File sorting / preview ───────────────────────────────────────────────
  sortedFiles: TorrentFile[];
  visibleFiles: TorrentFile[];
  showAllFiles: boolean;
  setShowAllFiles: (value: boolean) => void;

  // ─── Dialog state ─────────────────────────────────────────────────────────
  showDeleteDialog: boolean;
  speedLimitModal: { type: 'download' | 'upload'; currentValue: number } | null;
  filePriorityDialog: FilePriorityTarget | null;
  showRenameDialog: boolean;
  renameValue: string;
  showRelocateDialog: boolean;
  relocateValue: string;

  // ─── Tracker add flow ─────────────────────────────────────────────────────
  showAddTracker: boolean;
  newTrackerUrl: string;
  setNewTrackerUrl: (url: string) => void;
  toggleAddTracker: () => void;
  closeAddTracker: () => void;
  handleAddTrackerSubmit: () => void;

  // ─── Dialog helpers ───────────────────────────────────────────────────────
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  openRenameDialog: (currentName: string) => void;
  closeRenameDialog: () => void;
  setRenameValue: (value: string) => void;
  openRelocateDialog: (currentPath: string) => void;
  closeRelocateDialog: () => void;
  setRelocateValue: (value: string) => void;
  openSpeedLimitModal: (type: 'download' | 'upload', currentValue: number) => void;
  closeSpeedLimitModal: () => void;
  openFilePriorityDialog: (file: TorrentFile) => void;
  openFilePriorityTarget: (target: FilePriorityTarget) => void;
  closeFilePriorityDialog: () => void;

  // ─── Derived values ───────────────────────────────────────────────────────
  isPaused: boolean;
  currentDownloadLimit: number;
  currentUploadLimit: number;
  isActionPending: boolean;
  pauseResumeIsPending: boolean;
  recheckIsPending: boolean;
  reannounceIsPending: boolean;
  increasePriorityIsPending: boolean;
  decreasePriorityIsPending: boolean;
  addTrackerIsPending: boolean;
  banPeersIsPending: boolean;

  // ─── Action handlers ──────────────────────────────────────────────────────
  handlePauseResume: () => Promise<void>;
  handleRecheck: () => Promise<void>;
  handleReannounce: () => Promise<void>;
  handleForceStart: (value: boolean) => Promise<void>;
  handleSpeedLimit: (type: 'download' | 'upload', limitBytes: number) => Promise<void>;
  handleFilePriority: (priority: number) => Promise<void>;
  handleRename: () => void;
  handleRelocate: () => void;
  handleDelete: (deleteFiles: boolean) => Promise<void>;
  handleIncreasePriority: () => Promise<void>;
  handleDecreasePriority: () => Promise<void>;
  handleBanPeer: (peerKey: string) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FILE_PREVIEW_LIMIT = 50;

export interface FilePriorityTarget {
  label: string;
  currentPriority: number;
  fileIds: number[];
}

function sortFiles(files: TorrentFile[] | null): TorrentFile[] {
  if (!files || !Array.isArray(files)) return [];
  return [...files].sort((left, right) => {
    const leftIncomplete = left.progress < 1 ? 0 : 1;
    const rightIncomplete = right.progress < 1 ? 0 : 1;
    if (leftIncomplete !== rightIncomplete) return leftIncomplete - rightIncomplete;
    return left.name.localeCompare(right.name);
  });
}

// ─── Controller ───────────────────────────────────────────────────────────────

export function useTorrentDetailController({
  hash,
  torrent,
  files,
  displayStatus,
  actions,
  addTrackerMutation,
  banPeersMutation,
  onNavigateBack,
}: TorrentDetailControllerOptions): TorrentDetailControllerResult {
  // ─── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // ─── File preview state ────────────────────────────────────────────────────
  const [showAllFiles, setShowAllFiles] = useState(false);

  // ─── Dialog state ──────────────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [speedLimitModal, setSpeedLimitModal] = useState<{ type: 'download' | 'upload'; currentValue: number } | null>(null);
  const [filePriorityDialog, setFilePriorityDialog] = useState<FilePriorityTarget | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showRelocateDialog, setShowRelocateDialog] = useState(false);
  const [relocateValue, setRelocateValue] = useState('');

  // ─── Tracker add state ─────────────────────────────────────────────────────
  const [showAddTracker, setShowAddTracker] = useState(false);
  const [newTrackerUrl, setNewTrackerUrl] = useState('');

  // ─── Derived values ────────────────────────────────────────────────────────
  const isPaused = displayStatus === 'paused';
  const currentDownloadLimit = torrent?.dl_limit && torrent.dl_limit > 0 ? torrent.dl_limit : 0;
  const currentUploadLimit = torrent?.up_limit && torrent.up_limit > 0 ? torrent.up_limit : 0;

  const sortedFiles = useMemo(() => sortFiles(files), [files]);

  const visibleFiles = useMemo(
    () => (showAllFiles ? sortedFiles : sortedFiles.slice(0, FILE_PREVIEW_LIMIT)),
    [showAllFiles, sortedFiles]
  );

  const isActionPending = useMemo(
    () =>
      actions.pause.isPending ||
      actions.resume.isPending ||
      actions.delete.isPending ||
      actions.recheck.isPending ||
      actions.reannounce.isPending ||
      actions.setForceStart.isPending ||
      actions.setDownloadLimit?.isPending ||
      actions.setUploadLimit?.isPending ||
      actions.setFilePriority?.isPending ||
      actions.rename?.isPending ||
      actions.relocate?.isPending ||
      actions.increasePriority?.isPending ||
      actions.decreasePriority?.isPending ||
      false,
    [actions]
  );

  // ─── Tracker add helpers ───────────────────────────────────────────────────
  const toggleAddTracker = useCallback(() => {
    setShowAddTracker((prev) => !prev);
  }, []);

  const closeAddTracker = useCallback(() => {
    setShowAddTracker(false);
    setNewTrackerUrl('');
  }, []);

  const handleAddTrackerSubmit = useCallback(() => {
    if (!hash || !newTrackerUrl.trim()) return;
    addTrackerMutation.mutate(
      { hash, urls: newTrackerUrl.trim() },
      { onSuccess: () => closeAddTracker() }
    );
  }, [hash, newTrackerUrl, addTrackerMutation, closeAddTracker]);

  // ─── Dialog helpers ───────────────────────────────────────────────────────
  const openDeleteDialog = useCallback(() => setShowDeleteDialog(true), []);
  const closeDeleteDialog = useCallback(() => setShowDeleteDialog(false), []);

  const openRenameDialog = useCallback((currentName: string) => {
    setRenameValue(currentName);
    setShowRenameDialog(true);
  }, []);

  const closeRenameDialog = useCallback(() => {
    setShowRenameDialog(false);
    setRenameValue('');
  }, []);

  const openRelocateDialog = useCallback((currentPath: string) => {
    setRelocateValue(currentPath || '');
    setShowRelocateDialog(true);
  }, []);

  const closeRelocateDialog = useCallback(() => {
    setShowRelocateDialog(false);
    setRelocateValue('');
  }, []);

  const openSpeedLimitModal = useCallback(
    (type: 'download' | 'upload', currentValue: number) => {
      setSpeedLimitModal({ type, currentValue });
    },
    []
  );

  const closeSpeedLimitModal = useCallback(() => setSpeedLimitModal(null), []);

  const openFilePriorityDialog = useCallback((file: TorrentFile) => {
    setFilePriorityDialog({ label: file.name, currentPriority: file.priority, fileIds: [file.index] });
  }, []);

  const openFilePriorityTarget = useCallback((target: FilePriorityTarget) => {
    setFilePriorityDialog(target);
  }, []);

  const closeFilePriorityDialog = useCallback(() => setFilePriorityDialog(null), []);

  // ─── Action handlers ──────────────────────────────────────────────────────
  const handlePauseResume = useCallback(async () => {
    if (!hash || isActionPending) return;
    try {
      // Force-started torrents are not paused but Resume should let the user
      // clear the force-start flag via setForceStart(false).
      if (torrent?.force_start && !isPaused) {
        await actions.setForceStart.mutateAsync({ hashes: [hash], value: false });
      } else if (isPaused) {
        await actions.resume.mutateAsync([hash]);
      } else {
        await actions.pause.mutateAsync([hash]);
      }
    } catch (err) {
      console.error('Pause/resume failed:', err);
    }
  }, [hash, isActionPending, isPaused, torrent, actions]);

  const handleRecheck = useCallback(async () => {
    if (!hash || isActionPending) return;
    try {
      await actions.recheck.mutateAsync([hash]);
    } catch (err) {
      console.error('Recheck failed:', err);
    }
  }, [hash, isActionPending, actions]);

  const handleReannounce = useCallback(async () => {
    if (!hash || isActionPending) return;
    try {
      await actions.reannounce.mutateAsync([hash]);
    } catch (err) {
      console.error('Reannounce failed:', err);
    }
  }, [hash, isActionPending, actions]);

  const handleForceStart = useCallback(
    async (value: boolean) => {
      if (!hash || isActionPending) return;
      try {
        await actions.setForceStart.mutateAsync({ hashes: [hash], value });
      } catch (err) {
        console.error('Force start failed:', err);
      }
    },
    [hash, isActionPending, actions]
  );

  const handleSpeedLimit = useCallback(
    async (type: 'download' | 'upload', limitBytes: number) => {
      if (!hash || isActionPending) return;
      try {
        if (type === 'download' && actions.setDownloadLimit) {
          await actions.setDownloadLimit.mutateAsync({ hashes: [hash], limit: limitBytes });
        } else if (type === 'upload' && actions.setUploadLimit) {
          await actions.setUploadLimit.mutateAsync({ hashes: [hash], limit: limitBytes });
        }
        setSpeedLimitModal(null);
      } catch (err) {
        console.error('Speed limit failed:', err);
      }
    },
    [hash, isActionPending, actions]
  );

  const handleFilePriority = useCallback(
    async (priority: number) => {
      if (!hash || !filePriorityDialog || !actions.setFilePriority) return;
      try {
        await actions.setFilePriority.mutateAsync({ hash, fileIds: filePriorityDialog.fileIds, priority });
        setFilePriorityDialog(null);
      } catch (err) {
        console.error('File priority failed:', err);
      }
    },
    [hash, filePriorityDialog, actions]
  );

  const handleRename = useCallback(() => {
    if (!hash || !renameValue.trim() || !actions.rename) return;
    actions.rename.mutate(
      { hash, name: renameValue.trim() },
      { onSuccess: () => setShowRenameDialog(false) }
    );
  }, [hash, renameValue, actions.rename]);

  const handleRelocate = useCallback(() => {
    if (!hash || !relocateValue.trim() || !actions.relocate) return;
    actions.relocate.mutate(
      { hashes: [hash], newLocation: relocateValue.trim() },
      { onSuccess: () => setShowRelocateDialog(false) }
    );
  }, [hash, relocateValue, actions.relocate]);

  const handleDelete = useCallback(
    async (deleteFiles: boolean) => {
      if (!hash || actions.delete.isPending) return;
      try {
        await actions.delete.mutateAsync({ hashes: [hash], deleteFiles });
        onNavigateBack();
      } catch (err) {
        console.error('Delete failed:', err);
        setShowDeleteDialog(false);
      }
    },
    [hash, actions.delete, onNavigateBack]
  );

  const handleIncreasePriority = useCallback(async () => {
    if (!hash || isActionPending || !actions.increasePriority) return;
    try {
      await actions.increasePriority.mutateAsync([hash]);
    } catch (err) {
      console.error('Increase priority failed:', err);
    }
  }, [hash, isActionPending, actions]);

  const handleDecreasePriority = useCallback(async () => {
    if (!hash || isActionPending || !actions.decreasePriority) return;
    try {
      await actions.decreasePriority.mutateAsync([hash]);
    } catch (err) {
      console.error('Decrease priority failed:', err);
    }
  }, [hash, isActionPending, actions]);

  const handleBanPeer = useCallback(
    async (peerKey: string) => {
      if (!banPeersMutation || banPeersMutation.isPending) return;
      await banPeersMutation.mutateAsync([peerKey]);
    },
    [banPeersMutation]
  );

  return {
    activeTab,
    setActiveTab,
    sortedFiles,
    visibleFiles,
    showAllFiles,
    setShowAllFiles,
    showDeleteDialog,
    speedLimitModal,
    filePriorityDialog,
    showRenameDialog,
    renameValue,
    showRelocateDialog,
    relocateValue,
    showAddTracker,
    newTrackerUrl,
    setNewTrackerUrl,
    toggleAddTracker,
    closeAddTracker,
    handleAddTrackerSubmit,
    openDeleteDialog,
    closeDeleteDialog,
    openRenameDialog,
    closeRenameDialog,
    setRenameValue,
    openRelocateDialog,
    closeRelocateDialog,
    setRelocateValue,
    openSpeedLimitModal,
    closeSpeedLimitModal,
    openFilePriorityDialog,
    openFilePriorityTarget,
    closeFilePriorityDialog,
    isPaused,
    currentDownloadLimit,
    currentUploadLimit,
    isActionPending,
    pauseResumeIsPending: actions.pause.isPending || actions.resume.isPending,
    recheckIsPending: actions.recheck.isPending,
    reannounceIsPending: actions.reannounce.isPending,
    increasePriorityIsPending: actions.increasePriority?.isPending ?? false,
    decreasePriorityIsPending: actions.decreasePriority?.isPending ?? false,
    addTrackerIsPending: addTrackerMutation.isPending,
    banPeersIsPending: banPeersMutation?.isPending ?? false,
    handlePauseResume,
    handleRecheck,
    handleReannounce,
    handleForceStart,
    handleSpeedLimit,
    handleFilePriority,
    handleRename,
    handleRelocate,
    handleDelete,
    handleIncreasePriority,
    handleDecreasePriority,
    handleBanPeer,
  };
}
