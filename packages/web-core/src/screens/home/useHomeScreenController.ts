// Headless controller for HomeScreen batch torrent action orchestration.
//
// Platform-agnostic — does not import @tauri-apps/* or produce UI.
//
// Extracts modal/dialog state, pending-state derivation, and batch action handlers
// from the mobile HomeScreen route into a reusable shared hook. UI rendering stays
// in the app route; this hook owns the headless state machine.
//
// Usage (mobile HomeScreen):
//   const controller = useHomeScreenController({
//     selectedHashes,
//     clearSelection,
//     actions: useTorrentActionController({ scope, ...adapters }),
//   });

import { useMemo, useState, useCallback } from 'react';

// ─── Mutation shapes for HomeScreen-specific orchestration ─────────────────────

/** Minimal mutation shape for dialog-triggering actions (delete) */
interface DeleteMutation {
  mutateAsync: (vars: { hashes: string[]; deleteFiles: boolean }) => Promise<unknown>;
  isPending: boolean;
}

/** Minimal mutation shape for speed limit mutations */
interface SpeedLimitMutation {
  mutateAsync: (vars: { hashes: string[]; limit: number }) => Promise<unknown>;
  isPending: boolean;
}

/** Minimal mutation shape for category mutations */
interface CategoryMutation {
  mutateAsync: (vars: { hashes: string[]; category: string }) => Promise<unknown>;
  isPending: boolean;
}

/** Minimal mutation shape for tag mutations */
interface TagsMutation {
  mutateAsync: (vars: { hashes: string[]; tags: string[] }) => Promise<unknown>;
  isPending: boolean;
}

export interface HomeScreenControllerActions {
  pause: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  resume: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  delete: DeleteMutation;
  recheck: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  reannounce: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  setDownloadLimit?: SpeedLimitMutation;
  setUploadLimit?: SpeedLimitMutation;
  increasePriority?: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  decreasePriority?: { isPending: boolean; mutateAsync: (hashes: string[]) => Promise<unknown> };
  setCategory: CategoryMutation;
  addTags: TagsMutation;
  removeTags: TagsMutation;
  /** Optional aggregated pending flag from the action controller */
  isActionPending?: boolean;
}

export interface HomeScreenControllerOptions {
  /** Set of currently selected torrent hashes */
  selectedHashes: Set<string>;
  /** Called by handlers after a successful mutation that should clear selection */
  clearSelection: () => void;
  /** Headless action controller from useTorrentActionController */
  actions: HomeScreenControllerActions;
}

export interface HomeScreenControllerResult {
  // ─── Dialog state ───────────────────────────────────────────────
  speedLimitModal: { type: 'download' | 'upload' } | null;
  showDeleteDialog: boolean;
  showCategoryDialog: boolean;
  showTagsDialog: boolean;

  // ─── Derived values ────────────────────────────────────────────
  /** Array of selected hashes — derived from selectedHashes Set */
  selectedHashList: string[];
  /** True when any batch mutation is in-flight */
  isBatchActionPending: boolean;

  // ─── Dialog open/close helpers ────────────────────────────────
  openSpeedLimitModal: (type: 'download' | 'upload') => void;
  closeSpeedLimitModal: () => void;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  openCategoryDialog: () => void;
  closeCategoryDialog: () => void;
  openTagsDialog: () => void;
  closeTagsDialog: () => void;

  // ─── Batch action handlers ─────────────────────────────────────
  /** Delete selected torrents. Clears selection on success. */
  handleDeleteSelection: (deleteFiles: boolean) => Promise<void>;
  /** Apply download/upload speed limit to selected torrents. */
  handleApplySpeedLimit: (type: 'download' | 'upload', limitBytes: number) => Promise<void>;
  /** Set category for selected torrents. Clears selection on success. */
  handleSetCategory: (category: string) => Promise<void>;
  /** Add tags to selected torrents. Clears selection on success. */
  handleAddTags: (tagsToAdd: string[]) => Promise<void>;
  /** Remove tags from selected torrents. Clears selection on success. */
  handleRemoveTags: (tagsToRemove: string[]) => Promise<void>;

