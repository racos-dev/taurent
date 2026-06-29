import React, { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Trash2, FolderOpen } from '@taurent/shared';
import { Button, Input, Spinner } from '@taurent/web-ui';
import type { PathMapping } from '@taurent/bridge';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useQBClient } from '../../connection';
import { Icon } from '@taurent/shared';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';

interface MappingRow {
  id: string;
  serverPath: string;
  localPath: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function emptyRow(): MappingRow {
  return { id: generateId(), serverPath: '', localPath: '' };
}

/**
 * Desktop settings section for managing per-server path mappings.
 * Displays a list of server-path → local-path pairs with text inputs,
 * a folder-picker button for the local path, and an add/remove row UI.
 * Changes auto-save through BridgeAdapter.desktop.setPathMappings.
 */
export const PathMappingsSettings = React.memo(() => {
  const { serverId } = useQBClient();

  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load mappings on mount / serverId change ────────────────────────────
  useEffect(() => {
    if (!serverId) {
      setMappings([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const saved = await BridgeAdapter.getPathMappings(serverId);
        if (cancelled) return;
        setMappings(
          saved.map((m) => ({ id: generateId(), serverPath: m.serverPath, localPath: m.localPath })),
        );
      } catch (err) {
        if (cancelled) return;
        setLoadError(formatUserMessageForContext(err, 'path-mappings'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverId]);

  // ── Persist mappings whenever they change ──────────────────────────────
  const persistMappings = useCallback(
    async (rows: MappingRow[]) => {
      if (!serverId) return;
      setIsSaving(true);
      setSaveError(null);
      try {
        const toSave: PathMapping[] = rows
          .map(({ serverPath, localPath }) => ({
            serverPath: serverPath.trim(),
            localPath: localPath.trim(),
          }))
          .filter((m) => m.serverPath.length > 0 && m.localPath.length > 0);
        await BridgeAdapter.setPathMappings(serverId, toSave);
      } catch (err) {
        console.error('[PathMappingsSettings] autosave failed', err);
        setSaveError(formatUserMessageForContext(err, 'path-mappings'));
      } finally {
        setIsSaving(false);
      }
    },
    [serverId],
  );

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleServerPathChange = useCallback(
    (id: string, value: string) => {
      setMappings((prev) => {
        const next = prev.map((row) => (row.id === id ? { ...row, serverPath: value } : row));
        void persistMappings(next);
        return next;
      });
    },
    [persistMappings],
  );

  const handleLocalPathChange = useCallback(
    (id: string, value: string) => {
      setMappings((prev) => {
        const next = prev.map((row) => (row.id === id ? { ...row, localPath: value } : row));
        void persistMappings(next);
        return next;
      });
    },
    [persistMappings],
  );

  const handlePickLocalPath = useCallback(
    async (id: string) => {
      const selected = await open({ directory: true });
      if (selected && typeof selected === 'string') {
        handleLocalPathChange(id, selected);
      }
    },
    [handleLocalPathChange],
  );

  const handleAddRow = useCallback(() => {
    setMappings((prev) => {
      const next = [...prev, emptyRow()];
      void persistMappings(next);
      return next;
    });
  }, [persistMappings]);

  const handleRemoveRow = useCallback(
    (id: string) => {
      setMappings((prev) => {
        const next = prev.filter((row) => row.id !== id);
        void persistMappings(next);
        return next;
      });
    },
    [persistMappings],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex flex-col gap-2">
        <p className="max-w-2xl text-sm leading-6 text-text-secondary">
          Map server-side paths to local paths. Use this when your server and local storage are on different drives or network locations.
        </p>
        <Button variant="secondary" size="sm" onClick={handleAddRow}><Icon name="plus" iconSize="sm" /><span>Add path mapping</span></Button>
      </div>

      {/* Save indicator */}
      {(isSaving || saveError) && (
        <p className={saveError ? 'text-sm text-error' : 'text-xs text-text-muted'}>
          {saveError ?? 'Saving…'}
        </p>
      )}

      {/* Load error */}
      {loadError && (
        <p className="text-sm text-error">{loadError}</p>
      )}

      {/* Empty state */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-4">
          <Spinner variant="ring" size="md" />
          <span className="text-sm text-text-secondary">Loading path mappings…</span>
        </div>
      ) : mappings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-sm border border-border bg-surface p-4">
          <p className="text-sm text-text-secondary">No path mappings configured.</p>
          <p className="text-xs text-text-muted">Click &quot;Add path mapping&quot; to create your first mapping.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
            <p className="text-xs font-medium text-text-muted">Server path</p>
            <p className="text-xs font-medium text-text-muted">Local path</p>
            <div className="w-8" />
          </div>

          {/* Mapping rows */}
          {mappings.map((row) => (
            <MappingRowUI
              key={row.id}
              row={row}
              onServerPathChange={handleServerPathChange}
              onLocalPathChange={handleLocalPathChange}
              onPickLocalPath={handlePickLocalPath}
              onRemove={handleRemoveRow}
            />
          ))}
        </div>
      )}
    </div>
  );
});

PathMappingsSettings.displayName = 'PathMappingsSettings';

interface MappingRowUIProps {
  row: MappingRow;
  onServerPathChange: (id: string, value: string) => void;
  onLocalPathChange: (id: string, value: string) => void;
  onPickLocalPath: (id: string) => void;
  onRemove: (id: string) => void;
}

const MappingRowUI = React.memo(function MappingRowUI({
  row,
  onServerPathChange,
  onLocalPathChange,
  onPickLocalPath,
  onRemove,
}: MappingRowUIProps) {
  const handleServerChange = (value: string) => {
    onServerPathChange(row.id, value);
  };

  const handleLocalChange = (value: string) => {
    onLocalPathChange(row.id, value);
  };

  const handlePickClick = () => {
    void onPickLocalPath(row.id);
  };

  const handleRemoveClick = () => {
    onRemove(row.id);
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
      {/* Server path input */}
      <Input
          type="text"
          value={row.serverPath}
          onChange={handleServerChange}
          placeholder="/data/torrents"
          size="sm"
        />

      {/* Local path input + folder picker */}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={row.localPath}
          onChange={handleLocalChange}
          placeholder="/mnt/torrents"
          className="flex-1"
          size="sm"
        />
        <button
          type="button"
          onClick={handlePickClick}
          title="Pick local folder"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-surface hover:bg-surface-interactive transition-colors"
        >
          <FolderOpen className="size-4 text-text-secondary" />
        </button>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={handleRemoveClick}
        title="Remove mapping"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-surface hover:bg-surface-interactive hover:border-error hover:text-error transition-colors"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
});
