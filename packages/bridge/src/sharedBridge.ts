// Shared bridge helpers — extracted from desktop.ts and mobile-tauri.ts
// These are pure invoke wrappers with no platform-specific logic.
//
// Key extraction rationale:
// - Session lifecycle helpers are ~100% identical across both platforms
// - Torrent/transfer/category/tag/search/server wrappers differ only in naming prefix
//   (cmd_* on desktop, unprefixed on mobile)
// - Add-torrent payload normalization is Rust-owned (T156); the bridge
//   passes the typed frontend intent directly without null-filling or
//   qBittorrent field-name translation.
//
// The two add-torrent payload builders that used to live here were removed
// in T156.2 — the only remaining field mapping (torrentFiles → torrent_files)
// is a TypeScript-to-Rust struct naming convention, not qBittorrent
// serialization ownership.

import type { Transport } from './transport';
import type {
  OperationResponse,
  SavedServerSummary,
  AddServerInput,
  UpdateServerInput,
  RSSItemsResponse,
  RSSRulesResponse,
  RssRuleInput,
  MaindataSnapshotResponse,
  MaindataSyncHealth,
  MaindataSyncChangedEvent,
  WorkspaceView,
  WorkspaceViewRequest,
  SearchPlugin,
  SearchResults,
  SearchStatus,
} from './types';

// -----------------------------------------------------------------------------
// Generic invoke factory
// -----------------------------------------------------------------------------

/** Creates a simple invoke wrapper bound to a transport. */
export function makeInvoke<TArgs extends Record<string, unknown>, TResponse>(
  t: Transport,
  cmd: string
): (args: TArgs) => Promise<TResponse> {
  return (args: TArgs) => t.invoke<TResponse>(cmd, args);
}

/** Creates a no-args invoke wrapper. */
export function makeInvokeNoArgs<TResponse>(t: Transport, cmd: string): () => Promise<TResponse> {
  return () => t.invoke<TResponse>(cmd);
}

// -----------------------------------------------------------------------------
// Session lifecycle helpers
// These are ~100% identical between desktop and mobile.
// Extract once; both adapters import and call with their transport.
// -----------------------------------------------------------------------------

export interface SessionHelpers {
  getSessionSnapshot: () => Promise<import('./types').SessionSnapshot>;
  sessionConnectById: (serverId: string) => Promise<number>;
  sessionDisconnect: () => Promise<number>;
  sessionReconnect: () => Promise<number>;
  sessionSwitchServer: (
    serverId: string,
    serverName: string,
    serverUrl: string,
    serverUsername: string,
    serverPassword: string
  ) => Promise<number>;
  sessionSwitchServerById: (serverId: string) => Promise<number>;
  sessionSetError: (error: string) => Promise<number>;
  sessionClearError: () => Promise<number>;
  sessionSetConnecting: (
    serverId: string,
    serverName: string,
    serverUrl: string,
    serverUsername: string,
    serverPassword: string
  ) => Promise<number>;
  getSessionGeneration: () => Promise<number>;
  getSessionStatus: () => Promise<import('./types').SessionStatus>;
  sessionHealthCheck: () => Promise<boolean>;
}

export function createSessionHelpers(t: Transport): SessionHelpers {
  return {
    getSessionSnapshot: () => t.invoke<import('./types').SessionSnapshot>('get_session_snapshot'),
    sessionConnectById: (serverId) => t.invoke<number>('session_connect_by_id', { serverId }),
    sessionDisconnect: () => t.invoke<number>('session_disconnect'),
    sessionReconnect: () => t.invoke<number>('session_reconnect'),
    sessionSwitchServer: (serverId, serverName, serverUrl, serverUsername, serverPassword) =>
      t.invoke<number>('session_switch_server', {
        serverId,
        serverName,
        serverUrl,
        serverUsername,
        serverPassword,
      }),
    sessionSwitchServerById: (serverId) =>
      t.invoke<number>('session_switch_server_by_id', { serverId }),
    sessionSetError: (error) => t.invoke<number>('session_set_error', { error }),
    sessionClearError: () => t.invoke<number>('session_clear_error'),
    sessionSetConnecting: (serverId, serverName, serverUrl, serverUsername, serverPassword) =>
      t.invoke<number>('session_set_connecting', {
        serverId,
        serverName,
        serverUrl,
        serverUsername,
        serverPassword,
      }),
    getSessionGeneration: () => t.invoke<number>('get_session_generation'),
    getSessionStatus: () => t.invoke<import('./types').SessionStatus>('get_session_status'),
    sessionHealthCheck: () => t.invoke<boolean>('session_health_check'),
  };
}

// -----------------------------------------------------------------------------
// Server helpers (shared between desktop and mobile)
// -----------------------------------------------------------------------------

