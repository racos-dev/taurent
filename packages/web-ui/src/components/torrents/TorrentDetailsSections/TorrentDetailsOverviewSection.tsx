import React from 'react';
import {
  formatAvailabilityMultiplier,
  formatBytes,
  formatCount,
  formatCountFraction,
  formatCountWithTotal,
  formatDateTime,
  formatEta,
  formatPopularity,
  formatProgress,
  formatRatio,
  formatReannounce,
  formatSeenComplete,
  formatSpeed,
  formatTime,
  formatTransferLimit,
} from '@taurent/shared/utils/formatters';
import { getTorrentDetailedStateLabel, RatioIcon, ICON_SIZES } from '@taurent/shared';
import { Clock, Download, Upload, Users, Link, HardDrive, Layers, Shield } from '@taurent/shared';
import type { TorrentDetailsOverviewSectionProps } from './types';
import type { Torrent, TorrentProperties } from '@taurent/shared/types/qbittorrent';
import { StateCard } from '../../shared/StateCard';
import { RetryButton } from '../../shared/RetryButton';

// Desktop overview section — flat key-value layout matching qBittorrent's General tab
function DesktopOverview({ torrent, properties }: { torrent: Torrent; properties: TorrentProperties | null }) {
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
        <h3 className="text-xs font-semibold text-text-secondary border-b border-border pb-1 mb-1">Transfer</h3>
        <KVRow label="Time Active" value={formatTime(properties?.time_elapsed)} />
        <KVRow label="ETA" value={formatEta(torrent.eta)} />
        <KVRow label="Connections" value={formatCount(properties?.nb_connections)} />
        <KVRow label="Downloaded" value={`${formatBytes(torrent.downloaded)} (${formatBytes(properties?.total_downloaded ?? torrent.downloaded)} this session)`} />
        <KVRow label="Uploaded" value={`${formatBytes(torrent.uploaded)} (${formatBytes(properties?.total_uploaded ?? torrent.uploaded)} this session)`} />
        <KVRow label="Seeds" value={formatCountWithTotal(properties?.seeds ?? torrent.num_seeds, properties?.seeds_total ?? torrent.num_complete, 'total')} />
        <KVRow label="Peers" value={formatCountWithTotal(properties?.peers ?? torrent.num_leechs, properties?.peers_total ?? torrent.num_incomplete, 'total')} />
        <KVRow label="Download Speed" value={formatSpeed(torrent.dlspeed)} />
        <KVRow label="Upload Speed" value={formatSpeed(torrent.upspeed)} />
        <KVRow label="Wasted" value={formatBytes(wasted)} />
        <KVRow label="Share Ratio" value={formatRatio(torrent.ratio)} />
        <KVRow label="Popularity" value={formatPopularity(torrent.popularity)} />
        <KVRow label="Reannounce In" value={formatReannounce(reannounce)} />
        <KVRow label="Last Seen Complete" value={formatSeenComplete(lastSeen)} />
        <KVRow label="Download Limit" value={formatTransferLimit(torrent.dl_limit)} />
        <KVRow label="Upload Limit" value={formatTransferLimit(torrent.up_limit)} />
      </div>
      {/* Information column */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary border-b border-border pb-1 mb-1">Information</h3>
        <KVRow label="Total Size" value={formatBytes(totalSize)} />
        <KVRow label="Progress" value={formatProgress(torrent.progress)} />
        <KVRow label="State" value={getTorrentDetailedStateLabel(torrent.state)} />
        <KVRow label="Save Path" value={properties?.save_path ?? torrent.save_path ?? ''} />
        <KVRow label="Category" value={torrent.category || 'None'} />
        <KVRow label="Tags" value={torrent.tags || 'None'} />
        <KVRow label="Added On" value={formatDateTime(torrent.added_on)} />
        <KVRow label="Completed On" value={formatDateTime(torrent.completion_on)} />
        <KVRow label="Created On" value={formatDateTime(createdOn)} />
        <KVRow label="Created By" value={properties?.created_by || 'Unknown'} />
        <KVRow label="Piece Size" value={properties?.piece_size ? formatBytes(properties.piece_size) : '—'} />
        <KVRow label="Pieces" value={properties ? formatCountFraction(properties.pieces_have, properties.pieces_num) : '-'} />
        <KVRow label="Info Hash v1" value={infohashV1 || 'N/A'} />
        <KVRow label="Info Hash v2" value={infohashV2 || 'N/A'} />
        <KVRow label="Comment" value={properties?.comment || 'None'} />
        <KVRow label="Private" value={properties?.isPrivate ? 'Yes' : 'No'} />
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
  return (
    <div className="space-y-4">
      <SectionCard title="Transfer" icon="download">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="download" label="Downloaded" value={formatBytes(properties?.total_downloaded ?? torrent.downloaded)} />
          <StatTile icon="upload" label="Uploaded" value={formatBytes(properties?.total_uploaded ?? torrent.uploaded)} />
          <StatTile icon="clock" label="ETA" value={formatEta(properties?.eta ?? torrent.eta)} />
          <StatTile icon="ratio" label="Ratio" value={formatRatio(properties?.share_ratio ?? torrent.ratio)} />
          <StatTile icon="download" label="DL speed" value={formatSpeed(properties?.dl_speed ?? torrent.dlspeed)} />
          <StatTile icon="upload" label="UL speed" value={formatSpeed(properties?.up_speed ?? torrent.upspeed)} />
        </div>
      </SectionCard>

      <SectionCard title="Peers availability" icon="users">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="seeds" label="Seeds" value={formatCountFraction(properties?.seeds ?? torrent.num_seeds, properties?.seeds_total ?? torrent.num_complete)} />
          <StatTile icon="users" label="Peers" value={formatCountFraction(properties?.peers ?? torrent.num_leechs, properties?.peers_total ?? torrent.num_incomplete)} />
          <StatTile icon="link" label="Connections" value={formatCount(properties?.nb_connections)} />
          <StatTile icon="clock" label="Active time" value={formatTime(properties?.time_elapsed)} />
        </div>
        <DetailRow label="Availability" value={formatAvailabilityMultiplier(torrent.availability)} />
      </SectionCard>

      <SectionCard title="Storage" icon="hard-drive">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="hard-drive" label="Size" value={formatBytes(properties?.total_size ?? torrent.total_size ?? torrent.size)} />
          <StatTile icon="download" label="Remaining" value={formatBytes(torrent.amount_left)} />
          <StatTile icon="layers" label="Pieces" value={formatCountFraction(properties?.pieces_have, properties?.pieces_num)} />
          <StatTile icon="hard-drive" label="Piece size" value={properties?.piece_size ? formatBytes(properties.piece_size) : '-'} />
        </div>
        <DetailRow label="Save path" value={properties?.save_path ?? ''} />
        <DetailRow label="Content path" value={torrent.content_path || torrent.save_path} />
      </SectionCard>

      <SectionCard title="Metadata" icon="shield">
        <DetailRow label="Private torrent" value={properties?.isPrivate ? 'Yes' : 'No'} />
        <DetailRow label="Added" value={formatDateTime(torrent.added_on || properties?.addition_date || 0)} />
        <DetailRow label="Completed" value={formatDateTime(torrent.completion_on || properties?.completion_date || 0)} />
        <DetailRow label="Created by" value={properties?.created_by || 'Unknown'} />
        {properties?.comment ? <DetailRow label="Comment" value={properties.comment} /> : null}
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
            title="Could not load overview"
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
          title="Error loading properties"
          action={onRetry ? <RetryButton onClick={onRetry as () => void} /> : undefined}
        />
      );
    }

    return <DesktopOverview torrent={torrent} properties={properties} />;
  }
);

TorrentDetailsOverviewSection.displayName = 'TorrentDetailsOverviewSection';
