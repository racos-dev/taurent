// Bridge interfaces for future web support
// These define the contract that any platform bridge must implement

export type ResolveResult =
  | { kind: 'resolved'; localPath: string }
  | { kind: 'unmapped'; serverPath: string };

export interface AppUpdateInfo {
  currentVersion: string;
  version: string;
  date: string | null;
  body: string | null;
}

export type AppUpdateProgress =
  | { event: 'Started'; contentLength: number | null }
  | { event: 'Progress'; chunkLength: number; downloaded: number; contentLength: number | null }
  | { event: 'Finished'; downloaded: number; contentLength: number | null };

import { BridgeCapabilities } from './capabilities';

import type {
  SessionSnapshot,
  SessionStatus,
  OperationResponse,
  TorrentListResponse,
  TorrentListParams,
  TorrentPropertiesResponse,
  TorrentTrackersResponse,
  TorrentFilesResponse,
  AddTorrentOptions,
  PreferencesResponse,
  CategoriesResponse,
  TagsResponse,
  TransferInfoResponse,
  SpeedLimitsModeResponse,
  DownloadLimitResponse,
  UploadLimitResponse,
  DefaultSavePathResponse,
  SavedServerSummary,
  PathMapping,
  AddServerInput,
  UpdateServerInput,
  ServerCredentialsInput,
  TestConnectionResult,
  SyncTorrentPeers,
  RSSItemsResponse,
  RSSRulesResponse,
  RssRuleInput,
  TorrentWebseedsResponse,
  RustCapabilitiesResponse,
  MaindataSnapshotResponse,
  MaindataSyncHealth,
  WorkspaceView,
  WorkspaceViewRequest,
  SearchPlugin,
  SearchResults,
  SearchStatus,
} from '../types';

import type { Preferences } from '@taurent/shared';

// Root-level session/lifecycle contract — used by desktop and mobile bridges
// which expose these methods directly on the bridge root rather than under a `session` property.
export interface SessionLifecycleBridge {
  getSessionSnapshot(): Promise<SessionSnapshot>;
  sessionConnectById(serverId: string): Promise<number>;
  sessionDisconnect(): Promise<number>;
  sessionReconnect(): Promise<number>;
  sessionSwitchServer(
    serverId: string,
    serverName: string,
    serverUrl: string,
    serverUsername: string,
    serverPassword: string
  ): Promise<number>;
  /** Atomic saved-server switch: loads credentials inside the backend, authenticates the candidate, and
   *  commits the new session only on success. On failure the previous session remains intact. */
  sessionSwitchServerById(serverId: string): Promise<number>;
  sessionSetError(error: string): Promise<number>;
  sessionClearError(): Promise<number>;
  sessionSetConnecting(
    serverId: string,
    serverName: string,
    serverUrl: string,
    serverUsername: string,
    serverPassword: string
  ): Promise<number>;
  getSessionGeneration(): Promise<number>;
  getSessionStatus(): Promise<SessionStatus>;
  sessionHealthCheck?(): Promise<boolean>;
}

// Torrent bridge - common/base operations shared by desktop and mobile
export interface TorrentBridgeBase {
  getList(params?: TorrentListParams): Promise<TorrentListResponse>;
  pause(hashes: string[]): Promise<OperationResponse>;
  resume(hashes: string[]): Promise<OperationResponse>;
  delete(hashes: string[], deleteFiles: boolean): Promise<OperationResponse>;
  recheck(hashes: string[]): Promise<OperationResponse>;
  reannounce(hashes: string[]): Promise<OperationResponse>;
  setForceStart(hashes: string[], value: boolean): Promise<OperationResponse>;
  getProperties(hash: string): Promise<TorrentPropertiesResponse>;
  getTrackers(hash: string): Promise<TorrentTrackersResponse>;
  getFiles(hash: string): Promise<TorrentFilesResponse>;
  addTorrent(options: AddTorrentOptions): Promise<OperationResponse>;
  addTrackers(hash: string, urls: string): Promise<OperationResponse>;
  editTracker(hash: string, origUrl: string, newUrl: string): Promise<OperationResponse>;
  removeTrackers(hash: string, urls: string): Promise<OperationResponse>;
  getWebSeeds(hash: string): Promise<TorrentWebseedsResponse>;
}

