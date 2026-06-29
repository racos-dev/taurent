import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQBClient, useMaindataSelector } from '../../connection';
import { useQueryClient } from '@tanstack/react-query';
import { useTorrentStore } from '@taurent/shared/stores';
import { useShellStore, DEFAULT_SIDEBAR_WIDTH } from '@/stores';
import { useShellPersistence } from '../../hooks/shell/useShellPersistence';
import { TorrentWorkspaceViewProvider } from '../../hooks';
import { useNativeMenuSync } from '../../hooks/shell/useNativeMenuSync';
import { useWindowDragAndDrop } from '../../hooks/platform/useDragAndDrop';
import { DragDropOverlay } from '../../components/DragDropOverlay';
import { ConnectedServerUnavailableOverlay } from './ConnectedServerUnavailableOverlay';
import { openAddTorrentWindow } from '@/windows/dialogs/addTorrentWindow';
import { MenuBar } from '../MenuBar';
import { MainToolbar } from '../../components/Toolbar/MainToolbar';
import { Sidebar } from '../Sidebar';
import { StatusBar } from '../StatusBar';
import { DetailPanel } from '../../components/DetailPanel';
import {
  buildTorrentsKey,
  buildCategoriesKey,
  buildTagsKey,
  buildSyncMaindataKey,
} from '@taurent/web-core/query';
import { WorkspaceFrame } from '@taurent/web-ui';

interface AppShellProps {
  children: ReactNode;
}

const MIN_SIDEBAR_WIDTH = 140;
const MAX_SIDEBAR_WIDTH = 500;
const ACCEPTED_TORRENT_EXTENSIONS = ['.torrent'];

