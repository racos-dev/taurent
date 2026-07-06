// Desktop inspector shell — replaces the legacy DetailPanel with a thin desktop wrapper
// around shared useTorrentDetailController and shared detail sections/dialogs.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useShellStore, useTorrentSelectionStore } from '@/stores';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { useTorrentProperties, useTorrentTrackers, useTorrentFiles, useTorrentPeers, useTorrentWebSeeds } from '../../hooks/torrents/useTorrentDetails';
import { useLiveTorrentByHash } from '../../hooks/torrents/useLiveTorrentByHash';
import { useTorrentActions } from '../../hooks/torrents/useTorrentActions';
import { useMutation } from '@tanstack/react-query';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useBanPeersWithPeerInvalidation, useAddPeersWithPeerInvalidation } from '@taurent/web-core/hooks';
import { useSelectedTorrentDetailSync } from '@taurent/web-core/sync';
import { useQBClient, useMaindataState } from '../../connection';
import {
  TabBar,
  TorrentDetailsOverviewSection,
  TorrentDetailsTrackersSection,
  TorrentDetailsPeersSection,
  TorrentDetailsHttpSourcesSection,
  Input,
} from '@taurent/web-ui';
import { DesktopTorrentDetailsFilesSection } from '../TorrentDetail/DesktopTorrentDetailsFilesSection';
import { useTorrentDetailController, type DetailTab } from '@taurent/web-core/screens';
import type { PeerRow } from '@taurent/web-core/hooks';
import type { Tracker, TorrentFile, WebSeed } from '@taurent/shared/types/qbittorrent';
import { openTorrentTextDialogWindow } from '../../windows/dialogs/torrentTextDialogWindow';
import { openTorrentNumericDialogWindow } from '../../windows/dialogs/torrentNumericDialogWindow';
import { openTorrentDeleteDialogWindow } from '../../windows/dialogs/torrentDeleteDialogWindow';

const MIN_PANEL_HEIGHT = 150;
const MAX_PANEL_HEIGHT = 800;

// ─── Peers tab coordinator (owns hot maindata subscription) ───────────────
interface PeersTabCoordinatorProps {
  paneOpen: boolean;
  activeTab: DetailTab;
  peersRefetch: () => void;
  selectedTorrentHash: string | null;
}

function PeersTabCoordinator({ paneOpen, activeTab, peersRefetch, selectedTorrentHash }: PeersTabCoordinatorProps) {
  const { maindataState } = useMaindataState();
  const handleCoordinatorRefetch = useCallback(
    (tab: DetailTab) => {
      if (tab === 'peers') void peersRefetch();
    },
    [peersRefetch]
  );
  useSelectedTorrentDetailSync({
    paneOpen,
    activeTab,
    maindataState,
    onRefetch: handleCoordinatorRefetch,
    coordinatorTabs: ['peers'],
    selectedTorrentHash: selectedTorrentHash ?? undefined,
  });
  return null;
}

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'General' },
  { id: 'trackers', label: 'Trackers' },
  { id: 'peers', label: 'Peers' },
  { id: 'httpSources', label: 'HTTP Sources' },
  { id: 'files', label: 'Content' },
];

function clampHeight(height: number): number {
  return Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, height));
}

function normalizeHttpSourceUrls(value: string): string {
  return value
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean)
    .join('|');
}

