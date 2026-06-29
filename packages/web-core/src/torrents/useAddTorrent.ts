// Shared add-torrent controller hook — renderer-only, bridge-agnostic.
//
// Provides the core mutation logic for adding torrents by URL or by torrent file paths.
// Both desktop and mobile apps delegate to this hook; only the file-picking UX differs.
//
// Usage (mobile — re-export pattern):
//   export { useAddTorrent } from '@taurent/web-core/torrents';
//
// Usage (desktop — direct import):
//   import { useAddTorrent } from '@taurent/web-core/torrents';
//   const { addByUrl, addByFiles, isPending, error } = useAddTorrent({
//     addTorrentFn: (options) => BridgeAdapter.torrents.addTorrent(options),
//     scope,
//   });

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryScope } from '../query/scope';
import { invalidateTorrents } from '../query';
import type { AddTorrentOptions } from '@taurent/bridge';

export interface UseAddTorrentOptions {
  /** Injected bridge mutation function — platform provides at call site. */
  addTorrentFn: (options: AddTorrentOptions) => Promise<unknown>;
  scope: QueryScope;
}

export interface UseAddTorrentResult {
  /** Add torrent(s) by magnet URL or HTTP torrent link. */
  addByUrl: (url: string, options?: Omit<AddTorrentOptions, 'urls' | 'torrentFiles'>) => Promise<unknown>;
  /** Add torrent(s) by local .torrent file paths. */
  addByFiles: (files: string[], options?: Omit<AddTorrentOptions, 'urls' | 'torrentFiles'>) => Promise<unknown>;
  /** Whether a mutation is currently in-flight. */
  isPending: boolean;
  /** Error from the last mutation, if any. */
  error: Error | null;
}

export function useAddTorrent({ addTorrentFn, scope }: UseAddTorrentOptions): UseAddTorrentResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (options: AddTorrentOptions) => {
      return addTorrentFn(options);
    },
    retry: false,
    onSuccess: () => {
      invalidateTorrents(queryClient, scope);
    },
  });

  const addByUrl = useCallback(
    (url: string, options?: Omit<AddTorrentOptions, 'urls' | 'torrentFiles'>) => {
      return mutation.mutateAsync({
        urls: url,
        ...options,
      });
    },
    [mutation]
  );

  const addByFiles = useCallback(
    (files: string[], options?: Omit<AddTorrentOptions, 'urls' | 'torrentFiles'>) => {
      return mutation.mutateAsync({
        torrentFiles: files,
        ...options,
      });
    },
    [mutation]
  );

  return {
    addByUrl,
    addByFiles,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
