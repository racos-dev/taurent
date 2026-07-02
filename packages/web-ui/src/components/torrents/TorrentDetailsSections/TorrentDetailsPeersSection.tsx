import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '@taurent/shared';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { formatBytes, formatProgress, formatSpeed } from '@taurent/shared/utils/formatters';
import type { PeerRow, TorrentDetailsPeersSectionProps } from './types';
import {
  DesktopDetailTable,
  type DesktopDetailTableColumn,
  type DesktopDetailTableSortDirection,
} from './DesktopDetailTable';
import { StateCard } from '../../shared/StateCard';
import { RetryButton } from '../../shared/RetryButton';

function compareValues(a: number | string, b: number | string, direction: DesktopDetailTableSortDirection): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  const result = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

function PeerProgressCell({ progress }: { progress: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-sm bg-surface-elevated">
        <div className="h-full rounded-sm bg-primary" style={{ width: `${Math.max(0, Math.min(progress, 1)) * 100}%` }} />
      </div>
      <span className="w-12 text-right text-text-secondary">{formatProgress(progress)}</span>
    </div>
  );
}

/**
 * Resolve country/region display string from peer data.
 * qBittorrent sync exposes `country` (localized name) and `country_code` (ISO 3166-1 alpha-2).
 */
function resolveCountry(peer: PeerRow): string {
  if (peer.country) return peer.country;
  if (peer.country_code) return peer.country_code;
  return '—';
}

function DesktopPeersTable({ peers, onBanPeer, onAddPeers, onCopyPeerAddress, banPeerIsPending }: {
  peers: PeerRow[];
  onBanPeer?: (peerKey: string) => void;
  onAddPeers?: () => void;
  onCopyPeerAddress?: (peer: PeerRow) => void;
  banPeerIsPending?: boolean;
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; peer: PeerRow | null } | null>(null);
  const [activePeerKey, setActivePeerKey] = useState<string | null>(null);
  const [sortColumnId, setSortColumnId] = useState<string>('dlSpeed');
  const [sortDirection, setSortDirection] = useState<DesktopDetailTableSortDirection>('desc');

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLTableRowElement>, peer: PeerRow) => {
    event.preventDefault();
    setActivePeerKey(peer.key);
    setContextMenu({ x: event.clientX, y: event.clientY, peer });
  }, []);

  const handleTableContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onAddPeers) return;
    event.preventDefault();
    setActivePeerKey(null);
    setContextMenu({ x: event.clientX, y: event.clientY, peer: null });
  }, [onAddPeers]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleSortChange = useCallback((columnId: string) => {
    if (sortColumnId === columnId) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortColumnId(columnId);
    setSortDirection(columnId === 'ip' || columnId === 'client' || columnId === 'country' ? 'asc' : 'desc');
  }, [sortColumnId]);

  const sortedPeers = useMemo(() => {
    const sortValue = (peer: PeerRow): string | number => {
      switch (sortColumnId) {
        case 'country':
          return resolveCountry(peer);
        case 'ip':
          return `${peer.ip}:${peer.port}`;
        case 'port':
          return peer.port;
        case 'connection':
          return peer.connection || '';
        case 'flags':
          return peer.flags || '';
        case 'client':
          return peer.client || '';
        case 'progress':
          return peer.progress;
        case 'dlSpeed':
          return peer.dl_speed;
        case 'ulSpeed':
          return peer.up_speed;
        case 'downloaded':
          return peer.downloaded;
        case 'uploaded':
          return peer.uploaded;
        case 'relevance':
          return peer.relevance ?? 0;
        case 'files':
          return peer.files || '';
        default:
          return peer.dl_speed;
      }
    };

    return [...peers].sort((left, right) => compareValues(sortValue(left), sortValue(right), sortDirection));
  }, [peers, sortColumnId, sortDirection]);

  const columns = useMemo<DesktopDetailTableColumn<PeerRow>[]>(() => [
    {
      id: 'country',
      label: 'Country/Region',
      width: 136,
      minWidth: 100,
      sortable: true,
      renderCell: (peer) => {
        const resolved = resolveCountry(peer);
        return <span title={resolved} className="block truncate text-text-secondary">{resolved}</span>;
      },
    },
    {
      id: 'ip',
      label: 'IP',
      width: 154,
      minWidth: 120,
      sortable: true,
        renderCell: (peer) => <span title={peer.ip} className="block truncate text-text-primary">{peer.ip}</span>,
    },
    {
      id: 'port',
      label: 'Port',
      width: 76,
      minWidth: 64,
      align: 'right',
      sortable: true,
      renderCell: (peer) => <span className="text-text-secondary">{peer.port}</span>,
    },
    {
      id: 'connection',
      label: 'Connection',
      width: 124,
      minWidth: 100,
      sortable: true,
        renderCell: (peer) => <span title={peer.connection || '—'} className="block truncate text-text-secondary">{peer.connection || '—'}</span>,
    },
    {
      id: 'flags',
      label: 'Flags',
      width: 92,
      minWidth: 76,
      sortable: true,
      renderCell: (peer) => <span className="block truncate text-text-secondary" title={peer.flags_desc || peer.flags || ''}>{peer.flags || '—'}</span>,
    },
    {
      id: 'client',
      label: 'Client',
      width: 164,
      minWidth: 124,
      sortable: true,
      renderCell: (peer) => <span className="block truncate text-text-secondary" title={peer.client || 'Unknown'}>{peer.client || 'Unknown'}</span>,
    },
    {
      id: 'progress',
      label: 'Progress',
      width: 136,
      minWidth: 124,
      align: 'right',
      sortable: true,
      renderCell: (peer) => <PeerProgressCell progress={peer.progress} />,
    },
    {
      id: 'dlSpeed',
      label: 'DL Speed',
      width: 112,
      minWidth: 88,
      align: 'right',
      sortable: true,
      renderCell: (peer) => <span className="text-text-secondary">{formatSpeed(peer.dl_speed)}</span>,
    },
    {
      id: 'ulSpeed',
      label: 'UL Speed',
      width: 112,
      minWidth: 88,
      align: 'right',
      sortable: true,
      renderCell: (peer) => <span className="text-text-secondary">{formatSpeed(peer.up_speed)}</span>,
    },
    {
      id: 'downloaded',
      label: 'Downloaded',
      width: 112,
      minWidth: 96,
      align: 'right',
      sortable: true,
      renderCell: (peer) => <span className="text-text-secondary">{formatBytes(peer.downloaded)}</span>,
    },
    {
      id: 'uploaded',
      label: 'Uploaded',
      width: 112,
      minWidth: 96,
      align: 'right',
      sortable: true,
      renderCell: (peer) => <span className="text-text-secondary">{formatBytes(peer.uploaded)}</span>,
    },
    {
      id: 'relevance',
      label: 'Relevance',
      width: 96,
      minWidth: 80,
      align: 'right',
      sortable: true,
      renderCell: (peer) => <span className="text-text-secondary">{peer.relevance != null ? formatProgress(peer.relevance) : '—'}</span>,
    },
    {
      id: 'files',
      label: 'Files',
      width: 160,
      minWidth: 100,
      sortable: true,
      renderCell: (peer) => <span className="block truncate text-text-secondary" title={peer.files || ''}>{peer.files || '—'}</span>,
    },
  ], []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DesktopDetailTable
        columns={columns}
        rows={sortedPeers}
        rowKey={(peer) => peer.key}
        activeRowKey={activePeerKey}
        sortColumnId={sortColumnId}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onRowClick={(peer) => { setActivePeerKey(peer.key); }}
        onRowContextMenu={handleContextMenu}
        onTableContextMenu={handleTableContextMenu}
        getRowClassName={(peer) => cn(peer.progress >= 1 && 'text-success')}
      />

      {contextMenu ? (
        <PeerContextMenuOverlay
          x={contextMenu.x}
          y={contextMenu.y}
          peer={contextMenu.peer}
          onClose={closeContextMenu}
          onAddPeers={onAddPeers}
          onCopyPeerAddress={onCopyPeerAddress}
          onBanPeer={onBanPeer}
          banPeerIsPending={banPeerIsPending}
        />
      ) : null}
    </div>
  );
}

