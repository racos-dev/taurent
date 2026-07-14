/**
 * Desktop-specific override of TorrentDetailsFilesSection that adds:
 * - "Show in Folder" and "Open File" context menu actions for file rows
 * - Click-to-open behavior for folder rows
 * - Context menu for folder rows
 */

import React, { useCallback, useMemo, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { File, FolderOpen } from '@taurent/shared';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { ContextMenu, TorrentDetailsFilesSection } from '@taurent/web-ui';
import type { TorrentDetailsFilesSectionProps, FileDisplayRow } from '@taurent/web-ui/components/torrents/TorrentDetailsSections/types';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { buildServerTargetPath, dirname } from '../../utils/pathMapping';
import { openSettingsWindow } from '../../windows/settings/settingsWindow';

interface FileContextMenuState {
  x: number;
  y: number;
  serverFolderPath: string;
  /** Full server-side path to the file itself (only set for file rows). */
  serverFilePath?: string;
}

interface FolderContextMenuState {
  x: number;
  y: number;
  serverFolderPath: string;
}

/**
 * Compute the server-side folder path for a file row.
 * - Single-file torrent: contentPath is the file itself → open its parent dir
 * - Multi-file torrent: derive the full target path first (using buildServerTargetPath
 *   which strips any duplicate top-level segment), then take its dirname
 */
function buildServerFolderPath(contentPath: string, rowPath: string, isSingleFile: boolean): string {
  if (isSingleFile) {
    return dirname(contentPath);
  }
  const targetPath = buildServerTargetPath(contentPath, rowPath, isSingleFile);
  return dirname(targetPath);
}

/**
 * Resolve a server path to a local path using path mappings, falling back to settings.
 */
async function resolveAndOpenPath(serverPath: string): Promise<void> {
  const snapshot = await BridgeAdapter.getSessionSnapshot();
  const serverId = snapshot.server_id;
  if (!serverId) return;
  const result = await BridgeAdapter.resolveLocalPath(serverId, serverPath);
  if ('localPath' in result) {
    await BridgeAdapter.openLocalPath(result.localPath);
  } else {
    await openSettingsWindow('desktop-path-mappings');
    await emit('scroll-to-section', { section: 'desktop-path-mappings' });
  }
}

/**
 * Resolve a server path to a local path and reveal the item in its parent directory.
 */
async function resolveAndRevealItem(serverPath: string): Promise<void> {
  const snapshot = await BridgeAdapter.getSessionSnapshot();
  const serverId = snapshot.server_id;
  if (!serverId) return;
  const result = await BridgeAdapter.resolveLocalPath(serverId, serverPath);
  if ('localPath' in result) {
    await BridgeAdapter.revealLocalItem(result.localPath);
  } else {
    await openSettingsWindow('desktop-path-mappings');
    await emit('scroll-to-section', { section: 'desktop-path-mappings' });
  }
}

/**
 * Desktop wrapper around TorrentDetailsFilesSection that adds:
 * - Context menu with "Open File" and "Show in Folder" for file rows
 * - Click-to-open-inside for folder rows
 * - Context menu for folder rows with "Open Folder" and "Show in Folder"
 */
interface DesktopTorrentDetailsFilesSectionProps extends TorrentDetailsFilesSectionProps {
  /** The torrent's server-side content path — the actual downloaded content root. */
  contentPath: string;
  /**
   * The total number of files in the torrent (not the filtered/visible count).
   * Used to determine single-file status for path construction.
   */
  totalFileCount: number;
}

export function DesktopTorrentDetailsFilesSection(
  props: DesktopTorrentDetailsFilesSectionProps
) {
  const { contentPath, totalFileCount, ...restProps } = props;
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null);

  // Single-file status derived from the authoritative total file count, not the
  // possibly-truncated visible-files list.
  const isSingleFile = useMemo(() => {
    return totalFileCount === 1;
  }, [totalFileCount]);

  const closeFileContextMenu = useCallback(() => {
    setFileContextMenu(null);
  }, []);

  const closeFolderContextMenu = useCallback(() => {
    setFolderContextMenu(null);
  }, []);

  const handleFileContextMenu = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: FileDisplayRow) => {
      if (row.isFolder || !row.file) return;
      event.preventDefault();
      event.stopPropagation();
      const serverFolderPath = buildServerFolderPath(contentPath, row.path, isSingleFile);
      const serverFilePath = buildServerTargetPath(contentPath, row.path, isSingleFile);
      setFileContextMenu({ x: event.clientX, y: event.clientY, serverFolderPath, serverFilePath });
    },
    [contentPath, isSingleFile]
  );

  const handleFolderContextMenu = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: FileDisplayRow) => {
      if (!row.isFolder) return;
      event.preventDefault();
      event.stopPropagation();
      const serverFolderPath = buildServerTargetPath(contentPath, row.path, isSingleFile);
      setFolderContextMenu({ x: event.clientX, y: event.clientY, serverFolderPath });
    },
    [contentPath, isSingleFile]
  );

  const handleFilesContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const serverFolderPath = isSingleFile ? dirname(contentPath) : contentPath;
      setFolderContextMenu({ x: event.clientX, y: event.clientY, serverFolderPath });
    },
    [contentPath, isSingleFile]
  );

  const handleFolderRowClick = useCallback(
    async (row: FileDisplayRow) => {
      if (!row.isFolder) return;
      const serverFolderPath = buildServerTargetPath(contentPath, row.path, isSingleFile);
      await resolveAndOpenPath(serverFolderPath);
    },
    [contentPath, isSingleFile]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col relative">
      <TorrentDetailsFilesSection
        {...restProps}
        onFileContextMenu={handleFileContextMenu}
        onFolderContextMenu={handleFolderContextMenu}
        onFilesContextMenu={handleFilesContextMenu}
        onFolderRowClick={handleFolderRowClick}
      />
      {fileContextMenu ? (
        <ContextMenu
          x={fileContextMenu.x}
          y={fileContextMenu.y}
          width="w-44"
          onClose={closeFileContextMenu}
          items={[
            {
              kind: 'item',
              id: 'open-file',
              label: 'Open File',
              icon: File,
              disabled: !fileContextMenu.serverFilePath,
              onClick: async () => {
                if (!fileContextMenu.serverFilePath) return;
                closeFileContextMenu();
                try {
                  await resolveAndOpenPath(fileContextMenu.serverFilePath);
                } catch (err) {
                  toast.error(formatUserMessageForContext(err, 'torrent-action'), { dedupeKey: 'details-panel:open-file' });
                }
              },
            },
            {
              kind: 'item',
              id: 'show-in-folder',
              label: 'Show in Folder',
              icon: FolderOpen,
              onClick: async () => {
                closeFileContextMenu();
                try {
                  await resolveAndRevealItem(fileContextMenu.serverFilePath ?? fileContextMenu.serverFolderPath);
                } catch (err) {
                  toast.error(formatUserMessageForContext(err, 'torrent-action'), { dedupeKey: 'details-panel:show-in-folder' });
                }
              },
            },
          ]}
        />
      ) : null}
      {folderContextMenu ? (
        <ContextMenu
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          width="w-44"
          onClose={closeFolderContextMenu}
          items={[
            {
              kind: 'item',
              id: 'open-folder',
              label: 'Open Folder',
              icon: FolderOpen,
              onClick: async () => {
                closeFolderContextMenu();
                try {
                  await resolveAndOpenPath(folderContextMenu.serverFolderPath);
                } catch (err) {
                  toast.error(formatUserMessageForContext(err, 'torrent-action'), { dedupeKey: 'details-panel:open-folder' });
                }
              },
            },
            {
              kind: 'item',
              id: 'show-in-folder',
              label: 'Show in Folder',
              icon: FolderOpen,
              onClick: async () => {
                closeFolderContextMenu();
                try {
                  await resolveAndRevealItem(folderContextMenu.serverFolderPath);
                } catch (err) {
                  toast.error(formatUserMessageForContext(err, 'torrent-action'), { dedupeKey: 'details-panel:show-in-folder' });
                }
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}

// Re-export types for consumers
