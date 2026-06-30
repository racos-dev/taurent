import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

import type { AppUpdateInfo, AppUpdateProgress } from '../contracts/interfaces';

let pendingUpdate: Update | null = null;

function toUpdateInfo(update: Update): AppUpdateInfo {
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date ?? null,
    body: update.body ?? null,
  };
}

export async function checkForUpdate(): Promise<AppUpdateInfo | null> {
  if (pendingUpdate) {
    await pendingUpdate.close().catch(() => undefined);
    pendingUpdate = null;
  }

  const update = await check();
  pendingUpdate = update;
  return update ? toUpdateInfo(update) : null;
}

export async function downloadAndInstallUpdate(
  onProgress?: (event: AppUpdateProgress) => void,
): Promise<void> {
  const update = pendingUpdate ?? await check();
  if (!update) {
    throw new Error('No update is available.');
  }

  pendingUpdate = update;
  let downloaded = 0;
  let contentLength: number | null = null;

  try {
    await update.downloadAndInstall((event: DownloadEvent) => {
      switch (event.event) {
        case 'Started':
          downloaded = 0;
          contentLength = event.data.contentLength ?? null;
          onProgress?.({ event: 'Started', contentLength });
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          onProgress?.({
            event: 'Progress',
            chunkLength: event.data.chunkLength,
            downloaded,
            contentLength,
          });
          break;
        case 'Finished':
          onProgress?.({ event: 'Finished', downloaded, contentLength });
          break;
      }
    });
  } finally {
    pendingUpdate = null;
  }
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
