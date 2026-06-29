import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQBClient } from '../connection';
import { useTorrentWorkspaceListController } from '../hooks';
import { Button, RetryButton, Spinner, StateSurface, StateCard } from '@taurent/web-ui';
import { TorrentContextMenu } from '../components/TorrentContextMenu';
import { Filter } from '@taurent/shared';
import { measure, mark } from '@taurent/shared/utils/perfAudit';
import { classifyError, formatUserMessageForContext } from '@taurent/shared/utils/error';

import { type SortField } from '@taurent/shared/stores';
import { useShellStore, useTorrentSelectionStore } from '@/stores';
import { TorrentTable } from '../components/TorrentTable';
import { useLiveTorrentByHash } from '../hooks/torrents/useLiveTorrentByHash';
import type { Torrent } from '@taurent/shared';

export function HomeScreen() {
  const { isConnected, isConnecting, isHydrated, error: providerError, retry } = useQBClient();

  // Workspace controller — provides sortedTorrents, filter/sort state and setters.
  // liveTorrentProvider is wired in hooks/index.ts so torrents come from maindata
  // without full-array Zustand subscription.
  const {
    sortedTorrents,
    isLoading,
    filters,
    clearFilters,
    sortField,
    sortDirection,
    setSortField,
    toggleSortDirection,
  } = useTorrentWorkspaceListController();

  // Selection state from desktop selection store
  const selectedHashes = useTorrentSelectionStore((state) => state.selectedHashes);
  const focusedHash = useTorrentSelectionStore((state) => state.focusedHash);
  const selectTorrent = useTorrentSelectionStore((state) => state.selectTorrent);
  const deselectAll = useTorrentSelectionStore((state) => state.deselectAll);
  const setPanelTorrentHash = useTorrentSelectionStore((state) => state.setPanelTorrentHash);
  const setVisibleHashes = useTorrentSelectionStore((state) => state.setVisibleHashes);

  // Sync visibleHashes into selection store whenever sorted order changes
  // (drives Ctrl+A and range selection correctness).
  const visibleHashes = useMemo(
    () => measure('HomeScreen.visibleHashes', () => sortedTorrents.map((t) => t.hash)),
    [sortedTorrents],
  );
  // setVisibleHashes is synchronous and cheap; runs after every sortedTorrents change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setVisibleHashes(visibleHashes); }, [visibleHashes]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Shell store for properties pane
  const setPropertiesPaneVisible = useShellStore((state) => state.setPropertiesPaneVisible);

  // Right-click handler - selects the row if not selected, then shows context menu
  const handleRightClick = useCallback((e: React.MouseEvent, torrent: Torrent, isSelected: boolean) => {
    e.preventDefault();

    if (!isSelected) {
      selectTorrent(torrent.hash, false, false);
    }

    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [selectTorrent]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle blank space click — clear selection and dismiss details pane
  const handleBlankSpaceClick = useCallback(() => {
    deselectAll();
    setPanelTorrentHash(null);
    setPropertiesPaneVisible(false);
  }, [deselectAll, setPanelTorrentHash, setPropertiesPaneVisible]);

  // Handle torrent click - select and show properties pane
  const handleTorrentClick = useCallback((torrent: Torrent) => {
    // Add to selection if not already selected
    if (!selectedHashes.has(torrent.hash)) {
      selectTorrent(torrent.hash, false, false);
    }
    // Show properties pane with this torrent
    setPanelTorrentHash(torrent.hash);
    setPropertiesPaneVisible(true);
  }, [selectedHashes, selectTorrent, setPanelTorrentHash, setPropertiesPaneVisible]);

  // Stable sort handler — wrapped in useCallback so TorrentTable doesn't churn on every HomeScreen render.
  const handleSort = useCallback((field: SortField) => {
    setSortField(field);
    if (field === sortField) {
      toggleSortDirection();
    }
  }, [setSortField, sortField, toggleSortDirection]);

  // Compute target hash before the memo so we can use it for the narrow fallback lookup
  const firstSelectedHash = selectedHashes.values().next().value;
  const targetHash = focusedHash ?? firstSelectedHash;

  // Fallback lookup when the target hash isn't in the filtered view
  const fallbackTorrent = useLiveTorrentByHash(targetHash ?? null);

  const contextMenuTargetTorrent = useMemo(() => {
    if (!contextMenu) {
      return null;
    }

    if (!targetHash) {
      return null;
    }

    // First try sortedTorrents (filtered/sorted view), then fallback to
    // the narrow live lookup for hashes not in the current filter.
    return sortedTorrents.find((t) => t.hash === targetHash)
      ?? fallbackTorrent
      ?? null;
  }, [contextMenu, targetHash, sortedTorrents, fallbackTorrent]);

  const hasActiveFilters = Boolean(
    filters.search || filters.status !== 'all' || filters.category || filters.tag || filters.tracker,
  );

  // Mark once when screen is in renderable state: hydrated, connected, not loading, no errors
  const homeScreenReadyRef = useRef(false);
  useEffect(() => {
    if (
      isHydrated &&
      isConnected &&
      !isConnecting &&
      !(isLoading && sortedTorrents.length === 0)
    ) {
      if (!homeScreenReadyRef.current) {
        homeScreenReadyRef.current = true;
        mark('home.screen.ready');
      }
    }
  }, [isHydrated, isConnected, isConnecting, isLoading, sortedTorrents.length]);

  if (!isHydrated) {
    return (
      <StateSurface tone="loading" title="Loading..." />
    );
  }

  if (isConnecting) {
    return (
      <StateSurface tone="loading" title="Connecting..." message="Establishing connection to server." />
    );
  }

  if (providerError) {
    const category = classifyError(providerError);
    const errorMessage = formatUserMessageForContext(providerError, 'connection');

    const retryButton = category === 'auth' ? null : (
      <RetryButton onClick={() => retry()} />
    );

    return (
      <StateSurface
        tone="error"
        title="Connection Error"
        message={errorMessage}
        actions={retryButton}
      />
    );
  }

  if (!isConnected) {
    return (
      <StateSurface
        tone="offline"
        title="Not Connected"
        message="Connect to a qBittorrent server to get started."
        actions={
          <Button onClick={() => { window.location.href = '/login'; }}>
            Connect
          </Button>
        }
      />
    );
  }

  if (isLoading && sortedTorrents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Spinner variant="icon" size="md" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex-1 min-h-0">
        {sortedTorrents.length > 0 ? (
          <TorrentTable
            torrents={sortedTorrents}
            selectedHashes={selectedHashes}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onTorrentClick={handleTorrentClick}
            onRightClick={handleRightClick}
            onBlankSpaceClick={handleBlankSpaceClick}
          />
        ) : hasActiveFilters ? (
              <StateCard
                title="No torrents match filters"
                message="Try adjusting or clearing your filters."
                icon={<Filter className="h-5 w-5" />}
                action={
                  <button
                    onClick={() => clearFilters()}
                    className="text-primary text-xs hover:underline"
                  >
                    Clear Filters
                  </button>
                }
              />
            ) : (
              <StateCard title="No torrents found" message="Add a torrent to get started." />
            )}
      </div>

      {contextMenu && contextMenuTargetTorrent ? (
        <TorrentContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          torrent={contextMenuTargetTorrent}
          selectedHashes={selectedHashes}
          onClose={handleCloseContextMenu}
        />
      ) : null}
      
    </div>
  );
}