// Desktop torrent bridge - desktop-specific operations extending base
export interface DesktopTorrentBridge extends TorrentBridgeBase {
  setCategory(hashes: string[], category: string): Promise<OperationResponse>;
  setName(hash: string, name: string): Promise<OperationResponse>;
  setLocation(hashes: string[], location: string): Promise<OperationResponse>;
  increasePriority(hashes: string[]): Promise<OperationResponse>;
  decreasePriority(hashes: string[]): Promise<OperationResponse>;
  topPriority(hashes: string[]): Promise<OperationResponse>;
  bottomPriority(hashes: string[]): Promise<OperationResponse>;
  addTags(hashes: string[], tags: string[]): Promise<OperationResponse>;
  removeTags(hashes: string[], tags: string[]): Promise<OperationResponse>;
  setDownloadLimit(hashes: string[], limit: number): Promise<OperationResponse>;
  setUploadLimit(hashes: string[], limit: number): Promise<OperationResponse>;
  setFilePriority(hash: string, ids: number[], priority: number): Promise<OperationResponse>;
  renameFile(hash: string, oldPath: string, newPath: string): Promise<OperationResponse>;
  renameFolder(hash: string, oldPath: string, newPath: string): Promise<OperationResponse>;
  getDownloadLimit(hashes: string[]): Promise<DownloadLimitResponse>;
  getUploadLimit(hashes: string[]): Promise<UploadLimitResponse>;
  syncTorrentPeers(hash: string, rid?: number): Promise<SyncTorrentPeers>;
  setAutoManagement(hashes: string[], enable: boolean): Promise<OperationResponse>;
  setShareLimits(hashes: string[], ratioLimit: number, seedingTimeLimit: number): Promise<OperationResponse>;
  setSequentialDownload(hashes: string[], value: boolean): Promise<OperationResponse>;
  setFirstLastPiecePriority(hashes: string[], value: boolean): Promise<OperationResponse>;
  setSuperSeeding(hashes: string[], value: boolean): Promise<OperationResponse>;
  exportTorrent(hash: string, savePath: string): Promise<OperationResponse>;
  /** Add one or more peers (`host:port`) to the given torrents. */
  addPeers(hashes: string[], peers: string[]): Promise<OperationResponse>;
}

// Transfer bridge - speed limits and transfer info
export interface TransferBridge {
  getInfo(): Promise<TransferInfoResponse>;
  getSpeedLimitsMode(): Promise<SpeedLimitsModeResponse>;
  toggleSpeedLimitsMode(): Promise<OperationResponse>;
  getDownloadLimit(): Promise<DownloadLimitResponse>;
  setDownloadLimit(limit: number): Promise<OperationResponse>;
  getUploadLimit(): Promise<UploadLimitResponse>;
  setUploadLimit(limit: number): Promise<OperationResponse>;
  banPeers(peers: string[]): Promise<OperationResponse>;
  getCookies(): Promise<unknown>;
  setCookies(url: string, cookies: string): Promise<OperationResponse>;
}

// Categories bridge
export interface CategoriesBridge {
  getCategories(): Promise<CategoriesResponse>;
  createCategory(category: string, savePath: string): Promise<OperationResponse>;
  editCategory(category: string, savePath: string): Promise<OperationResponse>;
  removeCategories(categories: string[]): Promise<OperationResponse>;
}

// Tags bridge
export interface TagsBridge {
  getTags(): Promise<TagsResponse>;
  createTags(tags: string[]): Promise<OperationResponse>;
  deleteTags(tags: string[]): Promise<OperationResponse>;
  addTorrentTags(hashes: string[], tags: string[]): Promise<OperationResponse>;
  removeTorrentTags(hashes: string[], tags: string[]): Promise<OperationResponse>;
}

