// Presentation model for torrent actions.
//
// Defines shared descriptor types (icon, label, tone) and builder helpers
// that convert headless mutation objects into UI-ready action descriptors.
// This keeps presentation logic in web-ui while action orchestration lives in web-core.
//
// This file is self-contained — it does NOT import from web-core so it can live
// in the web-ui package without creating a dependency cycle.

import type { AppIconName } from '@taurent/shared';

// ─── Local mutation shapes ─────────────────────────────────────────────────────
// Minimal shapes needed by builders. Keep in sync with the mutations that
// useTorrentActionController exposes.

interface HashListMutation {
  isPending: boolean;
  mutateAsync: (hashes: string[]) => Promise<unknown>;
}

interface DeleteMutation {
  isPending: boolean;
  mutateAsync: (vars: { hashes: string[]; deleteFiles: boolean }) => Promise<unknown>;
}

interface SpeedLimitMutation {
  isPending: boolean;
  mutateAsync: (vars: { hashes: string[]; limit: number }) => Promise<unknown>;
}

interface ForceStartMutation {
  isPending: boolean;
  mutateAsync: (vars: { hashes: string[]; value: boolean }) => Promise<unknown>;
}

interface CategoryMutation {
  isPending: boolean;
  mutateAsync: (vars: { hashes: string[]; category: string }) => Promise<unknown>;
}

interface TagsMutation {
  isPending: boolean;
  mutateAsync: (vars: { hashes: string[]; tags: string[] }) => Promise<unknown>;
}

// ─── Descriptor type ───────────────────────────────────────────────────────────

/** UI-only action descriptor built from a headless mutation object. */
export interface TorrentActionDescriptor {
  /** Stable key for the action (used as React key) */
  key: string;
  /** Icon name from the shared icon set */
  icon: AppIconName;
  /** Display label; may reflect pending state (e.g. "Starting...") */
  label: string;
  /** Optional tone passed through to ActionButton */
  tone?: 'primary' | 'secondary' | 'danger';
  /** Whether the action is currently disabled */
  disabled: boolean;
  /** Pending flag for composing label text */
  isPending: boolean;
  /** Callback invoked when the action button/chip is clicked */
  onClick: () => void;
}

// ─── Builder helpers ───────────────────────────────────────────────────────────

/**
 * Creates a TorrentActionDescriptor for a hash-list mutation (pause, resume, etc.).
 *
 * @param isBatchActionPending - Aggregated pending flag; gates all direct-action
 *   descriptors so they cannot fire while any batch mutation is in-flight.
 * @param onClick - Controller-provided handler (returns unknown for flexibility).
 *   When provided, the builder calls this instead of mutation.mutateAsync directly.
 * @param mutation - Raw mutation object. Only used when onClick is not provided
 *   (legacy path for callers that don't yet use controller handlers).
 */
export function buildHashListAction(
  key: string,
  icon: AppIconName,
  label: string,
  pendingLabel: string,
  tone: 'primary' | 'secondary' | 'danger' | undefined,
  isPending: boolean,
  isBatchActionPending: boolean,
  onClick?: () => unknown,
  mutation?: HashListMutation,
  hashes?: string[]
): TorrentActionDescriptor {
  return {
    key,
    icon,
    label: isPending ? pendingLabel : label,
    tone,
    disabled: isPending || isBatchActionPending,
    isPending,
    onClick: () => {
      if (isPending || isBatchActionPending) return;
      if (onClick) {
        void onClick();
      } else if (mutation && hashes) {
        void mutation.mutateAsync(hashes);
      }
    },
  };
}

/**
 * Builds the primary batch action trio: resume, pause, delete.
 * Returns three descriptors in fixed order for the primary action bar.
 */
export function buildPrimaryBatchActions(
  actions: {
    pause: HashListMutation;
    resume: HashListMutation;
    delete: DeleteMutation;
  },
  hashes: string[],
  isBatchActionPending: boolean,
  onDeleteClick: () => void
): TorrentActionDescriptor[] {
  return [
    buildHashListAction(
      'resume', 'play', 'Resume', 'Starting...', 'primary',
      actions.resume.isPending,
      isBatchActionPending,
      () => void actions.resume.mutateAsync(hashes)
    ),
    buildHashListAction(
      'pause', 'pause', 'Pause', 'Pausing...', undefined,
      actions.pause.isPending,
      isBatchActionPending,
      () => void actions.pause.mutateAsync(hashes)
    ),
    {
      key: 'delete',
      icon: 'trash',
      label: actions.delete.isPending ? 'Deleting...' : 'Delete',
      tone: 'danger',
      disabled: isBatchActionPending,
      isPending: actions.delete.isPending,
      onClick: onDeleteClick,
    },
  ];
}

/**
 * Builds the secondary batch action chips row: recheck, reannounce,
 * download-limit, upload-limit, category, tags, and optionally priority.
 */
