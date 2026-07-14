import React from 'react';
import type { TorrentDetailScreenBodyProps, DetailTab } from './types';
import type { WebSeed } from '@taurent/shared/types/qbittorrent';
import {
  TorrentDetailHeader,
  ActionButton,
  ActionChip,
  TorrentActionsBar,
  Button,
  DeleteTorrentDialog,
  NumberInputModal,
  FilePriorityDialog,
  InputDialog,
  Pill,
  TabBar,
} from '@taurent/web-ui';
import {
  TorrentDetailsOverviewSection,
  TorrentDetailsTrackersSection,
  TorrentDetailsFilesSection,
  TorrentDetailsPeersSection,
  TorrentDetailsHttpSourcesSection,
} from '@taurent/web-ui';
import { Icon } from '@taurent/shared';
import { TorrentItem } from '../HomeScreen';

const FILE_PREVIEW_LIMIT = 50;

const TABS = (['overview', 'trackers', 'peers', 'files', 'httpSources'] as DetailTab[]).map((tab) => ({
  id: tab,
  label: tab === 'overview'
    ? 'Overview'
    : tab === 'httpSources'
      ? 'HTTP Sources'
      : tab.charAt(0).toUpperCase() + tab.slice(1),
}));

function normalizeHttpSourceUrls(value: string): string {
  return value
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean)
    .join('|');
}

