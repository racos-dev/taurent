import React from 'react';
import { cn, formatBytes, formatRatio } from '@taurent/shared';
import type { StatisticsScreenBodyProps } from './types';
import { StateCard, MetadataList, MetadataRow } from '@taurent/web-ui';

export const StatisticsScreenBody = React.memo<StatisticsScreenBodyProps>(({
  statistics,
  isLoading,
  isConnected,
  contentClassName,
}) => {
  const formatPercentStat = (value: number | string | null, decimals = 2) => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }

    if (typeof value === 'number') {
      return `${value.toFixed(decimals)}%`;
    }

    return value;
  };

  if (!isConnected) {
    return (
      <div className={cn("mx-auto flex w-full flex-col gap-2 px-2 py-2", contentClassName ?? "max-w-lg")}>
        <StateCard
          title="Not connected"
          message="Connect to a qBittorrent server to view statistics."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("mx-auto flex w-full flex-col gap-2 px-2 py-2", contentClassName ?? "max-w-lg")}>
        <StateCard
          title="Loading statistics"
          message="Fetching the latest statistics from your qBittorrent server."
        />
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className={cn("mx-auto flex w-full flex-col gap-2 px-2 py-2", contentClassName ?? "max-w-lg")}>
        <StateCard
          title="Statistics unavailable"
          message="Statistics data is not available at this time."
        />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto flex w-full flex-col gap-2 px-2 py-2", contentClassName ?? "max-w-lg")}>
      <section className="overflow-hidden rounded-sm border border-border bg-surface">
        <div className="p-3">
          <h2 className="mb-1 text-sm font-semibold text-text-primary">User statistics</h2>
          <MetadataList className="space-y-0">
            <MetadataRow label="All-time upload" value={formatBytes(statistics.alltimeUl)} />
            <MetadataRow label="All-time download" value={formatBytes(statistics.alltimeDl)} />
            <MetadataRow label="All-time share ratio" value={formatRatio(statistics.globalRatio)} />
            <MetadataRow label="Session waste" value={formatBytes(statistics.totalWastedSession)} />
            <MetadataRow label="Connected peers" value={String(statistics.totalPeerConnections)} />
          </MetadataList>
        </div>
      </section>

      <section className="overflow-hidden rounded-sm border border-border bg-surface">
        <div className="p-3">
          <h2 className="mb-1 text-sm font-semibold text-text-primary">Cache statistics</h2>
          <MetadataList className="space-y-0">
            <MetadataRow label="Read cache hits" value={formatPercentStat(statistics.readCacheHits > 0 ? statistics.readCacheHits : null)} />
            <MetadataRow label="Total buffer size" value={formatBytes(statistics.totalBuffersSize)} />
          </MetadataList>
        </div>
      </section>

      <section className="overflow-hidden rounded-sm border border-border bg-surface">
        <div className="p-3">
          <h2 className="mb-1 text-sm font-semibold text-text-primary">Performance statistics</h2>
          <MetadataList className="space-y-0">
            <MetadataRow label="Write cache overload" value={formatPercentStat(statistics.writeCacheOverload)} />
            <MetadataRow label="Read cache overload" value={formatPercentStat(statistics.readCacheOverload)} />
            <MetadataRow label="Queued I/O jobs" value={String(statistics.queuedIoJobs)} />
            <MetadataRow label="Average time in queue" value={statistics.averageTimeQueue > 0 ? `${statistics.averageTimeQueue.toFixed(1)}s` : 'N/A'} />
            <MetadataRow label="Total queued size" value={formatBytes(statistics.totalQueuedSize)} />
          </MetadataList>
        </div>
      </section>
    </div>
  );
});

StatisticsScreenBody.displayName = 'StatisticsScreenBody';
