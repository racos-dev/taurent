import React, { useCallback, useMemo, useState } from 'react';
import type { TorrentDetailsTrackersSectionProps } from './types';
import type { Tracker } from '@taurent/shared/types/qbittorrent';
import { StatusBadge, type StatusType } from '@taurent/shared';
import { useLocalization, useLocalizedFormatters, useTaurentTranslation } from '@taurent/shared/i18n';
import {
  DesktopDetailTable,
  type DesktopDetailTableColumn,
  type DesktopDetailTableSortDirection,
} from './DesktopDetailTable';
import { StateCard } from '../../shared/StateCard';
import { RetryButton } from '../../shared/RetryButton';

type TrackerStatusLabelKey =
  | 'details.trackers.disabled' | 'details.trackers.notContacted' | 'details.trackers.working'
  | 'details.trackers.updating' | 'details.trackers.notWorking' | 'details.trackers.unknown';

function getTrackerStatus(status: number): { type: StatusType; labelKey: TrackerStatusLabelKey } {
  switch (status) {
    case 0: return { type: 'tracker-disabled', labelKey: 'details.trackers.disabled' };
    case 1: return { type: 'inactive', labelKey: 'details.trackers.notContacted' };
    case 2: return { type: 'tracker-working', labelKey: 'details.trackers.working' };
    case 3: return { type: 'tracker-updating', labelKey: 'details.trackers.updating' };
    case 4: return { type: 'tracker-error', labelKey: 'details.trackers.notWorking' };
    default: return { type: 'inactive', labelKey: 'details.trackers.unknown' };
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function compareValues(a: number | string, b: number | string, direction: DesktopDetailTableSortDirection, locale: string): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  const result = String(a).localeCompare(String(b), locale, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

function DesktopTrackers({ trackers, onAddTrackers, onEditTracker, onRemoveTracker, onCopyTrackerUrl }: {
  trackers: Tracker[];
  onAddTrackers?: () => void;
  onEditTracker?: (tracker: Tracker) => void;
  onRemoveTracker?: (tracker: Tracker) => void;
  onCopyTrackerUrl?: (tracker: Tracker) => void;
}) {
  const { locale } = useLocalization();
  const { t } = useTaurentTranslation('torrents');
  const format = useLocalizedFormatters();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tracker: Tracker | null } | null>(null);
  const [activeTrackerKey, setActiveTrackerKey] = useState<string | null>(null);
  const [sortColumnId, setSortColumnId] = useState<string>('tier');
  const [sortDirection, setSortDirection] = useState<DesktopDetailTableSortDirection>('asc');

  const getTrackerKey = useCallback((tracker: Tracker) => `${tracker.url}-${tracker.tier}-${tracker.status}`, []);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLTableRowElement>, tracker: Tracker) => {
    event.preventDefault();
    if (tracker.url.startsWith('** [')) {
      if (onAddTrackers) {
        setActiveTrackerKey(null);
        setContextMenu({ x: event.clientX, y: event.clientY, tracker: null });
      }
      return;
    }
    setActiveTrackerKey(getTrackerKey(tracker));
    setContextMenu({ x: event.clientX, y: event.clientY, tracker });
  }, [getTrackerKey, onAddTrackers]);

  const handleTableContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onAddTrackers) return;
    event.preventDefault();
    setActiveTrackerKey(null);
    setContextMenu({ x: event.clientX, y: event.clientY, tracker: null });
  }, [onAddTrackers]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleSortChange = useCallback((columnId: string) => {
    if (sortColumnId === columnId) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortColumnId(columnId);
    setSortDirection(columnId === 'url' || columnId === 'message' || columnId === 'status' ? 'asc' : 'desc');
  }, [sortColumnId]);

  const sortedTrackers = useMemo(() => {
    const sortValue = (tracker: Tracker): string | number => {
      switch (sortColumnId) {
        case 'tier':
          return tracker.tier;
        case 'url':
          return tracker.url;
        case 'status':
          return t(getTrackerStatus(tracker.status).labelKey);
        case 'peers':
          return tracker.num_peers;
        case 'seeds':
          return tracker.num_seeds;
        case 'leeches':
          return tracker.num_leeches;
        case 'downloaded':
          return tracker.num_downloaded;
        case 'message':
          return tracker.msg || '';
        default:
          return tracker.tier;
      }
    };

    return [...trackers].sort((left, right) => compareValues(sortValue(left), sortValue(right), sortDirection, locale));
  }, [locale, sortColumnId, sortDirection, t, trackers]);

  const columns = useMemo<DesktopDetailTableColumn<Tracker>[]>(() => [
    {
      id: 'tier',
      label: t('details.trackers.tier'),
      width: 68,
      minWidth: 56,
      align: 'center',
      sortable: true,
      renderCell: (tracker) => <span className="text-text-secondary">{format.formatCount(tracker.tier)}</span>,
    },
    {
      id: 'url',
      label: t('details.trackers.url'),
      width: 328,
      minWidth: 220,
      sortable: true,
      renderCell: (tracker) => (
        <div className="min-w-0">
          <span className="block truncate text-text-primary" title={tracker.url}>{tracker.url}</span>
          <span title={getHostname(tracker.url)} className="block truncate text-xs text-text-muted">{getHostname(tracker.url)}</span>
        </div>
      ),
    },
    {
      id: 'status',
      label: t('details.trackers.status'),
      width: 116,
      minWidth: 104,
      align: 'center',
      sortable: true,
      renderCell: (tracker) => {
        const { type, labelKey } = getTrackerStatus(tracker.status);
        return <StatusBadge status={type} label={t(labelKey)} size="small" />;
      },
    },
    {
      id: 'peers',
      label: t('fields.peers'),
      width: 74,
      minWidth: 64,
      align: 'right',
      sortable: true,
      renderCell: (tracker) => <span className="text-text-secondary">{format.formatCount(tracker.num_peers)}</span>,
    },
    {
      id: 'seeds',
      label: t('fields.seeds'),
      width: 74,
      minWidth: 64,
      align: 'right',
      sortable: true,
      renderCell: (tracker) => <span className="text-text-secondary">{format.formatCount(tracker.num_seeds)}</span>,
    },
    {
      id: 'leeches',
      label: t('details.trackers.leeches'),
      width: 80,
      minWidth: 68,
      align: 'right',
      sortable: true,
      renderCell: (tracker) => <span className="text-text-secondary">{format.formatCount(tracker.num_leeches)}</span>,
    },
    {
      id: 'downloaded',
      label: t('fields.downloaded'),
      width: 96,
      minWidth: 84,
      align: 'right',
      sortable: true,
      renderCell: (tracker) => <span className="text-text-secondary">{format.formatCount(tracker.num_downloaded)}</span>,
    },
    {
      id: 'message',
      label: t('details.trackers.message'),
      width: 220,
      minWidth: 144,
      sortable: true,
      renderCell: (tracker) => <span className="block truncate text-text-secondary" title={tracker.msg || ''}>{tracker.msg || '—'}</span>,
    },
  ], [format, t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DesktopDetailTable
        columns={columns}
        rows={sortedTrackers}
        rowKey={getTrackerKey}
        activeRowKey={activeTrackerKey}
        sortColumnId={sortColumnId}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onRowClick={(tracker) => { setActiveTrackerKey(getTrackerKey(tracker)); }}
        onRowContextMenu={handleContextMenu}
        onTableContextMenu={handleTableContextMenu}
      />

      {contextMenu ? (
        <TrackerContextMenuOverlay
          x={contextMenu.x}
          y={contextMenu.y}
          tracker={contextMenu.tracker}
          onClose={closeContextMenu}
          onAddTrackers={onAddTrackers}
          onEditTracker={onEditTracker}
          onRemoveTracker={onRemoveTracker}
          onCopyTrackerUrl={onCopyTrackerUrl}
        />
      ) : null}
    </div>
  );
}