export function buildSecondaryBatchActions(
  actions: {
    recheck: HashListMutation;
    reannounce: HashListMutation;
    setDownloadLimit?: SpeedLimitMutation;
    setUploadLimit?: SpeedLimitMutation;
    setCategory?: CategoryMutation;
    addTags?: TagsMutation;
    removeTags?: TagsMutation;
    increasePriority?: HashListMutation;
    decreasePriority?: HashListMutation;
  },
  hashes: string[],
  isBatchActionPending: boolean,
  onDownloadLimitClick: () => void,
  onUploadLimitClick: () => void,
  onCategoryClick: () => void,
  onTagsClick: () => void
): TorrentActionDescriptor[] {
  const result: TorrentActionDescriptor[] = [];

  result.push(
    buildHashListAction(
      'recheck', 'refresh', 'Recheck', 'Rechecking...', undefined,
      actions.recheck.isPending,
      isBatchActionPending,
      () => void actions.recheck.mutateAsync(hashes)
    )
  );

  result.push(
    buildHashListAction(
      'reannounce', 'globe', 'Announce', 'Announcing...', undefined,
      actions.reannounce.isPending,
      isBatchActionPending,
      () => void actions.reannounce.mutateAsync(hashes)
    )
  );

  if (actions.setDownloadLimit) {
    result.push({
      key: 'download-limit',
      icon: 'download',
      label: 'DL Limit',
      disabled: isBatchActionPending,
      isPending: actions.setDownloadLimit.isPending,
      onClick: onDownloadLimitClick,
    });
  }

  if (actions.setUploadLimit) {
    result.push({
      key: 'upload-limit',
      icon: 'upload',
      label: 'UL Limit',
      disabled: isBatchActionPending,
      isPending: actions.setUploadLimit.isPending,
      onClick: onUploadLimitClick,
    });
  }

  if (actions.setCategory) {
    result.push({
      key: 'category',
      icon: 'folder',
      label: 'Category',
      disabled: isBatchActionPending,
      isPending: actions.setCategory.isPending,
      onClick: onCategoryClick,
    });
  }

  if (actions.addTags && actions.removeTags) {
    result.push({
      key: 'tags',
      icon: 'tag',
      label: 'Tags',
      disabled: isBatchActionPending,
      isPending: actions.addTags.isPending || actions.removeTags.isPending,
      onClick: onTagsClick,
    });
  }

  if (actions.increasePriority) {
    const increasePriority = actions.increasePriority;
    result.push(
      buildHashListAction(
        'increase-priority', 'chevron-up', 'Queue Up', 'Moving...', undefined,
        increasePriority.isPending,
        isBatchActionPending,
        () => void increasePriority.mutateAsync(hashes)
      )
    );
  }

  if (actions.decreasePriority) {
    const decreasePriority = actions.decreasePriority;
    result.push(
      buildHashListAction(
        'decrease-priority', 'chevron-down', 'Queue Down', 'Moving...', undefined,
        decreasePriority.isPending,
        isBatchActionPending,
        () => void decreasePriority.mutateAsync(hashes)
      )
    );
  }

  return result;
}

/**
 * Builds single-torrent action descriptors for the torrent detail screen.
 * These actions operate on a single hash rather than a batch.
 */
export function buildDetailActions(
  actions: {
    pause: HashListMutation;
    resume: HashListMutation;
    delete: DeleteMutation;
    recheck: HashListMutation;
    reannounce: HashListMutation;
    forceStart: ForceStartMutation;
    setDownloadLimit?: SpeedLimitMutation;
    setUploadLimit?: SpeedLimitMutation;
    rename?: { isPending: boolean; mutate: (vars: { hash: string; name: string }) => void };
    relocate?: { isPending: boolean; mutate: (vars: { hashes: string[]; newLocation: string }) => void };
    increasePriority?: HashListMutation;
    decreasePriority?: HashListMutation;
  },
  hash: string,
  isPaused: boolean,
  isActionPending: boolean
): {
  pauseResume: TorrentActionDescriptor;
  delete: TorrentActionDescriptor;
  secondary: TorrentActionDescriptor[];
} {
  const hashes = [hash];

  const pauseResumeDescriptor = buildHashListAction(
    'pause-resume',
    isPaused ? 'play' : 'pause',
    isPaused ? 'Resume' : 'Pause',
    isPaused ? 'Resuming...' : 'Pausing...',
    'primary',
    isPaused ? actions.resume.isPending : actions.pause.isPending,
    isActionPending,
    () => void (isPaused ? actions.resume : actions.pause).mutateAsync(hashes)
  );

  const deleteDescriptor: TorrentActionDescriptor = {
    key: 'delete',
    icon: 'trash',
    label: actions.delete.isPending ? 'Deleting...' : 'Delete',
    tone: 'danger',
    disabled: isActionPending,
    isPending: actions.delete.isPending,
    onClick: () => {}, // Caller provides via delete action
  };

  const secondary: TorrentActionDescriptor[] = [
    {
      key: 'force-start',
      icon: 'zap',
      label: actions.forceStart.isPending
        ? 'Setting...'
        : 'Force Start',
      disabled: isActionPending,
      isPending: actions.forceStart.isPending,
      onClick: () => {},
    },
    buildHashListAction(
      'recheck', 'refresh', 'Recheck', 'Rechecking...', undefined,
      actions.recheck.isPending,
      isActionPending,
      () => void actions.recheck.mutateAsync(hashes)
    ),
    buildHashListAction(
      'reannounce', 'globe', 'Announce', 'Announcing...', undefined,
      actions.reannounce.isPending,
      isActionPending,
      () => void actions.reannounce.mutateAsync(hashes)
    ),
  ];

  return { pauseResume: pauseResumeDescriptor, delete: deleteDescriptor, secondary };
}