export function AppShell({ children }: AppShellProps) {
  const { isConnected, isHydrated, serverId, sessionGeneration } = useQBClient();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setLoading = useTorrentStore((state) => state.setLoading);
  const setError = useTorrentStore((state) => state.setError);
  const setCategories = useTorrentStore((state) => state.setCategories);
  const setTags = useTorrentStore((state) => state.setTags);

  const prevServerIdRef = useRef<string | null>(null);
  const prevSessionGenRef = useRef<number>(0);

  // Track last mirrored refs to avoid redundant Zustand updates when the
  // underlying categories/tags references haven't changed.
  // mergeMaindata preserves sub-object references on each delta merge.
  const lastCategoriesRef = useRef<Record<string, unknown> | null>(null);
  const lastTagsRef = useRef<string[] | null>(null);

  // Keep a ref for isConnected so the effect doesn't re-run when isConnected
  // changes — we only care about connectivity transitions inside the effect.
  const isConnectedRef = useRef(false);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Subscribe to only the slices actually needed for mirroring, so other
  // maindata fields (torrents, trackers, etc.) no longer cause re-renders.
  const categories = useMaindataSelector((s) => s.categories);
  const tags = useMaindataSelector((s) => s.tags);

  useShellPersistence();

  const sidebarWidth = useShellStore((state) => state.sidebarWidth);
  const setSidebarWidth = useShellStore((state) => state.setSidebarWidth);
  const sidebarVisible = useShellStore((state) => state.sidebarVisible);

  const propertiesPaneVisible = useShellStore((state) => state.propertiesPaneVisible);
  const propertiesPaneHeight = useShellStore((state) => state.propertiesPaneHeight);
  const inWindowMenuBarVisible = useShellStore((state) => state.inWindowMenuBarVisible);
  const includeSortedHashes = location.pathname === '/';

  // Listen to native menu events and sync menu state to Rust
  useNativeMenuSync();

  const handleFileDrop = useCallback(async (filePaths: string[]) => {
    const torrentPaths = filePaths.filter((path) =>
      path.toLowerCase().endsWith('.torrent'),
    );

    if (torrentPaths.length === 0) {
      console.warn('Dropped files contain no .torrent files');
      return;
    }

    await openAddTorrentWindow({ files: JSON.stringify(torrentPaths) });
  }, []);

  const { isDragging } = useWindowDragAndDrop({
    acceptedTypes: ACCEPTED_TORRENT_EXTENSIONS,
    onDrop: handleFileDrop,
  });

  const handleSidebarResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebarWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent) => {
        const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth + ev.clientX - startX));
        setSidebarWidth(newWidth);
      };
      const onUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [sidebarWidth, setSidebarWidth],
  );

  // Clean up stale query cache entries when server changes or disconnects
  useEffect(() => {
    if (!isHydrated) return;

    const prevServerId = prevServerIdRef.current;
    const prevGen = prevSessionGenRef.current;

    if (!isConnected && prevServerId !== null) {
      queryClient.removeQueries({ queryKey: buildTorrentsKey(prevServerId, prevGen) });
      queryClient.removeQueries({ queryKey: buildCategoriesKey(prevServerId, prevGen) });
      queryClient.removeQueries({ queryKey: buildTagsKey(prevServerId, prevGen) });
      queryClient.removeQueries({ queryKey: buildSyncMaindataKey(prevServerId, prevGen) });
    }

    if (isConnected && prevServerId !== null && prevServerId !== serverId) {
      queryClient.removeQueries({ queryKey: buildTorrentsKey(prevServerId, prevGen) });
      queryClient.removeQueries({ queryKey: buildCategoriesKey(prevServerId, prevGen) });
      queryClient.removeQueries({ queryKey: buildTagsKey(prevServerId, prevGen) });
      queryClient.removeQueries({ queryKey: buildSyncMaindataKey(prevServerId, prevGen) });
    }

    prevServerIdRef.current = serverId;
    prevSessionGenRef.current = sessionGeneration;
  }, [isConnected, isHydrated, serverId, sessionGeneration, queryClient]);

  // Populate the Zustand store from the accumulated sync state.
  // maindataState is kept current by useMaindataSyncBackend (Rust live sync).
  // Only mirror categories/tags into Zustand. Torrents are consumed directly from
  // maindata via useLiveTorrentList / workspace controllers — no full-array Zustand
  // subscription needed.
  // Only mirror into Zustand when the underlying categories/tags reference
  // actually changed to avoid redundant store updates.
  useEffect(() => {
    if (!isConnectedRef.current || !isHydrated) {
      if (!isConnectedRef.current) {
        setCategories([]);
        setTags([]);
        setLoading(false);
        setError(null);
        // Reset tracked refs so next connect starts fresh
        lastCategoriesRef.current = null;
        lastTagsRef.current = null;
      }
      return;
    }

    // Only call setters when the reference changed.
    // mergeMaindata preserves sub-object references when nothing changed.
    const safeCategories = categories ?? {};
    if (safeCategories !== lastCategoriesRef.current) {
      lastCategoriesRef.current = safeCategories;
      setCategories(Object.values(safeCategories));
    }
    const safeTags = tags ?? [];
    if (safeTags !== lastTagsRef.current) {
      lastTagsRef.current = safeTags;
      setTags(safeTags);
    }

    setLoading(false);
    setError(null);
  }, [categories, tags, isHydrated, setCategories, setTags, setLoading, setError]);

  const header = (
    <>
      {inWindowMenuBarVisible && <MenuBar />}
      <MainToolbar />
    </>
  );

  const rail = sidebarVisible ? (
    <div className="flex h-full shrink-0">
      <div style={{ width: sidebarWidth }} className="shrink-0 overflow-y-auto border-r border-border">
        <Sidebar />
      </div>
      <button
        type="button"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary-20"
        onMouseDown={handleSidebarResizeStart}
        onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
      />
    </div>
  ) : undefined;

  const content = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
      {propertiesPaneVisible && (
        <div style={{ height: propertiesPaneHeight }} className="min-h-0 shrink-0">
          <DetailPanel />
        </div>
      )}
    </div>
  );

  return (
    <>
      <TorrentWorkspaceViewProvider key={sessionGeneration} includeSortedHashes={includeSortedHashes}>
        <WorkspaceFrame
          variant="desktop"
          header={header}
          rail={rail}
          content={content}
          footer={<StatusBar />}
        />
      </TorrentWorkspaceViewProvider>
      <DragDropOverlay
        isVisible={isDragging}
        onClose={() => {}}
      />
      <ConnectedServerUnavailableOverlay />
    </>
  );
}
