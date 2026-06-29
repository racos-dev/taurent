import React, { useState } from 'react';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import { NumberInput } from '../../primitives/NumberInput';
import { SettingsRow } from '../SettingsRow';
import { Button } from '../../primitives/Button';
import { NumberInputModal } from '../../dialogs/NumberInputModal';
import type { QueueSettingsPanelProps } from './types';
import { cn } from '@taurent/shared';

type QueuePreferenceValue = boolean | number;
type MobileQueueNumberKey =
  | 'max_active_downloads'
  | 'max_active_uploads'
  | 'max_active_torrents';

interface MobileQueueModalState {
  key: MobileQueueNumberKey;
  title: string;
  currentValue: number;
}

export const QueueSettingsPanel = React.memo<QueueSettingsPanelProps>(({
  variant = 'mobile',
  preferences,
  onPreferenceChange,
  onSave,
  isSaving,
}) => {
  const queueingEnabled = (preferences?.queueing_enabled as boolean) ?? false;
  const maxActiveDownloads = (preferences?.max_active_downloads as number) ?? 0;
  const maxActiveUploads = (preferences?.max_active_uploads as number) ?? 0;
  const maxActiveTorrents = (preferences?.max_active_torrents as number) ?? 0;
  const dontCountSlowTorrents = (preferences?.dont_count_slow_torrents as boolean) ?? false;

  const [stagedQueueingEnabled, setStagedQueueingEnabled] = useState(queueingEnabled);
  const [stagedMaxActiveDownloads, setStagedMaxActiveDownloads] = useState(maxActiveDownloads);
  const [stagedMaxActiveUploads, setStagedMaxActiveUploads] = useState(maxActiveUploads);
  const [stagedMaxActiveTorrents, setStagedMaxActiveTorrents] = useState(maxActiveTorrents);
  const [stagedDontCountSlowTorrents, setStagedDontCountSlowTorrents] = useState(dontCountSlowTorrents);
  const [mobileModal, setMobileModal] = useState<MobileQueueModalState | null>(null);
  const applyPreferenceChange = onPreferenceChange as
    | ((key: string, value: QueuePreferenceValue) => void)
    | undefined;

  // Sync local state when preferences change from outside (e.g., server switch)
  React.useEffect(() => {
    setStagedQueueingEnabled(queueingEnabled);
    setStagedMaxActiveDownloads(maxActiveDownloads);
    setStagedMaxActiveUploads(maxActiveUploads);
    setStagedMaxActiveTorrents(maxActiveTorrents);
    setStagedDontCountSlowTorrents(dontCountSlowTorrents);
  }, [queueingEnabled, maxActiveDownloads, maxActiveUploads, maxActiveTorrents, dontCountSlowTorrents]);

  const handleSave = () => {
    if (onSave) {
      onSave({
        queueing_enabled: stagedQueueingEnabled,
        max_active_downloads: stagedMaxActiveDownloads,
        max_active_uploads: stagedMaxActiveUploads,
        max_active_torrents: stagedMaxActiveTorrents,
        dont_count_slow_torrents: stagedDontCountSlowTorrents,
      });
    }
  };

  if (variant === 'desktop') {
    return (
      <div className="space-y-2">
        <ToggleSwitch checked={stagedQueueingEnabled} onChange={setStagedQueueingEnabled} />

        {stagedQueueingEnabled && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Max active downloads
                </label>
                <NumberInput
                  value={stagedMaxActiveDownloads}
                  onChange={(event) => setStagedMaxActiveDownloads(Number.parseInt(event.target.value, 10) || 0)}
                  min={0}
                  className={cn(
                    'w-full rounded-sm border border-border bg-background px-3 py-2 text-text-primary',
                    'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Max active uploads
                </label>
                <NumberInput
                  value={stagedMaxActiveUploads}
                  onChange={(event) => setStagedMaxActiveUploads(Number.parseInt(event.target.value, 10) || 0)}
                  min={0}
                  className={cn(
                    'w-full rounded-sm border border-border bg-background px-3 py-2 text-text-primary',
                    'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Max active torrents
                </label>
                <NumberInput
                  value={stagedMaxActiveTorrents}
                  onChange={(event) => setStagedMaxActiveTorrents(Number.parseInt(event.target.value, 10) || 0)}
                  min={0}
                  className={cn(
                    'w-full rounded-sm border border-border bg-background px-3 py-2 text-text-primary',
                    'focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none'
                  )}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-text-primary">Ignore slow torrents</div>
                <div className="mt-1 text-xs text-text-secondary">
                  Do not count slow torrents in queue limits.
                </div>
              </div>
              <ToggleSwitch checked={stagedDontCountSlowTorrents} onChange={setStagedDontCountSlowTorrents} />
            </div>
          </>
        )}

        <Button variant="primary" size="sm" className="w-full" loading={isSaving} onClick={handleSave}>{isSaving ? 'Saving Queue Settings...' : 'Save Queue Settings'}</Button>
      </div>
    );
  }

  // Mobile variant - immediate edits with NumberInputModal callbacks
  return (
    <>
      <SettingsRow
        title="Enable queueing"
        description="Limit how many torrents stay active at once"
        right={
          <ToggleSwitch
            checked={queueingEnabled}
            onChange={(value) => applyPreferenceChange?.('queueing_enabled', value)}
          />
        }
      />

      {queueingEnabled && (
        <>
          <SettingsRow
            title="Max active downloads"
            value={maxActiveDownloads}
            onPress={() => setMobileModal({
              key: 'max_active_downloads',
              title: 'Max active downloads',
              currentValue: maxActiveDownloads,
            })}
          />
          <SettingsRow
            title="Max active uploads"
            value={maxActiveUploads}
            onPress={() => setMobileModal({
              key: 'max_active_uploads',
              title: 'Max active uploads',
              currentValue: maxActiveUploads,
            })}
          />
          <SettingsRow
            title="Max active torrents"
            value={maxActiveTorrents}
            onPress={() => setMobileModal({
              key: 'max_active_torrents',
              title: 'Max active torrents',
              currentValue: maxActiveTorrents,
            })}
          />
          <SettingsRow
            title="Ignore slow torrents"
            description="Do not count slow torrents toward the active limits"
            right={
              <ToggleSwitch
                checked={dontCountSlowTorrents}
                onChange={(value) => applyPreferenceChange?.('dont_count_slow_torrents', value)}
              />
            }
          />
        </>
      )}

      {mobileModal ? (
        <NumberInputModal
          title={mobileModal.title}
          currentValue={mobileModal.currentValue}
          onSubmit={(value) => {
            applyPreferenceChange?.(mobileModal.key, value);
            setMobileModal(null);
          }}
          onCancel={() => setMobileModal(null)}
        />
      ) : null}
    </>
  );
});

QueueSettingsPanel.displayName = 'QueueSettingsPanel';
