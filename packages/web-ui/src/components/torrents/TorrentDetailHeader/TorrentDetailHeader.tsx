import React from 'react';
import { formatBytes, formatCountFraction, formatSpeed, formatEta, formatProgress, formatRatio } from '@taurent/shared/utils/formatters';
import {
  Icon,
  StatusBadge,
} from '@taurent/shared';
import { getTorrentDisplayStatus, toStatusBadgeStatus } from '@taurent/shared/utils/torrentStatus';
import { Pill } from '../../primitives/Pill';
import type { TorrentDetailHeaderProps } from './types';

export const TorrentDetailHeader = React.memo<TorrentDetailHeaderProps>(({
  torrent,
  properties,
  progressBarClass,
  renderBadges,
}) => {
  const progress = (torrent.progress || 0) * 100;
  const displayStatus = getTorrentDisplayStatus(torrent);

  return (
    <section className="rounded-sm border border-border bg-surface p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-sm font-semibold leading-tight text-text-primary">
            {torrent.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={toStatusBadgeStatus(displayStatus)} />
            {renderBadges ? renderBadges(torrent) : null}
          </div>
        </div>
        <Pill>{formatProgress(torrent.progress)}</Pill>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-interactive">
        <div
          className={`h-full rounded-full transition-all ${progressBarClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>
          {formatBytes(torrent.completed ?? properties?.total_downloaded ?? 0)} / {formatBytes(torrent.size ?? properties?.total_size ?? 0)}
        </span>
        <span>ETA {formatEta(torrent.eta)}</span>
      </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-sm bg-surface-interactive px-2 py-1">
          <div className="flex items-center gap-1 text-text-secondary">
            <Icon name="download" className="h-3 w-3" />
            <span className="text-xs font-medium">DL</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-text-primary">
            {formatSpeed(torrent.dlspeed ?? properties?.dl_speed ?? 0)}
          </div>
        </div>
        <div className="rounded-sm bg-surface-interactive px-2 py-1">
          <div className="flex items-center gap-1 text-text-secondary">
            <Icon name="upload" className="h-3 w-3" />
            <span className="text-xs font-medium">UL</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-text-primary">
            {formatSpeed(torrent.upspeed ?? properties?.up_speed ?? 0)}
          </div>
        </div>
        <div className="rounded-sm bg-surface-interactive px-2 py-1">
          <div className="flex items-center gap-1 text-text-secondary">
            <Icon name="ratio" className="h-3 w-3" />
            <span className="text-xs font-medium">Ratio</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-text-primary">
            {formatRatio(torrent.ratio ?? properties?.share_ratio)}
          </div>
        </div>
        <div className="rounded-sm bg-surface-interactive px-2 py-1">
          <div className="flex items-center gap-1 text-text-secondary">
            <Icon name="users" className="h-3 w-3" />
            <span className="text-xs font-medium">Peers</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-text-primary">
            {formatCountFraction(torrent.num_leechs, torrent.num_seeds)}
          </div>
        </div>
      </div>
    </section>
  );
});

TorrentDetailHeader.displayName = 'TorrentDetailHeader';
