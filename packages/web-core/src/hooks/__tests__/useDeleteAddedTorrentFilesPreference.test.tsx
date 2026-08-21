import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlatformStorage } from '@taurent/shared/platform';
import {
  DELETE_ADDED_TORRENT_FILES_SETTING_KEY,
  useDeleteAddedTorrentFilesPreference,
} from '../useDeleteAddedTorrentFilesPreference';

function makeStorage(initialValue: string | null): PlatformStorage {
  let value = initialValue;
  return {
    getItem: vi.fn(async () => value),
    setItem: vi.fn(async (_key, nextValue) => {
      value = nextValue;
    }),
    deleteItem: vi.fn(async () => {
      value = null;
    }),
  };
}

describe('useDeleteAddedTorrentFilesPreference', () => {
  it('defaults to disabled when the preference is absent', async () => {
    const storage = makeStorage(null);
    const { result } = renderHook(() => useDeleteAddedTorrentFilesPreference(storage));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.deleteAddedTorrentFiles).toBe(false);
  });

  it('loads and persists the Taurent-local preference', async () => {
    const storage = makeStorage('true');
    const { result } = renderHook(() => useDeleteAddedTorrentFilesPreference(storage));

    await waitFor(() => expect(result.current.deleteAddedTorrentFiles).toBe(true));
    await act(async () => {
      await result.current.setDeleteAddedTorrentFiles(false);
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      DELETE_ADDED_TORRENT_FILES_SETTING_KEY,
      'false',
    );
    expect(result.current.deleteAddedTorrentFiles).toBe(false);
  });
});
