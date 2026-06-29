// Shared torrent actions hook — capability-gated.
//
// Composes all shared torrent mutations from useTorrentMutations into a single
// interface. Consumers (desktop/mobile) pass in their bridge mutation fns;
// the hook gates actions that aren't supported on the platform by checking
// whether the mutation function was provided.
//
// Always-available actions: pause, resume, delete, recheck, reannounce, forceStart
// Capability-gated: setName, setLocation, setDownloadLimit, setUploadLimit,
//                   setFilePriority, increasePriority, decreasePriority,
//                   topPriority, bottomPriority
// Always-exposed if provided: setCategory, addTags, removeTags

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import {
  usePauseTorrents,
  useResumeTorrents,
  useDeleteTorrents,
  useRecheckTorrents,
  useReannounceTorrents,
  useSetForceStart,
  useSetTorrentCategory,
  useAddTorrentTags,
  useRemoveTorrentTags,
} from '../hooks';
import { invalidateTorrents, invalidateTorrentProperties, invalidateTorrentFiles } from '../query';

export interface UseTorrentActionsOptions {
  scope: QueryScope;
  pauseTorrents: (hashes: string[]) => Promise<void>;
  resumeTorrents: (hashes: string[]) => Promise<void>;
  deleteTorrents: (vars: { hashes: string[]; deleteFiles: boolean }) => Promise<void>;
  recheckTorrents: (hashes: string[]) => Promise<void>;
  reannounceTorrents: (hashes: string[]) => Promise<void>;
  setForceStart: (vars: { hashes: string[]; value: boolean }) => Promise<void>;
  // Capability-gated — omit or pass undefined if not supported
  setCategory?: (vars: { hashes: string[]; category: string }) => Promise<void>;
  addTags?: (vars: { hashes: string[]; tags: string[] }) => Promise<void>;
  removeTags?: (vars: { hashes: string[]; tags: string[] }) => Promise<void>;
  setDownloadLimit?: (vars: { hashes: string[]; limit: number }) => Promise<void>;
  setUploadLimit?: (vars: { hashes: string[]; limit: number }) => Promise<void>;
  setFilePriority?: (vars: { hash: string; fileIds: number[]; priority: number }) => Promise<void>;
  setName?: (vars: { hash: string; name: string }) => Promise<void>;
  setLocation?: (vars: { hashes: string[]; newLocation: string }) => Promise<void>;
  increasePriority?: (hashes: string[]) => Promise<void>;
  decreasePriority?: (hashes: string[]) => Promise<void>;
  topPriority?: (hashes: string[]) => Promise<void>;
  bottomPriority?: (hashes: string[]) => Promise<void>;
  // Desktop torrent management toggles
  setAutoManagement?: (vars: { hashes: string[]; enable: boolean }) => Promise<void>;
  setShareLimits?: (vars: { hashes: string[]; ratioLimit: number; seedingTimeLimit: number }) => Promise<void>;
  setSequentialDownload?: (vars: { hashes: string[]; value: boolean }) => Promise<void>;
  setFirstLastPiecePriority?: (vars: { hashes: string[]; value: boolean }) => Promise<void>;
  setSuperSeeding?: (vars: { hashes: string[]; value: boolean }) => Promise<void>;
  exportTorrent?: (vars: { hash: string; savePath: string }) => Promise<void>;
}

export interface UseTorrentActionsResult {
  // Always available
  pause: ReturnType<typeof usePauseTorrents>;
  resume: ReturnType<typeof useResumeTorrents>;
  delete: ReturnType<typeof useDeleteTorrents>;
  recheck: ReturnType<typeof useRecheckTorrents>;
  reannounce: ReturnType<typeof useReannounceTorrents>;
  forceStart: ReturnType<typeof useSetForceStart>;
  // Always-exposed if provided
  setCategory: ReturnType<typeof useSetTorrentCategory> | undefined;
  addTags: ReturnType<typeof useAddTorrentTags> | undefined;
  removeTags: ReturnType<typeof useRemoveTorrentTags> | undefined;
  // Capability-gated — undefined if not supported
  setDownloadLimit: ReturnType<typeof useSetDownloadLimit> | undefined;
  setUploadLimit: ReturnType<typeof useSetUploadLimit> | undefined;
  setFilePriority: ReturnType<typeof useSetFilePriority> | undefined;
  rename: ReturnType<typeof useRenameTorrent> | undefined;
  relocate: ReturnType<typeof useRelocateTorrents> | undefined;
  increasePriority: ReturnType<typeof useIncreasePriority> | undefined;
  decreasePriority: ReturnType<typeof useDecreasePriority> | undefined;
  topPriority: ReturnType<typeof useTopPriority> | undefined;
  bottomPriority: ReturnType<typeof useBottomPriority> | undefined;
  // Desktop torrent management toggles — undefined if not supported
  setAutoManagement: ReturnType<typeof useSetAutoManagement> | undefined;
  setShareLimits: ReturnType<typeof useSetShareLimits> | undefined;
  setSequentialDownload: ReturnType<typeof useSetSequentialDownload> | undefined;
  setFirstLastPiecePriority: ReturnType<typeof useSetFirstLastPiecePriority> | undefined;
  setSuperSeeding: ReturnType<typeof useSetSuperSeeding> | undefined;
  exportTorrent: ReturnType<typeof useExportTorrent> | undefined;
}

