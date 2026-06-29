import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { Checkbox, DialogActions } from '@taurent/web-ui';
import { extractHttpReason, formatUserMessageForContext } from '@taurent/shared/utils/error';
import { parseTorrentTags } from '@taurent/shared';
import { useQBClient } from '../connection/QBClientProvider';
import { useTags } from '../hooks/platform/useTags';
import { useLiveTorrentByHash } from '../hooks/torrents/useLiveTorrentByHash';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';

export function TagSelectDialogScreen() {
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const hashesParam = searchParams.get('hashes') ?? '';
  const hashes = hashesParam ? hashesParam.split(',') : [];

  const { tags: availableTags } = useTags();

  // Single-torrent lookup for tag display
  const singleTorrent = useLiveTorrentByHash(hashes.length === 1 ? hashes[0] : null);

  // Persist error until explicitly dismissed — no auto-clear on new action
  const [error, setError] = useState<string | null>(null);
  // Track add and remove pending states independently
  const [addTagsPending, setAddTagsPending] = useState(false);
  const [removeTagsPending, setRemoveTagsPending] = useState(false);

  // Checked state for multi-select
  const [checkedTags, setCheckedTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getCurrentWindow().setTitle('Add/Remove Tags');
  }, []);

  // Toggle a tag's checked state
  function toggleTag(tag: string) {
    setCheckedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  async function handleAddTags() {
    // Only add tags that are not already assigned
    const sharedTagsSet = new Set(parseTorrentTags(singleTorrent?.tags ?? ''));
    const toAdd = Array.from(checkedTags).filter((t) => !sharedTagsSet.has(t));
    if (toAdd.length === 0) return;

    setError(null);
    setAddTagsPending(true);
    try {
      await BridgeAdapter.torrents.addTags(hashes, toAdd);
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: 'torrents',
      });
      await dismissDialogWindow();
    } catch (err) {
      console.error('Failed to add tags:', extractHttpReason(err));
      setError(formatUserMessageForContext(err, 'torrent-action'));
    } finally {
      setAddTagsPending(false);
    }
  }

  async function handleRemoveTags() {
    // Only remove tags that are currently assigned
    const sharedTagsSet = new Set(parseTorrentTags(singleTorrent?.tags ?? ''));
    const toRemove = Array.from(checkedTags).filter((t) => sharedTagsSet.has(t));
    if (toRemove.length === 0) return;

    setError(null);
    setRemoveTagsPending(true);
    try {
      await BridgeAdapter.torrents.removeTags(hashes, toRemove);
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: 'torrents',
      });
      await dismissDialogWindow();
    } catch (err) {
      console.error('Failed to remove tags:', extractHttpReason(err));
      setError(formatUserMessageForContext(err, 'torrent-action'));
    } finally {
      setRemoveTagsPending(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  // Determine which tags are already assigned to the selected torrent(s)
  const sharedTagsSet = new Set(parseTorrentTags(singleTorrent?.tags ?? ''));

  const isPending = addTagsPending || removeTagsPending;

  // Disable Add when: nothing selected, pending, or no tags to actually add
  const canAdd =
    checkedTags.size > 0 &&
    !isPending &&
    Array.from(checkedTags).some((t) => !sharedTagsSet.has(t));

  // Disable Remove when: nothing selected, pending, or no tags to actually remove
  const canRemove =
    checkedTags.size > 0 &&
    !isPending &&
    Array.from(checkedTags).some((t) => sharedTagsSet.has(t));

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-medium text-text-secondary">
          {hashes.length === 1
            ? 'Select tags to add or remove from 1 torrent'
            : `Select tags to add or remove from ${hashes.length} torrents`}
        </p>
      </div>

      {error && (
        <div className="px-3 py-2 bg-error-20 border-b border-error text-xs text-error">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {availableTags && availableTags.length > 0 ? (
          availableTags.map((tag) => {
            const isAssigned = sharedTagsSet.has(tag);
            const isChecked = checkedTags.has(tag);
            return (
              <label
                key={tag}
                className="flex items-center gap-3 px-3 py-2 text-xs text-text-primary hover:bg-surface-interactive cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={isChecked}
                  onChange={() => toggleTag(tag)}
                  disabled={isPending}
                />
                <span className={isAssigned ? 'font-semibold text-primary' : ''}>
                  {tag}
                </span>
                {isAssigned && (
                  <span className="ml-auto text-xs text-text-muted">assigned</span>
                )}
              </label>
            );
          })
        ) : (
          <div className="px-3 py-4 text-xs text-text-muted text-center">
            No tags defined
          </div>
        )}
      </div>

      <DialogActions
        actions={[
          {
            label: addTagsPending ? 'Adding...' : 'Add Tags',
            onClick: handleAddTags,
            variant: 'primary',
            disabled: !canAdd,
          },
          {
            label: removeTagsPending ? 'Removing...' : 'Remove Tags',
            onClick: handleRemoveTags,
            variant: 'outline',
            disabled: !canRemove,
            className: 'border-error/30 bg-error/5 text-error hover:border-error/30 hover:bg-error/10',
          },
          { label: 'Cancel', onClick: handleCancel, disabled: isPending },
        ]}
        className="border-t border-border px-3 py-2"
      />
    </div>
  );
}