function PeerContextMenuOverlay({ x, y, peer, onClose, onAddPeers, onCopyPeerAddress, onBanPeer, banPeerIsPending }: {
  x: number;
  y: number;
  peer: PeerRow | null;
  onClose: () => void;
  onAddPeers?: () => void;
  onCopyPeerAddress?: (peer: PeerRow) => void;
  onBanPeer?: (peerKey: string) => void;
  banPeerIsPending?: boolean;
}) {
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
      {!peer && onAddPeers ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onAddPeers(); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          Add peers...
        </button>
      ) : null}
      {peer && onCopyPeerAddress ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onCopyPeerAddress(peer); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          Copy IP:port
        </button>
      ) : null}
      {peer && onBanPeer ? (
        <button
          type="button"
          role="menuitem"
          disabled={banPeerIsPending}
          onClick={() => { onBanPeer(peer.key); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-error hover:bg-error-20 disabled:text-text-disabled select-none"
        >
          Ban peer permanently
        </button>
      ) : null}
    </div>
  );
}

function PeerCard({ peer, onRequestBan, banPeerIsPending }: {
  peer: PeerRow;
  onRequestBan?: (peerKey: string) => void;
  banPeerIsPending?: boolean;
}) {
  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p title={`${peer.ip}:${peer.port}`} className="truncate text-sm font-medium text-text-primary">
            {peer.ip}:{peer.port}
          </p>
          <p title={peer.client || 'Unknown client'} className="truncate text-xs text-text-secondary">
            {peer.client || 'Unknown client'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-primary-20 px-2 py-1 text-xs font-medium text-primary">
            {formatProgress(peer.progress)}
          </span>
          {onRequestBan ? (
            <button
              type="button"
              onClick={() => { onRequestBan(peer.key); }}
              disabled={banPeerIsPending}
              className="rounded-sm bg-error/10 px-2 py-1 text-xs font-medium text-error transition-colors hover:bg-error/20 disabled:text-text-disabled"
              title="Ban this peer"
            >
              Ban
            </button>
          ) : null}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(peer.progress, 1)) * 100}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-text-secondary">
        <div>
          <span className="block text-text-muted">Down</span>
          <span>{formatSpeed(peer.dl_speed)}</span>
        </div>
        <div>
          <span className="block text-text-muted">Up</span>
          <span>{formatSpeed(peer.up_speed)}</span>
        </div>
        <div>
          <span className="block text-text-muted">Downloaded</span>
          <span>{formatBytes(peer.downloaded)}</span>
        </div>
        <div>
          <span className="block text-text-muted">Uploaded</span>
          <span>{formatBytes(peer.uploaded)}</span>
        </div>
      </div>
    </div>
  );
}

