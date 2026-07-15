// Desktop bridge adapter
import { createTauriTransport } from '../transport/tauriTransport';
import type { Transport } from '../transport/transport';
import type {
  AppUpdateInfo,
  AppUpdateProgress,
  DesktopBridge,
  NativeMenuState,
  NativeUiAction,
  ResolveResult,
} from '../contracts/interfaces';
export type {
  AppUpdateInfo,
  AppUpdateProgress,
  NativeMenuState,
  NativeUiAction,
  ResolveResult,
} from '../contracts/interfaces';
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
  DefaultSavePathResponse,
  SavedServerSummary,
  PathMapping,
  AddServerInput,
  UpdateServerInput,
  RSSItemsResponse,
  RSSRulesResponse,
  RssRuleInput,
  MaindataSnapshotResponse,
  MaindataSyncHealth,
  WorkspaceView,
  WorkspaceViewRequest,
  SearchPlugin,
  SearchResults,
  SearchStatus,
} from '../types';
import type { Preferences } from '@taurent/shared/types/qbittorrent';
import { DESKTOP_CAPABILITIES } from '../contracts/capabilities';
import {
  createSessionHelpers,
  createServerHelpers,
  createQbClientHelpers,
  createSyncHelpers,
  createWorkspaceViewHelpers,
} from '../sharedBridge';
import type { SyncTorrentPeers, TorrentWebseedsResponse } from '../types';

/**
 * Creates a desktop bridge adapter with an optional injected transport.
 * If no transport is provided, uses the default Tauri transport.
 *
 * This factory pattern allows future web runtimes to inject a different
 * transport (e.g., fetch-based) without rewriting bridge logic.
 */
