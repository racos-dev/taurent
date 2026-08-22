import React from 'react';
import { localizeTorrentDetailedState, RatioIcon, ICON_SIZES } from '@taurent/shared';
import { useLocalizedFormatters, useTaurentTranslation } from '@taurent/shared/i18n';
import { Clock, Download, Upload, Users, Link, HardDrive, Layers, Shield } from '@taurent/shared';
import type { TorrentDetailsOverviewSectionProps } from './types';
import type { Torrent, TorrentProperties } from '@taurent/shared/types/qbittorrent';
import { StateCard } from '../../shared/StateCard';
import { RetryButton } from '../../shared/RetryButton';

// Desktop overview section — flat key-value layout matching qBittorrent's General tab
function DesktopOverview({ torrent, properties }: { torrent: Torrent; properties: TorrentProperties | null }) {
  const { t } = useTaurentTranslation('torrents');
  const { t: tCommon } = useTaurentTranslation('common');
  const format = useLocalizedFormatters();
  const wasted = properties?.total_wasted ?? 0;
  const reannounce = properties?.reannounce ?? 0;
  const lastSeen = properties?.last_seen ?? 0;
  const infohashV1 = torrent.infohash_v1 || '';
  const infohashV2 = torrent.infohash_v2 || '';
  const createdOn = properties?.creation_date ?? 0;
  const totalSize = properties?.total_size ?? torrent.total_size ?? torrent.size ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
      {/* Transfer column */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary border-b border-border pb-1 mb-1">{t('details.overview.transfer')}</h3>
        <KVRow label={t('details.overview.timeActive')} value={format.formatDuration(properties?.time_elapsed ?? 0)} />
        <KVRow label={t('fields.eta')} value={format.formatEta(torrent.eta)} />
        <KVRow label={t('details.overview.connections')} value={format.formatCount(properties?.nb_connections)} />
        <KVRow label={t('fields.downloaded')} value={t('details.overview.downloadedWithSession', {
          total: format.formatBytes(torrent.downloaded), session: format.formatBytes(properties?.total_downloaded ?? torrent.downloaded),
        })} />
        <KVRow label={t('fields.uploaded')} value={t('details.overview.uploadedWithSession', {
          total: format.formatBytes(torrent.uploaded), session: format.formatBytes(properties?.total_uploaded ?? torrent.uploaded),
        })} />
        <KVRow label={t('fields.seeds')} value={t('details.overview.countWithTotal', {
          current: format.formatCount(properties?.seeds ?? torrent.num_seeds), total: format.formatCount(properties?.seeds_total ?? torrent.num_complete),
        })} />
        <KVRow label={t('fields.peers')} value={t('details.overview.countWithTotal', {
          current: format.formatCount(properties?.peers ?? torrent.num_leechs), total: format.formatCount(properties?.peers_total ?? torrent.num_incomplete),
        })} />
        <KVRow label={t('fields.downloadSpeed')} value={format.formatSpeed(torrent.dlspeed)} />
        <KVRow label={t('fields.uploadSpeed')} value={format.formatSpeed(torrent.upspeed)} />
        <KVRow label={t('details.overview.wasted')} value={format.formatBytes(wasted)} />
        <KVRow label={t('details.overview.shareRatio')} value={format.formatRatio(torrent.ratio)} />
        <KVRow label={t('details.overview.popularity')} value={format.formatNumber(torrent.popularity ?? 0, { maximumFractionDigits: 3 })} />
        <KVRow label={t('details.overview.reannounceIn')} value={format.formatDuration(reannounce)} />
        <KVRow label={t('details.overview.lastSeenComplete')} value={lastSeen > 0 ? format.formatDateTime(lastSeen) : tCommon('values.never')} />
        <KVRow label={t('details.overview.downloadLimit')} value={torrent.dl_limit > 0 ? format.formatSpeed(torrent.dl_limit) : '∞'} />
        <KVRow label={t('details.overview.uploadLimit')} value={torrent.up_limit > 0 ? format.formatSpeed(torrent.up_limit) : '∞'} />
      </div>
      {/* Information column */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary border-b border-border pb-1 mb-1">{t('details.overview.information')}</h3>
        <KVRow label={t('details.overview.totalSize')} value={format.formatBytes(totalSize)} />
        <KVRow label={t('fields.progress')} value={format.formatPercent(torrent.progress)} />
        <KVRow label={t('fields.state')} value={localizeTorrentDetailedState(torrent.state, t)} />
        <KVRow label={t('fields.savePath')} value={properties?.save_path ?? torrent.save_path ?? ''} />
        <KVRow label={t('fields.category')} value={torrent.category || tCommon('values.none')} />
        <KVRow label={t('fields.tags')} value={torrent.tags || tCommon('values.none')} />
        <KVRow label={t('details.overview.addedOn')} value={format.formatDateTime(torrent.added_on)} />
        <KVRow label={t('details.overview.completedOn')} value={format.formatDateTime(torrent.completion_on)} />
        <KVRow label={t('details.overview.createdOn')} value={format.formatDateTime(createdOn)} />
        <KVRow label={t('details.overview.createdBy')} value={properties?.created_by || tCommon('values.unknown')} />
        <KVRow label={t('details.overview.pieceSize')} value={properties?.piece_size ? format.formatBytes(properties.piece_size) : '—'} />
        <KVRow label={t('details.overview.pieces')} value={properties ? `${format.formatCount(properties.pieces_have)} / ${format.formatCount(properties.pieces_num)}` : '-'} />
        <KVRow label={t('details.overview.infoHashV1')} value={infohashV1 || tCommon('values.notAvailable')} />
        <KVRow label={t('details.overview.infoHashV2')} value={infohashV2 || tCommon('values.notAvailable')} />
        <KVRow label={t('details.overview.comment')} value={properties?.comment || tCommon('values.none')} />
        <KVRow label={t('details.overview.private')} value={format.formatBoolean(Boolean(properties?.isPrivate))} />
      </div>
    </div>
  );
}

// Flat key-value row used in desktop General tab
function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex py-1">
      <span className="w-32 shrink-0 text-text-secondary">{label}:</span>
      <span className="min-w-0 text-text-primary break-all">{value}</span>
    </div>
  );
}
function MobileOverview({ torrent, properties }: { torrent: Torrent; properties: TorrentProperties | null }) {
  const { t } = useTaurentTranslation('torrents');
  const { t: tCommon } = useTaurentTranslation('common');
  const format = useLocalizedFormatters();
  return (
    <div className="space-y-4">
      <SectionCard title={t('details.overview.transfer')} icon="download">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="download" label={t('fields.downloaded')} value={format.formatBytes(properties?.total_downloaded ?? torrent.downloaded)} />
          <StatTile icon="upload" label={t('fields.uploaded')} value={format.formatBytes(properties?.total_uploaded ?? torrent.uploaded)} />
          <StatTile icon="clock" label={t('fields.eta')} value={format.formatEta(properties?.eta ?? torrent.eta)} />
          <StatTile icon="ratio" label={t('fields.ratio')} value={format.formatRatio(properties?.share_ratio ?? torrent.ratio)} />
          <StatTile icon="download" label={t('details.overview.dlSpeed')} value={format.formatSpeed(properties?.dl_speed ?? torrent.dlspeed)} />
          <StatTile icon="upload" label={t('details.overview.ulSpeed')} value={format.formatSpeed(properties?.up_speed ?? torrent.upspeed)} />
        </div>
      </SectionCard>

      <SectionCard title={t('details.overview.peersAvailability')} icon="users">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="seeds" label={t('fields.seeds')} value={`${format.formatCount(properties?.seeds ?? torrent.num_seeds)} / ${format.formatCount(properties?.seeds_total ?? torrent.num_complete)}`} />
          <StatTile icon="users" label={t('fields.peers')} value={`${format.formatCount(properties?.peers ?? torrent.num_leechs)} / ${format.formatCount(properties?.peers_total ?? torrent.num_incomplete)}`} />
          <StatTile icon="link" label={t('details.overview.connections')} value={format.formatCount(properties?.nb_connections)} />
          <StatTile icon="clock" label={t('details.overview.activeTime')} value={format.formatDuration(properties?.time_elapsed ?? 0)} />
        </div>
        <DetailRow label={t('fields.availability')} value={`${format.formatNumber(torrent.availability, { maximumFractionDigits: 2 })}×`} />
      </SectionCard>

      <SectionCard title={t('details.overview.storage')} icon="hard-drive">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="hard-drive" label={t('fields.size')} value={format.formatBytes(properties?.total_size ?? torrent.total_size ?? torrent.size)} />
          <StatTile icon="download" label={t('fields.remaining')} value={format.formatBytes(torrent.amount_left)} />
          <StatTile icon="layers" label={t('details.overview.pieces')} value={`${format.formatCount(properties?.pieces_have)} / ${format.formatCount(properties?.pieces_num)}`} />
          <StatTile icon="hard-drive" label={t('details.overview.pieceSize')} value={properties?.piece_size ? format.formatBytes(properties.piece_size) : '-'} />
        </div>
        <DetailRow label={t('fields.savePath')} value={properties?.save_path ?? ''} />
        <DetailRow label={t('details.overview.contentPath')} value={torrent.content_path || torrent.save_path} />
      </SectionCard>

      <SectionCard title={t('details.overview.metadata')} icon="shield">
        <DetailRow label={t('details.overview.privateTorrent')} value={format.formatBoolean(Boolean(properties?.isPrivate))} />
        <DetailRow label={t('details.overview.added')} value={format.formatDateTime(torrent.added_on || properties?.addition_date || 0)} />
        <DetailRow label={t('fields.completed')} value={format.formatDateTime(torrent.completion_on || properties?.completion_date || 0)} />
        <DetailRow label={t('details.overview.createdByShort')} value={properties?.created_by || tCommon('values.unknown')} />
        {properties?.comment ? <DetailRow label={t('details.overview.comment')} value={properties.comment} /> : null}
      </SectionCard>
    </div>
  );
}

