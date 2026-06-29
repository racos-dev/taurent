import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQBClient, useMaindataSelector } from '../connection/QBClientProvider';
import { useServerManager } from '../connection/ServerManager';
import { useSelection } from '../hooks/useSelection';
import { useSortPreference } from '../hooks/useSortPreference';
import { useTorrentActions } from '../hooks/useTorrentActions';
import { useTorrents, useMobileHomeController, useSetPreferences, useToggleSpeedLimitsMode } from '../hooks';
import { useHomeScreenController } from '@taurent/web-core/screens';
import {
  buildPrimaryBatchActions,
  buildSecondaryBatchActions,
} from '@taurent/web-ui';
import { isTorrentFilterType } from '@taurent/shared';
import type { SortField } from '@taurent/shared';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { Icon } from '../ui/Icon';
import { RetryButton, StateCard, Button } from '@taurent/web-ui';
import { HomeScreenBody, SpeedLimitsModal } from '@taurent/web-ui';
import type { SortOption } from '@taurent/web-core/screens';
import { mobileCenteredStateClassName } from '../ui/mobileScreenLayout';

const SORT_OPTIONS: SortOption[] = [
  { value: 'added_on', label: 'Date Added', defaultOrder: 'desc' },
  { value: 'name', label: 'Name', defaultOrder: 'asc' },
  { value: 'size', label: 'Size', defaultOrder: 'desc' },
  { value: 'progress', label: 'Progress', defaultOrder: 'desc' },
  { value: 'dlspeed', label: 'Download Speed', defaultOrder: 'desc' },
  { value: 'upspeed', label: 'Upload Speed', defaultOrder: 'desc' },
  { value: 'ratio', label: 'Ratio', defaultOrder: 'desc' },
  { value: 'eta', label: 'ETA', defaultOrder: 'asc' },
];