function TrackerContextMenuOverlay({ x, y, tracker, onClose, onAddTrackers, onEditTracker, onRemoveTracker, onCopyTrackerUrl }: {
  x: number;
  y: number;
  tracker: Tracker | null;
  onClose: () => void;
  onAddTrackers?: () => void;
  onEditTracker?: (tracker: Tracker) => void;
  onRemoveTracker?: (tracker: Tracker) => void;
  onCopyTrackerUrl?: (tracker: Tracker) => void;
}) {
  const { t } = useTaurentTranslation('torrents');
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const [pos, setPos] = React.useState({ x, y });
  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const pad = 8;
    setPos({
      x: Math.min(Math.max(pad, x), window.innerWidth - rect.width - pad),
      y: Math.min(Math.max(pad, y), window.innerHeight - rect.height - pad),
    });
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-52 rounded-md border border-border bg-surface-elevated py-1 shadow-lg select-none"
    >
      {!tracker && onAddTrackers ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onAddTrackers(); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          {t('details.trackers.add')}
        </button>
      ) : null}
      {tracker && onEditTracker ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onEditTracker(tracker); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          {t('details.trackers.edit')}
        </button>
      ) : null}
      {tracker && onRemoveTracker ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onRemoveTracker(tracker); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-error hover:bg-error-20 select-none"
        >
          {t('details.trackers.remove')}
        </button>
      ) : null}
      {tracker && onCopyTrackerUrl ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onCopyTrackerUrl(tracker); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          {t('details.trackers.copy')}
        </button>
      ) : null}
    </div>
  );
}

