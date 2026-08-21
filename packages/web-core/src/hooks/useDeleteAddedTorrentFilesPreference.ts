import { useCallback, useEffect, useState } from 'react';
import type { PlatformStorage } from '@taurent/shared/platform';

export const DELETE_ADDED_TORRENT_FILES_SETTING_KEY = 'delete_added_torrent_files';

export interface DeleteAddedTorrentFilesPreference {
  deleteAddedTorrentFiles: boolean;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  setDeleteAddedTorrentFiles: (value: boolean) => Promise<void>;
}

/**
 * Taurent-local preference controlling whether source .torrent files are
 * removed after qBittorrent accepts their uploaded contents.
 */
export function useDeleteAddedTorrentFilesPreference(
  storage: PlatformStorage,
): DeleteAddedTorrentFilesPreference {
  const [deleteAddedTorrentFiles, setValue] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setValue((await storage.getItem(DELETE_ADDED_TORRENT_FILES_SETTING_KEY)) === 'true');
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  const setDeleteAddedTorrentFiles = useCallback(async (value: boolean) => {
    try {
      await storage.setItem(DELETE_ADDED_TORRENT_FILES_SETTING_KEY, String(value));
      setValue(value);
      setError(null);
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
    }
  }, [storage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    deleteAddedTorrentFiles,
    isLoading,
    error,
    reload,
    setDeleteAddedTorrentFiles,
  };
}