// Standalone mutation hooks for capability-gated actions.
// Each is a named export so they can be returned directly from the main hook.

function useSetDownloadLimit(scope: QueryScope, mutationFn: (vars: { hashes: string[]; limit: number }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hashes: string[]; limit: number }) => mutationFn(vars),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useSetUploadLimit(scope: QueryScope, mutationFn: (vars: { hashes: string[]; limit: number }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hashes: string[]; limit: number }) => mutationFn(vars),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useSetFilePriority(scope: QueryScope, mutationFn: (vars: { hash: string; fileIds: number[]; priority: number }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hash: string; fileIds: number[]; priority: number }) => mutationFn(vars),
    onSuccess: (_data, { hash }) => {
      invalidateTorrentFiles(queryClient, scope, hash);
    },
  });
}

function useRenameTorrent(scope: QueryScope, mutationFn: (vars: { hash: string; name: string }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hash: string; name: string }) => mutationFn(vars),
    onSuccess: (_data, { hash }) => {
      invalidateTorrents(queryClient, scope);
      invalidateTorrentProperties(queryClient, scope, hash);
    },
  });
}

function useRelocateTorrents(scope: QueryScope, mutationFn: (vars: { hashes: string[]; newLocation: string }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hashes: string[]; newLocation: string }) => mutationFn(vars),
    onSuccess: (_data, { hashes }) => {
      invalidateTorrents(queryClient, scope);
      for (const hash of hashes) {
        invalidateTorrentProperties(queryClient, scope, hash);
      }
    },
  });
}

function useIncreasePriority(scope: QueryScope, mutationFn: (hashes: string[]) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hashes: string[]) => mutationFn(hashes),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useDecreasePriority(scope: QueryScope, mutationFn: (hashes: string[]) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hashes: string[]) => mutationFn(hashes),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useTopPriority(scope: QueryScope, mutationFn: (hashes: string[]) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hashes: string[]) => mutationFn(hashes),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useBottomPriority(scope: QueryScope, mutationFn: (hashes: string[]) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hashes: string[]) => mutationFn(hashes),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useSetAutoManagement(scope: QueryScope, mutationFn: (vars: { hashes: string[]; enable: boolean }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hashes: string[]; enable: boolean }) => mutationFn(vars),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useSetShareLimits(scope: QueryScope, mutationFn: (vars: { hashes: string[]; ratioLimit: number; seedingTimeLimit: number }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hashes: string[]; ratioLimit: number; seedingTimeLimit: number }) => mutationFn(vars),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useSetSequentialDownload(scope: QueryScope, mutationFn: (vars: { hashes: string[]; value: boolean }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hashes: string[]; value: boolean }) => mutationFn(vars),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useSetFirstLastPiecePriority(scope: QueryScope, mutationFn: (vars: { hashes: string[]; value: boolean }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hashes: string[]; value: boolean }) => mutationFn(vars),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useSetSuperSeeding(scope: QueryScope, mutationFn: (vars: { hashes: string[]; value: boolean }) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hashes: string[]; value: boolean }) => mutationFn(vars),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

function useExportTorrent(scope: QueryScope, mutationFn: (vars: { hash: string; savePath: string }) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hash: string; savePath: string }) => mutationFn(vars),
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });
}

