import React from 'react';
import type { TorrentDetailsHttpSourcesSectionProps } from './types';
import {
  DesktopDetailTable,
  type DesktopDetailTableColumn,
} from './DesktopDetailTable';
import { StateCard } from '../../shared/StateCard';
import { RetryButton } from '../../shared/RetryButton';

// Desktop HTTP sources table
function DesktopHttpSources({ webSeeds }: { webSeeds: { url: string }[] }) {
  const columns = React.useMemo<DesktopDetailTableColumn<{ url: string }>[]>(() => [
    {
      id: 'url',
      label: 'URL',
      width: 9999,
      minWidth: 200,
      renderCell: (seed) => (
        <span className="block break-all text-text-primary">{seed.url}</span>
      ),
    },
  ], []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DesktopDetailTable
        columns={columns}
        rows={webSeeds}
        rowKey={(seed) => seed.url}
      />
    </div>
  );
}

// Mobile HTTP sources card
function MobileHttpSourceCard({ seed }: { seed: { url: string } }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <div className="text-sm text-text-primary break-all">{seed.url}</div>
    </div>
  );
}

export const TorrentDetailsHttpSourcesSection = React.memo<TorrentDetailsHttpSourcesSectionProps>(
  ({ variant = 'desktop', webSeeds, isLoading, error, onRetry }) => {
    if (isLoading && !webSeeds) {
      if (variant === 'mobile') {
        return (
          <div className="space-y-3">
            {[0, 1].map((item) => (
              <div key={item} className="h-12 rounded-sm border border-border bg-surface" />
            ))}
          </div>
        );
      }
      return (
        <div>
          <div className="border border-divider">
            {[0, 1].map((item) => (
              <div key={item} className="h-8 border-b border-divider" />
            ))}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <StateCard
          title="Could not load HTTP sources"
          action={onRetry ? <RetryButton onClick={onRetry as () => void} /> : undefined}
        />
      );
    }

    if (!webSeeds || webSeeds.length === 0) {
      if (variant === 'mobile') {
        return (
          <StateCard title="No HTTP sources" />
        );
      }
      return (
        <StateCard title="No HTTP sources" />
      );
    }

    if (variant === 'mobile') {
      return (
        <div className="space-y-3">
          {webSeeds.map((seed, index) => (
            <MobileHttpSourceCard key={index} seed={seed} />
          ))}
        </div>
      );
    }

    return <DesktopHttpSources webSeeds={webSeeds} />;
  }
);

TorrentDetailsHttpSourcesSection.displayName = 'TorrentDetailsHttpSourcesSection';