  // ─── Direct batch action handlers (no dialog) ─────────────────────
  handleResume: () => Promise<void>;
  handlePause: () => Promise<void>;
  handleRecheck: () => Promise<void>;
  handleReannounce: () => Promise<void>;
  handleIncreasePriority: () => Promise<void>;
  handleDecreasePriority: () => Promise<void>;
}

export function useHomeScreenController({
  selectedHashes,
  clearSelection,
  actions,
}: HomeScreenControllerOptions): HomeScreenControllerResult {
  // ─── Dialog state ────────────────────────────────────────────────
  const [speedLimitModal, setSpeedLimitModal] = useState<{ type: 'download' | 'upload' } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);

  // ─── Derived values ─────────────────────────────────────────────
  const selectedHashList = useMemo(() => Array.from(selectedHashes), [selectedHashes]);

  const isBatchActionPending = useMemo(
    () =>
      actions.isActionPending ??
      (actions.pause.isPending ||
        actions.resume.isPending ||
        actions.delete.isPending ||
        actions.recheck.isPending ||
        actions.reannounce.isPending ||
        actions.setDownloadLimit?.isPending ||
        actions.setUploadLimit?.isPending ||
        actions.increasePriority?.isPending ||
        actions.decreasePriority?.isPending ||
        actions.setCategory.isPending ||
        actions.addTags.isPending ||
        actions.removeTags.isPending),
    [
      actions.isActionPending,
      actions.pause.isPending,
      actions.resume.isPending,
      actions.delete.isPending,
      actions.recheck.isPending,
      actions.reannounce.isPending,
      actions.setDownloadLimit?.isPending,
      actions.setUploadLimit?.isPending,
      actions.increasePriority?.isPending,
      actions.decreasePriority?.isPending,
      actions.setCategory.isPending,
      actions.addTags.isPending,
      actions.removeTags.isPending,
    ]
  );

  // ─── Dialog open/close helpers ──────────────────────────────────
  const openSpeedLimitModal = useCallback((type: 'download' | 'upload') => {
    setSpeedLimitModal({ type });
  }, []);

  const closeSpeedLimitModal = useCallback(() => {
    setSpeedLimitModal(null);
  }, []);

  const openDeleteDialog = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  const openCategoryDialog = useCallback(() => {
    setShowCategoryDialog(true);
  }, []);

  const closeCategoryDialog = useCallback(() => {
    setShowCategoryDialog(false);
  }, []);

  const openTagsDialog = useCallback(() => {
    setShowTagsDialog(true);
  }, []);

  const closeTagsDialog = useCallback(() => {
    setShowTagsDialog(false);
  }, []);

  // ─── Batch action handlers ──────────────────────────────────────
  const handleDeleteSelection = useCallback(
    async (deleteFiles: boolean) => {
      if (selectedHashList.length === 0 || isBatchActionPending) return;
      try {
        await actions.delete.mutateAsync({ hashes: selectedHashList, deleteFiles });
        setShowDeleteDialog(false);
        clearSelection();
      } catch (err) {
        console.error('Delete selection failed:', err);
      }
    },
    [selectedHashList, isBatchActionPending, actions.delete, clearSelection]
  );

  const handleApplySpeedLimit = useCallback(
    async (type: 'download' | 'upload', limitBytes: number) => {
      if (selectedHashList.length === 0 || isBatchActionPending) return;
      try {
        if (type === 'download' && actions.setDownloadLimit) {
          await actions.setDownloadLimit.mutateAsync({ hashes: selectedHashList, limit: limitBytes });
        } else if (type === 'upload' && actions.setUploadLimit) {
          await actions.setUploadLimit.mutateAsync({ hashes: selectedHashList, limit: limitBytes });
        }
        setSpeedLimitModal(null);
      } catch (err) {
        console.error('Apply speed limit failed:', err);
      }
    },
    [selectedHashList, isBatchActionPending, actions.setDownloadLimit, actions.setUploadLimit]
  );

  const handleSetCategory = useCallback(
    async (category: string) => {
      if (selectedHashList.length === 0 || isBatchActionPending) return;
      try {
        await actions.setCategory.mutateAsync({ hashes: selectedHashList, category });
        setShowCategoryDialog(false);
        clearSelection();
      } catch (err) {
        console.error('Set category failed:', err);
      }
    },
    [selectedHashList, isBatchActionPending, actions.setCategory, clearSelection]
  );

  const handleAddTags = useCallback(
    async (tagsToAdd: string[]) => {
      if (selectedHashList.length === 0 || isBatchActionPending || tagsToAdd.length === 0) return;
      try {
        await actions.addTags.mutateAsync({ hashes: selectedHashList, tags: tagsToAdd });
        setShowTagsDialog(false);
        clearSelection();
      } catch (err) {
        console.error('Add tags failed:', err);
      }
    },
    [selectedHashList, isBatchActionPending, actions.addTags, clearSelection]
  );

  const handleRemoveTags = useCallback(
    async (tagsToRemove: string[]) => {
      if (selectedHashList.length === 0 || isBatchActionPending || tagsToRemove.length === 0) return;
      try {
        await actions.removeTags.mutateAsync({ hashes: selectedHashList, tags: tagsToRemove });
        setShowTagsDialog(false);
        clearSelection();
      } catch (err) {
        console.error('Remove tags failed:', err);
      }
    },
    [selectedHashList, isBatchActionPending, actions.removeTags, clearSelection]
  );

  // ─── Direct batch action handlers (no dialog) ─────────────────────
  const handleResume = useCallback(async () => {
    if (selectedHashList.length === 0 || isBatchActionPending) return;
    try {
      await actions.resume.mutateAsync(selectedHashList);
    } catch (err) {
      console.error('Resume failed:', err);
    }
  }, [selectedHashList, isBatchActionPending, actions.resume]);

  const handlePause = useCallback(async () => {
    if (selectedHashList.length === 0 || isBatchActionPending) return;
    try {
      await actions.pause.mutateAsync(selectedHashList);
    } catch (err) {
      console.error('Pause failed:', err);
    }
  }, [selectedHashList, isBatchActionPending, actions.pause]);

  const handleRecheck = useCallback(async () => {
    if (selectedHashList.length === 0 || isBatchActionPending) return;
    try {
      await actions.recheck.mutateAsync(selectedHashList);
    } catch (err) {
      console.error('Recheck failed:', err);
    }
  }, [selectedHashList, isBatchActionPending, actions.recheck]);

  const handleReannounce = useCallback(async () => {
    if (selectedHashList.length === 0 || isBatchActionPending) return;
    try {
      await actions.reannounce.mutateAsync(selectedHashList);
    } catch (err) {
      console.error('Reannounce failed:', err);
    }
  }, [selectedHashList, isBatchActionPending, actions.reannounce]);

  const handleIncreasePriority = useCallback(async () => {
    if (selectedHashList.length === 0 || isBatchActionPending || !actions.increasePriority) return;
    try {
      await actions.increasePriority.mutateAsync(selectedHashList);
    } catch (err) {
      console.error('Increase priority failed:', err);
    }
  }, [selectedHashList, isBatchActionPending, actions.increasePriority]);

  const handleDecreasePriority = useCallback(async () => {
    if (selectedHashList.length === 0 || isBatchActionPending || !actions.decreasePriority) return;
    try {
      await actions.decreasePriority.mutateAsync(selectedHashList);
    } catch (err) {
      console.error('Decrease priority failed:', err);
    }
  }, [selectedHashList, isBatchActionPending, actions.decreasePriority]);

  return {
    speedLimitModal,
    showDeleteDialog,
    showCategoryDialog,
    showTagsDialog,
    selectedHashList,
    isBatchActionPending,
    openSpeedLimitModal,
    closeSpeedLimitModal,
    openDeleteDialog,
    closeDeleteDialog,
    openCategoryDialog,
    closeCategoryDialog,
    openTagsDialog,
    closeTagsDialog,
    handleDeleteSelection,
    handleApplySpeedLimit,
    handleSetCategory,
    handleAddTags,
    handleRemoveTags,
    handleResume,
    handlePause,
    handleRecheck,
    handleReannounce,
    handleIncreasePriority,
    handleDecreasePriority,
  };
}