export const TorrentDetailsPeersSection = React.memo<TorrentDetailsPeersSectionProps>(
  ({ variant = 'desktop', peers, isLoading, error, onRetry, onBanPeer, onAddPeers, onCopyPeerAddress, banPeerIsPending }) => {
    const [pendingBanKey, setPendingBanKey] = useState<string | null>(null);
    const [banError, setBanError] = useState<string | null>(null);

    const handleRequestBan = useCallback((peerKey: string) => {
      setPendingBanKey(peerKey);
      setBanError(null);
    }, []);

    const handleConfirmBan = useCallback(async () => {
      if (!pendingBanKey || !onBanPeer) return;
      setBanError(null);
      try {
        await onBanPeer(pendingBanKey);
        setPendingBanKey(null);
      } catch (err) {
        setBanError(formatUserMessageForContext(err, 'torrent-action'));
      }
    }, [pendingBanKey, onBanPeer]);

    const handleCancelBan = useCallback(() => {
      setPendingBanKey(null);
      setBanError(null);
    }, []);

    if (isLoading && !peers) {
      return (
        <div className="max-w-4xl">
          <div className="mb-3 h-4 w-24 rounded-sm bg-surface" />
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-32 rounded-sm border border-border bg-surface p-3" />
            ))}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <StateCard
          title="Could not load peers"
          action={onRetry ? <RetryButton onClick={onRetry as () => void} /> : undefined}
        />
      );
    }

    if (variant === 'desktop') {
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <DesktopPeersTable
            peers={peers ?? []}
            onBanPeer={handleRequestBan}
            onAddPeers={onAddPeers}
            onCopyPeerAddress={onCopyPeerAddress}
            banPeerIsPending={banPeerIsPending}
          />

          {pendingBanKey ? (
            <div className="mt-2 rounded-md border border-error/30 bg-error/5 p-3">
              <p className="text-xs font-medium text-text-primary">
                Ban peer {pendingBanKey.split('_')[0]}?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelBan}
                  disabled={banPeerIsPending}
                  className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-text-secondary enabled:hover:bg-surface-interactive disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBan}
                  disabled={banPeerIsPending}
                  className="rounded-sm bg-error px-2 py-1 text-xs font-medium text-text-on-danger enabled:hover:bg-error/90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                >
                  {banPeerIsPending ? 'Banning...' : 'Ban'}
                </button>
              </div>
            </div>
          ) : null}

          {banError ? <p className="mt-1 text-xs text-error">{banError}</p> : null}
        </div>
      );
    }

    if (!peers || peers.length === 0) {
      return (
        <StateCard title="No peers connected" />
      );
    }

    return (
      <div>
        <div className="space-y-3">
          {peers.map((peer) => (
            <PeerCard key={peer.key} peer={peer} onRequestBan={handleRequestBan} banPeerIsPending={banPeerIsPending} />
          ))}
        </div>

        {pendingBanKey ? (
          <div className="mt-3 rounded-sm border border-error/30 bg-error/5 p-3">
            <p className="text-sm font-medium text-text-primary">
              Ban peer {pendingBanKey.split('_')[0]}?
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              This will disconnect the peer and prevent future connections from this address.
            </p>
<div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelBan}
                  disabled={banPeerIsPending}
                  className="flex items-center justify-center gap-2 rounded-sm border border-border px-3 py-2 text-sm font-medium text-text-secondary transition-colors enabled:hover:bg-surface-interactive disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBan}
                  disabled={banPeerIsPending}
                  className="flex items-center justify-center gap-2 rounded-sm bg-error px-3 py-2 text-sm font-medium text-text-on-danger transition-colors enabled:hover:bg-error/90 disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                >
                  {banPeerIsPending ? 'Banning...' : 'Ban peer'}
                </button>
              </div>
          </div>
        ) : null}

        {banError ? <p className="mt-2 text-xs text-error">{banError}</p> : null}
      </div>
    );
  }
);

TorrentDetailsPeersSection.displayName = 'TorrentDetailsPeersSection';