function MobileTrackerCard({ tracker }: { tracker: Tracker }) {
  const { t } = useTaurentTranslation('torrents');
  const format = useLocalizedFormatters();
  const status = getTrackerStatus(tracker.status);
  
  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-primary">{getHostname(tracker.url)}</div>
          <div className="mt-1 break-all text-xs text-text-secondary">{tracker.url}</div>
        </div>
        <StatusBadge status={status.type} label={t(status.labelKey)} size="small" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SummaryChip>{t('details.trackers.labeledCount', { label: t('fields.seeds'), count: format.formatCount(tracker.num_seeds) })}</SummaryChip>
        <SummaryChip>{t('details.trackers.labeledCount', { label: t('fields.peers'), count: format.formatCount(tracker.num_peers) })}</SummaryChip>
        <SummaryChip>{t('details.trackers.labeledCount', { label: t('details.trackers.downloads'), count: format.formatCount(tracker.num_downloaded) })}</SummaryChip>
        <SummaryChip>{t('details.trackers.labeledCount', { label: t('details.trackers.tier'), count: format.formatCount(tracker.tier) })}</SummaryChip>
      </div>

      {tracker.msg ? (
        <div className="mt-3 rounded-sm bg-surface px-2 py-2 text-xs text-text-secondary">
          {tracker.msg}
        </div>
      ) : null}
    </div>
  );
}

function SummaryChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-sm bg-surface px-2 py-1 text-xs font-medium text-text-secondary">
      {children}
    </span>
  );
}

export const TorrentDetailsTrackersSection = React.memo<TorrentDetailsTrackersSectionProps>(
  ({ variant = 'desktop', trackers, isLoading, error, onRetry, onAddTrackers, onEditTracker, onRemoveTracker, onCopyTrackerUrl }) => {
    const { t } = useTaurentTranslation('torrents');
    if (isLoading && !trackers) {
      if (variant === 'mobile') {
        return (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-28 rounded-sm border border-border bg-surface" />
            ))}
          </div>
        );
      }
      return (
        <div className="rounded-md border border-border bg-surface">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-8 border-b border-border last:border-b-0" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <StateCard
          title={t('details.trackers.loadError')}
          action={onRetry ? <RetryButton onClick={onRetry as () => void} /> : undefined}
        />
      );
    }

    if (variant === 'desktop') {
      return <DesktopTrackers trackers={trackers ?? []} onAddTrackers={onAddTrackers} onEditTracker={onEditTracker} onRemoveTracker={onRemoveTracker} onCopyTrackerUrl={onCopyTrackerUrl} />;
    }

    if (!trackers || trackers.length === 0) {
      return (
        <StateCard
          title={t('details.trackers.empty')}
          message={t('details.trackers.emptyMessage')}
        />
      );
    }

    return (
      <div className="space-y-4">
        {trackers.map((tracker, index) => (
          <MobileTrackerCard key={`${tracker.url}-${index}`} tracker={tracker} />
        ))}
      </div>
    );
  }
);

TorrentDetailsTrackersSection.displayName = 'TorrentDetailsTrackersSection';