// Mobile helper components
function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const iconMap: Record<string, React.ReactNode> = {
    download: <Download size={ICON_SIZES.md} />,
    upload: <Upload size={ICON_SIZES.md} />,
    clock: <Clock size={ICON_SIZES.md} />,
    ratio: <RatioIcon size={ICON_SIZES.md} />,
    seeds: <Users size={ICON_SIZES.md} />,
    users: <Users size={ICON_SIZES.md} />,
    link: <Link size={ICON_SIZES.md} />,
    'hard-drive': <HardDrive size={ICON_SIZES.md} />,
    layers: <Layers size={ICON_SIZES.md} />,
    shield: <Shield size={ICON_SIZES.md} />,
  };

  return (
    <section className="rounded-sm border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-text-primary">
        <div
          className="flex items-center justify-center text-primary"
          style={{ width: ICON_SIZES.lg, height: ICON_SIZES.lg }}
        >
          {iconMap[icon] || <Download size={ICON_SIZES.md} />}
        </div>
        <h2 className="text-xs font-medium">{title}</h2>
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    download: <Download size={ICON_SIZES.md} />,
    upload: <Upload size={ICON_SIZES.md} />,
    clock: <Clock size={ICON_SIZES.md} />,
    ratio: <RatioIcon size={ICON_SIZES.md} />,
    seeds: <Users size={ICON_SIZES.md} />,
    users: <Users size={ICON_SIZES.md} />,
    link: <Link size={ICON_SIZES.md} />,
    'hard-drive': <HardDrive size={ICON_SIZES.md} />,
    layers: <Layers size={ICON_SIZES.md} />,
  };

  return (
    <div className="rounded-sm bg-surface px-3 py-2">
      <div className="flex items-center gap-2 text-text-secondary">
        {iconMap[icon] || <Download size={ICON_SIZES.md} />}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-1 text-xs font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-sm bg-surface px-3 py-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="max-w-[65%] text-right text-sm font-medium text-text-primary break-words">{value}</span>
    </div>
  );
}

export const TorrentDetailsOverviewSection = React.memo<TorrentDetailsOverviewSectionProps>(
  ({ variant = 'desktop', torrent, properties, isLoading, error, onRetry }) => {
    const { t } = useTaurentTranslation('torrents');
    if (variant === 'mobile') {
      if (isLoading && !properties) {
        return (
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-sm border border-border bg-surface p-3">
                <div className="h-4 w-24 rounded-sm bg-surface" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((tile) => (
                    <div key={tile} className="h-16 rounded-sm bg-surface" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      }

      if (error) {
        return (
          <StateCard
            title={t('details.overview.loadError')}
            action={onRetry ? <RetryButton onClick={onRetry as () => void} /> : undefined}
          />
        );
      }

      return <MobileOverview torrent={torrent} properties={properties} />;
    }

    // Desktop
    if (error) {
      return (
        <StateCard
          title={t('details.overview.propertiesError')}
          action={onRetry ? <RetryButton onClick={onRetry as () => void} /> : undefined}
        />
      );
    }

    return <DesktopOverview torrent={torrent} properties={properties} />;
  }
);

TorrentDetailsOverviewSection.displayName = 'TorrentDetailsOverviewSection';
