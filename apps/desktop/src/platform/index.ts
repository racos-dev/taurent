import { open, save } from '@tauri-apps/plugin-dialog';
import { Store } from '@tauri-apps/plugin-store';
import type { PlatformStorage } from '@taurent/shared/platform';


let storeInstance: Store | null = null;
let currentPath: string | null = null;

async function getStore(storagePath: string): Promise<Store> {
  if (!storeInstance || currentPath !== storagePath) {
    storeInstance = await Store.load(storagePath, { autoSave: false, defaults: {} });
    currentPath = storagePath;
  }
  return storeInstance;
}

export const storage: PlatformStorage = {
  getItem: async (key) => {
    try {
      const store = await getStore('.settings.dat');
      const value = await store.get(key);
      return (typeof value === 'string' ? value : JSON.stringify(value)) || null;
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    const store = await getStore('.settings.dat');
    await store.set(key, value);
    await store.save();
  },
  deleteItem: async (key) => {
    const store = await getStore('.settings.dat');
    await store.delete(key);
    await store.save();
  },
};

export async function pickTorrentFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: 'Torrent',
        extensions: ['torrent'],
      },
    ],
  });

  if (!selected) return [];

  const files = Array.isArray(selected) ? selected : [selected];
  return files.filter((f) => f.toLowerCase().endsWith('.torrent'));
}

export async function pickSavePath(defaultName: string): Promise<string | null> {
  const path = await save({
    defaultPath: defaultName,
    filters: [
      {
        name: 'Torrent',
        extensions: ['torrent'],
      },
    ],
  });
  return path ?? null;
}
