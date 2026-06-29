import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { DialogActions, NumberInput, Select } from '@taurent/web-ui';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { useQBClient } from '../connection/QBClientProvider';
import { dismissDialogWindow } from '../windows/dialogs/dialogHostWindow';

type RatioMode = 'global' | 'unlimited' | 'custom';
type SeedingMode = 'global' | 'unlimited' | 'custom';

function resolveRatioMode(v: number): RatioMode {
  if (v === -2) return 'global';
  if (v === -1) return 'unlimited';
  return 'custom';
}

function resolveSeedingMode(v: number): SeedingMode {
  if (v === -2) return 'global';
  if (v === -1) return 'unlimited';
  return 'custom';
}

function ratioToSentinel(mode: RatioMode, custom: number): number {
  if (mode === 'global') return -2;
  if (mode === 'unlimited') return -1;
  return custom;
}

function seedingToSentinel(mode: SeedingMode, custom: number): number {
  if (mode === 'global') return -2;
  if (mode === 'unlimited') return -1;
  return custom;
}

export function TorrentShareLimitsDialogScreen() {
  const [searchParams] = useSearchParams();
  const { serverId, sessionGeneration } = useQBClient();

  const initialRatio = Number(searchParams.get('ratio') ?? '-2');
  const initialSeedingTime = Number(searchParams.get('seedingTime') ?? '-2');
  const hashesParam = searchParams.get('hashes') ?? '';
  const hashes = hashesParam ? hashesParam.split(',') : [];

  const [ratioMode, setRatioMode] = useState<RatioMode>(() => resolveRatioMode(initialRatio));
  const [ratioCustom, setRatioCustom] = useState(initialRatio >= 0 ? initialRatio : 0);

  const [seedingMode, setSeedingMode] = useState<SeedingMode>(() => resolveSeedingMode(initialSeedingTime));
  const [seedingCustom, setSeedingCustom] = useState(initialSeedingTime >= 0 ? initialSeedingTime : 0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync all form state when the torrent selection changes (e.g. dialog reused for different torrents)
  useEffect(() => {
    setRatioMode(resolveRatioMode(initialRatio));
    setRatioCustom(initialRatio >= 0 ? initialRatio : 0);
    setSeedingMode(resolveSeedingMode(initialSeedingTime));
    setSeedingCustom(initialSeedingTime >= 0 ? initialSeedingTime : 0);
    setError(null);
  }, [hashesParam, initialRatio, initialSeedingTime]);

  useEffect(() => {
    void getCurrentWindow().setTitle('Limit Share Ratio');
  }, []);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const ratioLimit = ratioToSentinel(ratioMode, ratioCustom);
      const seedingLimit = seedingToSentinel(seedingMode, seedingCustom);
      await BridgeAdapter.torrents.setShareLimits(hashes, ratioLimit, seedingLimit);
      await emit('resource-invalidated', {
        session_generation: sessionGeneration,
        server_id: serverId,
        resource: 'torrents',
      });
      await dismissDialogWindow();
    } catch (err) {
      setError(formatUserMessageForContext(err, 'torrent-action'));
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    void dismissDialogWindow();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* scrollable body */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Limit Share Ratio</label>
          <p className="text-xs text-text-secondary">Set per-torrent ratio and seeding time limits.</p>
        </div>

        <div className="flex flex-col gap-4 rounded-md border border-border-subtle p-4">
          <div className="flex flex-col gap-2">
            <Select
              dataTestid="ratio-limit-select"
              label="Ratio Limit"
              value={ratioMode}
              onChange={(value) => setRatioMode(value as RatioMode)}
              options={[
                { value: 'global', label: 'Global setting' },
                { value: 'unlimited', label: 'Unlimited' },
                { value: 'custom', label: 'Custom ratio' },
              ]}
            />
            {ratioMode === 'custom' && (
              <NumberInput
                min={0}
                step={0.1}
                value={ratioCustom}
                onChange={(e) => setRatioCustom(Number.parseFloat(e.target.value) || 0)}
                className="w-full"
                placeholder="e.g. 2.0"
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Select
              dataTestid="seeding-time-limit-select"
              label="Seeding Time Limit"
              value={seedingMode}
              onChange={(value) => setSeedingMode(value as SeedingMode)}
              options={[
                { value: 'global', label: 'Global setting' },
                { value: 'unlimited', label: 'Unlimited' },
                { value: 'custom', label: 'Custom (minutes)' },
              ]}
            />
            {seedingMode === 'custom' && (
              <NumberInput
                min={0}
                value={seedingCustom}
                onChange={(e) => setSeedingCustom(Number.parseInt(e.target.value, 10) || 0)}
                className="w-full"
                placeholder="e.g. 1440 (24h)"
              />
            )}
          </div>
        </div>

        {error && (
          <p className="max-h-16 overflow-y-auto break-words whitespace-pre-wrap text-xs text-error">
            {error}
          </p>
        )}
      </div>

      {/* pinned footer */}
      <div className="shrink-0 px-5 pb-4 pt-4">
        <DialogActions
          actions={[
            { label: 'Cancel', onClick: handleCancel, disabled: isSubmitting },
            {
              label: isSubmitting ? 'Saving...' : 'Set',
              onClick: () => void handleSubmit(),
              variant: 'primary',
              disabled: isSubmitting,
            },
          ]}
          stretch={false}
          className="justify-end gap-3"
        />
      </div>
    </div>
  );
}