// Preferences bridge
export interface PreferencesBridge {
  getPreferences(): Promise<PreferencesResponse>;
  setPreferences(prefs: Partial<Preferences>): Promise<OperationResponse>;
}

// Application bridge
export interface ApplicationBridge {
  getPreferences(): Promise<PreferencesResponse>;
  setPreferences(prefs: Partial<Preferences>): Promise<OperationResponse>;
  getDefaultSavePath(): Promise<DefaultSavePathResponse>;
  shutdown(): Promise<OperationResponse>;
  /** Retrieve server capabilities (supported features) from the Rust backend. */
  getServerCapabilities(): Promise<RustCapabilitiesResponse>;
}

// Mobile-specific application bridge.
// Shared consumers should prefer application.* to stay desktop-aligned.
export interface MobileApplicationBridge {
  getDefaultSavePath(): Promise<DefaultSavePathResponse>;
  /** Retrieve server capabilities (supported features) from the Rust backend. */
  getServerCapabilities(): Promise<RustCapabilitiesResponse>;
  shutdown(): Promise<OperationResponse>;
  getPreferences(): Promise<PreferencesResponse>;
  setPreferences(prefs: Partial<Preferences>): Promise<OperationResponse>;
}

// QB Client bridge - direct qBittorrent API requests
export interface QBClientBridge {
  /** Rust-owned: fetch the current accumulated maindata snapshot (server_id, session_generation, revision, rid, health, maindata). */
  getMaindataSnapshot(): Promise<MaindataSnapshotResponse>;
  /** Rust-owned: fetch the current sync health without the full snapshot payload. */
  getMaindataSyncStatus(): Promise<MaindataSyncHealth>;
  /** Rust-owned: start the live sync manager for the current session. */
  startMaindataSync(): Promise<void>;
  /** Rust-owned: stop the live sync manager for a server. */
  stopMaindataSync(serverId: string): Promise<void>;
  /**
   * Rust-owned: add a listener for maindata sync change events.
   * Returns a synchronous unsubscribe function that is safe to call before
   * the async listener registration resolves.
   */
  addMaindataSyncListener(handler: (event: import('../types').MaindataSyncChangedEvent) => void): () => void;
  /**
   * Rust-owned: set the active workspace view request and return the
   * computed view. The Rust engine recomputes from the current maindata
   * snapshot under the active filter/sort/locale and returns the view
   * inline; the `workspace-view-changed` event is emitted only when the
   * recomputed view differs from the cached one.
   *
   * Consumers should branch on
   * `bridge.capabilities.supportsWorkspaceViewRust` before calling this.
   */
  setWorkspaceView(request: WorkspaceViewRequest): Promise<WorkspaceView>;
  /**
   * Rust-owned: return the cached last workspace view, or `null` if none
   * has been computed yet. Does not trigger a recompute — call
   * `setWorkspaceView` to refresh.
   */
  getWorkspaceView(): Promise<WorkspaceView | null>;
  /**
   * Rust-owned: add a listener for `workspace-view-changed` events.
   * Returns a synchronous unsubscribe function that is safe to call before
   * the async listener registration resolves (mirrors the
   * `addMaindataSyncListener` pattern).
   */
  addWorkspaceViewListener(handler: (event: WorkspaceView) => () => void): () => void;
  /** Fetch RSS items from /api/v2/rss/items */
  getRssItems(): Promise<RSSItemsResponse>;
  /** Fetch RSS rules from /api/v2/rss/rules */
  getRssRules(): Promise<RSSRulesResponse>;
  /** Add an RSS feed. `path` is the destination folder path (empty string = root). */
  addRssFeed(path: string, url: string): Promise<OperationResponse>;
  /** Change the URL of an existing RSS feed identified by `path`. */
  setRssFeedUrl(path: string, url: string): Promise<OperationResponse>;
  /** Remove an RSS item (feed or folder) identified by `path`. */
  removeRssItem(path: string): Promise<OperationResponse>;
  /**
   * Create or update an RSS auto-download rule.
   * The rule definition is serialised to JSON internally before sending to qBittorrent.
   */
  setRssRule(ruleName: string, rule: RssRuleInput): Promise<OperationResponse>;
  /** Rename an RSS auto-download rule. */
  renameRssRule(ruleName: string, newRuleName: string): Promise<OperationResponse>;
  /** Remove an RSS auto-download rule. */
  removeRssRule(ruleName: string): Promise<OperationResponse>;
  /** Logout from the current session */
  logout(): Promise<OperationResponse>;
  /** Start a search — returns the search id assigned by the server */
  startSearch(query: string, plugins: string, category: string): Promise<{ id: number }>;
  /** Stop a search */
  stopSearch(id: number): Promise<OperationResponse>;
  /**
   * Get search status (optionally for a specific search id).
   * Rust-owned (T141.3): the returned array mirrors `qb_core::dto::SearchStatusDto`.
   */
  getSearchStatus(id?: number): Promise<SearchStatus[]>;
  /**
   * Get search results.
   * Rust-owned (T141.3): mirrors `qb_core::dto::SearchResultsDto` with
   * camelCase result row fields (`descrLink`, `fileName`, `fileSize`,
   * `fileUrl`, `nbLeechers`, `nbSeeders`, `siteUrl`).
   */
  getSearchResults(id: number, limit?: number, offset?: number): Promise<SearchResults>;
  /** Delete a search */
  deleteSearch(id: number): Promise<OperationResponse>;
  /**
   * Get list of search plugins.
   * Rust-owned (T141.3): mirrors `qb_core::dto::SearchPluginDto`.
   */
  getSearchPlugins(): Promise<SearchPlugin[]>;
  /** Install a search plugin */
  installSearchPlugin(sources: string): Promise<OperationResponse>;
  /** Uninstall a search plugin */
  uninstallSearchPlugin(names: string): Promise<OperationResponse>;
  /** Enable/disable a search plugin */
  enableSearchPlugin(names: string, enable: boolean): Promise<OperationResponse>;
  /** Update search plugins */
  updateSearchPlugins(): Promise<OperationResponse>;
}