export function createServerHelpers(t: Transport) {
  async function listServers(): Promise<SavedServerSummary[]> {
    return t.invoke<SavedServerSummary[]>('list_servers');
  }

  async function getActiveServer(): Promise<SavedServerSummary | null> {
    return t.invoke<SavedServerSummary | null>('get_active_server');
  }

  async function addServer(input: AddServerInput): Promise<SavedServerSummary> {
    return t.invoke<SavedServerSummary>('add_server', { input });
  }

  async function updateServer(input: UpdateServerInput): Promise<SavedServerSummary> {
    return t.invoke<SavedServerSummary>('update_server', { input });
  }

  async function removeServer(serverId: string): Promise<void> {
    return t.invoke<void>('remove_server', { serverId });
  }

  async function selectServer(serverId: string): Promise<void> {
    return t.invoke<void>('select_server', { serverId });
  }

  return {
    listServers,
    getActiveServer,
    addServer,
    updateServer,
    removeServer,
    selectServer,
  };
}

// -----------------------------------------------------------------------------
// QB Client helpers (shared search/RSS/logout)
// -----------------------------------------------------------------------------

export interface QbClientHelpers {
  getRssItems: () => Promise<RSSItemsResponse>;
  getRssRules: () => Promise<RSSRulesResponse>;
  addRssFeed: (path: string, url: string) => Promise<OperationResponse>;
  setRssFeedUrl: (path: string, url: string) => Promise<OperationResponse>;
  removeRssItem: (path: string) => Promise<OperationResponse>;
  setRssRule: (ruleName: string, rule: RssRuleInput) => Promise<OperationResponse>;
  renameRssRule: (ruleName: string, newRuleName: string) => Promise<OperationResponse>;
  removeRssRule: (ruleName: string) => Promise<OperationResponse>;
  logout: () => Promise<OperationResponse>;
  startSearch: (query: string, plugins: string, category: string) => Promise<{ id: number }>;
  stopSearch: (id: number) => Promise<OperationResponse>;
  // Rust-owned: T141.2 added qb_core DTO parsers behind the search read
  // commands. The bridge now exposes typed shapes instead of `unknown` so
  // consumers can drop wire-shape defensive normalization.
  getSearchStatus: (id?: number) => Promise<SearchStatus[]>;
  getSearchResults: (id: number, limit?: number, offset?: number) => Promise<SearchResults>;
  deleteSearch: (id: number) => Promise<OperationResponse>;
  getSearchPlugins: () => Promise<SearchPlugin[]>;
  installSearchPlugin: (sources: string) => Promise<OperationResponse>;
  uninstallSearchPlugin: (names: string) => Promise<OperationResponse>;
  enableSearchPlugin: (names: string, enable: boolean) => Promise<OperationResponse>;
  updateSearchPlugins: () => Promise<OperationResponse>;
}

export function createQbClientHelpers(t: Transport): QbClientHelpers {
  return {
    getRssItems: () =>
      // T142.3: qb-tauri now returns a real session-scoped envelope
      // ({ session_generation, server_id, items }) with typed
      // `RssItem[]` rows, so we forward the typed response directly
      // instead of synthesizing `session_generation: 0, server_id: null`.
      t.invoke<RSSItemsResponse>('get_rss_items'),
    getRssRules: () =>
      // T142.3: same as `getRssItems` above — qb-tauri now returns a real
      // session-scoped envelope with typed `RssRule[]` rows, so the
      // bridge forwards the typed response directly.
      t.invoke<RSSRulesResponse>('get_rss_rules'),
    addRssFeed: (path, url) =>
      t.invoke<OperationResponse>('add_rss_feed', { path, url }),
    setRssFeedUrl: (path, url) =>
      t.invoke<OperationResponse>('set_rss_feed_url', { path, url }),
    removeRssItem: (path) =>
      t.invoke<OperationResponse>('remove_rss_item', { path }),
    setRssRule: (ruleName, rule) =>
      t.invoke<OperationResponse>('set_rss_rule', { ruleName, ruleDef: JSON.stringify(rule) }),
    renameRssRule: (ruleName, newRuleName) =>
      t.invoke<OperationResponse>('rename_rss_rule', { ruleName, newRuleName }),
    removeRssRule: (ruleName) =>
      t.invoke<OperationResponse>('remove_rss_rule', { ruleName }),
    logout: () => t.invoke<OperationResponse>('logout'),
    startSearch: (query, plugins, category) =>
      t.invoke<{ id: number }>('start_search', { query, plugins, category }),
    stopSearch: (id) => t.invoke<OperationResponse>('stop_search', { id }),
    getSearchStatus: (id?: number) =>
      t.invoke<SearchStatus[]>('get_search_status', { id: id ?? null }),
    getSearchResults: (id, limit?: number, offset?: number) =>
      t.invoke<SearchResults>('get_search_results', {
        id,
        limit: limit ?? null,
        offset: offset ?? null,
      }),
    deleteSearch: (id) => t.invoke<OperationResponse>('delete_search', { id }),
    getSearchPlugins: () => t.invoke<SearchPlugin[]>('get_search_plugins'),
    installSearchPlugin: (sources) =>
      t.invoke<OperationResponse>('install_search_plugin', { sources }),
    uninstallSearchPlugin: (names) =>
      t.invoke<OperationResponse>('uninstall_search_plugin', { names }),
    enableSearchPlugin: (names, enable) =>
      t.invoke<OperationResponse>('enable_search_plugin', { names, enable }),
    updateSearchPlugins: () => t.invoke<OperationResponse>('update_search_plugins'),
  };
}

