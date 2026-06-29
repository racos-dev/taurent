// Mobile TorrentDetailScreen route — thin shell / container glue.
//
// Owns: route param parsing, navigation glue, mutation/hook wiring.
// Moved to shared: tab state, file sorting, dialog state, action handlers,
// tracker-add flow, and all presentational body.
import { useNavigate, useParams } from 'react-router-dom';
import { useCallback } from 'react';
import { useTorrentDetailMutations } from '../hooks';
import { useTorrentActions } from '../hooks/useTorrentActions';
import {
  useTorrentFiles,
  useTorrentProperties,
  useTorrentTrackers,
  useTorrentPeers,
} from '../hooks/useTorrentDetails';
import { useTorrents } from '../hooks';
import { useMaindataState } from '../connection';
import { useTorrentDetailController } from '@taurent/web-core/screens';
import { TorrentDetailScreenBody } from '@taurent/web-ui';
import { StateCard, ScreenHeader, Button } from '@taurent/web-ui';
import { getTorrentDisplayStatus, getStatusColorClass } from '@taurent/shared/utils/torrentStatus';
import {
  mobileCenteredStateClassName,
  mobileScreenContentClassName,
  mobileScreenRootClassName,
} from '../ui/mobileScreenLayout';

export function TorrentDetailScreen() {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const { torrents, isLoading: torrentsLoading } = useTorrents();
  const { maindataState } = useMaindataState();
  const getTorrentState = useCallback(
    (h: string) => maindataState?.torrents?.[h]?.state,
    [maindataState],
  );
  const {
    pause,
    resume,
    delete: deleteTorrents,
    recheck,
    reannounce,
    setForceStart,
    setDownloadLimit,
    setUploadLimit,
    setFilePriority,
    rename,
    relocate,
    increasePriority,
    decreasePriority,
  } = useTorrentActions();
  const { properties, isLoading: propertiesLoading, error: propertiesError, refetch: refetchProperties } = useTorrentProperties(hash || '', { getTorrentState });
  const { trackers, isLoading: trackersLoading, error: trackersError, refetch: refetchTrackers } = useTorrentTrackers(hash || '', { getTorrentState });
  const { files, isLoading: filesLoading, error: filesError, refetch: refetchFiles } = useTorrentFiles(hash || '', { getTorrentState });

  // QBClient is consumed inside useTorrentDetailMutations and useTorrentActions.
  const { addTrackerMutation, banPeersMutation } = useTorrentDetailMutations({
    hash: hash ?? '',
    onRefetchTrackers: () => {
      void refetchTrackers();
    },
  });

  const torrent = torrents.find((item) => item.hash === hash) ?? null;
  const displayStatus = torrent ? getTorrentDisplayStatus(torrent) : null;
  const statusBarClass = displayStatus ? getStatusColorClass(displayStatus, 'bar') : null;

  const controller = useTorrentDetailController({
    hash: hash ?? '',
    torrent,
    files: files ?? null,
    displayStatus,
    actions: {
      pause,
      resume,
      delete: deleteTorrents,
      recheck,
      reannounce,
      setForceStart,
      setDownloadLimit,
      setUploadLimit,
      setFilePriority,
      rename,
      relocate,
      increasePriority,
      decreasePriority,
    },
    addTrackerMutation,
    banPeersMutation: {
      isPending: banPeersMutation.isPending,
      mutateAsync: banPeersMutation.mutateAsync as (peers: string[]) => Promise<void>,
    },
    onNavigateBack: () => navigate('/', { replace: true }),
  });

  const { peers, isLoading: peersLoading, error: peersError, refetch: refetchPeers } = useTorrentPeers(hash || '', { enabled: controller.activeTab === 'peers' });

  if (!hash) {
    return (
      <div className={mobileScreenRootClassName()}>
        <div className={mobileCenteredStateClassName()}>
          <StateCard title="Invalid torrent" message="Open a torrent from the list to view its details." action={<Button variant="primary" onClick={() => navigate('/')}>Back to torrents</Button>} />
        </div>
      </div>
    );
  }

  if (torrentsLoading && !torrent) {
    return (
      <div className={mobileScreenRootClassName()}>
        <div className={mobileCenteredStateClassName()}>
          <StateCard title="Loading torrent" message="Fetching the latest torrent list and details." />
        </div>
      </div>
    );
  }

  if (!torrent || !displayStatus || !statusBarClass) {
    return (
      <div className={mobileScreenRootClassName()}>
        <ScreenHeader
          title="Torrent details"
          variant="mobile"
          onBack={() => navigate('/')}
        />
        <main className={mobileScreenContentClassName({ bottomSpacing: 'content', className: 'py-6' })}>
          <StateCard title="Torrent not found" message={`The torrent with hash ${hash} is not available in the current session.`} action={<Button variant="secondary" onClick={() => navigate('/')}>Back to torrents</Button>} />
        </main>
      </div>
    );
  }

  return (
    <div className={mobileScreenRootClassName({ bottomSpacing: 'content' })}>
      <ScreenHeader
        title="Torrent details"
        variant="mobile"
        onBack={() => navigate('/')}
      />

      <TorrentDetailScreenBody
        isMobile={true}
        torrent={torrent}
        properties={properties ?? null}
        files={files ?? null}
        trackers={trackers}
        peers={peers}
        statusBarClass={statusBarClass}
        propertiesLoading={propertiesLoading}
        propertiesError={propertiesError}
        trackersLoading={trackersLoading}
        trackersError={trackersError}
        filesLoading={filesLoading}
        filesError={filesError}
        peersLoading={peersLoading}
        peersError={peersError}
        refetchProperties={refetchProperties as () => void | Promise<void>}
        refetchTrackers={refetchTrackers as () => void | Promise<void>}
        refetchFiles={refetchFiles as () => void | Promise<void>}
        refetchPeers={refetchPeers as unknown as () => void | Promise<void>}
        activeTab={controller.activeTab}
        setActiveTab={controller.setActiveTab}
        visibleFiles={controller.visibleFiles}
        showAllFiles={controller.showAllFiles}
        setShowAllFiles={controller.setShowAllFiles}
        showDeleteDialog={controller.showDeleteDialog}
        speedLimitModal={controller.speedLimitModal}
        filePriorityDialog={controller.filePriorityDialog}
        showRenameDialog={controller.showRenameDialog}
        renameValue={controller.renameValue}
        showRelocateDialog={controller.showRelocateDialog}
        relocateValue={controller.relocateValue}
        showAddTracker={controller.showAddTracker}
        newTrackerUrl={controller.newTrackerUrl}
        setNewTrackerUrl={controller.setNewTrackerUrl}
        toggleAddTracker={controller.toggleAddTracker}
        handleAddTrackerSubmit={controller.handleAddTrackerSubmit}
        openDeleteDialog={controller.openDeleteDialog}
        closeDeleteDialog={controller.closeDeleteDialog}
        openRenameDialog={controller.openRenameDialog}
        closeRenameDialog={controller.closeRenameDialog}
        setRenameValue={controller.setRenameValue}
        openRelocateDialog={controller.openRelocateDialog}
        closeRelocateDialog={controller.closeRelocateDialog}
        setRelocateValue={controller.setRelocateValue}
        openSpeedLimitModal={controller.openSpeedLimitModal}
        closeSpeedLimitModal={controller.closeSpeedLimitModal}
        openFilePriorityDialog={controller.openFilePriorityDialog}
        openFilePriorityTarget={controller.openFilePriorityTarget}
        closeFilePriorityDialog={controller.closeFilePriorityDialog}
        isPaused={controller.isPaused}
        currentDownloadLimit={controller.currentDownloadLimit}
        currentUploadLimit={controller.currentUploadLimit}
        isActionPending={controller.isActionPending}
        deleteIsPending={deleteTorrents.isPending}
        pauseResumeIsPending={controller.pauseResumeIsPending}
        recheckIsPending={controller.recheckIsPending}
        reannounceIsPending={controller.reannounceIsPending}
        increasePriorityIsPending={controller.increasePriorityIsPending}
        decreasePriorityIsPending={controller.decreasePriorityIsPending}
        addTrackerIsPending={controller.addTrackerIsPending}
        banPeersIsPending={controller.banPeersIsPending}
        handlePauseResume={controller.handlePauseResume}
        handleRecheck={controller.handleRecheck}
        handleReannounce={controller.handleReannounce}
        handleForceStart={controller.handleForceStart}
        handleSpeedLimit={controller.handleSpeedLimit}
        handleFilePriority={controller.handleFilePriority}
        handleRename={controller.handleRename}
        handleRelocate={controller.handleRelocate}
        handleDelete={controller.handleDelete}
        handleIncreasePriority={controller.handleIncreasePriority}
        handleDecreasePriority={controller.handleDecreasePriority}
        handleBanPeer={controller.handleBanPeer}
      />
    </div>
  );
}