// Server management bridge
export interface ServerBridge {
  listServers(): Promise<SavedServerSummary[]>;
  getActiveServer(): Promise<SavedServerSummary | null>;
  addServer(input: AddServerInput): Promise<SavedServerSummary>;
  updateServer(input: UpdateServerInput): Promise<SavedServerSummary>;
  removeServer(serverId: string): Promise<void>;
  selectServer(serverId: string): Promise<void>;
  testServerConnection(
    serverUrl: string,
    credentials: ServerCredentialsInput
  ): Promise<TestConnectionResult>;
  testSavedServerConnection(serverId: string): Promise<TestConnectionResult>;
  /** Atomic saved-server switch: commits the new session only on success. On failure the
   *  previous session remains intact. Returns the new session generation on success. */
  sessionSwitchServerById(serverId: string): Promise<number>;

  /** Normalize a server URL (strip trailing slashes, prepend scheme, remove /api/v2). */
  normalizeServerUrl(input: { url: string; defaultScheme?: string }): Promise<{ normalized: string }>;

  /** Probe for the correct scheme (https-first, http-fallback on network errors). */
  probeServerScheme(url: string, username: string, password: string): Promise<{
    success: boolean;
    normalizedUrl: string | null;
    error: string | null;
  }>;
}

/** Bridge methods for server URL normalization and scheme probing used by add-server flows. */
export interface ServerUrlProbeBridge {
  normalizeServerUrl(input: { url: string; defaultScheme?: string }): Promise<{ normalized: string }>;
  probeServerScheme(url: string, username: string, password: string): Promise<{
    success: boolean;
    normalizedUrl: string | null;
    error: string | null;
  }>;
}