// ---------------------------------------------------------------------------
// Rust-owned sync helpers (T130)
// ---------------------------------------------------------------------------

export interface SyncHelpers {
  getMaindataSnapshot: () => Promise<MaindataSnapshotResponse>;
  getMaindataSyncStatus: () => Promise<MaindataSyncHealth>;
  startMaindataSync: () => Promise<void>;
  stopMaindataSync: (serverId: string) => Promise<void>;
  /**
   * Rust-owned: add a listener for maindata sync change events.
   * Returns a synchronous unsubscribe function that is safe to call before
   * the async listener registration resolves.
   */
  addMaindataSyncListener(
    handler: (event: MaindataSyncChangedEvent) => void
  ): () => void;
}

export function createSyncHelpers(t: Transport): SyncHelpers {
  return {
    getMaindataSnapshot: () => t.invoke<MaindataSnapshotResponse>('get_maindata_snapshot'),
    getMaindataSyncStatus: () => t.invoke<MaindataSyncHealth>('get_maindata_sync_status'),
    startMaindataSync: () => t.invoke<void>('start_maindata_sync'),
    stopMaindataSync: (serverId: string) => t.invoke<void>('stop_maindata_sync', { serverId }),
    addMaindataSyncListener(handler) {
      // Wrapper must be synchronous so callers can unsubscribe before the async
      // listen() registration completes.
      let unsubscribeFn: (() => void) | null = null;
      let settled = false;

      // Register the listener asynchronously. Attach a rejection handler so a
      // failed transport.listen() surfaces as a best-effort warning instead of
      // becoming an unhandled promise rejection (T136 advisory).
      t.listen<MaindataSyncChangedEvent>('maindata-sync-changed', handler).then(
        (unlisten) => {
          if (!settled) {
            // Registration completed before unsubscribe was called — wire up the real unlisten
            unsubscribeFn = unlisten;
          }
          // else: unsubscribe() was called before registration resolved — discard unlisten
        },
        (error: unknown) => {
          // Registration failed. Log deliberately so the rejection is handled
          // but does not crash the host. Unsubscribe remains a no-op for this
          // listener because there is nothing to detach on the transport side.
          console.warn(
            '[bridge] maindata sync listener registration failed',
            error
          );
        }
      );

      // Synchronous unsubscribe function — safe to call before listen() resolves
      return () => {
        settled = true;
        if (unsubscribeFn) {
          unsubscribeFn();
        }
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Rust-owned workspace view helpers (P2.3-TS)
//
// Mirrors the `addMaindataSyncListener` synchronous-unsubscribe pattern:
// callers must be able to unsubscribe before the async listen()
// registration resolves (e.g. effect cleanup that runs immediately on
// teardown). The wrapper captures a single unlisten handle and discards
// it if unsubscribe fires before registration completes.
// ---------------------------------------------------------------------------

export interface WorkspaceViewHelpers {
  /**
   * Rust-owned: set the active workspace view request and return the
   * computed view inline. Triggers a recompute against the current
   * maindata snapshot; the `workspace-view-changed` event is emitted only
   * when the recomputed view differs from the cached one.
   */
  setWorkspaceView: (request: WorkspaceViewRequest) => Promise<WorkspaceView>;
  /**
   * Rust-owned: return the cached last workspace view, or `null` if none
   * has been computed. Does not trigger a recompute.
   */
  getWorkspaceView: () => Promise<WorkspaceView | null>;
  /**
   * Rust-owned: add a listener for `workspace-view-changed` events.
   * Returns a synchronous unsubscribe function that is safe to call
   * before the async listener registration resolves.
   */
  addWorkspaceViewListener: (handler: (event: WorkspaceView) => void) => () => void;
}

export function createWorkspaceViewHelpers(t: Transport): WorkspaceViewHelpers {
  return {
    setWorkspaceView: (request) =>
      t.invoke<WorkspaceView>('set_workspace_view', { request }),
    getWorkspaceView: () => t.invoke<WorkspaceView | null>('get_workspace_view'),
    addWorkspaceViewListener(handler) {
      // Synchronous unsubscribe wrapper — see `createSyncHelpers` for the
      // shared pattern. Captures the async unlisten handle so callers can
      // tear down the subscription even if registration is still pending.
      let unsubscribeFn: (() => void) | null = null;
      let settled = false;

      t.listen<WorkspaceView>('workspace-view-changed', handler).then(
        (unlisten) => {
          if (!settled) {
            unsubscribeFn = unlisten;
          }
          // else: unsubscribe() fired before listen() resolved — drop the handle
        },
        (error: unknown) => {
          // Best-effort warning so a failed registration does not become an
          // unhandled promise rejection (T136 advisory).
          console.warn(
            '[bridge] workspace view listener registration failed',
            error
          );
        }
      );

      return () => {
        settled = true;
        if (unsubscribeFn) {
          unsubscribeFn();
        }
      };
    },
  };
}