export const TorrentDetailScreenBody = React.memo<TorrentDetailScreenBodyProps>(({
  torrent,
  properties,
  files,
  trackers,
  peers,
  webSeeds,
  statusBarClass,
  isMobile,
  propertiesLoading,
  propertiesError,
  trackersLoading,
  trackersError,
  filesLoading,
  filesError,
  peersLoading,
  peersError,
  webSeedsLoading = false,
  webSeedsError = null,
  refetchProperties,
  refetchTrackers,
  refetchFiles,
  refetchPeers,
  refetchWebSeeds,
  activeTab,
  setActiveTab,
  visibleFiles,
  showAllFiles,
  setShowAllFiles,
  showDeleteDialog,
  speedLimitModal,
  filePriorityDialog,
  showRenameDialog,
  renameValue,
  showRelocateDialog,
  relocateValue,
  showAddTracker,
  newTrackerUrl,
  setNewTrackerUrl,
  toggleAddTracker,
  handleAddTrackerSubmit,
  openDeleteDialog,
  closeDeleteDialog,
  openRenameDialog,
  closeRenameDialog,
  setRenameValue,
  openRelocateDialog,
  closeRelocateDialog,
  setRelocateValue,
  openSpeedLimitModal,
  closeSpeedLimitModal,
  openFilePriorityDialog,
  openFilePriorityTarget,
  closeFilePriorityDialog,
  isPaused,
  currentDownloadLimit,
  currentUploadLimit,
  isActionPending,
  deleteIsPending,
  pauseResumeIsPending,
  recheckIsPending,
  reannounceIsPending,
  increasePriorityIsPending,
  decreasePriorityIsPending,
  addTrackerIsPending,
  banPeersIsPending,
  addHttpSourcesIsPending = false,
  editHttpSourceIsPending = false,
  removeHttpSourceIsPending = false,
  supportsWebSeedManagement = false,
  handlePauseResume,
  handleRecheck,
  handleReannounce,
  handleForceStart,
  handleSpeedLimit,
  handleFilePriority,
  handleRename,
  handleRelocate,
  handleDelete,
  handleIncreasePriority,
  handleDecreasePriority,
  handleBanPeer,
  handleAddHttpSources,
  handleEditHttpSource,
  handleRemoveHttpSource,
}) => {
  const fileCount = files?.length ?? 0;
  const hasManyFiles = fileCount > FILE_PREVIEW_LIMIT;
  const webSeedCount = webSeeds?.length ?? 0;
  const [showAddHttpSources, setShowAddHttpSources] = React.useState(false);
  const [newHttpSourceUrls, setNewHttpSourceUrls] = React.useState('');
  const [editingHttpSource, setEditingHttpSource] = React.useState<WebSeed | null>(null);
  const [editHttpSourceUrl, setEditHttpSourceUrl] = React.useState('');

  const canManageHttpSources = supportsWebSeedManagement
    && Boolean(handleAddHttpSources && handleEditHttpSource && handleRemoveHttpSource);

  const submitHttpSources = React.useCallback(() => {
    if (!handleAddHttpSources) return;
    const urls = normalizeHttpSourceUrls(newHttpSourceUrls);
    if (!urls) return;
    void handleAddHttpSources(urls)
      .then(() => {
        setNewHttpSourceUrls('');
        setShowAddHttpSources(false);
      })
      .catch(() => undefined);
  }, [handleAddHttpSources, newHttpSourceUrls]);

  const submitHttpSourceEdit = React.useCallback(() => {
    if (!handleEditHttpSource || !editingHttpSource || !editHttpSourceUrl.trim()) return;
    void handleEditHttpSource(editingHttpSource, editHttpSourceUrl.trim())
      .then(() => {
        setEditingHttpSource(null);
        setEditHttpSourceUrl('');
      })
      .catch(() => undefined);
  }, [editHttpSourceUrl, editingHttpSource, handleEditHttpSource]);

  return (
    <div className="min-h-screen bg-background pb-6">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-3">
        {/* ── Header ────────────────────────────────────────────────────── */}
        {torrent && (
          isMobile ? (
            <TorrentItem
              torrent={torrent}
              isSelected={false}
              selectionMode={false}
              isStandalone={true}
              onPress={() => {}}
              onLongPress={() => {}}
            />
          ) : (
            <TorrentDetailHeader
              torrent={torrent}
              properties={properties ?? null}
              progressBarClass={statusBarClass ?? ''}
              renderBadges={(t) => (
                <>
                  {t.category ? <Pill>{t.category}</Pill> : null}
                  {t.tags
                    .split(',')
                    .map((tag: string) => tag.trim())
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((tag: string) => <Pill key={tag}>{tag}</Pill>)}
                </>
              )}
            />
          )
        )}

        {/* ── Actions bar ────────────────────────────────────────────────── */}
        {torrent ? (
          <TorrentActionsBar
            primaryActions={
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <ActionButton
                  icon={isPaused ? 'play' : 'pause'}
                  label={pauseResumeIsPending ? (isPaused ? 'Resuming...' : 'Pausing...') : isPaused ? 'Resume' : 'Pause'}
                  tone="primary"
                  onClick={() => void handlePauseResume()}
                  disabled={pauseResumeIsPending}
                />
                <ActionButton
                  icon="trash"
                  label={deleteIsPending ? 'Deleting...' : 'Delete'}
                  tone="danger"
                  onClick={openDeleteDialog}
                  disabled={isActionPending}
                />
              </div>
            }
            secondaryActions={
              <>
                <ActionChip
                  icon="zap"
                  label={torrent.force_start ? 'Force Start On' : 'Force Start'}
                  onClick={() => { void handleForceStart(!torrent.force_start); }}
                  disabled={isActionPending}
                  isActive={torrent.force_start}
                />
                <ActionChip
                  icon="refresh"
                  label={recheckIsPending ? 'Rechecking...' : 'Recheck'}
                  onClick={() => { void handleRecheck(); }}
                  disabled={recheckIsPending}
                />
                <ActionChip
                  icon="globe"
                  label={reannounceIsPending ? 'Announcing...' : 'Announce'}
                  onClick={() => { void handleReannounce(); }}
                  disabled={reannounceIsPending}
                />
                <ActionChip
                  icon="download"
                  label="DL Limit"
                  onClick={() => openSpeedLimitModal('download', currentDownloadLimit)}
                  disabled={isActionPending}
                />
                <ActionChip
                  icon="upload"
                  label="UL Limit"
                  onClick={() => openSpeedLimitModal('upload', currentUploadLimit)}
                  disabled={isActionPending}
                />
                <ActionChip
                  icon="file"
                  label="Rename"
                  onClick={() => { openRenameDialog(torrent.name); }}
                  disabled={isActionPending}
                />
                <ActionChip
                  icon="folder"
                  label="Relocate"
                  onClick={() => { openRelocateDialog(properties?.save_path || ''); }}
                  disabled={isActionPending}
                />
                <ActionChip
                  icon="chevron-up"
                  label={increasePriorityIsPending ? 'Moving...' : 'Queue Up'}
                  onClick={() => { void handleIncreasePriority(); }}
                  disabled={increasePriorityIsPending}
                />
                <ActionChip
                  icon="chevron-down"
                  label={decreasePriorityIsPending ? 'Moving...' : 'Queue Down'}
                  onClick={() => { void handleDecreasePriority(); }}
                  disabled={decreasePriorityIsPending}
                />
              </>
            }
          />
        ) : null}

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <TabBar
          variant="pill"
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as DetailTab)}
        />

        {/* ── Overview tab ───────────────────────────────────────────────── */}
        {activeTab === 'overview' && torrent ? (
          <TorrentDetailsOverviewSection
            variant="mobile"
            torrent={torrent}
            properties={properties ?? null}
            isLoading={propertiesLoading}
            error={propertiesError}
            onRetry={() => void refetchProperties()}
          />
        ) : null}

        {/* ── Trackers tab ───────────────────────────────────────────────── */}
        {activeTab === 'trackers' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Trackers</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {(trackers?.length || 0)} tracker{(trackers?.length || 0) === 1 ? '' : 's'} reporting for this torrent
                </p>
              </div>
              <div className="flex items-center gap-2">
                {trackers && trackers.length > 0 ? <Pill>{trackers.length}</Pill> : null}
                <Button
                  type="button"
                  variant={showAddTracker ? 'ghost' : 'outline'}
                  size="sm"
                  onClick={toggleAddTracker}
                >
                  {showAddTracker ? 'Cancel' : 'Add'}
                </Button>
              </div>
            </div>

            {showAddTracker ? (
              <div className="rounded-sm border border-border bg-surface p-3 space-y-2">
                <p className="text-xs text-text-secondary">Enter tracker URLs (one per line)</p>
                <textarea
                  value={newTrackerUrl}
                  onChange={(e) => setNewTrackerUrl(e.target.value)}
                  placeholder="https://tracker.example.com:443/announce"
                  rows={3}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none resize-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => { void handleAddTrackerSubmit(); }}
                  disabled={!newTrackerUrl.trim() || addTrackerIsPending}
                  className="w-full"
                >
                  <Icon name="plus" iconSize="md" />
                  {addTrackerIsPending ? 'Adding...' : 'Add Trackers'}
                </Button>
              </div>
            ) : null}

            <TorrentDetailsTrackersSection
              variant="mobile"
              trackers={trackers ?? undefined}
              isLoading={trackersLoading}
              error={trackersError}
              onRetry={() => void refetchTrackers()}
            />
          </div>
        ) : null}

        {/* ── Peers tab ──────────────────────────────────────────────────── */}
        {activeTab === 'peers' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Peers</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {(peers?.length || 0)} peer{(peers?.length || 0) === 1 ? '' : 's'} connected
                </p>
              </div>
              {peers && peers.length > 0 ? <Pill>{peers.length}</Pill> : null}
            </div>

            <TorrentDetailsPeersSection
              peers={peers ?? undefined}
              isLoading={peersLoading}
              error={peersError}
              onRetry={() => void refetchPeers()}
              onBanPeer={handleBanPeer}
              banPeerIsPending={banPeersIsPending}
            />
          </div>
        ) : null}

        {/* ── Files tab ──────────────────────────────────────────────────── */}
        {activeTab === 'files' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Files</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {fileCount} file{fileCount === 1 ? '' : 's'} in this torrent
                </p>
              </div>

              {hasManyFiles ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllFiles(!showAllFiles)}
                >
                  {showAllFiles ? 'Show fewer' : 'Show all'}
                </Button>
              ) : null}
            </div>

            {hasManyFiles && !showAllFiles ? (
              <div className="rounded-sm bg-surface-interactive px-3 py-2 text-xs text-text-secondary">
                Showing the first {FILE_PREVIEW_LIMIT} files, with incomplete files listed first.
              </div>
            ) : null}

            <TorrentDetailsFilesSection
              variant="mobile"
              files={visibleFiles}
              isLoading={filesLoading}
              error={filesError}
              onRetry={() => void refetchFiles()}
              onFilePriority={openFilePriorityDialog}
              onFilePriorityTarget={openFilePriorityTarget}
            />
          </div>
        ) : null}

        {/* ── HTTP Sources tab ─────────────────────────────────────────────── */}
        {activeTab === 'httpSources' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">HTTP Sources</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {webSeedCount} source{webSeedCount === 1 ? '' : 's'} configured
                </p>
              </div>
              <div className="flex items-center gap-2">
                {webSeedCount > 0 ? <Pill>{webSeedCount}</Pill> : null}
                {canManageHttpSources ? (
                  <Button
                    type="button"
                    variant={showAddHttpSources ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setShowAddHttpSources((value) => !value);
                      setEditingHttpSource(null);
                    }}
                  >
                    {showAddHttpSources ? 'Cancel' : 'Add'}
                  </Button>
                ) : null}
              </div>
            </div>

            {showAddHttpSources && canManageHttpSources ? (
              <div className="space-y-2 rounded-sm border border-border bg-surface p-3">
                <textarea
                  value={newHttpSourceUrls}
                  onChange={(event) => setNewHttpSourceUrls(event.target.value)}
                  placeholder="https://example.com/file"
                  rows={3}
                  className="w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={submitHttpSources}
                  disabled={!newHttpSourceUrls.trim() || addHttpSourcesIsPending}
                  className="w-full"
                >
                  <Icon name="plus" iconSize="md" />
                  {addHttpSourcesIsPending ? 'Adding...' : 'Add HTTP Sources'}
                </Button>
              </div>
            ) : null}

            {editingHttpSource && canManageHttpSources ? (
              <div className="space-y-2 rounded-sm border border-border bg-surface p-3">
                <textarea
                  value={editHttpSourceUrl}
                  onChange={(event) => setEditHttpSourceUrl(event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:ring-1 focus-visible:ring-border-focus focus-visible:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={submitHttpSourceEdit}
                    disabled={!editHttpSourceUrl.trim() || editHttpSourceIsPending}
                  >
                    {editHttpSourceIsPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setEditingHttpSource(null);
                      setEditHttpSourceUrl('');
                    }}
                    disabled={editHttpSourceIsPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            <TorrentDetailsHttpSourcesSection
              variant="mobile"
              webSeeds={webSeeds ?? undefined}
              isLoading={webSeedsLoading}
              error={webSeedsError}
              onRetry={refetchWebSeeds ? () => void refetchWebSeeds() : undefined}
              onEditHttpSource={canManageHttpSources ? (seed) => {
                setEditingHttpSource(seed);
                setEditHttpSourceUrl(seed.url);
                setShowAddHttpSources(false);
              } : undefined}
              onRemoveHttpSource={canManageHttpSources ? (seed) => {
                if (handleRemoveHttpSource) void handleRemoveHttpSource(seed).catch(() => undefined);
              } : undefined}
              removeHttpSourceIsPending={removeHttpSourceIsPending}
            />
          </div>
        ) : null}
      </main>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      {showDeleteDialog ? (
        <DeleteTorrentDialog
          onCancel={closeDeleteDialog}
          onDelete={(deleteFiles) => {
            void handleDelete(deleteFiles);
          }}
          isPending={deleteIsPending}
        />
      ) : null}

      {speedLimitModal ? (
        <NumberInputModal
          title={speedLimitModal.type === 'download' ? 'Download Limit' : 'Upload Limit'}
          currentValue={speedLimitModal.currentValue}
          unit="Use 0 for unlimited speed."
          unitMode="bytes-per-second"
          unitDefault="kb"
          onSubmit={(value) => { void handleSpeedLimit(speedLimitModal.type, value); }}
          onCancel={closeSpeedLimitModal}
        />
      ) : null}

      {filePriorityDialog ? (
        <FilePriorityDialog
          fileName={filePriorityDialog.label}
          currentPriority={filePriorityDialog.currentPriority}
          onSubmit={(priority) => { void handleFilePriority(priority); }}
          onCancel={closeFilePriorityDialog}
          isPending={isActionPending}
        />
      ) : null}

      {showRenameDialog ? (
        <InputDialog
          title="Rename Torrent"
          value={renameValue}
          onChange={setRenameValue}
          onSubmit={handleRename}
          onCancel={closeRenameDialog}
          isPending={isActionPending}
          submitLabel="Rename"
        />
      ) : null}

      {showRelocateDialog ? (
        <InputDialog
          title="Relocate Files"
          description="Enter the new save path for this torrent"
          value={relocateValue}
          onChange={setRelocateValue}
          onSubmit={handleRelocate}
          onCancel={closeRelocateDialog}
          isPending={isActionPending}
          submitLabel="Move"
          placeholder="/path/to/new/location"
        />
      ) : null}
    </div>
  );
});

TorrentDetailScreenBody.displayName = 'TorrentDetailScreenBody';