// Full desktop bridge interface
// Session/lifecycle methods are at the ROOT level (extend SessionLifecycleBridge),
// not nested under a `session` property.
// Desktop bridge interface
// Session/lifecycle methods are at the ROOT level (extend SessionLifecycleBridge),
// not nested under a `session` property.
export interface DesktopBridge extends SessionLifecycleBridge {
  capabilities: BridgeCapabilities;
  torrents: DesktopTorrentBridge;
  transfer: TransferBridge;
  categories: CategoriesBridge;
  tags: TagsBridge;
  application: ApplicationBridge;
  qBClient: QBClientBridge;
  servers: ServerBridge;
  getPathMappings(serverId: string): Promise<PathMapping[]>;
  setPathMappings(serverId: string, mappings: PathMapping[]): Promise<void>;
  /** Sync dynamic enabled/disabled state to the native macOS app menu. */
  syncMenuState(state: NativeMenuState): Promise<void>;
  /** Exit the application (proper quit, not hide-to-tray). */
  exitApp(): Promise<void>;
  /**
   * Drain pending native UI actions that arrived while the main window was absent.
   * Returns actions in the order they were queued.
   */
  getPendingNativeUiActions(): Promise<NativeUiAction[]>;
  /**
   * Drain pending view toggle actions that arrived before JS listeners were ready.
   * Returns panel names in the order they were queued.
   */
  getPendingViewActions(): Promise<string[]>;
  /**
   * Signal that JS view listeners have registered and are ready to receive events.
   * After this call, view toggle events are emitted directly instead of queued.
   */
  setViewListenersReady(): Promise<void>;
  /**
   * Reset the view-listeners-ready flag. Called when listeners are torn down
   * so that events are re-queued until the next setup() completes.
   */
  resetViewListenersReady(): Promise<void>;
  /** Get the current download-completion notification setting. Defaults to true when absent. */
  getDownloadCompletionNotificationsEnabled(): Promise<boolean>;
  /** Set the download-completion notification setting to the given value. */
  setDownloadCompletionNotificationsEnabled(enabled: boolean): Promise<void>;
  /** Resolve a server path to a local path using the path mappings for the given server. */
  resolveLocalPath(serverId: string, serverPath: string): Promise<ResolveResult>;
  /** Open a local path using the native file explorer (Rust). */
  openLocalPath(path: string): Promise<void>;
  /** Reveal a local item in the native file explorer (Rust). Falls back to opening the containing directory on Linux. */
  revealLocalItem(path: string): Promise<void>;
  /** Check the configured updater endpoint for a stable desktop app update. */
  checkForUpdate(): Promise<AppUpdateInfo | null>;
  /** Download and install the previously checked update, reporting download progress when available. */
  downloadAndInstallUpdate(onProgress?: (event: AppUpdateProgress) => void): Promise<void>;
  /** Relaunch the app after an installed update is ready. */
  relaunchApp(): Promise<void>;
}

/// Dynamic menu state synced from the frontend to the native macOS app menu.
/// `can_*` fields control enabled/disabled; `view_*` fields carry the current
/// checked state for View-menu toggles (native macOS checked-state updates
/// are applied via stored menu-item handles where the Tauri API allows it).
export interface NativeMenuState {
  can_pause: boolean;
  can_resume: boolean;
  can_delete: boolean;
  can_recheck: boolean;
  can_reannounce: boolean;
  can_force_start: boolean;
  can_set_category: boolean;
  can_set_tags: boolean;
  can_queue_up: boolean;
  can_queue_down: boolean;
  can_move_top: boolean;
  can_move_bottom: boolean;
  /// Whether the sidebar is currently visible (View → Toggle Sidebar checked state)
  view_sidebar: boolean;
  /// Whether the details panel is currently visible (View → Toggle Details checked state)
  view_details: boolean;
  /// Whether the in-window menubar is currently visible (macOS only)
  in_window_menubar: boolean;
  /// ---- Tray fields (synced from frontend to native tray menu) ----
  /** Whether the alternative speed limits are currently active. */
  tray_alt_speed_active: boolean;
  /** Whether the qBittorrent session is connected. */
  tray_connected: boolean;
}

