// Mobile Tauri bridge adapter - preserves existing API with unprefixed commands
import { createTauriTransport } from '../transport/tauriTransport';
import type { Transport } from '../transport/transport';
import type { MobileBridge } from '../contracts/interfaces';

import { MOBILE_CAPABILITIES } from '../contracts/capabilities';
import {
  createSessionHelpers,
  createServerHelpers,
  createQbClientHelpers,
  createSyncHelpers,
  createWorkspaceViewHelpers,
} from '../sharedBridge';
import type {
  SessionSnapshot,
  SessionStatus,
  OperationResponse,
  TorrentListResponse,
  TorrentListParams,
  TorrentPropertiesResponse,
  TorrentTrackersResponse,
  TorrentFilesResponse,
  TorrentPropertiesEnvelope,
  TorrentTrackersEnvelope,
  TorrentFilesEnvelope,
  AddTorrentOptions,
  PreferencesResponse,
  CategoriesResponse,
  TagsResponse,
  TransferInfoResponse,
  SpeedLimitsModeResponse,
  DownloadLimitResponse,
  UploadLimitResponse,
  SavedServerSummary,
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
import type { Preferences } from '@taurent/shared/types/qbittorrent';

/**
 * Creates a mobile Tauri bridge adapter with an optional injected transport.
 * If no transport is provided, uses the default Tauri transport.
 *
 * This factory pattern allows future web runtimes to inject a different
 * transport (e.g., fetch-based) without rewriting bridge logic.
 */
export function createMobileTauriBridge(transport?: Transport): MobileBridge {
  const t = transport ?? createTauriTransport();

  // Shared helpers
  const session = createSessionHelpers(t);
  const servers = createServerHelpers(t);
  const qb = createQbClientHelpers(t);
  const sync = createSyncHelpers(t);
  const workspaceView = createWorkspaceViewHelpers(t);

  // Transfer commands (canonical namespace — desktop-aligned)
  async function getTransferInfo(): Promise<TransferInfoResponse> {
    return t.invoke<TransferInfoResponse>('get_transfer_info');
  }

  async function getSpeedLimitsMode(): Promise<SpeedLimitsModeResponse> {
    return t.invoke<SpeedLimitsModeResponse>('get_speed_limits_mode');
  }

  async function toggleSpeedLimitsMode(): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('toggle_speed_limits_mode');
  }

  async function banPeers(peers: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('ban_peers', { peers });
  }

  // Session commands
  async function getSessionSnapshot(): Promise<SessionSnapshot> {
    return session.getSessionSnapshot();
  }

  async function sessionConnectById(serverId: string): Promise<number> {
    return session.sessionConnectById(serverId);
  }

  async function sessionDisconnect(): Promise<number> {
    return session.sessionDisconnect();
  }

  async function sessionReconnect(): Promise<number> {
    return session.sessionReconnect();
  }

  async function sessionSwitchServer(
    serverId: string,
    serverName: string,
    serverUrl: string,
    serverUsername: string,
    serverPassword: string
  ): Promise<number> {
    return session.sessionSwitchServer(serverId, serverName, serverUrl, serverUsername, serverPassword);
  }

  async function sessionSwitchServerById(serverId: string): Promise<number> {
    return session.sessionSwitchServerById(serverId);
  }

  async function sessionSetError(error: string): Promise<number> {
    return session.sessionSetError(error);
  }

  async function sessionClearError(): Promise<number> {
    return session.sessionClearError();
  }

  async function sessionSetConnecting(
    serverId: string,
    serverName: string,
    serverUrl: string,
    serverUsername: string,
    serverPassword: string
  ): Promise<number> {
    return session.sessionSetConnecting(serverId, serverName, serverUrl, serverUsername, serverPassword);
  }

  async function getSessionGeneration(): Promise<number> {
    return session.getSessionGeneration();
  }

  async function getSessionStatus(): Promise<SessionStatus> {
    return session.getSessionStatus();
  }

  async function sessionHealthCheck(): Promise<boolean> {
    return session.sessionHealthCheck();
  }

  // Torrent commands (unprefixed)
  async function getTorrentList(params?: TorrentListParams): Promise<TorrentListResponse> {
    return t.invoke<TorrentListResponse>('get_torrent_list', {
      query: {
        filter: params?.filter ?? null,
        category: params?.category ?? null,
        tag: params?.tag ?? null,
        sort: params?.sort ?? null,
        reverse: params?.reverse ?? null,
        limit: params?.limit ?? null,
        offset: params?.offset ?? null,
        hashes: params?.hashes ?? null,
      },
    });
  }

  async function pauseTorrents(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('pause_torrents', { hashes });
  }

  async function resumeTorrents(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('resume_torrents', { hashes });
  }

  async function deleteTorrents(hashes: string[], deleteFiles: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('delete_torrents', { hashes, deleteFiles });
  }

  async function recheckTorrents(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('recheck_torrents', { hashes });
  }

  async function reannounceTorrents(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('reannounce_torrents', { hashes });
  }

  async function setForceStart(hashes: string[], value: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_force_start', { hashes, value });
  }

  async function setTorrentDownloadLimit(hashes: string[], limit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_download_limit', { hashes, limit });
  }

  async function setTorrentUploadLimit(hashes: string[], limit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_upload_limit', { hashes, limit });
  }

  async function setFilePriority(hash: string, ids: number[], priority: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_file_priority', { hash, ids, priority });
  }

  // torrent-detail commands — Rust returns a typed session envelope; the
  // adapter unwraps it to expose the plain typed payload to consumers.
  async function getTorrentProperties(hash: string): Promise<TorrentPropertiesResponse> {
    const response = await t.invoke<TorrentPropertiesEnvelope>('get_torrent_properties', { hash });
    return response.properties;
  }

  async function getTorrentTrackers(hash: string): Promise<TorrentTrackersResponse> {
    const response = await t.invoke<TorrentTrackersEnvelope>('get_torrent_trackers', { hash });
    return response.trackers;
  }

  async function getTorrentFiles(hash: string): Promise<TorrentFilesResponse> {
    const response = await t.invoke<TorrentFilesEnvelope>('get_torrent_files', { hash });
    return response.files;
  }

  async function addTrackers(hash: string, urls: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('add_trackers', { hash, urls });
  }

  async function editTracker(hash: string, origUrl: string, newUrl: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('edit_tracker', { hash, origUrl, newUrl });
  }

  async function removeTrackers(hash: string, urls: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('remove_trackers', { hash, urls });
  }

  async function addTorrent(options: AddTorrentOptions): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('add_torrent', {
      options: {
        urls: options.urls,
        torrent_files: options.torrentFiles,
        savepath: options.savepath,
        category: options.category,
        tags: options.tags,
        skip_checking: options.skip_checking,
        paused: options.paused,
        root_folder: options.root_folder,
        sequential_download: options.sequential_download,
        rename: options.rename,
        up_limit: options.up_limit,
        dl_limit: options.dl_limit,
        auto_tmm: options.auto_tmm,
        first_last_piece_prio: options.first_last_piece_prio,
        content_layout: options.content_layout,
        stop_condition: options.stop_condition,
        add_to_top: options.add_to_top,
      },
    });
  }

  async function renameFile(hash: string, oldPath: string, newPath: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('rename_file', { hash, oldPath, newPath });
  }

  async function renameFolder(hash: string, oldPath: string, newPath: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('rename_folder', { hash, oldPath, newPath });
  }

  async function getTorrentDownloadLimit(hashes: string[]): Promise<DownloadLimitResponse> {
    return t.invoke<DownloadLimitResponse>('get_torrent_download_limit', { hashes });
  }

  async function getTorrentUploadLimit(hashes: string[]): Promise<UploadLimitResponse> {
    return t.invoke<UploadLimitResponse>('get_torrent_upload_limit', { hashes });
  }

  async function syncTorrentPeers(hash: string, rid?: number): Promise<SyncTorrentPeers> {
    // Rust (qb_core::parse_sync_torrent_peers) owns the validation boundary; the raw
    // response shape is returned directly. Retain SyncTorrentPeersSchema in
    // @taurent/shared as a compatibility/parity artifact — it is not invoked here.
    return t.invoke<SyncTorrentPeers>('sync_torrent_peers', { hash, rid: rid ?? null });
  }

  async function getTorrentWebseeds(hash: string): Promise<TorrentWebseedsResponse> {
    return t.invoke<TorrentWebseedsResponse>('get_torrent_webseeds', { hash });
  }

  async function getCookies(): Promise<unknown> {
    return t.invoke('get_cookies');
  }

  async function setCookies(url: string, cookies: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_cookies', { url, cookies });
  }

  async function logout(): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('logout');
  }

  async function getCategories(): Promise<CategoriesResponse> {
    return t.invoke<CategoriesResponse>('get_categories');
  }

  async function getTags(): Promise<TagsResponse> {
    return t.invoke<TagsResponse>('get_tags');
  }

  async function createCategory(name: string, savePath?: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('create_category', { name, savePath: savePath ?? null });
  }

  async function editCategory(category: string, savePath: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('edit_category', { category, savePath });
  }

  async function removeCategories(categories: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('remove_categories', { categories });
  }

  async function createTags(tags: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('create_tags', { tags });
  }

  async function deleteTags(tags: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('delete_tags', { tags });
  }

  async function setGlobalDownloadLimit(limit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_global_download_limit', { limit });
  }

  async function setGlobalUploadLimit(limit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_global_upload_limit', { limit });
  }

  async function getGlobalDownloadLimit(): Promise<DownloadLimitResponse> {
    return t.invoke<DownloadLimitResponse>('get_global_download_limit');
  }

  async function getGlobalUploadLimit(): Promise<UploadLimitResponse> {
    return t.invoke<UploadLimitResponse>('get_global_upload_limit');
  }

  async function setCategory(hashes: string[], category: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_category', { hashes, category });
  }

  async function addTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('add_tags', { hashes, tags: tags.join(',') });
  }

  async function removeTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('remove_tags', { hashes, tags: tags.join(',') });
  }

  async function setTorrentName(hash: string, name: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_name', { hash, name });
  }

  async function setTorrentLocation(hashes: string[], location: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_location', { hashes, location });
  }

  async function increasePriority(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('increase_priority', { hashes });
  }

  async function decreasePriority(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('decrease_priority', { hashes });
  }

  async function topPriority(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('top_priority', { hashes });
  }

  async function bottomPriority(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('bottom_priority', { hashes });
  }

  async function getDefaultSavePath(): Promise<{ session_generation: number; server_id: string | null; path: string }> {
    return t.invoke<{ session_generation: number; server_id: string | null; path: string }>('get_default_save_path');
  }

  async function shutdown(): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('shutdown_server');
  }

  // Shared preferences — canonical surface is application.*.
  // qBittorrent API has a single /api/v2/app/getPreferences endpoint used by both desktop and mobile.
  async function bridgeGetPreferences(): Promise<PreferencesResponse> {
    return t.invoke<PreferencesResponse>('get_preferences');
  }

  async function bridgeSetPreferences(prefs: Partial<Preferences>): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_preferences', { prefs });
  }

  // Application commands
  async function getServerCapabilities(): Promise<RustCapabilitiesResponse> {
    return t.invoke<RustCapabilitiesResponse>('get_server_capabilities');
  }

  // Server management commands
  async function listServers(): Promise<SavedServerSummary[]> {
    return servers.listServers();
  }

  async function getActiveServer(): Promise<SavedServerSummary | null> {
    return servers.getActiveServer();
  }

  async function addServer(input: AddServerInput): Promise<SavedServerSummary> {
    return servers.addServer(input);
  }

  async function updateServer(input: UpdateServerInput): Promise<SavedServerSummary> {
    return servers.updateServer(input);
  }

  async function removeServer(serverId: string): Promise<void> {
    return servers.removeServer(serverId);
  }

  async function selectServer(serverId: string): Promise<void> {
    return servers.selectServer(serverId);
  }

  async function testServerConnection(
    serverUrl: string,
    credentials: ServerCredentialsInput
  ): Promise<TestConnectionResult> {
    return servers.testServerConnection(serverUrl, credentials);
  }

  async function testSavedServerConnection(serverId: string): Promise<TestConnectionResult> {
    return servers.testSavedServerConnection(serverId);
  }

  // Search commands
  async function startSearch(query: string, plugins: string, category: string): Promise<{ id: number }> {
    return qb.startSearch(query, plugins, category);
  }

  async function stopSearch(id: number): Promise<OperationResponse> {
    return qb.stopSearch(id);
  }

  async function getSearchStatus(id?: number): Promise<SearchStatus[]> {
    return qb.getSearchStatus(id);
  }

  async function getSearchResults(id: number, limit?: number, offset?: number): Promise<SearchResults> {
    return qb.getSearchResults(id, limit, offset);
  }

  async function deleteSearch(id: number): Promise<OperationResponse> {
    return qb.deleteSearch(id);
  }

  async function getSearchPlugins(): Promise<SearchPlugin[]> {
    return qb.getSearchPlugins();
  }

  async function installSearchPlugin(sources: string): Promise<OperationResponse> {
    return qb.installSearchPlugin(sources);
  }

  async function uninstallSearchPlugin(names: string): Promise<OperationResponse> {
    return qb.uninstallSearchPlugin(names);
  }

  async function enableSearchPlugin(names: string, enable: boolean): Promise<OperationResponse> {
    return qb.enableSearchPlugin(names, enable);
  }

  async function updateSearchPlugins(): Promise<OperationResponse> {
    return qb.updateSearchPlugins();
  }

  // Return the adapter object
  return {
    capabilities: MOBILE_CAPABILITIES,

    async getSessionSnapshot(): Promise<SessionSnapshot> {
      return getSessionSnapshot();
    },

    async sessionConnectById(serverId: string): Promise<number> {
      return sessionConnectById(serverId);
    },

    async sessionDisconnect(): Promise<number> {
      return sessionDisconnect();
    },

    async sessionReconnect(): Promise<number> {
      return sessionReconnect();
    },

    async sessionSwitchServer(
      serverId: string,
      serverName: string,
      serverUrl: string,
      serverUsername: string,
      serverPassword: string
    ): Promise<number> {
      return sessionSwitchServer(serverId, serverName, serverUrl, serverUsername, serverPassword);
    },

    async sessionSwitchServerById(serverId: string): Promise<number> {
      return sessionSwitchServerById(serverId);
    },

    async sessionSetError(error: string): Promise<number> {
      return sessionSetError(error);
    },

    async sessionClearError(): Promise<number> {
      return sessionClearError();
    },

    async sessionSetConnecting(
      serverId: string,
      serverName: string,
      serverUrl: string,
      serverUsername: string,
      serverPassword: string
    ): Promise<number> {
      return sessionSetConnecting(serverId, serverName, serverUrl, serverUsername, serverPassword);
    },

    async getSessionGeneration(): Promise<number> {
      return getSessionGeneration();
    },

    async getSessionStatus(): Promise<SessionStatus> {
      return getSessionStatus();
    },

    async sessionHealthCheck(): Promise<boolean> {
      return sessionHealthCheck();
    },

    torrents: {
      async getList(params?: TorrentListParams): Promise<TorrentListResponse> {
        return getTorrentList(params);
      },

      async pause(hashes: string[]): Promise<OperationResponse> {
        return pauseTorrents(hashes);
      },

      async resume(hashes: string[]): Promise<OperationResponse> {
        return resumeTorrents(hashes);
      },

      async delete(hashes: string[], deleteFiles: boolean): Promise<OperationResponse> {
        return deleteTorrents(hashes, deleteFiles);
      },

      async recheck(hashes: string[]): Promise<OperationResponse> {
        return recheckTorrents(hashes);
      },

      async reannounce(hashes: string[]): Promise<OperationResponse> {
        return reannounceTorrents(hashes);
      },

      async setForceStart(hashes: string[], value: boolean): Promise<OperationResponse> {
        return setForceStart(hashes, value);
      },

      async setDownloadLimit(hashes: string[], limit: number): Promise<OperationResponse> {
        return setTorrentDownloadLimit(hashes, limit);
      },

      async setUploadLimit(hashes: string[], limit: number): Promise<OperationResponse> {
        return setTorrentUploadLimit(hashes, limit);
      },

      async setFilePriority(hash: string, ids: number[], priority: number): Promise<OperationResponse> {
        return setFilePriority(hash, ids, priority);
      },

      async getProperties(hash: string): Promise<TorrentPropertiesResponse> {
        return getTorrentProperties(hash);
      },

      async getTrackers(hash: string): Promise<TorrentTrackersResponse> {
        return getTorrentTrackers(hash);
      },

      async getFiles(hash: string): Promise<TorrentFilesResponse> {
        return getTorrentFiles(hash);
      },

      async addTorrent(options: AddTorrentOptions): Promise<OperationResponse> {
        return addTorrent(options);
      },

      async addTrackers(hash: string, urls: string): Promise<OperationResponse> {
        return addTrackers(hash, urls);
      },

      async editTracker(hash: string, origUrl: string, newUrl: string): Promise<OperationResponse> {
        return editTracker(hash, origUrl, newUrl);
      },

      async removeTrackers(hash: string, urls: string): Promise<OperationResponse> {
        return removeTrackers(hash, urls);
      },

      async setCategory(hashes: string[], category: string): Promise<OperationResponse> {
        return setCategory(hashes, category);
      },

      async addTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
        return addTags(hashes, tags);
      },

      async removeTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
        return removeTags(hashes, tags);
      },

      async setName(hash: string, name: string): Promise<OperationResponse> {
        return setTorrentName(hash, name);
      },

      async setLocation(hashes: string[], location: string): Promise<OperationResponse> {
        return setTorrentLocation(hashes, location);
      },

      async increasePriority(hashes: string[]): Promise<OperationResponse> {
        return increasePriority(hashes);
      },

      async decreasePriority(hashes: string[]): Promise<OperationResponse> {
        return decreasePriority(hashes);
      },

      async topPriority(hashes: string[]): Promise<OperationResponse> {
        return topPriority(hashes);
      },

      async bottomPriority(hashes: string[]): Promise<OperationResponse> {
        return bottomPriority(hashes);
      },

      async renameFile(hash: string, oldPath: string, newPath: string): Promise<OperationResponse> {
        return renameFile(hash, oldPath, newPath);
      },

      async renameFolder(hash: string, oldPath: string, newPath: string): Promise<OperationResponse> {
        return renameFolder(hash, oldPath, newPath);
      },

      async getDownloadLimit(hashes: string[]): Promise<DownloadLimitResponse> {
        return getTorrentDownloadLimit(hashes);
      },

      async getUploadLimit(hashes: string[]): Promise<UploadLimitResponse> {
        return getTorrentUploadLimit(hashes);
      },

      async syncTorrentPeers(hash: string, rid?: number): Promise<SyncTorrentPeers> {
        return syncTorrentPeers(hash, rid);
      },

      async getWebSeeds(hash: string): Promise<TorrentWebseedsResponse> {
        return getTorrentWebseeds(hash);
      },

      async setAutoManagement(hashes: string[], enable: boolean): Promise<OperationResponse> {
        return t.invoke<OperationResponse>('set_auto_management', { hashes, enable });
      },

      async setShareLimits(hashes: string[], ratioLimit: number, seedingTimeLimit: number): Promise<OperationResponse> {
        return t.invoke<OperationResponse>('set_share_limits', { hashes, ratioLimit, seedingTimeLimit });
      },

      async setSequentialDownload(hashes: string[], value: boolean): Promise<OperationResponse> {
        return t.invoke<OperationResponse>('set_sequential_download', { hashes, value });
      },

      async setFirstLastPiecePriority(hashes: string[], value: boolean): Promise<OperationResponse> {
        return t.invoke<OperationResponse>('set_first_last_piece_priority', { hashes, value });
      },

      async setSuperSeeding(hashes: string[], value: boolean): Promise<OperationResponse> {
        return t.invoke<OperationResponse>('set_super_seeding', { hashes, value });
      },

      async exportTorrent(hash: string, savePath: string): Promise<OperationResponse> {
        return t.invoke<OperationResponse>('export_torrent', { hash, savePath });
      },
    },

    // NOTE: getCookies/setCookies are NOT exposed under torrents.* on mobile.
    // Canonical surface is transfer.* (desktop-aligned). Cookie management
    // for torrent operations (addTorrent, etc.) uses the underlying
    // Tauri commands directly in the torrent command implementations.
    // Cookies are exposed under transfer.* instead.

    // Canonical transfer namespace (desktop-aligned) — global speed limits and transfer info
    transfer: {
      async getInfo(): Promise<TransferInfoResponse> {
        return getTransferInfo();
      },

      async getSpeedLimitsMode(): Promise<SpeedLimitsModeResponse> {
        return getSpeedLimitsMode();
      },

      async toggleSpeedLimitsMode(): Promise<OperationResponse> {
        return toggleSpeedLimitsMode();
      },

      async getDownloadLimit(): Promise<DownloadLimitResponse> {
        return getGlobalDownloadLimit();
      },

      async setDownloadLimit(limit: number): Promise<OperationResponse> {
        return setGlobalDownloadLimit(limit);
      },

      async getUploadLimit(): Promise<UploadLimitResponse> {
        return getGlobalUploadLimit();
      },

      async setUploadLimit(limit: number): Promise<OperationResponse> {
        return setGlobalUploadLimit(limit);
      },

      async banPeers(peers: string[]): Promise<OperationResponse> {
        return banPeers(peers);
      },

      async getCookies(): Promise<unknown> {
        return getCookies();
      },

      async setCookies(url: string, cookies: string): Promise<OperationResponse> {
        return setCookies(url, cookies);
      },
    },

    // Canonical categories namespace (desktop-aligned)
    categories: {
      async getCategories(): Promise<CategoriesResponse> {
        return getCategories();
      },

      async createCategory(category: string, savePath: string): Promise<OperationResponse> {
        return createCategory(category, savePath);
      },

      async editCategory(category: string, savePath: string): Promise<OperationResponse> {
        return editCategory(category, savePath);
      },

      async removeCategories(categories: string[]): Promise<OperationResponse> {
        return removeCategories(categories);
      },
    },

    // Canonical tags namespace (desktop-aligned)
    tags: {
      async getTags(): Promise<TagsResponse> {
        return getTags();
      },

      async createTags(tags: string[]): Promise<OperationResponse> {
        return createTags(tags);
      },

      async deleteTags(tags: string[]): Promise<OperationResponse> {
        return deleteTags(tags);
      },

      async addTorrentTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
        return addTags(hashes, tags);
      },

      async removeTorrentTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
        return removeTags(hashes, tags);
      },
    },

    application: {
      async getServerCapabilities(): Promise<RustCapabilitiesResponse> {
        return getServerCapabilities();
      },

      async getDefaultSavePath(): Promise<{ session_generation: number; server_id: string | null; path: string }> {
        return getDefaultSavePath();
      },

      async shutdown(): Promise<OperationResponse> {
        return shutdown();
      },

      async getPreferences(): Promise<PreferencesResponse> {
        return bridgeGetPreferences();
      },

      async setPreferences(prefs: Partial<Preferences>): Promise<OperationResponse> {
        return bridgeSetPreferences(prefs);
      },
    },

    servers: {
      async listServers(): Promise<SavedServerSummary[]> {
        return listServers();
      },

      async getActiveServer(): Promise<SavedServerSummary | null> {
        return getActiveServer();
      },

      async addServer(input: AddServerInput): Promise<SavedServerSummary> {
        return addServer(input);
      },

      async updateServer(input: UpdateServerInput): Promise<SavedServerSummary> {
        return updateServer(input);
      },

      async removeServer(serverId: string): Promise<void> {
        return removeServer(serverId);
      },

      async selectServer(serverId: string): Promise<void> {
        return selectServer(serverId);
      },

      async sessionSwitchServerById(serverId: string): Promise<number> {
        return sessionSwitchServerById(serverId);
      },

      async testServerConnection(
        serverUrl: string,
        credentials: ServerCredentialsInput
      ): Promise<TestConnectionResult> {
        return testServerConnection(serverUrl, credentials);
      },

      async testSavedServerConnection(serverId: string): Promise<TestConnectionResult> {
        return testSavedServerConnection(serverId);
      },

      async normalizeServerUrl(input: { url: string; defaultScheme?: string }): Promise<{ normalized: string }> {
        return t.invoke('normalize_server_url_cmd', { input });
      },

      async probeServerScheme(url: string, username: string, password: string): Promise<{
        success: boolean;
        normalizedUrl: string | null;
        error: string | null;
      }> {
        return t.invoke('probe_server_scheme', { url, username, password });
      },
    },

    qBClient: {
      async getMaindataSnapshot(): Promise<MaindataSnapshotResponse> {
        return sync.getMaindataSnapshot();
      },
      async getMaindataSyncStatus(): Promise<MaindataSyncHealth> {
        return sync.getMaindataSyncStatus();
      },
      async startMaindataSync(): Promise<void> {
        return sync.startMaindataSync();
      },
      async stopMaindataSync(serverId: string): Promise<void> {
        return sync.stopMaindataSync(serverId);
      },
      addMaindataSyncListener(handler) {
        return sync.addMaindataSyncListener(handler);
      },
      async setWorkspaceView(request: WorkspaceViewRequest): Promise<WorkspaceView> {
        return workspaceView.setWorkspaceView(request);
      },
      async getWorkspaceView(): Promise<WorkspaceView | null> {
        return workspaceView.getWorkspaceView();
      },
      addWorkspaceViewListener(handler) {
        return workspaceView.addWorkspaceViewListener(handler);
      },
      async getRssItems(): Promise<RSSItemsResponse> {
        return qb.getRssItems();
      },
      async getRssRules(): Promise<RSSRulesResponse> {
        return qb.getRssRules();
      },
      async addRssFeed(path: string, url: string): Promise<OperationResponse> {
        return qb.addRssFeed(path, url);
      },
      async setRssFeedUrl(path: string, url: string): Promise<OperationResponse> {
        return qb.setRssFeedUrl(path, url);
      },
      async removeRssItem(path: string): Promise<OperationResponse> {
        return qb.removeRssItem(path);
      },
      async setRssRule(ruleName: string, rule: RssRuleInput): Promise<OperationResponse> {
        return qb.setRssRule(ruleName, rule);
      },
      async renameRssRule(ruleName: string, newRuleName: string): Promise<OperationResponse> {
        return qb.renameRssRule(ruleName, newRuleName);
      },
      async removeRssRule(ruleName: string): Promise<OperationResponse> {
        return qb.removeRssRule(ruleName);
      },
      async logout(): Promise<OperationResponse> {
        return logout();
      },
      async startSearch(query: string, plugins: string, category: string): Promise<{ id: number }> {
        return startSearch(query, plugins, category);
      },

      async stopSearch(id: number): Promise<OperationResponse> {
        return stopSearch(id);
      },

      async getSearchStatus(id?: number): Promise<SearchStatus[]> {
        return getSearchStatus(id);
      },

      async getSearchResults(id: number, limit?: number, offset?: number): Promise<SearchResults> {
        return getSearchResults(id, limit, offset);
      },

      async deleteSearch(id: number): Promise<OperationResponse> {
        return deleteSearch(id);
      },

      async getSearchPlugins(): Promise<SearchPlugin[]> {
        return getSearchPlugins();
      },

      async installSearchPlugin(sources: string): Promise<OperationResponse> {
        return installSearchPlugin(sources);
      },

      async uninstallSearchPlugin(names: string): Promise<OperationResponse> {
        return uninstallSearchPlugin(names);
      },

      async enableSearchPlugin(names: string, enable: boolean): Promise<OperationResponse> {
        return enableSearchPlugin(names, enable);
      },

      async updateSearchPlugins(): Promise<OperationResponse> {
        return updateSearchPlugins();
      },
    },
  };
}

/**
 * Mobile Tauri bridge adapter - uses default Tauri transport.
 * Use createMobileTauriBridge(transport?) for custom transport injection.
 */
export const BridgeAdapter = createMobileTauriBridge();