export function useTorrentActions({
  scope,
  pauseTorrents,
  resumeTorrents,
  deleteTorrents,
  recheckTorrents,
  reannounceTorrents,
  setForceStart,
  setCategory,
  addTags,
  removeTags,
  setDownloadLimit,
  setUploadLimit,
  setFilePriority,
  setName,
  setLocation,
  increasePriority,
  decreasePriority,
  topPriority,
  bottomPriority,
  setAutoManagement,
  setShareLimits,
  setSequentialDownload,
  setFirstLastPiecePriority,
  setSuperSeeding,
  exportTorrent,
}: UseTorrentActionsOptions): UseTorrentActionsResult {
  // Always-available shared mutations
  const pause = usePauseTorrents({ scope, mutationFn: pauseTorrents });
  const resume = useResumeTorrents({ scope, mutationFn: resumeTorrents });
  const delete_ = useDeleteTorrents({ scope, mutationFn: deleteTorrents });
  const recheck = useRecheckTorrents({ scope, mutationFn: recheckTorrents });
  const reannounce = useReannounceTorrents({ scope, mutationFn: reannounceTorrents });
  const forceStart = useSetForceStart({ scope, mutationFn: setForceStart });

  // Always-exposed if provided (no explicit capability gate)
  // Wrapped to be no-ops when the capability is absent, so hooks are called unconditionally.
  const setCategory_ = useSetTorrentCategory({
    scope,
    mutationFn: setCategory ?? (async () => {}),
  });
  const addTags_ = useAddTorrentTags({
    scope,
    mutationFn: addTags ?? (async () => {}),
  });
  const removeTags_ = useRemoveTorrentTags({
    scope,
    mutationFn: removeTags ?? (async () => {}),
  });

  // Capability-gated mutations — hooks always called; underlying fn is a no-op when unsupported.
  const setDownloadLimit_ = useSetDownloadLimit(
    scope,
    setDownloadLimit ?? (async () => {}),
  );
  const setUploadLimit_ = useSetUploadLimit(
    scope,
    setUploadLimit ?? (async () => {}),
  );
  const setFilePriority_ = useSetFilePriority(
    scope,
    setFilePriority ?? (async () => {}),
  );
  const rename_ = useRenameTorrent(scope, setName ?? (async () => {}));
  const relocate_ = useRelocateTorrents(scope, setLocation ?? (async () => {}));
  const increasePriority_ = useIncreasePriority(
    scope,
    increasePriority ?? (async () => {}),
  );
  const decreasePriority_ = useDecreasePriority(
    scope,
    decreasePriority ?? (async () => {}),
  );
  const topPriority_ = useTopPriority(scope, topPriority ?? (async () => {}));
  const bottomPriority_ = useBottomPriority(
    scope,
    bottomPriority ?? (async () => {}),
  );

  // Desktop torrent management toggles
  const setAutoManagement_ = useSetAutoManagement(
    scope,
    setAutoManagement ?? (async (v: { hashes: string[]; enable: boolean }): Promise<void> => { void v; }),
  );
  const setShareLimits_ = useSetShareLimits(
    scope,
    setShareLimits ?? (async (v: { hashes: string[]; ratioLimit: number; seedingTimeLimit: number }): Promise<void> => { void v; }),
  );
  const setSequentialDownload_ = useSetSequentialDownload(
    scope,
    setSequentialDownload ?? (async (v: { hashes: string[]; value: boolean }): Promise<void> => { void v; }),
  );
  const setFirstLastPiecePriority_ = useSetFirstLastPiecePriority(
    scope,
    setFirstLastPiecePriority ?? (async (v: { hashes: string[]; value: boolean }): Promise<void> => { void v; }),
  );
  const setSuperSeeding_ = useSetSuperSeeding(
    scope,
    setSuperSeeding ?? (async (v: { hashes: string[]; value: boolean }): Promise<void> => { void v; }),
  );
  const exportTorrent_ = useExportTorrent(
    scope,
    exportTorrent ?? (async (v: { hash: string; savePath: string }): Promise<unknown> => { void v; return undefined; }),
  );

  return {
    pause,
    resume,
    delete: delete_,
    recheck,
    reannounce,
    forceStart,
    setCategory: setCategory ? setCategory_ : undefined,
    addTags: addTags ? addTags_ : undefined,
    removeTags: removeTags ? removeTags_ : undefined,
    setDownloadLimit: setDownloadLimit ? setDownloadLimit_ : undefined,
    setUploadLimit: setUploadLimit ? setUploadLimit_ : undefined,
    setFilePriority: setFilePriority ? setFilePriority_ : undefined,
    rename: setName ? rename_ : undefined,
    relocate: setLocation ? relocate_ : undefined,
    increasePriority: increasePriority ? increasePriority_ : undefined,
    decreasePriority: decreasePriority ? decreasePriority_ : undefined,
    topPriority: topPriority ? topPriority_ : undefined,
    bottomPriority: bottomPriority ? bottomPriority_ : undefined,
    setAutoManagement: setAutoManagement ? setAutoManagement_ : undefined,
    setShareLimits: setShareLimits ? setShareLimits_ : undefined,
    setSequentialDownload: setSequentialDownload ? setSequentialDownload_ : undefined,
    setFirstLastPiecePriority: setFirstLastPiecePriority ? setFirstLastPiecePriority_ : undefined,
    setSuperSeeding: setSuperSeeding ? setSuperSeeding_ : undefined,
    exportTorrent: exportTorrent ? exportTorrent_ : undefined,
  };
}
