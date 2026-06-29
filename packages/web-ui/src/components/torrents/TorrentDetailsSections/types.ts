// Types for torrent detail sections
export type {
  Torrent,
  TorrentProperties,
  Tracker,
  TorrentFile,
} from '@taurent/shared/types/qbittorrent';
import type {
  Torrent,
  TorrentProperties,
  Tracker,
  TorrentFile,
} from '@taurent/shared/types/qbittorrent';

// Peer data shape after transformation
export interface PeerRow {
  key: string;
  ip: string;
  port: number;
  client: string;
  progress: number;
  dl_speed: number;
  up_speed: number;
  downloaded: number;
  uploaded: number;
  connection: string;
  flags: string;
  flags_desc: string;
  relevance: number;
  files: string;
  country?: string;
  country_code?: string;
}

// Common props for loading/error states
export interface SectionStateProps {
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

// Overview section props
export interface TorrentDetailsOverviewSectionProps extends SectionStateProps {
  variant?: 'desktop' | 'mobile';
  torrent: Torrent;
  properties: TorrentProperties | null;
}

// Trackers section props
export interface TorrentDetailsTrackersSectionProps extends SectionStateProps {
  variant?: 'desktop' | 'mobile';
  trackers: Tracker[] | undefined;
  onAddTrackers?: () => void;
  onEditTracker?: (tracker: Tracker) => void;
  onRemoveTracker?: (tracker: Tracker) => void;
  onCopyTrackerUrl?: (tracker: Tracker) => void;
}

// Files section props
export interface TorrentDetailsFilesSectionProps extends SectionStateProps {
  variant?: 'desktop' | 'mobile';
  files: TorrentFile[] | undefined;
  onFilePriority?: (file: TorrentFile) => void;
  onFilePriorityTarget?: (target: FilePriorityTarget) => void;
  onFileToggle?: (fileIndex: number, enabled: boolean) => void;
  onToggleAll?: (enabled: boolean) => void;
  /** Desktop only: called when the user requests a context menu on a file row (not folders). */
  onFileContextMenu?: (event: React.MouseEvent<HTMLTableRowElement>, row: FileDisplayRow) => void;
  /**
   * Desktop only: called when the user requests a context menu on a folder row.
   * If provided, the caller is responsible for rendering and handling the menu.
   */
  onFolderContextMenu?: (event: React.MouseEvent<HTMLTableRowElement>, row: FileDisplayRow) => void;
  /**
   * Desktop only: called when the user clicks a folder row.
   * If provided, the caller is responsible for handling the click (e.g. opening the folder).
   * The internal expand/collapse is still driven by this component when this callback is absent.
   */
  onFolderRowClick?: (row: FileDisplayRow) => void;
}

export interface FileDisplayRow {
  key: string;
  path: string;
  depth: number;
  isFolder: boolean;
  node: FileTreeNode;
  file?: TorrentFile;
  stats: FolderStats;
}

export interface FilePriorityTarget {
  label: string;
  currentPriority: number;
  fileIds: number[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  file?: TorrentFile;
  children: FileTreeNode[];
}

export interface FolderStats {
  totalSize: number;
  progress: number;
  remaining: number;
  avgAvailability: number;
  allEnabled: boolean;
  someEnabled: boolean;
  fileCount: number;
  maxPriority: number;
}

// Peers section props
export interface TorrentDetailsPeersSectionProps extends SectionStateProps {
  variant?: 'desktop' | 'mobile';
  peers: PeerRow[] | undefined;
  onBanPeer?: (peerKey: string) => Promise<void>;
  onAddPeers?: () => void;
  onCopyPeerAddress?: (peer: PeerRow) => void;
  banPeerIsPending?: boolean;
}

// Web seeds / HTTP Sources section props
export interface TorrentDetailsHttpSourcesSectionProps extends SectionStateProps {
  variant?: 'desktop' | 'mobile';
  webSeeds: import('@taurent/shared/types/qbittorrent').WebSeed[] | undefined;
}

// Display status types for mobile
export type DisplayStatus =
  | 'downloading'
  | 'seeding'
  | 'paused'
  | 'completed'
  | 'error'
  | 'checking'
  | 'moving'
  | 'queued';