export function createDesktopBridge(transport?: Transport): DesktopBridge {
  const t = transport ?? createTauriTransport();

  // Shared helpers
  const session = createSessionHelpers(t);
  const servers = createServerHelpers(t);
  const qb = createQbClientHelpers(t);
  const sync = createSyncHelpers(t);
  const workspaceView = createWorkspaceViewHelpers(t);

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

  // Torrent commands (cmd_* prefixed)
  async function cmdGetTorrentList(params?: TorrentListParams): Promise<TorrentListResponse> {
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

  async function cmdPauseTorrents(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('pause_torrents', { hashes });
  }

  async function cmdResumeTorrents(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('resume_torrents', { hashes });
  }

  async function cmdDeleteTorrents(hashes: string[], deleteFiles: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('delete_torrents', { hashes, deleteFiles });
  }

  async function cmdRecheckTorrents(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('recheck_torrents', { hashes });
  }

  async function cmdReannounceTorrents(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('reannounce_torrents', { hashes });
  }

  async function cmdSetForceStart(hashes: string[], value: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_force_start', { hashes, value });
  }

  async function cmdSetTorrentCategory(hashes: string[], category: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_category', { hashes, category });
  }

  async function cmdSetTorrentName(hash: string, name: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_name', { hash, name });
  }

  async function cmdSetTorrentLocation(hashes: string[], location: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_location', { hashes, location });
  }

  async function cmdIncreasePriority(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('increase_priority', { hashes });
  }

  async function cmdDecreasePriority(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('decrease_priority', { hashes });
  }

  async function cmdTopPriority(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('top_priority', { hashes });
  }

  async function cmdBottomPriority(hashes: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('bottom_priority', { hashes });
  }

  async function cmdAddTorrentTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('add_torrent_tags', { hashes, tags });
  }

  async function cmdRemoveTorrentTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('remove_torrent_tags', { hashes, tags });
  }

  async function cmdAddTrackers(hash: string, urls: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('add_trackers', { hash, urls });
  }

  async function cmdEditTracker(hash: string, origUrl: string, newUrl: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('edit_tracker', { hash, origUrl, newUrl });
  }

  async function cmdRemoveTrackers(hash: string, urls: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('remove_trackers', { hash, urls });
  }

  async function cmdSetTorrentDownloadLimit(hashes: string[], limit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_download_limit', { hashes, limit });
  }

  async function cmdSetTorrentUploadLimit(hashes: string[], limit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_torrent_upload_limit', { hashes, limit });
  }

  async function cmdSetFilePriority(hash: string, ids: number[], priority: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_file_priority', { hash, ids, priority });
  }

  // torrent-detail commands — Rust returns a typed session envelope; the
  // adapter unwraps it below to expose the plain payload to consumers.
  async function cmdGetTorrentProperties(hash: string): Promise<TorrentPropertiesEnvelope> {
    return t.invoke<TorrentPropertiesEnvelope>('get_torrent_properties', { hash });
  }

  async function cmdGetTorrentTrackers(hash: string): Promise<TorrentTrackersEnvelope> {
    return t.invoke<TorrentTrackersEnvelope>('get_torrent_trackers', { hash });
  }

  async function cmdGetTorrentFiles(hash: string): Promise<TorrentFilesEnvelope> {
    return t.invoke<TorrentFilesEnvelope>('get_torrent_files', { hash });
  }

  async function cmdAddTorrent(options: AddTorrentOptions): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('add_torrent_options', {
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

  async function cmdRenameFile(hash: string, oldPath: string, newPath: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('rename_file', { hash, oldPath, newPath });
  }

  async function cmdRenameFolder(hash: string, oldPath: string, newPath: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('rename_folder', { hash, oldPath, newPath });
  }

  async function cmdGetTorrentDownloadLimit(hashes: string[]): Promise<DownloadLimitResponse> {
    return t.invoke<DownloadLimitResponse>('get_torrent_download_limit', { hashes });
  }

  async function cmdGetTorrentUploadLimit(hashes: string[]): Promise<UploadLimitResponse> {
    return t.invoke<UploadLimitResponse>('get_torrent_upload_limit', { hashes });
  }

  async function cmdSyncTorrentPeers(hash: string, rid?: number): Promise<SyncTorrentPeers> {
    // Rust (qb_core::parse_sync_torrent_peers) owns the validation boundary; the raw
    // response shape is returned directly. Retain SyncTorrentPeersSchema in
    // @taurent/shared as a compatibility/parity artifact — it is not invoked here.
    return t.invoke<SyncTorrentPeers>('sync_torrent_peers', { hash, rid: rid ?? null });
  }

  async function cmdGetTorrentWebseeds(hash: string): Promise<TorrentWebseedsResponse> {
    return t.invoke<TorrentWebseedsResponse>('get_torrent_webseeds', { hash });
  }

  async function cmdAddWebSeeds(hash: string, urls: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('add_webseeds', { hash, urls });
  }

  async function cmdEditWebSeed(hash: string, origUrl: string, newUrl: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('edit_webseed', { hash, origUrl, newUrl });
  }

  async function cmdRemoveWebSeeds(hash: string, urls: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('remove_webseeds', { hash, urls });
  }

  async function cmdSetAutoManagement(hashes: string[], enable: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_auto_management', { hashes, enable });
  }

  async function cmdSetShareLimits(hashes: string[], ratioLimit: number, seedingTimeLimit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_share_limits', { hashes, ratioLimit, seedingTimeLimit });
  }

  async function cmdSetSequentialDownload(hashes: string[], value: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_sequential_download', { hashes, value });
  }

  async function cmdSetFirstLastPiecePriority(hashes: string[], value: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_first_last_piece_priority', { hashes, value });
  }

  async function cmdSetSuperSeeding(hashes: string[], value: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_super_seeding', { hashes, value });
  }

  async function cmdExportTorrent(hash: string, savePath: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('export_torrent', { hash, savePath });
  }

  async function cmdAddPeers(hashes: string[], peers: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('add_peers', { hashes, peers });
  }

  // Transfer commands
  async function cmdGetTransferInfo(): Promise<TransferInfoResponse> {
    return t.invoke('get_transfer_info');
  }

  async function cmdGetSpeedLimitsMode(): Promise<SpeedLimitsModeResponse> {
    return t.invoke('get_speed_limits_mode');
  }

  async function cmdToggleSpeedLimitsMode(): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('toggle_speed_limits_mode');
  }

  async function cmdGetDownloadLimit(): Promise<DownloadLimitResponse> {
    return t.invoke('get_download_limit');
  }

  async function cmdSetDownloadLimit(limit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_download_limit', { limit });
  }

  async function cmdGetUploadLimit(): Promise<UploadLimitResponse> {
    return t.invoke('get_upload_limit');
  }

  async function cmdSetUploadLimit(limit: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_upload_limit', { limit });
  }

  async function cmdBanPeers(peers: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('ban_peers', { peers });
  }

  async function cmdGetCookies(): Promise<unknown> {
    return t.invoke('get_cookies');
  }

  async function cmdSetCookies(url: string, cookies: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_cookies', { url, cookies });
  }

  async function cmdLogout(): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('logout');
  }

  // Category commands
  async function cmdGetCategories(): Promise<CategoriesResponse> {
    return t.invoke('get_categories');
  }

  async function cmdCreateCategory(category: string, savePath: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('create_category', { category, savePath });
  }

  async function cmdEditCategory(category: string, savePath: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('edit_category', { category, savePath });
  }

  async function cmdRemoveCategories(categories: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('remove_categories', { categories });
  }

  // Tag commands
  async function cmdGetTags(): Promise<TagsResponse> {
    return t.invoke('get_tags');
  }

  async function cmdCreateTags(tags: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('create_tags', { tags });
  }

  async function cmdDeleteTags(tags: string[]): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('delete_tags', { tags });
  }

  // Application commands
  async function cmdGetPreferences(): Promise<PreferencesResponse> {
    return t.invoke('get_preferences');
  }

  async function cmdSetPreferences(prefs: Partial<Preferences>): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('set_preferences', { prefs });
  }

  async function cmdGetDefaultSavePath(): Promise<DefaultSavePathResponse> {
    return t.invoke('get_default_save_path');
  }

  async function cmdShutdownServer(): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('shutdown_server');
  }

  // Search commands
  async function cmdStartSearch(query: string, plugins: string, category: string): Promise<{ id: number }> {
    return t.invoke<{ id: number }>('start_search', { query, plugins, category });
  }

  async function cmdStopSearch(id: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('stop_search', { id });
  }

  async function cmdGetSearchStatus(id?: number): Promise<SearchStatus[]> {
    return t.invoke<SearchStatus[]>('get_search_status', { id: id ?? null });
  }

  async function cmdGetSearchResults(
    id: number,
    limit?: number,
    offset?: number,
  ): Promise<SearchResults> {
    return t.invoke<SearchResults>('get_search_results', {
      id,
      limit: limit ?? null,
      offset: offset ?? null,
    });
  }

  async function cmdDeleteSearch(id: number): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('delete_search', { id });
  }

  async function cmdGetSearchPlugins(): Promise<SearchPlugin[]> {
    return t.invoke<SearchPlugin[]>('get_search_plugins');
  }

  async function cmdInstallSearchPlugin(sources: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('install_search_plugin', { sources });
  }

  async function cmdUninstallSearchPlugin(names: string): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('uninstall_search_plugin', { names });
  }

  async function cmdEnableSearchPlugin(names: string, enable: boolean): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('enable_search_plugin', { names, enable });
  }

  async function cmdUpdateSearchPlugins(): Promise<OperationResponse> {
    return t.invoke<OperationResponse>('update_search_plugins');
  }

  // Server management commands (unprefixed)
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
    credentials: { username: string; password: string }
  ): Promise<{ success: boolean; error?: string }> {
    return servers.testServerConnection(serverUrl, { username: credentials.username, password: credentials.password });
  }

  async function testSavedServerConnection(serverId: string): Promise<{ success: boolean; error?: string }> {
    return servers.testSavedServerConnection(serverId);
  }

  async function getPathMappings(serverId: string): Promise<PathMapping[]> {
    return t.invoke<PathMapping[]>('get_path_mappings', { serverId });
  }

  async function setPathMappings(serverId: string, mappings: PathMapping[]): Promise<void> {
    return t.invoke<void>('set_path_mappings', { serverId, mappings });
  }

  // Return the adapter object
  return {
    capabilities: DESKTOP_CAPABILITIES,

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

    async sessionHealthCheck(): Promise<boolean> {
      return session.sessionHealthCheck();
    },

    async checkForUpdate(): Promise<AppUpdateInfo | null> {
      const updater = await import('../desktop/updater');
      return updater.checkForUpdate();
    },

    async downloadAndInstallUpdate(onProgress?: (event: AppUpdateProgress) => void): Promise<void> {
      const updater = await import('../desktop/updater');
      return updater.downloadAndInstallUpdate(onProgress);
    },

    async relaunchApp(): Promise<void> {
      const updater = await import('../desktop/updater');
      return updater.relaunchApp();
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

    torrents: {
      async getList(params?: TorrentListParams): Promise<TorrentListResponse> {
        return cmdGetTorrentList(params);
      },

      async pause(hashes: string[]): Promise<OperationResponse> {
        return cmdPauseTorrents(hashes);
      },

      async resume(hashes: string[]): Promise<OperationResponse> {
        return cmdResumeTorrents(hashes);
      },

      async delete(hashes: string[], deleteFiles: boolean): Promise<OperationResponse> {
        return cmdDeleteTorrents(hashes, deleteFiles);
      },

      async recheck(hashes: string[]): Promise<OperationResponse> {
        return cmdRecheckTorrents(hashes);
      },

      async reannounce(hashes: string[]): Promise<OperationResponse> {
        return cmdReannounceTorrents(hashes);
      },

      async setForceStart(hashes: string[], value: boolean): Promise<OperationResponse> {
        return cmdSetForceStart(hashes, value);
      },

      async setCategory(hashes: string[], category: string): Promise<OperationResponse> {
        return cmdSetTorrentCategory(hashes, category);
      },

      async setName(hash: string, name: string): Promise<OperationResponse> {
        return cmdSetTorrentName(hash, name);
      },

      async setLocation(hashes: string[], location: string): Promise<OperationResponse> {
        return cmdSetTorrentLocation(hashes, location);
      },

      async increasePriority(hashes: string[]): Promise<OperationResponse> {
        return cmdIncreasePriority(hashes);
      },

      async decreasePriority(hashes: string[]): Promise<OperationResponse> {
        return cmdDecreasePriority(hashes);
      },

      async topPriority(hashes: string[]): Promise<OperationResponse> {
        return cmdTopPriority(hashes);
      },

      async bottomPriority(hashes: string[]): Promise<OperationResponse> {
        return cmdBottomPriority(hashes);
      },

      async addTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
        return cmdAddTorrentTags(hashes, tags);
      },

      async removeTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
        return cmdRemoveTorrentTags(hashes, tags);
      },

      // Desktop Tauri returns typed { properties } / { trackers } / { files }
      // envelopes — unwrap to expose the plain typed detail payload to consumers.
      async getProperties(hash: string): Promise<TorrentPropertiesResponse> {
        const response = await cmdGetTorrentProperties(hash);
        return response.properties;
      },

      async getTrackers(hash: string): Promise<TorrentTrackersResponse> {
        const response = await cmdGetTorrentTrackers(hash);
        return response.trackers;
      },

      async getFiles(hash: string): Promise<TorrentFilesResponse> {
        try {
          const response = await cmdGetTorrentFiles(hash);
          const files = response.files;
          console.info(
            `[bridge] getFiles hash=${hash.slice(0, 8)}… file_count=${files.length}`,
          );
          if (files.length === 0) {
            console.warn(
              `[bridge] getFiles hash=${hash.slice(0, 8)}… returned EMPTY file list`,
            );
          }
          return files;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[bridge] getFiles hash=${hash.slice(0, 8)}… FAILED: ${msg}`,
            err,
          );
          throw err;
        }
      },

      async addTorrent(options: AddTorrentOptions): Promise<OperationResponse> {
        return cmdAddTorrent(options);
      },

      async setDownloadLimit(hashes: string[], limit: number): Promise<OperationResponse> {
        return cmdSetTorrentDownloadLimit(hashes, limit);
      },

      async setUploadLimit(hashes: string[], limit: number): Promise<OperationResponse> {
        return cmdSetTorrentUploadLimit(hashes, limit);
      },

      async setFilePriority(hash: string, ids: number[], priority: number): Promise<OperationResponse> {
        return cmdSetFilePriority(hash, ids, priority);
      },

      async addTrackers(hash: string, urls: string): Promise<OperationResponse> {
        return cmdAddTrackers(hash, urls);
      },

      async editTracker(hash: string, origUrl: string, newUrl: string): Promise<OperationResponse> {
        return cmdEditTracker(hash, origUrl, newUrl);
      },

      async removeTrackers(hash: string, urls: string): Promise<OperationResponse> {
        return cmdRemoveTrackers(hash, urls);
      },

      async getWebSeeds(hash: string): Promise<TorrentWebseedsResponse> {
        return cmdGetTorrentWebseeds(hash);
      },

      async addWebSeeds(hash: string, urls: string): Promise<OperationResponse> {
        return cmdAddWebSeeds(hash, urls);
      },

      async editWebSeed(hash: string, origUrl: string, newUrl: string): Promise<OperationResponse> {
        return cmdEditWebSeed(hash, origUrl, newUrl);
      },

      async removeWebSeeds(hash: string, urls: string): Promise<OperationResponse> {
        return cmdRemoveWebSeeds(hash, urls);
      },

      async renameFile(hash: string, oldPath: string, newPath: string): Promise<OperationResponse> {
        return cmdRenameFile(hash, oldPath, newPath);
      },

      async renameFolder(hash: string, oldPath: string, newPath: string): Promise<OperationResponse> {
        return cmdRenameFolder(hash, oldPath, newPath);
      },

      async getDownloadLimit(hashes: string[]): Promise<DownloadLimitResponse> {
        return cmdGetTorrentDownloadLimit(hashes);
      },

      async getUploadLimit(hashes: string[]): Promise<UploadLimitResponse> {
        return cmdGetTorrentUploadLimit(hashes);
      },

      async syncTorrentPeers(hash: string, rid?: number): Promise<SyncTorrentPeers> {
        return cmdSyncTorrentPeers(hash, rid);
      },

      async setAutoManagement(hashes: string[], enable: boolean): Promise<OperationResponse> {
        return cmdSetAutoManagement(hashes, enable);
      },

      async setShareLimits(hashes: string[], ratioLimit: number, seedingTimeLimit: number): Promise<OperationResponse> {
        return cmdSetShareLimits(hashes, ratioLimit, seedingTimeLimit);
      },

      async setSequentialDownload(hashes: string[], value: boolean): Promise<OperationResponse> {
        return cmdSetSequentialDownload(hashes, value);
      },

      async setFirstLastPiecePriority(hashes: string[], value: boolean): Promise<OperationResponse> {
        return cmdSetFirstLastPiecePriority(hashes, value);
      },

      async setSuperSeeding(hashes: string[], value: boolean): Promise<OperationResponse> {
        return cmdSetSuperSeeding(hashes, value);
      },

      async exportTorrent(hash: string, savePath: string): Promise<OperationResponse> {
        return cmdExportTorrent(hash, savePath);
      },

      async addPeers(hashes: string[], peers: string[]): Promise<OperationResponse> {
        return cmdAddPeers(hashes, peers);
      },
    },

    transfer: {
      async getInfo(): Promise<TransferInfoResponse> {
        return cmdGetTransferInfo();
      },

      async getSpeedLimitsMode(): Promise<SpeedLimitsModeResponse> {
        return cmdGetSpeedLimitsMode();
      },

      async toggleSpeedLimitsMode(): Promise<OperationResponse> {
        return cmdToggleSpeedLimitsMode();
      },

      async getDownloadLimit(): Promise<DownloadLimitResponse> {
        return cmdGetDownloadLimit();
      },

      async setDownloadLimit(limit: number): Promise<OperationResponse> {
        return cmdSetDownloadLimit(limit);
      },

      async getUploadLimit(): Promise<UploadLimitResponse> {
        return cmdGetUploadLimit();
      },

      async setUploadLimit(limit: number): Promise<OperationResponse> {
        return cmdSetUploadLimit(limit);
      },

      async banPeers(peers: string[]): Promise<OperationResponse> {
        return cmdBanPeers(peers);
      },

      async getCookies(): Promise<unknown> {
        return cmdGetCookies();
      },

      async setCookies(url: string, cookies: string): Promise<OperationResponse> {
        return cmdSetCookies(url, cookies);
      },
    },

    categories: {
      async getCategories(): Promise<CategoriesResponse> {
        return cmdGetCategories();
      },

      async createCategory(category: string, savePath: string): Promise<OperationResponse> {
        return cmdCreateCategory(category, savePath);
      },

      async editCategory(category: string, savePath: string): Promise<OperationResponse> {
        return cmdEditCategory(category, savePath);
      },

      async removeCategories(categories: string[]): Promise<OperationResponse> {
        return cmdRemoveCategories(categories);
      },
    },

    tags: {
      async getTags(): Promise<TagsResponse> {
        return cmdGetTags();
      },

      async createTags(tags: string[]): Promise<OperationResponse> {
        return cmdCreateTags(tags);
      },

      async deleteTags(tags: string[]): Promise<OperationResponse> {
        return cmdDeleteTags(tags);
      },

      async addTorrentTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
        return cmdAddTorrentTags(hashes, tags);
      },

      async removeTorrentTags(hashes: string[], tags: string[]): Promise<OperationResponse> {
        return cmdRemoveTorrentTags(hashes, tags);
      },
    },

    application: {
      async getPreferences(): Promise<PreferencesResponse> {
        return cmdGetPreferences();
      },

      async setPreferences(prefs: Partial<Preferences>): Promise<OperationResponse> {
        return cmdSetPreferences(prefs);
      },

      async getDefaultSavePath(): Promise<DefaultSavePathResponse> {
        return cmdGetDefaultSavePath();
      },

      async shutdown(): Promise<OperationResponse> {
        return cmdShutdownServer();
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
        return cmdLogout();
      },
      async startSearch(query: string, plugins: string, category: string): Promise<{ id: number }> {
        return cmdStartSearch(query, plugins, category);
      },

      async stopSearch(id: number): Promise<OperationResponse> {
        return cmdStopSearch(id);
      },

      async getSearchStatus(id?: number): Promise<SearchStatus[]> {
        return cmdGetSearchStatus(id);
      },

      async getSearchResults(id: number, limit?: number, offset?: number): Promise<SearchResults> {
        return cmdGetSearchResults(id, limit, offset);
      },

      async deleteSearch(id: number): Promise<OperationResponse> {
        return cmdDeleteSearch(id);
      },

      async getSearchPlugins(): Promise<SearchPlugin[]> {
        return cmdGetSearchPlugins();
      },

      async installSearchPlugin(sources: string): Promise<OperationResponse> {
        return cmdInstallSearchPlugin(sources);
      },

      async uninstallSearchPlugin(names: string): Promise<OperationResponse> {
        return cmdUninstallSearchPlugin(names);
      },

      async enableSearchPlugin(names: string, enable: boolean): Promise<OperationResponse> {
        return cmdEnableSearchPlugin(names, enable);
      },

      async updateSearchPlugins(): Promise<OperationResponse> {
        return cmdUpdateSearchPlugins();
      },
    },

    async exitApp(): Promise<void> {
      return t.invoke('exit_app');
    },

    async getPathMappings(serverId: string): Promise<PathMapping[]> {
      return getPathMappings(serverId);
    },

    async setPathMappings(serverId: string, mappings: PathMapping[]): Promise<void> {
      return setPathMappings(serverId, mappings);
    },

    async syncMenuState(state: NativeMenuState): Promise<void> {
      return t.invoke('sync_menu_state', { state });
    },

    async getPendingNativeUiActions(): Promise<NativeUiAction[]> {
      return t.invoke('get_pending_native_ui_actions');
    },

    async getPendingViewActions(): Promise<string[]> {
      return t.invoke('get_pending_view_actions');
    },

    async setViewListenersReady(): Promise<void> {
      return t.invoke('set_view_listeners_ready');
    },

    async resetViewListenersReady(): Promise<void> {
      return t.invoke('reset_view_listeners_ready');
    },

    async getDownloadCompletionNotificationsEnabled(): Promise<boolean> {
      return t.invoke<boolean>('get_download_completion_notifications_enabled');
    },

    async setDownloadCompletionNotificationsEnabled(enabled: boolean): Promise<void> {
      return t.invoke<void>('set_download_completion_notifications_enabled', { enabled });
    },

    async resolveLocalPath(serverId: string, serverPath: string): Promise<ResolveResult> {
      return t.invoke<ResolveResult>('resolve_local_path', { serverId, serverPath });
    },

    async openLocalPath(path: string): Promise<void> {
      return t.invoke<void>('open_local_path', { path });
    },

    async revealLocalItem(path: string): Promise<void> {
      return t.invoke<void>('reveal_local_item', { path });
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
        credentials: { username: string; password: string }
      ): Promise<{ success: boolean; error?: string }> {
        return testServerConnection(serverUrl, credentials);
      },

      async testSavedServerConnection(serverId: string): Promise<{ success: boolean; error?: string }> {
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
  };
}

/**
 * Desktop bridge adapter - uses default Tauri transport.
 * Use createDesktopBridge(transport?) for custom transport injection.
 */
export const BridgeAdapter = createDesktopBridge();
