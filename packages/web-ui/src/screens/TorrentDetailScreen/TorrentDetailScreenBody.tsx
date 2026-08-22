import React from 'react';
import type { TorrentDetailScreenBodyProps, DetailTab } from './types';
import type { WebSeed } from '@taurent/shared/types/qbittorrent';
import {
  TorrentDetailHeader,
  ActionButton,
  ActionChip,
  TorrentActionsBar,
  Button,
  CapabilityButton,
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
import { useTaurentTranslation } from '@taurent/shared/i18n';
import { TorrentItem } from '../HomeScreen';

const FILE_PREVIEW_LIMIT = 50;

const TAB_IDS = ['overview', 'trackers', 'peers', 'files', 'httpSources'] as const satisfies readonly DetailTab[];

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
  supportsWebseedManagement = false,
  supportsFileRenaming = false,
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
  const { t } = useTaurentTranslation('torrents');
  const { t: tCommon } = useTaurentTranslation('common');
  const tabs = React.useMemo(() => TAB_IDS.map((id) => ({
    id,
    label: t(`details.screen.${id}`),
  })), [t]);
  const fileCount = files?.length ?? 0;
  const hasManyFiles = fileCount > FILE_PREVIEW_LIMIT;
  const webSeedCount = webSeeds?.length ?? 0;
  const [showAddHttpSources, setShowAddHttpSources] = React.useState(false);
  const [newHttpSourceUrls, setNewHttpSourceUrls] = React.useState('');
  const [editingHttpSource, setEditingHttpSource] = React.useState<WebSeed | null>(null);
  const [editHttpSourceUrl, setEditHttpSourceUrl] = React.useState('');

  const canManageHttpSources = supportsWebseedManagement
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
                  label={pauseResumeIsPending
                    ? t(isPaused ? 'actions.resuming' : 'actions.pausing')
                    : t(isPaused ? 'actions.resume' : 'actions.pause')}
                  tone="primary"
                  onClick={() => void handlePauseResume()}
                  disabled={pauseResumeIsPending}
                />
                <ActionButton
                  icon="trash"
                  label={t(deleteIsPending ? 'actions.deleting' : 'actions.delete')}
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
                  label={t(torrent.force_start ? 'details.screen.forceStartOn' : 'actions.forceStart')}
                  onClick={() => { void handleForceStart(!torrent.force_start); }}
                  disabled={isActionPending}
                  isActive={torrent.force_start}
                />
                <ActionChip
                  icon="refresh"
                  label={t(recheckIsPending ? 'actions.rechecking' : 'actions.recheck')}
                  onClick={() => { void handleRecheck(); }}
                  disabled={recheckIsPending}
                />
                <ActionChip
                  icon="globe"
                  label={t(reannounceIsPending ? 'actions.announcing' : 'actions.announce')}
                  onClick={() => { void handleReannounce(); }}
                  disabled={reannounceIsPending}
                />
                <ActionChip
                  icon="download"
                  label={t('actions.downloadLimit')}
                  onClick={() => openSpeedLimitModal('download', currentDownloadLimit)}
                  disabled={isActionPending}
                />
                <ActionChip
                  icon="upload"
                  label={t('actions.uploadLimit')}
                  onClick={() => openSpeedLimitModal('upload', currentUploadLimit)}
                  disabled={isActionPending}
                />
                {supportsFileRenaming && (
                <ActionChip
                  icon="file"
                  label={t('details.screen.rename')}
                  onClick={() => { openRenameDialog(torrent.name); }}
                  disabled={isActionPending}
                />
                )}
                <ActionChip
                  icon="folder"
                  label={t('details.screen.relocate')}
                  onClick={() => { openRelocateDialog(properties?.save_path || ''); }}
                  disabled={isActionPending}
                />
                <ActionChip
                  icon="chevron-up"
                  label={t(increasePriorityIsPending ? 'actions.moving' : 'actions.queueUp')}
                  onClick={() => { void handleIncreasePriority(); }}
                  disabled={increasePriorityIsPending}
                />
                <ActionChip
                  icon="chevron-down"
                  label={t(decreasePriorityIsPending ? 'actions.moving' : 'actions.queueDown')}
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
          tabs={tabs}
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
                <h2 className="text-sm font-semibold text-text-primary">{t('details.screen.trackers')}</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('details.screen.trackerCount', { count: trackers?.length ?? 0 })}
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
                  {showAddTracker ? tCommon('actions.cancel') : tCommon('actions.add')}
                </Button>
              </div>
            </div>

            {showAddTracker ? (
              <div className="rounded-sm border border-border bg-surface p-3 space-y-2">
                <p className="text-xs text-text-secondary">{t('details.screen.trackerUrlsHelp')}</p>
                <textarea
                  value={newTrackerUrl}
                  onChange={(e) => setNewTrackerUrl(e.target.value)}
                  placeholder={
                    // i18n-audit-ignore: protocol URL example is intentionally verbatim
                    'https://tracker.example.com:443/announce'
                  }
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
                  {addTrackerIsPending ? t('details.screen.adding') : t('details.screen.addTrackers')}
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
                <h2 className="text-sm font-semibold text-text-primary">{t('details.screen.peers')}</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('details.screen.peerCount', { count: peers?.length ?? 0 })}
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
                <h2 className="text-sm font-semibold text-text-primary">{t('details.screen.files')}</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('details.screen.fileCount', { count: fileCount })}
                </p>
              </div>

              {hasManyFiles ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllFiles(!showAllFiles)}
                >
                  {t(showAllFiles ? 'details.screen.showFewer' : 'details.screen.showAll')}
                </Button>
              ) : null}
            </div>

            {hasManyFiles && !showAllFiles ? (
              <div className="rounded-sm bg-surface-interactive px-3 py-2 text-xs text-text-secondary">
                {t('details.screen.filePreview', { count: FILE_PREVIEW_LIMIT })}
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
                <h2 className="text-sm font-semibold text-text-primary">{t('details.screen.httpSources')}</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('details.screen.sourceCount', { count: webSeedCount })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {webSeedCount > 0 ? <Pill>{webSeedCount}</Pill> : null}
                {canManageHttpSources ? (
                  <CapabilityButton
                    type="button"
                    variant={showAddHttpSources ? 'ghost' : 'outline'}
                    size="sm"
                    enabled={canManageHttpSources}
                    onClick={() => {
                      setShowAddHttpSources((value) => !value);
                      setEditingHttpSource(null);
                    }}
                  >
                    {showAddHttpSources ? tCommon('actions.cancel') : tCommon('actions.add')}
                  </CapabilityButton>
                ) : null}
              </div>
            </div>

            {showAddHttpSources && canManageHttpSources ? (
              <div className="space-y-2 rounded-sm border border-border bg-surface p-3">
                <textarea
                  value={newHttpSourceUrls}
                  onChange={(event) => setNewHttpSourceUrls(event.target.value)}
                  placeholder={
                    // i18n-audit-ignore: protocol URL example is intentionally verbatim
                    'https://example.com/file'
                  }
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
                  {addHttpSourcesIsPending ? t('details.screen.adding') : t('details.screen.addHttpSources')}
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
                    {editHttpSourceIsPending ? t('details.screen.saving') : tCommon('actions.save')}
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
                    {tCommon('actions.cancel')}
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
          title={t(speedLimitModal.type === 'download' ? 'details.screen.downloadLimit' : 'details.screen.uploadLimit')}
          currentValue={speedLimitModal.currentValue}
          unit={t('details.screen.unlimitedSpeedHelp')}
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

      {supportsFileRenaming && showRenameDialog ? (
        <InputDialog
          title={t('details.screen.renameTitle')}
          value={renameValue}
          onChange={setRenameValue}
          onSubmit={handleRename}
          onCancel={closeRenameDialog}
          isPending={isActionPending}
          submitLabel={t('details.screen.rename')}
        />
      ) : null}

      {showRelocateDialog ? (
        <InputDialog
          title={t('details.screen.relocateTitle')}
          description={t('details.screen.relocateDescription')}
          value={relocateValue}
          onChange={setRelocateValue}
          onSubmit={handleRelocate}
          onCancel={closeRelocateDialog}
          isPending={isActionPending}
          submitLabel={t('details.screen.move')}
          placeholder={
            // i18n-audit-ignore: filesystem path example is intentionally verbatim
            '/path/to/new/location'
          }
        />
      ) : null}
    </div>
  );
});

TorrentDetailScreenBody.displayName = 'TorrentDetailScreenBody';
