import React from 'react';
import { useLocalizedFormatters, useTaurentTranslation } from '@taurent/shared/i18n';
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
  const { t } = useTaurentTranslation('torrents');
  const format = useLocalizedFormatters();
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
        <Pill>{format.formatPercent(torrent.progress)}</Pill>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-interactive">
        <div
          className={`h-full rounded-full transition-all ${progressBarClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>
          {format.formatBytes(torrent.completed ?? properties?.total_downloaded ?? 0)} / {format.formatBytes(torrent.size ?? properties?.total_size ?? 0)}
        </span>
        <span>{t('fields.eta')} {format.formatEta(torrent.eta)}</span>
      </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-sm bg-surface-interactive px-2 py-1">
          <div className="flex items-center gap-1 text-text-secondary">
            <Icon name="download" className="h-3 w-3" />
            <span className="text-xs font-medium">{t('details.overview.dlSpeed')}</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-text-primary">
            {format.formatSpeed(torrent.dlspeed ?? properties?.dl_speed ?? 0)}
          </div>
        </div>
        <div className="rounded-sm bg-surface-interactive px-2 py-1">
          <div className="flex items-center gap-1 text-text-secondary">
            <Icon name="upload" className="h-3 w-3" />
            <span className="text-xs font-medium">{t('details.overview.ulSpeed')}</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-text-primary">
            {format.formatSpeed(torrent.upspeed ?? properties?.up_speed ?? 0)}
          </div>
        </div>
        <div className="rounded-sm bg-surface-interactive px-2 py-1">
          <div className="flex items-center gap-1 text-text-secondary">
            <Icon name="ratio" className="h-3 w-3" />
            <span className="text-xs font-medium">{t('fields.ratio')}</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-text-primary">
            {format.formatRatio(torrent.ratio ?? properties?.share_ratio)}
          </div>
        </div>
        <div className="rounded-sm bg-surface-interactive px-2 py-1">
          <div className="flex items-center gap-1 text-text-secondary">
            <Icon name="users" className="h-3 w-3" />
            <span className="text-xs font-medium">{t('fields.peers')}</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-text-primary">
            {format.formatCount(torrent.num_leechs)} / {format.formatCount(torrent.num_seeds)}
          </div>
        </div>
      </div>
    </section>
  );
});

TorrentDetailHeader.displayName = 'TorrentDetailHeader';
