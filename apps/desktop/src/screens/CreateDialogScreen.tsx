import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { DialogActions, Input } from '@taurent/web-ui';
import { isConflictError, formatUserMessageForContext } from '@taurent/shared/utils/error';
import { useQBClient } from '../connection/QBClientProvider';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';

export function CreateDialogScreen() {
  const [searchParams] = useSearchParams();
  const type = (searchParams.get('type') ?? 'category') as 'category' | 'tag';
  const hashesParam = searchParams.get('hashes') ?? '';
  const hashes = hashesParam ? hashesParam.split(',').filter(Boolean) : [];
  const { serverId, sessionGeneration } = useQBClient();

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch existing names once on mount and when type changes
  useEffect(() => {
    setIsLoadingExisting(true);
    setExistingNames([]);
    setError(null);

    void (async () => {
      try {
        if (type === 'category') {
          const categoriesResponse = await BridgeAdapter.categories.getCategories();
          const categories = categoriesResponse.categories as Record<string, { name: string }>;
          setExistingNames(Object.values(categories).map((c) => c.name));
        } else {
          const tagsResponse = await BridgeAdapter.tags.getTags();
          setExistingNames(tagsResponse.tags.map((t) => t));
        }
      } catch {
        // Non-critical: backend 409 will catch races
        setExistingNames([]);
      } finally {
        setIsLoadingExisting(false);
      }
    })();
  }, [type]);

  // Sync and reset when type changes (mirrors rename dialog pattern)
  useEffect(() => {
    setName('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [type]);

  // Check for duplicate whenever name or known existing names change
  useEffect(() => {
    const trimmedName = name.trim();
    if (
      trimmedName.length > 0 &&
      !isLoadingExisting &&
      existingNames.some((n) => n === trimmedName)
    ) {
      setError(
        type === 'category'
          ? 'A category with this name already exists'
          : 'A tag with this name already exists',
      );
    } else if (error && !existingNames.some((n) => n === name.trim())) {
      setError(null);
    }
  }, [name, existingNames, isLoadingExisting, type, error]);

  useEffect(() => {
    const title = type === 'category' ? 'Create Category' : 'Create Tag';
    void getCurrentWindow().setTitle(title);
  }, [type]);

  const canSubmit =
    name.trim().length > 0 &&
    !isLoadingExisting &&
    !existingNames.some((n) => n === name.trim());

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const trimmedName = name.trim();

      if (type === 'category') {
        await BridgeAdapter.categories.createCategory(trimmedName, '');
        if (hashes.length > 0) {
          await BridgeAdapter.torrents.setCategory(hashes, trimmedName);
        }
        await emit('resource-invalidated', {
          session_generation: sessionGeneration,
          server_id: serverId,
          resource: 'categories',
        });
        if (hashes.length > 0) {
          await emit('resource-invalidated', {
            session_generation: sessionGeneration,
            server_id: serverId,
            resource: 'torrents',
          });
        }
      } else {
        await BridgeAdapter.tags.createTags([trimmedName]);
        if (hashes.length > 0) {
          await BridgeAdapter.torrents.addTags(hashes, [trimmedName]);
        }
        await emit('resource-invalidated', {
          session_generation: sessionGeneration,
          server_id: serverId,
          resource: 'tags',
        });
        if (hashes.length > 0) {
          await emit('resource-invalidated', {
            session_generation: sessionGeneration,
            server_id: serverId,
            resource: 'torrents',
          });
        }
      }
      await dismissDialogWindow();
    } catch (err) {
      if (isConflictError(err)) {
        setError(type === 'category' ? 'A category with this name already exists' : 'A tag with this name already exists');
      } else {
        setError(formatUserMessageForContext(err, 'torrent-action'));
      }
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  const label = type === 'category' ? 'Category name' : 'Tag name';
  const submitLabel = isSubmitting
    ? 'Creating...'
    : hashes.length > 0
      ? type === 'category'
        ? 'Create & Assign'
        : 'Create & Add'
      : 'Create';

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5 pb-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <label className="text-xs font-medium text-text-secondary">{label}</label>
        <Input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(value) => {
            setName(value);
            setError(null);
          }}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) void handleSubmit();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        {error && (
          <p className="max-h-16 overflow-y-auto break-words whitespace-pre-wrap text-xs text-error">
            {error}
          </p>
        )}
      </div>

      <DialogActions
        actions={[
          { label: 'Cancel', onClick: handleCancel, disabled: isSubmitting },
          {
            label: submitLabel,
            onClick: () => void handleSubmit(),
            variant: 'primary',
            disabled: isSubmitting || !canSubmit,
          },
        ]}
        stretch={false}
        className="mt-auto shrink-0 justify-end gap-3 pt-4"
      />
    </div>
  );
}
