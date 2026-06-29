import { useQBClient, useMaindataSelector } from '../../connection';
import { useUIStore } from '@taurent/shared/stores';
import { useTorrentWorkspaceSummaryController, useToggleSpeedLimitsMode } from '../../hooks';
import { formatSpeed, formatBytes, cn, TorrentConnectionStatus } from '@taurent/shared';
import { openTransferLimitDialogWindow } from '../../windows/dialogs/transferLimitDialogWindow';
import { Gauge } from '@taurent/shared';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';

export function StatusBar() {
  const { isConnecting, isConnected } = useQBClient();
  const ss = useMaindataSelector((s) => s.server_state);
  const { filteredCount, totalCount, isFiltered } = useTorrentWorkspaceSummaryController();
  const { toggleSpeedLimitsMode, isPending: isToggling } = useToggleSpeedLimitsMode();
  const statusMessage = useUIStore((state) => state.statusMessage);

  const connectionStatus = ss?.connection_status;
  const dotColor = isConnecting
    ? 'bg-warning'
    : connectionStatus === TorrentConnectionStatus.Connected
      ? 'bg-success'
      : connectionStatus === TorrentConnectionStatus.Firewalled
        ? 'bg-warning'
        : isConnected
          ? 'bg-success'
          : 'bg-text-muted';

  const dlSpeed = ss?.dl_info_speed ?? 0;
  const ulSpeed = ss?.up_info_speed ?? 0;
  const dlData = ss?.dl_info_data ?? 0;
  const ulData = ss?.up_info_data ?? 0;
  const dlLimit = ss?.dl_rate_limit ?? 0;
  const ulLimit = ss?.up_rate_limit ?? 0;
  const useAltSpeeds = ss?.use_alt_speed_limits ?? false;
  const freeSpace = ss?.free_space_on_disk;

  return (
    <div className="bg-surface border-t border-border px-3 py-0 flex flex-nowrap items-center gap-2 overflow-hidden text-xs text-text-secondary h-6 select-none">
      <div className="flex min-w-0 flex-[1_1_0%] items-center gap-2 overflow-hidden">
        {/* Connection status dot + torrent count */}
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', dotColor)} />
          {statusMessage ? (
            <span className="truncate text-primary">{statusMessage}</span>
          ) : isConnected ? (
            isFiltered ? (
              <span>
                <span className="text-text-primary">{filteredCount}</span>
                /{totalCount}
              </span>
            ) : (
              <span>{totalCount} torrent{totalCount !== 1 ? 's' : ''}</span>
            )
          ) : (
            <span className={isConnecting ? 'text-warning' : 'text-text-muted'}>
              {isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
          )}
        </div>
      </div>

      <span className="shrink-0 text-text-muted">|</span>
      <span className="shrink-0 whitespace-nowrap">
        {isConnected && freeSpace !== undefined ? `Free Space: ${formatBytes(freeSpace)}` : ''}
      </span>

      {/* Alt speed toggle — always present when connected, fixed width */}
      <span className="shrink-0 text-text-muted">|</span>
      <button
        type="button"
        title={useAltSpeeds ? 'Alternative speed limits: ON (click to disable)' : 'Alternative speed limits: OFF (click to enable)'}
        disabled={isToggling || !isConnected}
        onClick={() => {
          if (!isConnected) return;
          toggleSpeedLimitsMode().catch((err) => {
            toast.error(formatUserMessageForContext(err, 'speed-limits'));
          });
        }}
        className={cn(
          'flex items-center justify-center w-5 shrink-0 rounded-sm transition-colors',
          isConnected
            ? cn('cursor-pointer', useAltSpeeds ? 'text-warning hover:text-warning/80' : 'text-text-muted hover:text-text-secondary')
            : 'text-transparent pointer-events-none',
        )}
      >
        <Gauge className="h-3 w-3" />
      </button>

      <span className="shrink-0 text-text-muted">|</span>

      {/* Transfer speeds — tabular-nums + fixed widths to prevent reflow */}
      <div className="flex shrink-0 flex-nowrap items-center gap-3 tabular-nums whitespace-nowrap">
        <button
          type="button"
          disabled={!isConnected}
          onClick={() => {
            if (!isConnected) return;
            void openTransferLimitDialogWindow({
              direction: 'download',
              value: ss?.dl_rate_limit ?? 0,
              isAltSpeed: useAltSpeeds,
            });
          }}
          className={cn(
            'shrink-0 text-right whitespace-nowrap cursor-pointer disabled:cursor-default',
            dlSpeed > 0 ? 'text-download' : 'text-text-muted',
          )}
        >
          ↓ {formatSpeed(dlSpeed)}
          {dlLimit > 0 && <span className="text-text-muted"> [{formatSpeed(dlLimit)}]</span>}
          <span className="text-text-muted"> ({formatBytes(dlData)})</span>
        </button>
        <span className="shrink-0 text-text-muted">|</span>
        <button
          type="button"
          disabled={!isConnected}
          onClick={() => {
            if (!isConnected) return;
            void openTransferLimitDialogWindow({
              direction: 'upload',
              value: ss?.up_rate_limit ?? 0,
              isAltSpeed: useAltSpeeds,
            });
          }}
          className={cn(
            'shrink-0 text-right whitespace-nowrap cursor-pointer disabled:cursor-default',
            ulSpeed > 0 ? 'text-upload' : 'text-text-muted',
          )}
        >
          ↑ {formatSpeed(ulSpeed)}
          {ulLimit > 0 && <span className="text-text-muted"> [{formatSpeed(ulLimit)}]</span>}
          <span className="text-text-muted"> ({formatBytes(ulData)})</span>
        </button>
      </div>

    </div>
  );
}