/// Serializable UI-open actions that can arrive while `main` is absent and are
/// queued for the renderer to drain after window-state restore.
export type NativeUiAction =
  | { type: 'settings' }
  | { type: 'about' }
  | { type: 'add-torrent' }
  | { type: 'nav'; route: 'search' | 'rss' }
  /** Open the add-torrent window with a specific source (tray). */
  | { type: 'add-torrent-source'; source: 'file' | 'link' }
  /** Open the global transfer speed limits dialog (tray). */
  | { type: 'set-global-speed-limits' };

// Mobile-specific torrent bridge - extends base TorrentBridgeBase with mobile-only methods.
// Preference/category/tag/global-limit/cookie operations live under their canonical desktop-aligned
// namespaces (application.*, transfer.*, categories.*, tags.*) rather than here.
// Mobile consumers must use those canonical namespaces; this interface carries only
// the torrent-specific subset that genuinely belongs under torrents.*.
export interface MobileTorrentBridge extends TorrentBridgeBase {
  setDownloadLimit(hashes: string[], limit: number): Promise<OperationResponse>;
  setUploadLimit(hashes: string[], limit: number): Promise<OperationResponse>;
  setFilePriority(hash: string, ids: number[], priority: number): Promise<OperationResponse>;
  setCategory(hashes: string[], category: string): Promise<OperationResponse>;
  addTags(hashes: string[], tags: string[]): Promise<OperationResponse>;
  removeTags(hashes: string[], tags: string[]): Promise<OperationResponse>;
  setName(hash: string, name: string): Promise<OperationResponse>;
  setLocation(hashes: string[], location: string): Promise<OperationResponse>;
  increasePriority(hashes: string[]): Promise<OperationResponse>;
  decreasePriority(hashes: string[]): Promise<OperationResponse>;
  topPriority(hashes: string[]): Promise<OperationResponse>;
  bottomPriority(hashes: string[]): Promise<OperationResponse>;
  renameFile(hash: string, oldPath: string, newPath: string): Promise<OperationResponse>;
  renameFolder(hash: string, oldPath: string, newPath: string): Promise<OperationResponse>;
  getDownloadLimit(hashes: string[]): Promise<DownloadLimitResponse>;
  getUploadLimit(hashes: string[]): Promise<UploadLimitResponse>;
  syncTorrentPeers(hash: string, rid?: number): Promise<SyncTorrentPeers>;
  setAutoManagement(hashes: string[], enable: boolean): Promise<OperationResponse>;
  setShareLimits(hashes: string[], ratioLimit: number, seedingTimeLimit: number): Promise<OperationResponse>;
  setSequentialDownload(hashes: string[], value: boolean): Promise<OperationResponse>;
  setFirstLastPiecePriority(hashes: string[], value: boolean): Promise<OperationResponse>;
  setSuperSeeding(hashes: string[], value: boolean): Promise<OperationResponse>;
  exportTorrent(hash: string, savePath: string): Promise<OperationResponse>;
}

// Full mobile bridge interface
// Session/lifecycle methods are at the ROOT level (extend SessionLifecycleBridge).
// Canonical namespaces (desktop-aligned):
//   - application.*  — preferences and app info
//   - transfer.*     — global transfer limits and info
//   - categories.*   — category CRUD
//   - tags.*         — tag CRUD and torrent tagging
//   - torrents.*     — torrent-specific operations (not shared with desktop namespaces)
export interface MobileBridge extends SessionLifecycleBridge {
  capabilities: BridgeCapabilities;
  torrents: MobileTorrentBridge;
  transfer: TransferBridge;
  categories: CategoriesBridge;
  tags: TagsBridge;
  application: MobileApplicationBridge;
  servers: ServerBridge;
  qBClient: QBClientBridge;
}
