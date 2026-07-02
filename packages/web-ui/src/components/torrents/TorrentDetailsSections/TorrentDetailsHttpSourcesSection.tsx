import React, { useCallback, useState } from 'react';
import type { TorrentDetailsHttpSourcesSectionProps } from './types';
import type { WebSeed } from '@taurent/shared/types/qbittorrent';
import {
  DesktopDetailTable,
  type DesktopDetailTableColumn,
} from './DesktopDetailTable';
import { StateCard } from '../../shared/StateCard';
import { RetryButton } from '../../shared/RetryButton';

// Desktop HTTP sources table
function DesktopHttpSources({
  webSeeds,
  onAddHttpSources,
  onEditHttpSource,
  onRemoveHttpSource,
  onCopyHttpSourceUrl,
  onRefresh,
  removeHttpSourceIsPending,
}: {
  webSeeds: WebSeed[];
  onAddHttpSources?: () => void;
  onEditHttpSource?: (seed: WebSeed) => void;
  onRemoveHttpSource?: (seed: WebSeed) => void;
  onCopyHttpSourceUrl?: (seed: WebSeed) => void;
  onRefresh?: () => void;
  removeHttpSourceIsPending?: boolean;
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; seed: WebSeed | null } | null>(null);
  const [activeSeedUrl, setActiveSeedUrl] = useState<string | null>(null);

  const columns = React.useMemo<DesktopDetailTableColumn<WebSeed>[]>(() => [
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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRowContextMenu = useCallback((event: React.MouseEvent<HTMLTableRowElement>, seed: WebSeed) => {
    if (!onEditHttpSource && !onRemoveHttpSource && !onCopyHttpSourceUrl) return;
    event.preventDefault();
    setActiveSeedUrl(seed.url);
    setContextMenu({ x: event.clientX, y: event.clientY, seed });
  }, [onCopyHttpSourceUrl, onEditHttpSource, onRemoveHttpSource]);

  const handleTableContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onAddHttpSources && !onRefresh) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, seed: null });
  }, [onAddHttpSources, onRefresh]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DesktopDetailTable
        columns={columns}
        rows={webSeeds}
        rowKey={(seed) => seed.url}
        onRowContextMenu={handleRowContextMenu}
        onRowClick={(seed) => { setActiveSeedUrl(seed.url); }}
        onTableContextMenu={handleTableContextMenu}
        activeRowKey={activeSeedUrl ?? undefined}
      />

      {contextMenu ? (
        <HttpSourceContextMenuOverlay
          x={contextMenu.x}
          y={contextMenu.y}
          seed={contextMenu.seed}
          onClose={closeContextMenu}
          onAddHttpSources={onAddHttpSources}
          onEditHttpSource={onEditHttpSource}
          onRemoveHttpSource={onRemoveHttpSource}
          onCopyHttpSourceUrl={onCopyHttpSourceUrl}
          onRefresh={onRefresh}
          removeHttpSourceIsPending={removeHttpSourceIsPending}
        />
      ) : null}
    </div>
  );
}

function HttpSourceContextMenuOverlay({
  x,
  y,
  seed,
  onClose,
  onAddHttpSources,
  onEditHttpSource,
  onRemoveHttpSource,
  onCopyHttpSourceUrl,
  onRefresh,
  removeHttpSourceIsPending,
}: {
  x: number;
  y: number;
  seed: WebSeed | null;
  onClose: () => void;
  onAddHttpSources?: () => void;
  onEditHttpSource?: (seed: WebSeed) => void;
  onRemoveHttpSource?: (seed: WebSeed) => void;
  onCopyHttpSourceUrl?: (seed: WebSeed) => void;
  onRefresh?: () => void;
  removeHttpSourceIsPending?: boolean;
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
      {!seed && onAddHttpSources ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onAddHttpSources(); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          Add HTTP sources...
        </button>
      ) : null}
      {seed && onEditHttpSource ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onEditHttpSource(seed); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          Edit HTTP source URL...
        </button>
      ) : null}
      {seed && onRemoveHttpSource ? (
        <button
          type="button"
          role="menuitem"
          disabled={removeHttpSourceIsPending}
          onClick={() => { onRemoveHttpSource(seed); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive disabled:cursor-not-allowed disabled:text-text-disabled select-none"
        >
          Remove HTTP source
        </button>
      ) : null}
      {seed && onCopyHttpSourceUrl ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onCopyHttpSourceUrl(seed); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          Copy HTTP source URL
        </button>
      ) : null}
      {!seed && onRefresh ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onRefresh(); onClose(); }}
          className="flex w-full items-center px-2 py-1 text-left text-xs text-text-primary hover:bg-surface-interactive select-none"
        >
          Refresh HTTP sources
        </button>
      ) : null}
    </div>
  );
}

// Mobile HTTP sources card
function MobileHttpSourceCard({ seed }: { seed: WebSeed }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <div className="text-sm text-text-primary break-all">{seed.url}</div>
    </div>
  );
}

export const TorrentDetailsHttpSourcesSection = React.memo<TorrentDetailsHttpSourcesSectionProps>(
  ({
    variant = 'desktop',
    webSeeds,
    isLoading,
    error,
    onRetry,
    onAddHttpSources,
    onEditHttpSource,
    onRemoveHttpSource,
    onCopyHttpSourceUrl,
    removeHttpSourceIsPending,
  }) => {
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

    if (variant === 'desktop') {
      return (
        <DesktopHttpSources
          webSeeds={webSeeds ?? []}
          onAddHttpSources={onAddHttpSources}
          onEditHttpSource={onEditHttpSource}
          onRemoveHttpSource={onRemoveHttpSource}
          onCopyHttpSourceUrl={onCopyHttpSourceUrl}
          onRefresh={onRetry}
          removeHttpSourceIsPending={removeHttpSourceIsPending}
        />
      );
    }

    if (!webSeeds || webSeeds.length === 0) {
      return (
        <StateCard title="No HTTP sources" />
      );
    }
    return (
      <div className="space-y-3">
        {webSeeds.map((seed, index) => (
          <MobileHttpSourceCard key={index} seed={seed} />
        ))}
      </div>
    );
  }
);

TorrentDetailsHttpSourcesSection.displayName = 'TorrentDetailsHttpSourcesSection';
