import React from 'react';
import { cn } from '@taurent/shared';
import type { StatisticsScreenBodyProps } from './types';
import { StateCard, MetadataList, MetadataRow } from '@taurent/web-ui';
import { useLocalizedFormatters, useTaurentTranslation } from '@taurent/shared/i18n';

export const StatisticsScreenBody = React.memo<StatisticsScreenBodyProps>(({
  statistics,
  isLoading,
  isConnected,
  contentClassName,
}) => {
  const { t } = useTaurentTranslation('statistics');
  const { t: tCommon } = useTaurentTranslation('common');
  const format = useLocalizedFormatters();
  const formatPercentStat = (value: number | string | null, decimals = 2) => {
    if (value === null || value === undefined || value === '') {
      return tCommon('values.notAvailable');
    }

    if (typeof value === 'number') {
      return `${format.formatNumber(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
    }

    return value;
  };

  if (!isConnected) {
    return (
      <div className={cn("mx-auto flex w-full flex-col gap-2 px-2 py-2", contentClassName ?? "max-w-lg")}>
        <StateCard
          title={t('notConnected')}
          message={t('connectMessage')}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("mx-auto flex w-full flex-col gap-2 px-2 py-2", contentClassName ?? "max-w-lg")}>
        <StateCard
          title={t('loading')}
          message={t('loadingMessage')}
        />
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className={cn("mx-auto flex w-full flex-col gap-2 px-2 py-2", contentClassName ?? "max-w-lg")}>
        <StateCard
          title={t('unavailable')}
          message={t('unavailableMessage')}
        />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto flex w-full flex-col gap-2 px-2 py-2", contentClassName ?? "max-w-lg")}>
      <section className="overflow-hidden rounded-sm border border-border bg-surface">
        <div className="p-3">
          <h2 className="mb-1 text-sm font-semibold text-text-primary">{t('user')}</h2>
          <MetadataList className="space-y-0">
            <MetadataRow label={t('allTimeUpload')} value={format.formatBytes(statistics.alltimeUl)} />
            <MetadataRow label={t('allTimeDownload')} value={format.formatBytes(statistics.alltimeDl)} />
            <MetadataRow label={t('allTimeRatio')} value={format.formatRatio(statistics.globalRatio)} />
            <MetadataRow label={t('sessionWaste')} value={format.formatBytes(statistics.totalWastedSession)} />
            <MetadataRow label={t('connectedPeers')} value={format.formatCount(statistics.totalPeerConnections)} />
          </MetadataList>
        </div>
      </section>

      <section className="overflow-hidden rounded-sm border border-border bg-surface">
        <div className="p-3">
          <h2 className="mb-1 text-sm font-semibold text-text-primary">{t('cache')}</h2>
          <MetadataList className="space-y-0">
            <MetadataRow label={t('readCacheHits')} value={formatPercentStat(statistics.readCacheHits > 0 ? statistics.readCacheHits : null)} />
            <MetadataRow label={t('totalBufferSize')} value={format.formatBytes(statistics.totalBuffersSize)} />
          </MetadataList>
        </div>
      </section>

      <section className="overflow-hidden rounded-sm border border-border bg-surface">
        <div className="p-3">
          <h2 className="mb-1 text-sm font-semibold text-text-primary">{t('performance')}</h2>
          <MetadataList className="space-y-0">
            <MetadataRow label={t('writeCacheOverload')} value={formatPercentStat(statistics.writeCacheOverload)} />
            <MetadataRow label={t('readCacheOverload')} value={formatPercentStat(statistics.readCacheOverload)} />
            <MetadataRow label={t('queuedIoJobs')} value={format.formatCount(statistics.queuedIoJobs)} />
            <MetadataRow label={t('averageQueueTime')} value={statistics.averageTimeQueue > 0
              ? t('seconds', { value: format.formatNumber(statistics.averageTimeQueue, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
              : tCommon('values.notAvailable')} />
            <MetadataRow label={t('totalQueuedSize')} value={format.formatBytes(statistics.totalQueuedSize)} />
          </MetadataList>
        </div>
      </section>
    </div>
  );
});

StatisticsScreenBody.displayName = 'StatisticsScreenBody';