export function HomeScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConnected, isConnecting, isHydrated, serverName, error, disconnect, retry } = useQBClient();
  const { servers } = useServerManager();

  // ── URL filter params ────────────────────────────────────────────────────────
  const rawFilter = searchParams.get('selectedFilter');
  const urlFilter = rawFilter && isTorrentFilterType(rawFilter) ? rawFilter : null;
  const urlCategory = searchParams.get('selectedCategory');
  const urlTag = searchParams.get('selectedTag');
  const urlTracker = searchParams.get('selectedTracker');

  // ── Search / sort state ──────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const { sortBy, sortOrder, setSortConfig } = useSortPreference();

  // ── Torrent data ─────────────────────────────────────────────────────────────
  const { torrents, isLoading } = useTorrents({
    filter: urlFilter || undefined,
    category: urlCategory !== '' ? urlCategory || undefined : '',
    tag: urlTag || undefined,
    tracker: urlTracker || undefined,
    search: searchInput || undefined,
    sort: sortBy,
    reverse: sortOrder === 'desc',
  });

  const torrentActions = useTorrentActions();

  // ── Selection ────────────────────────────────────────────────────────────────
  const {
    selectedItems: selectedHashes,
    selectionMode,
    toggleSelection,
    startSelection,
    clearSelection,
    toggleAllSelection,
    isAllSelected,
  } = useSelection();

  // ── Home controller ──────────────────────────────────────────────────────────
  const homeController = useHomeScreenController({
    selectedHashes,
    clearSelection,
    actions: torrentActions,
  });

  // ── Batch actions ────────────────────────────────────────────────────────────
  const primaryBatchActions = buildPrimaryBatchActions(
    torrentActions,
    homeController.selectedHashList,
    homeController.isBatchActionPending,
    homeController.openDeleteDialog
  );

  const secondaryBatchActions = buildSecondaryBatchActions(
    torrentActions,
    homeController.selectedHashList,
    homeController.isBatchActionPending,
    () => homeController.openSpeedLimitModal('download'),
    () => homeController.openSpeedLimitModal('upload'),
    homeController.openCategoryDialog,
    homeController.openTagsDialog
  );

  // ── Alt speed limits toggle ────────────────────────────────────────────────────
  const { toggleSpeedLimitsMode, isPending: isTogglingAltSpeed } = useToggleSpeedLimitsMode();
  const setPreferencesMutation = useSetPreferences();
  const useAltSpeeds = useMaindataSelector((s) => s.server_state?.use_alt_speed_limits ?? false);

  const handleToggleAltSpeed = useCallback(() => {
    const willBeEnabled = !useAltSpeeds;
    toggleSpeedLimitsMode()
      .then(() => {
        const message = willBeEnabled ? 'Alternative speed limits enabled' : 'Alternative speed limits disabled';
        toast.success(message, { description: 'Long press to edit limits' });
      })
      .catch((err) => {
        toast.error(formatUserMessageForContext(err, 'speed-limits'));
      });
  }, [toggleSpeedLimitsMode, useAltSpeeds]);

  // ── Categories / tags from sync state ─────────────────────────────────────────
  const categories = useMaindataSelector((s) => s.categories ?? null);
  const tags = useMaindataSelector((s) => s.tags ?? null);

  // ── Speed limits from server state ─────────────────────────────────────────
  const currentDlLimitBytes = useMaindataSelector((s) => s.server_state?.dl_rate_limit ?? 0);
  const currentUlLimitBytes = useMaindataSelector((s) => s.server_state?.up_rate_limit ?? 0);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showSpeedLimitsModal, setShowSpeedLimitsModal] = useState(false);

  // ── Mobile home controller (sort/summary shaping) ──────────────────────────
  const { resultCount, summaryItems } = useMobileHomeController({
    torrents,
    statusFilter: urlFilter,
    category: urlCategory,
    tag: urlTag,
    tracker: urlTracker,
    search: searchInput,
  });

  const filtersQuery = searchParams.toString();

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      await disconnect();
      navigate('/servers', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }, [disconnect, navigate]);

  const handleSwitchServer = useCallback(() => {
    navigate('/servers');
  }, [navigate]);

  const handleResetAll = useCallback(() => {
    setSearchInput('');
    setShowSearchBar(false);
    navigate('/', { replace: true });
  }, [navigate]);

  const handleToggleSearchBar = useCallback(() => {
    setShowSearchBar((v) => !v);
    setShowSortMenu(false);
  }, []);

  const handleToggleFabMenu = useCallback(() => {
    setShowFabMenu((value) => !value);
  }, []);

  const handleToggleSortMenu = useCallback(() => {
    setShowSortMenu((v) => !v);
  }, []);

  const handleSortChange = useCallback((field: SortField, order: 'asc' | 'desc') => {
    setSortConfig(field, order);
  }, [setSortConfig]);

  const handleOpenTorrentDetails = useCallback((hash: string) => {
    navigate(`/torrent/${hash}`);
  }, [navigate]);

  const handleOpenFilters = useCallback(() => {
    navigate(filtersQuery ? `/filters?${filtersQuery}` : '/filters');
  }, [filtersQuery, navigate]);

  const handleOpenSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const handleAddTorrent = useCallback((mode: 'file' | 'magnet') => {
    setShowFabMenu(false);
    navigate(`/add-torrent?mode=${mode}`);
  }, [navigate]);

  // ── Mobile long-press semantics — triggers selection start ───────────────────
  const handleTorrentLongPress = useCallback((hash: string) => {
    if (selectionMode) {
      toggleSelection(hash);
      return;
    }

    startSelection(hash);
  }, [selectionMode, startSelection, toggleSelection]);

  // ── Speed limits modal ───────────────────────────────────────────────────────
  const handleLongPressAltSpeed = useCallback(() => {
    setShowSpeedLimitsModal(true);
  }, []);

  const handleSetSpeedLimits = useCallback((dlBytes: number, ulBytes: number) => {
    const prefKey1 = useAltSpeeds ? 'alt_dl_limit' : 'dl_limit';
    const prefKey2 = useAltSpeeds ? 'alt_up_limit' : 'up_limit';

    setPreferencesMutation.setPreferences({
      [prefKey1]: dlBytes,
      [prefKey2]: ulBytes,
    })
      .then(() => {
        toast.success('Speed limits updated');
        setShowSpeedLimitsModal(false);
      })
      .catch((err) => {
        toast.error(formatUserMessageForContext(err, 'speed-limits'));
      });
  }, [setPreferencesMutation, useAltSpeeds]);

  // ── Error / loading early returns ───────────────────────────────────────────
  if (!isHydrated) {
    return (
      <div className={mobileCenteredStateClassName({ height: 'full' })}>
        <StateCard
          title="Initializing"
          message="Loading your app state."
          icon={<Icon name="layers" iconSize="xl" />}
        />
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className={mobileCenteredStateClassName({ height: 'full' })}>
        <StateCard
          title="Connecting"
          message="Reaching your qBittorrent server."
          icon={<Icon name="layers" iconSize="xl" />}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={mobileCenteredStateClassName({ height: 'full' })}>
        <StateCard
          title="Connection problem"
          message={formatUserMessageForContext(error, 'connection')}
          action={
            <>
              <RetryButton onClick={retry} />
              <Button variant="secondary" onClick={handleSwitchServer}>
                Switch Server
              </Button>
            </>
          }
          icon={<Icon name="layers" iconSize="xl" />}
        />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={mobileCenteredStateClassName({ height: 'full' })}>
        <StateCard
          title="Not connected"
          message="Choose a server to start managing torrents."
          action={
            <Button variant="primary" onClick={() => navigate('/servers')}>
              Go to Login
            </Button>
          }
          icon={<Icon name="layers" iconSize="xl" />}
        />
      </div>
    );
  }

  // ── Pass all data + handlers to platform-agnostic body ───────────────────────
  return (
    <><HomeScreenBody
      serverName={serverName}
      filter={urlFilter}
      category={urlCategory}
      tag={urlTag}
      tracker={urlTracker}
      selectedHashes={selectedHashes}
      selectionMode={selectionMode}
      isAllSelected={isAllSelected(torrents.length)}
      onToggleSelection={toggleSelection}
      onClearSelection={clearSelection}
      onToggleAllSelection={toggleAllSelection}
      allHashes={torrents.map((t) => t.hash)}
      searchInput={searchInput}
      onSearchInputChange={setSearchInput}
      showSearchBar={showSearchBar}
      onToggleSearchBar={handleToggleSearchBar}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortChange={handleSortChange}
      onResetAll={handleResetAll}
      sortOptions={SORT_OPTIONS}
      showSortMenu={showSortMenu}
      onToggleSortMenu={handleToggleSortMenu}
      showFabMenu={showFabMenu}
      onToggleFabMenu={handleToggleFabMenu}
      onOpenTorrentDetails={handleOpenTorrentDetails}
      onOpenFilters={handleOpenFilters}
      onOpenSettings={handleOpenSettings}
      onAddTorrent={handleAddTorrent}
      hasMultipleServers={servers.length > 1}
      onSwitchServer={handleSwitchServer}
      onLogout={handleLogout}
      isMobile={true}
      summaryItems={summaryItems}
      resultCount={resultCount}
      isLoading={isLoading}
      torrents={torrents}
      primaryBatchActions={primaryBatchActions}
      secondaryBatchActions={secondaryBatchActions}
      isBatchActionPending={homeController.isBatchActionPending}
      speedLimitModal={homeController.speedLimitModal}
      showDeleteDialog={homeController.showDeleteDialog}
      showCategoryDialog={homeController.showCategoryDialog}
      showTagsDialog={homeController.showTagsDialog}
      categories={categories}
      tags={tags}
      deleteIsPending={torrentActions.delete.isPending}
      setCategoryIsPending={torrentActions.setCategory?.isPending ?? false}
      addTagsIsPending={torrentActions.addTags?.isPending ?? false}
      removeTagsIsPending={torrentActions.removeTags?.isPending ?? false}
      onApplySpeedLimit={homeController.handleApplySpeedLimit}
      onCloseSpeedLimitModal={homeController.closeSpeedLimitModal}
      onDeleteSelection={homeController.handleDeleteSelection}
      onCloseDeleteDialog={homeController.closeDeleteDialog}
      onSetCategory={homeController.handleSetCategory}
      onCloseCategoryDialog={homeController.closeCategoryDialog}
      onAddTags={homeController.handleAddTags}
      onRemoveTags={homeController.handleRemoveTags}
      onCloseTagsDialog={homeController.closeTagsDialog}
      onTorrentLongPress={handleTorrentLongPress}
      onToggleAltSpeedLimits={handleToggleAltSpeed}
      onLongPressAltSpeedButton={handleLongPressAltSpeed}
      altSpeedActive={useAltSpeeds}
      isTogglingAltSpeed={isTogglingAltSpeed}
    />
      {showSpeedLimitsModal && (
        <SpeedLimitsModal
          downloadLimit={currentDlLimitBytes}
          uploadLimit={currentUlLimitBytes}
          onSubmit={handleSetSpeedLimits}
          onCancel={() => setShowSpeedLimitsModal(false)}
        />
      )}
    </>
  );
}