export function DetailPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ bottomEdge: number } | null>(null);

  const panelTorrentHash = useTorrentSelectionStore((state) => state.panelTorrentHash);
  const setPanelTorrentHash = useTorrentSelectionStore((state) => state.setPanelTorrentHash);
  const deselectAll = useTorrentSelectionStore((state) => state.deselectAll);

  // Shell store state
  const shellTab = useShellStore((state) => state.propertiesPaneActiveTab);
  const propertiesPaneHeight = useShellStore((state) => state.propertiesPaneHeight);
  const setPropertiesPaneActiveTab = useShellStore((state) => state.setPropertiesPaneActiveTab);
  const setPropertiesPaneHeight = useShellStore((state) => state.setPropertiesPaneHeight);
  const setPropertiesPaneVisible = useShellStore((state) => state.setPropertiesPaneVisible);

  const [isResizing, setIsResizing] = useState(false);

  // Live torrent from maindata — narrow subscription, no full array
  const torrent = useLiveTorrentByHash(panelTorrentHash);

  // Reset tab when torrent changes
  useEffect(() => {
    if (panelTorrentHash) {
      setPropertiesPaneActiveTab('overview');
    }
  }, [panelTorrentHash, setPropertiesPaneActiveTab]);

  // Clear selection if torrent disappears
  useEffect(() => {
    if (panelTorrentHash && !torrent) {
      setPanelTorrentHash(null);
    }
  }, [panelTorrentHash, setPanelTorrentHash, torrent]);

  // Resize handling
  useEffect(() => {
    if (!isResizing) return undefined;

    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      const newHeight = clampHeight(resizeState.bottomEdge - event.clientY);
      setPropertiesPaneHeight(newHeight);
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setPropertiesPaneHeight]);

  const handleResizeStart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    resizeStateRef.current = {
      bottomEdge: panelRef.current?.getBoundingClientRect().bottom ?? window.innerHeight,
    };
    setIsResizing(true);
  };

  const handleDismiss = () => {
    deselectAll();
    setPanelTorrentHash(null);
    setPropertiesPaneVisible(false);
  };

  const handleTabChange = (tab: DetailTab) => {
    setPropertiesPaneActiveTab(tab);
  };

  // ─── Maindata state for adaptive detail polling ───────────────────────────
  const { maindataState } = useMaindataState();

  // ─── Data hooks (fetch when tab is active) ────────────────────────────────
  const getTorrentState = useCallback(
    (h: string) => maindataState?.torrents?.[h]?.state,
    [maindataState],
  );

  const { properties, isLoading: propertiesLoading, refetch: propertiesRefetch, error: propertiesError } = useTorrentProperties(panelTorrentHash ?? '', {
    enabled: Boolean(panelTorrentHash && shellTab === 'overview'),
    getTorrentState,
  });

  const { trackers, isLoading: trackersLoading, refetch: trackersRefetch, error: trackersError } = useTorrentTrackers(panelTorrentHash ?? '', {
    enabled: Boolean(panelTorrentHash && shellTab === 'trackers'),
    getTorrentState,
  });

  const { files, isLoading: filesLoading, refetch: filesRefetch, error: filesError } = useTorrentFiles(panelTorrentHash ?? '', {
    enabled: Boolean(panelTorrentHash && shellTab === 'files'),
    getTorrentState,
  });

  // Debug logging for empty-files content tab bug
  useEffect(() => {
    if (!panelTorrentHash) return;
    if (filesError) {
      console.warn(
        `[DetailPanel] files error hash=${panelTorrentHash.slice(0, 8)}… ${filesError.message}`,
        filesError,
      );
    } else if (files !== undefined) {
      console.info(
        `[DetailPanel] files hash=${panelTorrentHash.slice(0, 8)}… count=${files.length} loading=${filesLoading}`,
      );
    }
  }, [panelTorrentHash, files, filesError, filesLoading]);

  const { peers, isLoading: peersLoading, refetch: peersRefetch, error: peersError } = useTorrentPeers(panelTorrentHash ?? '', {
    enabled: Boolean(panelTorrentHash && shellTab === 'peers'),
  });

  const { webSeeds, isLoading: webSeedsLoading, refetch: webSeedsRefetch, error: webSeedsError } = useTorrentWebSeeds(panelTorrentHash ?? '', {
    enabled: Boolean(panelTorrentHash && shellTab === 'httpSources'),
  });

  // ─── Torrent actions (desktop-specific, all operations available) ──────────
  const desktopActions = useTorrentActions();

  // ─── Session scope ─────────────────────────────────────────────────────────
  const { isConnected, serverId, sessionGeneration, capabilities } = useQBClient();
  const supportsWebSeedManagement = capabilities.supportsWebSeedManagement;

  // ─── Add trackers mutation ────────────────────────────────────────────────
  const addTrackerMutation = useMutation({
    mutationFn: (vars: { hash: string; urls: string }) =>
      BridgeAdapter.torrents.addTrackers(vars.hash, vars.urls),
    onSuccess: () => {
      // Refetch trackers so the desktop surface updates promptly
      void trackersRefetch();
    },
  });

  // ─── Ban peers mutation ────────────────────────────────────────────────────
  const banPeersMutation = useBanPeersWithPeerInvalidation({
    scope: { serverId, sessionGeneration, isConnected },
    mutationFn: (peers) => BridgeAdapter.transfer.banPeers(peers),
    hash: panelTorrentHash ?? '',
  });

  // ─── Add peers mutation ─────────────────────────────────────────────────────
  const addPeersMutation = useAddPeersWithPeerInvalidation({
    scope: { serverId, sessionGeneration, isConnected },
    mutationFn: (peers) => BridgeAdapter.torrents.addPeers([panelTorrentHash ?? ''], peers),
    hash: panelTorrentHash ?? '',
  });

  // ─── Edit tracker mutation ────────────────────────────────────────────────
  const editTrackerMutation = useMutation({
    mutationFn: (vars: { hash: string; origUrl: string; newUrl: string }) =>
      BridgeAdapter.torrents.editTracker(vars.hash, vars.origUrl, vars.newUrl),
    onSuccess: () => { void trackersRefetch(); },
  });

  // ─── Remove tracker mutation ──────────────────────────────────────────────
  const removeTrackerMutation = useMutation({
    mutationFn: (vars: { hash: string; urls: string }) =>
      BridgeAdapter.torrents.removeTrackers(vars.hash, vars.urls),
    onSuccess: () => { void trackersRefetch(); },
  });

  // ─── HTTP source mutations ───────────────────────────────────────────────
  const addHttpSourcesMutation = useMutation({
    mutationFn: (vars: { hash: string; urls: string }) =>
      BridgeAdapter.torrents.addWebSeeds(vars.hash, vars.urls),
    onSuccess: () => { void webSeedsRefetch(); },
  });

  const editHttpSourceMutation = useMutation({
    mutationFn: (vars: { hash: string; origUrl: string; newUrl: string }) =>
      BridgeAdapter.torrents.editWebSeed(vars.hash, vars.origUrl, vars.newUrl),
    onSuccess: () => { void webSeedsRefetch(); },
  });

  const removeHttpSourceMutation = useMutation({
    mutationFn: (vars: { hash: string; urls: string }) =>
      BridgeAdapter.torrents.removeWebSeeds(vars.hash, vars.urls),
    onSuccess: () => { void webSeedsRefetch(); },
  });

  // ─── Set file priority mutation ───────────────────────────────────────────
  const setFilePriorityMutation = useMutation({
    mutationFn: (vars: { hash: string; ids: number[]; priority: number }) =>
      BridgeAdapter.torrents.setFilePriority(vars.hash, vars.ids, vars.priority),
    onSuccess: () => { void filesRefetch(); },
  });

  // ─── Tracker context menu handlers ────────────────────────────────────────
  const [editingTracker, setEditingTracker] = useState<Tracker | null>(null);
  const [editTrackerUrl, setEditTrackerUrl] = useState('');

  const handleEditTracker = useCallback((tracker: Tracker) => {
    setEditingTracker(tracker);
    setEditTrackerUrl(tracker.url);
  }, []);

  const handleEditTrackerSubmit = useCallback(() => {
    if (!editingTracker || !panelTorrentHash || !editTrackerUrl.trim()) return;
    void editTrackerMutation.mutateAsync({
      hash: panelTorrentHash,
      origUrl: editingTracker.url,
      newUrl: editTrackerUrl.trim(),
    });
    setEditingTracker(null);
    setEditTrackerUrl('');
  }, [editingTracker, panelTorrentHash, editTrackerUrl, editTrackerMutation]);

  const handleRemoveTracker = useCallback((tracker: Tracker) => {
    if (!panelTorrentHash) return;
    void removeTrackerMutation.mutateAsync({
      hash: panelTorrentHash,
      urls: tracker.url,
    }).catch((err) => { toast.error(formatUserMessageForContext(err, 'torrent-action')); });
  }, [panelTorrentHash, removeTrackerMutation]);

  const handleCopyTrackerUrl = useCallback((tracker: Tracker) => {
    void navigator.clipboard.writeText(tracker.url);
  }, []);

  // ─── Peer context menu handlers ───────────────────────────────────────────
  const handleCopyPeerAddress = useCallback((peer: PeerRow) => {
    void navigator.clipboard.writeText(`${peer.ip}:${peer.port}`);
  }, []);

  const handleCopyHttpSourceUrl = useCallback((seed: { url: string }) => {
    void navigator.clipboard.writeText(seed.url);
  }, []);

  // ─── HTTP source context menu handlers ───────────────────────────────────
  const [showAddHttpSources, setShowAddHttpSources] = useState(false);
  const [newHttpSourceUrls, setNewHttpSourceUrls] = useState('');
  const [editingHttpSource, setEditingHttpSource] = useState<WebSeed | null>(null);
  const [editHttpSourceUrl, setEditHttpSourceUrl] = useState('');

  const closeAddHttpSources = useCallback(() => {
    setShowAddHttpSources(false);
    setNewHttpSourceUrls('');
  }, []);

  const toggleAddHttpSources = useCallback(() => {
    setShowAddHttpSources((value) => !value);
    setEditingHttpSource(null);
  }, []);

  const handleAddHttpSourcesSubmit = useCallback(() => {
    const urls = normalizeHttpSourceUrls(newHttpSourceUrls);
    if (!panelTorrentHash || !urls) return;
    void addHttpSourcesMutation.mutateAsync({
      hash: panelTorrentHash,
      urls,
    }).then(() => {
      closeAddHttpSources();
    }).catch((err) => {
      toast.error(formatUserMessageForContext(err, 'torrent-action'), {
        dedupeKey: 'desktop-detail-panel:add-http-sources',
      });
    });
  }, [addHttpSourcesMutation, closeAddHttpSources, newHttpSourceUrls, panelTorrentHash]);

  const handleEditHttpSource = useCallback((seed: WebSeed) => {
    setEditingHttpSource(seed);
    setEditHttpSourceUrl(seed.url);
    setShowAddHttpSources(false);
  }, []);

  const handleEditHttpSourceSubmit = useCallback(() => {
    if (!editingHttpSource || !panelTorrentHash || !editHttpSourceUrl.trim()) return;
    void editHttpSourceMutation.mutateAsync({
      hash: panelTorrentHash,
      origUrl: editingHttpSource.url,
      newUrl: editHttpSourceUrl.trim(),
    }).then(() => {
      setEditingHttpSource(null);
      setEditHttpSourceUrl('');
    }).catch((err) => {
      toast.error(formatUserMessageForContext(err, 'torrent-action'), {
        dedupeKey: 'desktop-detail-panel:edit-http-source',
      });
    });
  }, [editHttpSourceMutation, editHttpSourceUrl, editingHttpSource, panelTorrentHash]);

  const handleRemoveHttpSource = useCallback((seed: WebSeed) => {
    if (!panelTorrentHash) return;
    void removeHttpSourceMutation.mutateAsync({
      hash: panelTorrentHash,
      urls: seed.url,
    }).catch((err) => {
      toast.error(formatUserMessageForContext(err, 'torrent-action'), {
        dedupeKey: 'desktop-detail-panel:remove-http-source',
      });
    });
  }, [panelTorrentHash, removeHttpSourceMutation]);

  // ─── File toggle/priority handlers ────────────────────────────────────────
  const handleFileToggle = useCallback((fileIndex: number, enabled: boolean) => {
    if (!panelTorrentHash) return;
    void setFilePriorityMutation.mutateAsync({
      hash: panelTorrentHash,
      ids: [fileIndex],
      priority: enabled ? 1 : 0,
    }).catch((err) => {
      toast.error(formatUserMessageForContext(err, 'torrent-action'), {
        dedupeKey: 'desktop-detail-panel:file-priority',
      });
    });
  }, [panelTorrentHash, setFilePriorityMutation]);

  const handleToggleAllFiles = useCallback((enabled: boolean) => {
    if (!panelTorrentHash || !files) return;
    const ids = files.map((f) => f.index);
    void setFilePriorityMutation.mutateAsync({
      hash: panelTorrentHash,
      ids,
      priority: enabled ? 1 : 0,
    });
  }, [panelTorrentHash, files, setFilePriorityMutation]);

  const handleFilePriorityChange = useCallback((file: TorrentFile) => {
    if (!panelTorrentHash) return;
    void setFilePriorityMutation.mutateAsync({
      hash: panelTorrentHash,
      ids: [file.index],
      priority: file.priority,
    });
  }, [panelTorrentHash, setFilePriorityMutation]);

  // ─── Build controller ─────────────────────────────────────────────────────
  // Derive displayStatus from torrent state
  const displayStatus = useMemo(() => {
    if (!torrent) return null;
    const state = torrent.state?.toLowerCase() ?? '';
    if (state.includes('paused') || state.includes('stopped')) return 'paused';
    if (state.includes('seeding')) return 'seeding';
    if (state.includes('checking')) return 'checking';
    if (state.includes('moving')) return 'moving';
    if (state.includes('queued')) return 'queued';
    if (state.includes('error')) return 'error';
    return 'downloading';
  }, [torrent]);

  const controller = useTorrentDetailController({
    hash: panelTorrentHash ?? '',
    torrent: torrent ?? null,
    files: files ?? null,
    displayStatus,
    actions: {
      pause: desktopActions.pause,
      resume: desktopActions.resume,
      delete: desktopActions.remove,
      recheck: desktopActions.recheck,
      reannounce: desktopActions.reannounce,
      setForceStart: desktopActions.forceStart,
      setDownloadLimit: desktopActions.setDownloadLimit,
      setUploadLimit: desktopActions.setUploadLimit,
      setFilePriority: desktopActions.setFilePriority,
      rename: desktopActions.setName,
      relocate: desktopActions.setLocation,
      increasePriority: desktopActions.increasePriority,
      decreasePriority: desktopActions.decreasePriority,
    },
    addTrackerMutation,
    banPeersMutation: {
      isPending: banPeersMutation.isPending,
      mutateAsync: banPeersMutation.mutateAsync,
    },
    addPeersMutation: {
      isPending: addPeersMutation.isPending,
      mutateAsync: addPeersMutation.mutateAsync,
    },
    onNavigateBack: () => {
      setPanelTorrentHash(null);
      setPropertiesPaneVisible(false);
    },
  });

  // ─── Window-based dialogs (replacing inline modals) ─────────────────────────

  // Rename dialog - opens window when controller requests dialog
  // Note: controller's handleRename is NOT called since window handles mutation directly
  useEffect(() => {
    if (!controller.showRenameDialog || !panelTorrentHash) return;
    void openTorrentTextDialogWindow({
      type: 'rename',
      value: controller.renameValue,
      hashes: [panelTorrentHash],
    });
  }, [controller.showRenameDialog, panelTorrentHash, controller.renameValue]);

  // Relocate dialog
  useEffect(() => {
    if (!controller.showRelocateDialog || !panelTorrentHash) return;
    void openTorrentTextDialogWindow({
      type: 'setLocation',
      value: controller.relocateValue,
      hashes: [panelTorrentHash],
    });
  }, [controller.showRelocateDialog, panelTorrentHash, controller.relocateValue]);

  // Speed limit dialog
  useEffect(() => {
    if (!controller.speedLimitModal || !panelTorrentHash) return;
    const { type, currentValue } = controller.speedLimitModal;
    void openTorrentNumericDialogWindow({
      type,
      value: currentValue,
      hashes: [panelTorrentHash],
    });
  }, [controller.speedLimitModal, panelTorrentHash]);

  // Delete dialog
  useEffect(() => {
    if (!controller.showDeleteDialog || !panelTorrentHash) return;
    void openTorrentDeleteDialogWindow({
      hashes: [panelTorrentHash],
      count: 1,
    });
  }, [controller.showDeleteDialog, panelTorrentHash]);

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (!panelTorrentHash || !torrent) {
    return (
      <aside
        ref={panelRef}
        className="relative flex h-full min-h-0 w-full shrink-0 border-t border-border bg-surface"
      >
        <button
          type="button"
          aria-label="Resize properties pane"
          aria-orientation="horizontal"
          aria-valuemin={MIN_PANEL_HEIGHT}
          aria-valuemax={MAX_PANEL_HEIGHT}
          aria-valuenow={propertiesPaneHeight}
          className="absolute inset-x-0 top-0 z-10 h-2 cursor-row-resize bg-transparent transition-colors hover:bg-primary/30 after:absolute after:inset-x-0 after:top-1 after:h-px after:bg-border/60"
          onMouseDown={handleResizeStart}
        />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-muted">Properties</p>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center text-xs text-text-secondary">
            Select a torrent to view details
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      ref={panelRef}
      className="relative flex h-full min-h-0 w-full shrink-0 border-t border-border bg-surface"
    >
      {/* Top resize handle */}
      <button
        type="button"
        aria-label="Resize properties pane"
        aria-orientation="horizontal"
        aria-valuemin={MIN_PANEL_HEIGHT}
        aria-valuemax={MAX_PANEL_HEIGHT}
        aria-valuenow={propertiesPaneHeight}
        className="absolute inset-x-0 top-0 z-10 h-2 cursor-row-resize bg-transparent transition-colors hover:bg-primary/30 after:absolute after:inset-x-0 after:top-1 after:h-px after:bg-border/60"
        onMouseDown={handleResizeStart}
      />

      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-1">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xs font-semibold text-text-primary" title={torrent.name}>{torrent.name}</h2>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-sm border border-border text-text-secondary transition-colors enabled:hover:bg-surface-interactive enabled:hover:text-text-primary disabled:text-text-disabled"
            aria-label="Close properties pane"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <TabBar
          variant="underline"
          tabs={TABS}
          activeTab={shellTab}
          onTabChange={handleTabChange as (id: string) => void}
        />

        {/* Tab content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-auto p-2 pb-1">
          {shellTab === 'overview' && (
            <TorrentDetailsOverviewSection
              variant="desktop"
              torrent={torrent}
              properties={properties ?? null}
              isLoading={propertiesLoading}
              error={propertiesError}
              onRetry={propertiesRefetch}
            />
          )}
          {shellTab === 'trackers' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {/* Tracker add UI */}
              {controller.showAddTracker ? (
                <div className="flex items-center gap-2 rounded-sm border border-border bg-surface p-2">
                  <Input
                    type="text"
                    value={controller.newTrackerUrl}
                    onChange={controller.setNewTrackerUrl}
                    onKeyDown={(e) => { if (e.key === 'Enter') { controller.handleAddTrackerSubmit(); } }}
                    placeholder="https://tracker.example.com/announce"
                    className="min-w-0 flex-1"
                    disabled={controller.addTrackerIsPending}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={controller.handleAddTrackerSubmit}
                    disabled={controller.addTrackerIsPending || !controller.newTrackerUrl.trim()}
                    className="shrink-0 rounded-sm border border-primary bg-primary px-2 py-1 text-xs font-medium text-text-on-primary transition-colors enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={controller.closeAddTracker}
                    disabled={controller.addTrackerIsPending}
                    className="shrink-0 rounded-sm border border-border px-2 py-1 text-xs font-medium text-text-secondary transition-colors enabled:hover:bg-surface-interactive disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}

              {/* Edit tracker dialog */}
              {editingTracker && (
                <div className="flex items-center gap-2 rounded-sm border border-border bg-surface p-2">
                  <span className="text-xs text-text-secondary shrink-0">Edit:</span>
                  <Input
                    type="text"
                    value={editTrackerUrl}
                    onChange={setEditTrackerUrl}
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleEditTrackerSubmit(); } }}
                    className="min-w-0 flex-1"
                    disabled={editTrackerMutation.isPending}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={handleEditTrackerSubmit}
                    disabled={editTrackerMutation.isPending || !editTrackerUrl.trim()}
                    className="shrink-0 rounded-sm border border-primary bg-primary px-2 py-1 text-xs font-medium text-text-on-primary transition-colors enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingTracker(null); }}
                    disabled={editTrackerMutation.isPending}
                    className="shrink-0 rounded-sm border border-border px-2 py-1 text-xs font-medium text-text-secondary transition-colors enabled:hover:bg-surface-interactive disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <TorrentDetailsTrackersSection
                variant="desktop"
                trackers={trackers}
                isLoading={trackersLoading}
                error={trackersError}
                onRetry={trackersRefetch}
                onAddTrackers={controller.toggleAddTracker}
                onEditTracker={handleEditTracker}
                onRemoveTracker={handleRemoveTracker}
                onCopyTrackerUrl={handleCopyTrackerUrl}
              />
            </div>
          )}
          {shellTab === 'peers' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <PeersTabCoordinator
                paneOpen={Boolean(panelTorrentHash)}
                activeTab={shellTab}
                peersRefetch={peersRefetch}
                selectedTorrentHash={panelTorrentHash}
              />
              {/* Peer add UI */}
              {controller.showAddPeers ? (
                <div className="flex items-center gap-2 rounded-sm border border-border bg-surface p-2">
                  <Input
                    type="text"
                    value={controller.newPeers}
                    onChange={controller.setNewPeers}
                    onKeyDown={(e) => { if (e.key === 'Enter') { controller.handleAddPeersSubmit(); } }}
                    placeholder="host:port, host:port (e.g. 1.2.3.4:6881)"
                    className="min-w-0 flex-1"
                    disabled={controller.addPeersIsPending}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={controller.handleAddPeersSubmit}
                    disabled={controller.addPeersIsPending || !controller.newPeers.trim()}
                    className="shrink-0 rounded-sm border border-primary bg-primary px-2 py-1 text-xs font-medium text-text-on-primary transition-colors enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={controller.closeAddPeers}
                    disabled={controller.addPeersIsPending}
                    className="shrink-0 rounded-sm border border-border px-2 py-1 text-xs font-medium text-text-secondary transition-colors enabled:hover:bg-surface-interactive disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              <TorrentDetailsPeersSection
                variant="desktop"
                peers={peers as PeerRow[] | undefined}
                isLoading={peersLoading}
                error={peersError}
                onRetry={peersRefetch}
                onBanPeer={controller.handleBanPeer}
                onAddPeers={controller.toggleAddPeers}
                onCopyPeerAddress={handleCopyPeerAddress}
                banPeerIsPending={controller.banPeersIsPending}
              />
            </div>
          )}
          {shellTab === 'httpSources' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {showAddHttpSources ? (
                <div className="flex items-center gap-2 rounded-sm border border-border bg-surface p-2">
                  <Input
                    type="text"
                    value={newHttpSourceUrls}
                    onChange={setNewHttpSourceUrls}
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleAddHttpSourcesSubmit(); } }}
                    placeholder="https://example.com/file, https://mirror.example.com/file"
                    className="min-w-0 flex-1"
                    disabled={addHttpSourcesMutation.isPending}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddHttpSourcesSubmit}
                    disabled={addHttpSourcesMutation.isPending || !newHttpSourceUrls.trim()}
                    className="shrink-0 rounded-sm border border-primary bg-primary px-2 py-1 text-xs font-medium text-text-on-primary transition-colors enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={closeAddHttpSources}
                    disabled={addHttpSourcesMutation.isPending}
                    className="shrink-0 rounded-sm border border-border px-2 py-1 text-xs font-medium text-text-secondary transition-colors enabled:hover:bg-surface-interactive disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}

              {editingHttpSource ? (
                <div className="flex items-center gap-2 rounded-sm border border-border bg-surface p-2">
                  <span className="text-xs text-text-secondary shrink-0">Edit:</span>
                  <Input
                    type="text"
                    value={editHttpSourceUrl}
                    onChange={setEditHttpSourceUrl}
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleEditHttpSourceSubmit(); } }}
                    className="min-w-0 flex-1"
                    disabled={editHttpSourceMutation.isPending}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={handleEditHttpSourceSubmit}
                    disabled={editHttpSourceMutation.isPending || !editHttpSourceUrl.trim()}
                    className="shrink-0 rounded-sm border border-primary bg-primary px-2 py-1 text-xs font-medium text-text-on-primary transition-colors enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingHttpSource(null); setEditHttpSourceUrl(''); }}
                    disabled={editHttpSourceMutation.isPending}
                    className="shrink-0 rounded-sm border border-border px-2 py-1 text-xs font-medium text-text-secondary transition-colors enabled:hover:bg-surface-interactive disabled:cursor-not-allowed disabled:text-text-disabled disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}

              <TorrentDetailsHttpSourcesSection
                variant="desktop"
                webSeeds={webSeeds}
                isLoading={webSeedsLoading}
                error={webSeedsError}
                onRetry={webSeedsRefetch}
                onAddHttpSources={supportsWebSeedManagement ? toggleAddHttpSources : undefined}
                onEditHttpSource={supportsWebSeedManagement ? handleEditHttpSource : undefined}
                onRemoveHttpSource={supportsWebSeedManagement ? handleRemoveHttpSource : undefined}
                onCopyHttpSourceUrl={handleCopyHttpSourceUrl}
                removeHttpSourceIsPending={removeHttpSourceMutation.isPending}
              />
            </div>
          )}
          {shellTab === 'files' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {/* File preview controls */}
              {files && files.length > 50 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">
                    Showing {controller.visibleFiles.length} of {files.length} files
                  </span>
                  <button
                    type="button"
                    onClick={() => { controller.setShowAllFiles(!controller.showAllFiles); }}
                    className="text-xs text-primary enabled:hover:text-primary/80"
                  >
                    {controller.showAllFiles ? 'Show less' : 'Show all'}
                  </button>
                </div>
              )}
              <DesktopTorrentDetailsFilesSection
                variant="desktop"
                files={controller.visibleFiles}
                isLoading={filesLoading}
                error={filesError}
                onRetry={filesRefetch}
                onFilePriority={handleFilePriorityChange}
                onFileToggle={handleFileToggle}
                onToggleAll={handleToggleAllFiles}
                contentPath={torrent.content_path}
                totalFileCount={files?.length ?? 0}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
