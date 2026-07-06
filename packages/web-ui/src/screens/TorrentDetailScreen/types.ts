// Types for the platform-agnostic TorrentDetailScreen presentational component.
// All data and callbacks are passed as props — this module has no platform knowledge.

import type {
  Torrent,
  TorrentProperties,
  TorrentFile,
  WebSeed,
} from '@taurent/shared/types/qbittorrent';
import type { PeerRow } from '../../components/torrents/TorrentDetailsSections/types';
import type { FilePriorityTarget } from '../../components/torrents/TorrentDetailsSections/types';

// ─── Tab type ─────────────────────────────────────────────────────────────────

export type DetailTab = 'overview' | 'trackers' | 'peers' | 'files' | 'httpSources';

// ─── TorrentDetailScreenBody props ─────────────────────────────────────────────

export interface TorrentDetailScreenBodyProps {
  // ── Torrent / connection ───────────────────────────────────────────────
  torrent: Torrent | null;
  properties: TorrentProperties | null;
  files: TorrentFile[] | null;
  trackers: import('@taurent/shared/types/qbittorrent').Tracker[] | null | undefined;
  peers: PeerRow[] | null | undefined;
  webSeeds?: WebSeed[] | null | undefined;
  statusBarClass: string | null;
  /** When true, renders a TorrentItem card instead of the TorrentDetailHeader */
  isMobile?: boolean;

  // ── Loading / error states ────────────────────────────────────────────
  propertiesLoading: boolean;
  propertiesError: unknown;
  trackersLoading: boolean;
  trackersError: unknown;
  filesLoading: boolean;
  filesError: unknown;
  peersLoading: boolean;
  peersError: unknown;
  webSeedsLoading?: boolean;
  webSeedsError?: unknown;

  // ── Refetch callbacks ────────────────────────────────────────────────
  refetchProperties: () => unknown;
  refetchTrackers: () => unknown;
  refetchFiles: () => unknown;
  refetchPeers: () => unknown;
  refetchWebSeeds?: () => unknown;

  // ── Controller state ─────────────────────────────────────────────────
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;

  visibleFiles: TorrentFile[];
  showAllFiles: boolean;
  setShowAllFiles: (show: boolean) => void;

  // ── Dialog state ─────────────────────────────────────────────────────
  showDeleteDialog: boolean;
  speedLimitModal: { type: 'download' | 'upload'; currentValue: number } | null;
  filePriorityDialog: FilePriorityTarget | null;
  showRenameDialog: boolean;
  renameValue: string;
  showRelocateDialog: boolean;
  relocateValue: string;

  // ── Tracker add flow ─────────────────────────────────────────────────
  showAddTracker: boolean;
  newTrackerUrl: string;
  setNewTrackerUrl: (url: string) => void;
  toggleAddTracker: () => void;
  handleAddTrackerSubmit: () => void;

  // ── Dialog helpers ───────────────────────────────────────────────────
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  openRenameDialog: (currentName: string) => void;
  closeRenameDialog: () => void;
  setRenameValue: (value: string) => void;
  openRelocateDialog: (currentPath: string) => void;
  closeRelocateDialog: () => void;
  setRelocateValue: (value: string) => void;
  openSpeedLimitModal: (type: 'download' | 'upload', currentValue: number) => void;
  closeSpeedLimitModal: () => void;
  openFilePriorityDialog: (file: TorrentFile) => void;
  openFilePriorityTarget: (target: FilePriorityTarget) => void;
  closeFilePriorityDialog: () => void;

  // ── Derived values ───────────────────────────────────────────────────
  isPaused: boolean;
  currentDownloadLimit: number;
  currentUploadLimit: number;
  isActionPending: boolean;

  // ── Delete mutation (for dialog prop) ───────────────────────────────
  deleteIsPending: boolean;

  // ── Per-action pending state (for accurate action labels) ─────────────
  pauseResumeIsPending: boolean;
  recheckIsPending: boolean;
  reannounceIsPending: boolean;
  increasePriorityIsPending: boolean;
  decreasePriorityIsPending: boolean;
  addTrackerIsPending: boolean;
  banPeersIsPending: boolean;
  addHttpSourcesIsPending?: boolean;
  editHttpSourceIsPending?: boolean;
  removeHttpSourceIsPending?: boolean;
  supportsWebseedManagement?: boolean;

  // ── Action handlers ───────────────────────────────────────────────────
  handlePauseResume: () => Promise<void>;
  handleRecheck: () => Promise<void>;
  handleReannounce: () => Promise<void>;
  handleForceStart: (value: boolean) => Promise<void>;
  handleSpeedLimit: (type: 'download' | 'upload', limitBytes: number) => Promise<void>;
  handleFilePriority: (priority: number) => Promise<void>;
  handleRename: () => void;
  handleRelocate: () => void;
  handleDelete: (deleteFiles: boolean) => Promise<void>;
  handleIncreasePriority: () => Promise<void>;
  handleDecreasePriority: () => Promise<void>;
  handleBanPeer: (peerKey: string) => Promise<void>;
  handleAddHttpSources?: (urls: string) => Promise<void>;
  handleEditHttpSource?: (seed: WebSeed, newUrl: string) => Promise<void>;
  handleRemoveHttpSource?: (seed: WebSeed) => Promise<void>;
}
