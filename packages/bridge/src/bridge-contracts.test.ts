/// <reference types="node" />

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

import { createDesktopBridge } from './adapters/desktop';
import { createMobileTauriBridge } from './adapters/mobile-tauri';
import { createSessionHelpers } from './sharedBridge';
import { createTransportWithFactory, type Transport } from './transport/transport';
import type { NativeMenuState, NativeUiAction } from './contracts/interfaces';
import type { Torrent, TorrentFile, TorrentProperties, Tracker } from '@taurent/shared/types/qbittorrent';

function createMockTransport(implementation?: (cmd: string, args?: Record<string, unknown>) => unknown) {
  const invoke = vi.fn(async (cmd: string, args?: Record<string, unknown>) => implementation?.(cmd, args));
  const listen = vi.fn(async () => () => {});

  return {
    transport: { invoke, listen } as Transport,
    invoke,
    listen,
  };
}

describe('bridge contract coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a transport and factory pair', () => {
    const { transport } = createMockTransport();
    const factory = vi.fn(() => transport);

    const result = createTransportWithFactory(factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(result.transport).toBe(transport);
    expect(result.factory).toBe(factory);
  });

  it('uses the expected session command names and payloads', async () => {
    const transport = createMockTransport();
    const session = createSessionHelpers(transport.transport);

    await session.getSessionSnapshot();
    await session.sessionConnectById('srv-1');
    await session.sessionDisconnect();
    await session.sessionReconnect();
    await session.sessionSwitchServer('srv-1', 'Server', 'http://localhost', 'user', 'pass');
    await session.sessionSwitchServerById('srv-2');
    await session.sessionSetError('oops');
    await session.sessionClearError();
    await session.sessionSetConnecting('srv-2', 'Alt', 'http://alt', 'alt-user', 'alt-pass');
    await session.getSessionGeneration();
    await session.getSessionStatus();
    await session.sessionHealthCheck();

    expect(transport.invoke.mock.calls).toEqual([
      ['get_session_snapshot'],
      ['session_connect_by_id', { serverId: 'srv-1' }],
      ['session_disconnect'],
      ['session_reconnect'],
      [
        'session_switch_server',
        {
          serverId: 'srv-1',
          serverName: 'Server',
          serverUrl: 'http://localhost',
          serverUsername: 'user',
          serverPassword: 'pass',
        },
      ],
      ['session_switch_server_by_id', { serverId: 'srv-2' }],
      ['session_set_error', { error: 'oops' }],
      ['session_clear_error'],
      [
        'session_set_connecting',
        {
          serverId: 'srv-2',
          serverName: 'Alt',
          serverUrl: 'http://alt',
          serverUsername: 'alt-user',
          serverPassword: 'alt-pass',
        },
      ],
      ['get_session_generation'],
      ['get_session_status'],
      ['session_health_check'],
    ]);
  });

  it('covers desktop bridge command names, parsing, validation fallback, and probe wiring', async () => {
    const transport = createMockTransport((cmd, _args) => {
      switch (cmd) {
        case 'get_torrent_properties':
          return { properties: { save_path: '/downloads' } };
        case 'get_torrent_trackers':
          return { trackers: [{ url: 'udp://tracker' }] };
        case 'get_torrent_files':
          return { files: [{ name: 'file-1.mkv' }] };
        case 'sync_torrent_peers':
          // Rust now owns the validation boundary; bridge returns the raw parsed shape.
          return { rid: 7, full_update: true, peers: {}, peers_removed: [] };
        default:
          return { ok: true };
      }
    });
    const bridge = createDesktopBridge(transport.transport);

    await expect(bridge.torrents.pause(['hash-1'])).resolves.toEqual({ ok: true });
    await expect(bridge.torrents.getProperties('hash-1')).resolves.toEqual({ save_path: '/downloads' });
    await expect(bridge.torrents.getTrackers('hash-1')).resolves.toEqual([{ url: 'udp://tracker' }]);
    await expect(bridge.torrents.getFiles('hash-1')).resolves.toEqual([{ name: 'file-1.mkv' }]);
    // Typed plain-payload contract (T140.3): bridge returns the inner typed
    // payload, not the raw Rust envelope.
    const desktopProperties = await bridge.torrents.getProperties('hash-1');
    expect(desktopProperties).not.toHaveProperty('properties');
    const desktopTrackers = await bridge.torrents.getTrackers('hash-1');
    expect(desktopTrackers).not.toHaveProperty('trackers');
    const desktopFiles = await bridge.torrents.getFiles('hash-1');
    expect(desktopFiles).not.toHaveProperty('files');
    // Rust validation is now the canonical boundary; bridge returns parsed shape directly.
    const validPeers = await bridge.torrents.syncTorrentPeers('valid-hash', 3);
    expect(validPeers).toMatchObject({ rid: 7, full_update: true });

    await bridge.torrents.addTorrent({
      urls: 'magnet:?xt=urn:btih:123',
      torrentFiles: ['one.torrent'],
      sequential_download: true,
      paused: true,
      up_limit: 10,
      dl_limit: 20,
    });

    if (!bridge.sessionHealthCheck) {
      throw new Error('desktop bridge should expose sessionHealthCheck');
    }

    await bridge.sessionHealthCheck();
    await bridge.sessionSwitchServerById('srv-atomic');

    expect(transport.invoke).toHaveBeenCalledWith('session_health_check');
    expect(transport.invoke).toHaveBeenCalledWith('session_switch_server_by_id', { serverId: 'srv-atomic' });
    await bridge.exitApp();
    await bridge.syncMenuState({ canPause: true } as never);
    await bridge.getPendingNativeUiActions();

    expect(transport.invoke).toHaveBeenCalledWith('pause_torrents', { hashes: ['hash-1'] });
    expect(transport.invoke).toHaveBeenCalledWith('add_torrent_options', {
      options: {
        urls: 'magnet:?xt=urn:btih:123',
        torrent_files: ['one.torrent'],
        sequential_download: true,
        paused: true,
        up_limit: 10,
        dl_limit: 20,
      },
    });
    expect(transport.invoke).toHaveBeenCalledWith('session_health_check');
    expect(transport.invoke).toHaveBeenCalledWith('exit_app');
    expect(transport.invoke).toHaveBeenCalledWith('sync_menu_state', { state: { canPause: true } });
    expect(transport.invoke).toHaveBeenCalledWith('get_pending_native_ui_actions');
  });

  it('passes extended tray menu state through sync_menu_state unchanged', async () => {
    const transport = createMockTransport();
    const bridge = createDesktopBridge(transport.transport);
    const state: NativeMenuState = {
      can_pause: true,
      can_resume: false,
      can_delete: true,
      can_recheck: true,
      can_reannounce: false,
      can_force_start: true,
      can_set_category: true,
      can_set_tags: true,
      can_queue_up: false,
      can_queue_down: true,
      can_move_top: false,
      can_move_bottom: true,
      view_sidebar: true,
      view_details: false,
      in_window_menubar: true,
      tray_alt_speed_active: true,
      tray_connected: true,
    };

    await bridge.syncMenuState(state);

    expect(transport.invoke).toHaveBeenCalledWith('sync_menu_state', { state });
  });

  it('getDownloadCompletionNotificationsEnabled invokes get_download_completion_notifications_enabled with no args', async () => {
    const transport = createMockTransport(() => true);
    const bridge = createDesktopBridge(transport.transport);

    await expect(bridge.getDownloadCompletionNotificationsEnabled()).resolves.toBe(true);
    expect(transport.invoke).toHaveBeenCalledWith('get_download_completion_notifications_enabled');
    expect(transport.invoke).toHaveBeenCalledTimes(1);
  });

  it('setDownloadCompletionNotificationsEnabled passes enabled boolean to the native command', async () => {
    const transport = createMockTransport();
    const bridge = createDesktopBridge(transport.transport);

    await bridge.setDownloadCompletionNotificationsEnabled(true);
    await bridge.setDownloadCompletionNotificationsEnabled(false);

    expect(transport.invoke).toHaveBeenCalledWith('set_download_completion_notifications_enabled', { enabled: true });
    expect(transport.invoke).toHaveBeenCalledWith('set_download_completion_notifications_enabled', { enabled: false });
    expect(transport.invoke).toHaveBeenCalledTimes(2);
  });

  it('returns tray pending native UI action variants unchanged', async () => {
    const pendingActions: NativeUiAction[] = [
      { type: 'add-torrent-source', source: 'file' },
      { type: 'add-torrent-source', source: 'link' },
      { type: 'set-global-speed-limits' },
    ];
    const transport = createMockTransport((cmd) => {
      if (cmd === 'get_pending_native_ui_actions') return pendingActions;
      return undefined;
    });
    const bridge = createDesktopBridge(transport.transport);

    await expect(bridge.getPendingNativeUiActions()).resolves.toEqual(pendingActions);
    expect(transport.invoke).toHaveBeenCalledWith('get_pending_native_ui_actions');
  });

  it('revealLocalItem delegates to Rust reveal_local_item command', async () => {
    const transport = createMockTransport();
    const bridge = createDesktopBridge(transport.transport);

    await bridge.revealLocalItem('/some/path');

    expect(transport.invoke).toHaveBeenCalledWith('reveal_local_item', { path: '/some/path' });
  });

  it('covers mobile bridge payload shapes and probe wiring', async () => {
    const transport = createMockTransport((cmd, args) => {
      switch (cmd) {
        case 'add_torrent':
          return { success: true };
        case 'sync_torrent_peers':
          // Rust owns the validation boundary; bridge returns parsed shape directly.
          return { rid: 5, full_update: false, peers: {}, peers_removed: [] };
        default:
          return { ok: true, echoed: args };
      }
    });
    const bridge = createMobileTauriBridge(transport.transport);

    await bridge.torrents.addTorrent({
      urls: 'magnet:?xt=urn:btih:abc',
      torrentFiles: ['movie.torrent'],
      savepath: '/downloads',
      skip_checking: true,
      sequential_download: true,
      up_limit: 10,
      dl_limit: 20,
      auto_tmm: true,
      first_last_piece_prio: true,
      content_layout: 'Subfolder',
      stop_condition: 'files',
      add_to_top: true,
    });
    await bridge.torrents.addTags(['hash-1'], ['tag-a', 'tag-b']);
    await bridge.torrents.removeTags(['hash-1'], ['tag-a', 'tag-b']);
    // Rust validation is now the canonical boundary; bridge returns parsed shape directly.
    const peers = await bridge.torrents.syncTorrentPeers('hash-1');
    expect(peers).toMatchObject({ rid: 5, full_update: false });
    if (!bridge.sessionHealthCheck) {
      throw new Error('mobile bridge should expose sessionHealthCheck');
    }

    await bridge.sessionHealthCheck();

    expect(transport.invoke).toHaveBeenCalledWith('add_torrent', {
      options: {
        urls: 'magnet:?xt=urn:btih:abc',
        torrent_files: ['movie.torrent'],
        savepath: '/downloads',
        skip_checking: true,
        sequential_download: true,
        up_limit: 10,
        dl_limit: 20,
        auto_tmm: true,
        first_last_piece_prio: true,
        content_layout: 'Subfolder',
        stop_condition: 'files',
        add_to_top: true,
      },
    });
    expect(transport.invoke).toHaveBeenCalledWith('add_tags', {
      hashes: ['hash-1'],
      tags: 'tag-a,tag-b',
    });
    expect(transport.invoke).toHaveBeenCalledWith('remove_tags', {
      hashes: ['hash-1'],
      tags: 'tag-a,tag-b',
    });
  });

  it('covers desktop bridge Rust-owned sync commands', async () => {
    const transport = createMockTransport((cmd) => {
      switch (cmd) {
        case 'get_maindata_snapshot':
          return {
            session_generation: 3,
            server_id: 'srv-1',
            revision: 99,
            rid: 100,
            health: { state: 'healthy', consecutive_errors: 0, last_success_ts: 1234567890, last_error_ts: null, last_error_message: null },
            maindata: { torrents: {}, categories: {}, tags: [], server_state: {} },
          };
        case 'get_maindata_sync_status':
          return { state: 'healthy', consecutive_errors: 0, last_success_ts: 1234567890, last_error_ts: null, last_error_message: null };
        default:
          return { ok: true };
      }
    });
    const bridge = createDesktopBridge(transport.transport);

    // Rust-owned sync methods
    await bridge.qBClient.getMaindataSnapshot();
    await bridge.qBClient.getMaindataSyncStatus();
    await bridge.qBClient.startMaindataSync();
    await bridge.qBClient.stopMaindataSync('srv-1');

    expect(transport.invoke).toHaveBeenCalledWith('get_maindata_snapshot');
    expect(transport.invoke).toHaveBeenCalledWith('get_maindata_sync_status');
    expect(transport.invoke).toHaveBeenCalledWith('start_maindata_sync');
    expect(transport.invoke).toHaveBeenCalledWith('stop_maindata_sync', { serverId: 'srv-1' });
  });

  it('covers mobile bridge Rust-owned sync commands', async () => {
    const transport = createMockTransport((cmd) => {
      switch (cmd) {
        case 'get_maindata_snapshot':
          return {
            session_generation: 3,
            server_id: 'srv-1',
            revision: 99,
            rid: 100,
            health: { state: 'degraded', consecutive_errors: 2, last_success_ts: 1234567890, last_error_ts: 1234567900, last_error_message: 'timeout' },
            maindata: { torrents: {}, categories: {}, tags: ['tag-a'], server_state: {} },
          };
        case 'get_maindata_sync_status':
          return { state: 'degraded', consecutive_errors: 2, last_success_ts: 1234567890, last_error_ts: 1234567900, last_error_message: 'timeout' };
        default:
          return { ok: true };
      }
    });
    const bridge = createMobileTauriBridge(transport.transport);

    // Rust-owned sync methods
    await bridge.qBClient.getMaindataSnapshot();
    await bridge.qBClient.getMaindataSyncStatus();
    await bridge.qBClient.startMaindataSync();
    await bridge.qBClient.stopMaindataSync('srv-2');

    expect(transport.invoke).toHaveBeenCalledWith('get_maindata_snapshot');
    expect(transport.invoke).toHaveBeenCalledWith('get_maindata_sync_status');
    expect(transport.invoke).toHaveBeenCalledWith('start_maindata_sync');
    expect(transport.invoke).toHaveBeenCalledWith('stop_maindata_sync', { serverId: 'srv-2' });
  });

  it('getMaindataSnapshot returns typed response with all envelope fields', async () => {
    const transport = createMockTransport(() => ({
      session_generation: 5,
      server_id: 'test-server',
      revision: 42,
      rid: 99,
      health: { state: 'idle', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
      maindata: {
        torrents: { 'hash-1': { name: 'test-torrent', progress: 0.5 } },
        categories: { videos: { name: 'videos', savePath: '/data' } },
        tags: ['tag-1', 'tag-2'],
        server_state: { dl_info_speed: 1024 },
      },
    }));
    const bridge = createDesktopBridge(transport.transport);

    const snapshot = await bridge.qBClient.getMaindataSnapshot();

    expect(snapshot).toEqual({
      session_generation: 5,
      server_id: 'test-server',
      revision: 42,
      rid: 99,
      health: { state: 'idle', consecutive_errors: 0, last_success_ts: null, last_error_ts: null, last_error_message: null },
      maindata: {
        torrents: { 'hash-1': { name: 'test-torrent', progress: 0.5 } },
        categories: { videos: { name: 'videos', savePath: '/data' } },
        tags: ['tag-1', 'tag-2'],
        server_state: { dl_info_speed: 1024 },
      },
    });
  });

  it('getMaindataSyncStatus returns health with all state variants', async () => {
    const states: Array<'idle' | 'healthy' | 'degraded' | 'retrying'> = ['idle', 'healthy', 'degraded', 'retrying'];
    for (const state of states) {
      const transport = createMockTransport(() => ({
        state,
        consecutive_errors: state === 'degraded' ? 3 : 0,
        last_success_ts: state !== 'idle' ? 1234567890 : null,
        last_error_ts: state === 'degraded' || state === 'retrying' ? 1234567900 : null,
        last_error_message: state === 'degraded' || state === 'retrying' ? 'connection error' : null,
      }));
      const bridge = createDesktopBridge(transport.transport);
      const status = await bridge.qBClient.getMaindataSyncStatus();
      expect(status.state).toBe(state);
    }
  });

  it('categories response is typed as Record<string, Category> (Rust-validated)', async () => {
    const transport = createMockTransport(() => ({
      session_generation: 1,
      server_id: 'srv-1',
      categories: {
        videos: { name: 'videos', savePath: '/data/videos' },
        audio: { name: 'audio', savePath: '/data/audio' },
      },
    }));
    const bridge = createDesktopBridge(transport.transport);

    const response = await bridge.categories.getCategories();
    expect(response.categories).toBeDefined();
    expect(typeof response.categories).toBe('object');
    expect(response.categories).toHaveProperty('videos');
    expect(response.categories).toHaveProperty('audio');
    expect(response.categories['videos']).toEqual({ name: 'videos', savePath: '/data/videos' });
    // Rust validates categories, so invalid shapes surface as command errors upstream.
    // The bridge receives a typed Record<string, Category> — no unknown coercion needed.
  });

  it('tags response returns string[] (Rust-validated)', async () => {
    const transport = createMockTransport(() => ({
      session_generation: 2,
      server_id: 'srv-1',
      tags: ['tag-a', 'tag-b'],
    }));
    const bridge = createDesktopBridge(transport.transport);

    const response = await bridge.tags.getTags();
    expect(response.tags).toEqual(['tag-a', 'tag-b']);
    expect(Array.isArray(response.tags)).toBe(true);
  });

  it('sync_torrent_peers returns typed SyncTorrentPeers shape from Rust', async () => {
    const transport = createMockTransport(() => ({
      rid: 42,
      full_update: false,
      peers: {
        '1.2.3.4:6881': { ip: '1.2.3.4', port: 6881, client: 'qBittorrent', progress: 0.5 },
      },
      peers_removed: ['5.6.7.8:6881'],
    }));
    const bridge = createDesktopBridge(transport.transport);

    const peers = await bridge.torrents.syncTorrentPeers('hash-abc');
    expect(peers).toMatchObject({
      rid: 42,
      full_update: false,
      peers: {
        '1.2.3.4:6881': { ip: '1.2.3.4', port: 6881, client: 'qBittorrent', progress: 0.5 },
      },
      peers_removed: ['5.6.7.8:6881'],
    });
  });

  it('addMaindataSyncListener returns a synchronous unsubscribe function', async () => {
    const transport = createMockTransport();
    const bridge = createDesktopBridge(transport.transport);

    const handler = vi.fn();
    const unsubscribe = bridge.qBClient.addMaindataSyncListener(handler);

    // Unsubscribe must be callable immediately (synchronously) even though
    // the underlying listen() is async
    expect(typeof unsubscribe).toBe('function');

    // Calling unsubscribe before listen resolves should be safe
    unsubscribe();
  });

  it('addMaindataSyncListener wires up the underlying transport listen call', async () => {
    const transport = createMockTransport();
    const bridge = createDesktopBridge(transport.transport);

    const handler = vi.fn();
    bridge.qBClient.addMaindataSyncListener(handler);

    // The transport listen should have been called with the correct event name
    expect(transport.listen).toHaveBeenCalledWith('maindata-sync-changed', handler);
  });

  it('addMaindataSyncListener still wires real unlisten when transport.listen resolves', async () => {
    const realUnlisten = vi.fn();
    const transport = createMockTransport();
    transport.listen.mockResolvedValueOnce(realUnlisten);
    const bridge = createDesktopBridge(transport.transport);

    const handler = vi.fn();
    const unsubscribe = bridge.qBClient.addMaindataSyncListener(handler);

    // Unsubscribe must be a function even before the async listen() resolves
    expect(typeof unsubscribe).toBe('function');

    // Let the microtask queue drain so the listen() promise resolves
    await Promise.resolve();
    await Promise.resolve();

    // Now the real unlisten should be wired up and invoked on unsubscribe
    unsubscribe();
    expect(realUnlisten).toHaveBeenCalledTimes(1);
  });

  it('addMaindataSyncListener handles rejected transport.listen without an unhandled rejection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const nodeUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', nodeUnhandled);

    const transport = createMockTransport();
    transport.listen.mockRejectedValueOnce(new Error('transport down'));
    const bridge = createDesktopBridge(transport.transport);

    const handler = vi.fn();
    const unsubscribe = bridge.qBClient.addMaindataSyncListener(handler);

    // Unsubscribe remains synchronous and callable
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();

    // Drain the microtask queue so the rejected promise's catch handler runs
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();

    // The rejection must be handled deliberately via console.warn, not surfaced unhandled
    expect(warn).toHaveBeenCalled();
    const callArgs = warn.mock.calls[0] ?? [];
    const message = callArgs[0];
    const error = callArgs[1];
    expect(message).toContain('[bridge]');
    expect(message).toContain('maindata sync listener registration failed');
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('transport down');

    expect(unhandled).toEqual([]);

    process.off('unhandledRejection', nodeUnhandled);
    warn.mockRestore();
  });

  it('desktop qBClient exposes Rust sync commands and listener', async () => {
    const transport = createMockTransport((cmd) => {
      switch (cmd) {
        case 'get_maindata_snapshot':
          return {
            session_generation: 3,
            server_id: 'srv-1',
            revision: 99,
            rid: 100,
            health: { state: 'healthy', consecutive_errors: 0, last_success_ts: 1234567890, last_error_ts: null, last_error_message: null },
            maindata: { torrents: {}, categories: {}, tags: [], server_state: {} },
          };
        case 'get_maindata_sync_status':
          return { state: 'healthy', consecutive_errors: 0, last_success_ts: 1234567890, last_error_ts: null, last_error_message: null };
        default:
          return { ok: true };
      }
    });
    const bridge = createDesktopBridge(transport.transport);

    await bridge.qBClient.getMaindataSnapshot();
    await bridge.qBClient.getMaindataSyncStatus();
    await bridge.qBClient.startMaindataSync();
    await bridge.qBClient.stopMaindataSync('srv-1');
    bridge.qBClient.addMaindataSyncListener(vi.fn());

    expect(transport.invoke).toHaveBeenCalledWith('get_maindata_snapshot');
    expect(transport.invoke).toHaveBeenCalledWith('get_maindata_sync_status');
    expect(transport.invoke).toHaveBeenCalledWith('start_maindata_sync');
    expect(transport.invoke).toHaveBeenCalledWith('stop_maindata_sync', { serverId: 'srv-1' });
    expect(transport.listen).toHaveBeenCalledWith('maindata-sync-changed', expect.any(Function));
  });

  it('mobile qBClient exposes Rust sync commands and listener', async () => {
    const transport = createMockTransport((cmd) => {
      switch (cmd) {
        case 'get_maindata_snapshot':
          return {
            session_generation: 3,
            server_id: 'srv-2',
            revision: 99,
            rid: 100,
            health: { state: 'degraded', consecutive_errors: 2, last_success_ts: 1234567890, last_error_ts: 1234567900, last_error_message: 'timeout' },
            maindata: { torrents: {}, categories: {}, tags: ['tag-a'], server_state: {} },
          };
        case 'get_maindata_sync_status':
          return { state: 'degraded', consecutive_errors: 2, last_success_ts: 1234567890, last_error_ts: 1234567900, last_error_message: 'timeout' };
        default:
          return { ok: true };
      }
    });
    const bridge = createMobileTauriBridge(transport.transport);

    await bridge.qBClient.getMaindataSnapshot();
    await bridge.qBClient.getMaindataSyncStatus();
    await bridge.qBClient.startMaindataSync();
    await bridge.qBClient.stopMaindataSync('srv-2');
    bridge.qBClient.addMaindataSyncListener(vi.fn());

    expect(transport.invoke).toHaveBeenCalledWith('get_maindata_snapshot');
    expect(transport.invoke).toHaveBeenCalledWith('get_maindata_sync_status');
    expect(transport.invoke).toHaveBeenCalledWith('start_maindata_sync');
    expect(transport.invoke).toHaveBeenCalledWith('stop_maindata_sync', { serverId: 'srv-2' });
    expect(transport.listen).toHaveBeenCalledWith('maindata-sync-changed', expect.any(Function));
  });

  it('desktop bridge unwraps typed torrent detail envelopes to plain typed payloads (T140.3)', async () => {
    // Rust now owns the validation boundary and returns typed envelopes. The
    // desktop bridge must unwrap { properties } / { trackers } / { files } to
    // expose plain typed payloads to consumers.
    const propertiesFixture: TorrentProperties = {
      save_path: '/downloads/movies',
      creation_date: 1_700_000_000,
      piece_size: 16384,
      comment: 'qBittorrent',
      total_wasted: 0,
      total_uploaded: 0,
      total_uploaded_session: 0,
      total_downloaded: 1024,
      total_downloaded_session: 1024,
      up_limit: 0,
      dl_limit: 0,
      time_elapsed: 60,
      seeding_time: 0,
      nb_connections: 5,
      nb_connections_limit: 100,
      share_ratio: 0.5,
      addition_date: 1_700_000_000,
      completion_date: 0,
      created_by: 'qBittorrent 4.6.0',
      dl_speed_avg: 0,
      dl_speed: 0,
      eta: 0,
      last_seen: 0,
      peers: 5,
      peers_total: 5,
      pieces_have: 0,
      pieces_num: 1,
      reannounce: 0,
      seeds: 0,
      seeds_total: 0,
      total_size: 1024,
      up_speed_avg: 0,
      up_speed: 0,
      isPrivate: false,
    };
    const trackersFixture: Tracker[] = [
      { url: 'udp://tracker.example', status: 2, tier: 0, num_peers: 1, num_seeds: 1, num_leeches: 0, num_downloaded: 0, msg: '' },
    ];
    const filesFixture: TorrentFile[] = [
      {
        index: 0,
        name: 'movie.mkv',
        size: 1024,
        progress: 0.5,
        priority: 1,
        is_seed: false,
        piece_range: [0, 0],
        availability: 1,
      },
    ];

    const transport = createMockTransport((cmd) => {
      switch (cmd) {
        case 'get_torrent_properties':
          return { session_generation: 1, server_id: 'srv-1', properties: propertiesFixture };
        case 'get_torrent_trackers':
          return { session_generation: 1, server_id: 'srv-1', trackers: trackersFixture };
        case 'get_torrent_files':
          return { session_generation: 1, server_id: 'srv-1', files: filesFixture };
        default:
          return { ok: true };
      }
    });
    const bridge = createDesktopBridge(transport.transport);

    const properties = await bridge.torrents.getProperties('hash-1');
    const trackers = await bridge.torrents.getTrackers('hash-1');
    const files = await bridge.torrents.getFiles('hash-1');

    // Public contract returns plain typed payloads — no envelope wrapper.
    expect(properties).toEqual(propertiesFixture);
    expect(trackers).toEqual(trackersFixture);
    expect(files).toEqual(filesFixture);
    expect(properties).not.toHaveProperty('session_generation');
    expect(properties).not.toHaveProperty('server_id');
    expect(properties).not.toHaveProperty('properties');
    expect(trackers).not.toHaveProperty('trackers');
    expect(files).not.toHaveProperty('files');
    // Canonical typed fields from @taurent/shared/types/qbittorrent must be present.
    expect(typeof properties.isPrivate).toBe('boolean');
    expect(Array.isArray(trackers)).toBe(true);
    expect(Array.isArray(files)).toBe(true);
  });

  it('mobile bridge unwraps typed torrent detail envelopes to plain typed payloads (T140.3)', async () => {
    const propertiesFixture: TorrentProperties = {
      save_path: '/downloads',
      creation_date: 1,
      piece_size: 1,
      comment: '',
      total_wasted: 0,
      total_uploaded: 0,
      total_uploaded_session: 0,
      total_downloaded: 0,
      total_downloaded_session: 0,
      up_limit: 0,
      dl_limit: 0,
      time_elapsed: 0,
      seeding_time: 0,
      nb_connections: 0,
      nb_connections_limit: 0,
      share_ratio: 0,
      addition_date: 1,
      completion_date: 0,
      created_by: '',
      dl_speed_avg: 0,
      dl_speed: 0,
      eta: 0,
      last_seen: 0,
      peers: 0,
      peers_total: 0,
      pieces_have: 0,
      pieces_num: 0,
      reannounce: 0,
      seeds: 0,
      seeds_total: 0,
      total_size: 0,
      up_speed_avg: 0,
      up_speed: 0,
      isPrivate: true,
    };
    const transport = createMockTransport((cmd) => {
      switch (cmd) {
        case 'get_torrent_properties':
          return { session_generation: 2, server_id: 'srv-2', properties: propertiesFixture };
        case 'get_torrent_trackers':
          return { session_generation: 2, server_id: 'srv-2', trackers: [] };
        case 'get_torrent_files':
          return { session_generation: 2, server_id: 'srv-2', files: [] };
        default:
          return { ok: true };
      }
    });
    const bridge = createMobileTauriBridge(transport.transport);

    const properties = await bridge.torrents.getProperties('hash-mobile');
    const trackers = await bridge.torrents.getTrackers('hash-mobile');
    const files = await bridge.torrents.getFiles('hash-mobile');

    expect(properties).toEqual(propertiesFixture);
    expect(trackers).toEqual([]);
    expect(files).toEqual([]);
    expect(properties).not.toHaveProperty('properties');
    expect(trackers).not.toHaveProperty('trackers');
    expect(files).not.toHaveProperty('files');
    expect(properties.isPrivate).toBe(true);
  });

  it('desktop qBClient returns typed search status/results/plugins (T141.3)', async () => {
    const statuses = [
      { id: 1, status: 'Running', total: 0 },
      { id: 2, status: 'Stopped', total: 17, error: 'plugin timeout' },
    ];
    const results = {
      results: [
        {
          descrLink: 'https://example.com/desc/1',
          fileName: 'ubuntu.iso',
          fileSize: 5_000_000_000,
          fileUrl: 'https://example.com/t/1',
          nbLeechers: 4,
          nbSeeders: 12,
          siteUrl: 'https://example.com',
        },
      ],
      total: 1,
    };
    const plugins = [
      {
        name: 'piratebay',
        fullName: 'The Pirate Bay',
        version: '2.0.0',
        enabled: true,
        url: 'https://thepiratebay.org',
      },
      {
        name: 'linuxtracker',
        fullName: 'Linux Tracker',
        version: '1.4.0',
        enabled: false,
        url: 'https://linuxtracker.org',
        supportedCategories: [
          { id: 'movies', name: 'Movies' },
          { id: 'tv', name: 'TV' },
        ],
      },
    ];
    const transport = createMockTransport((cmd) => {
      switch (cmd) {
        case 'get_search_status':
          return statuses;
        case 'get_search_results':
          return results;
        case 'get_search_plugins':
          return plugins;
        default:
          return { ok: true };
      }
    });
    const bridge = createDesktopBridge(transport.transport);

    // Status: typed array with optional error field
    const gotStatuses = await bridge.qBClient.getSearchStatus();
    expect(gotStatuses).toEqual(statuses);
    expect(Array.isArray(gotStatuses)).toBe(true);
    expect(gotStatuses[0].error).toBeUndefined();
    expect(gotStatuses[1].error).toBe('plugin timeout');

    // Results: typed wrapper with camelCase row fields
    const gotResults = await bridge.qBClient.getSearchResults(2, 50, 0);
    expect(gotResults).toEqual(results);
    expect(gotResults.total).toBe(1);
    expect(gotResults.results[0]).toMatchObject({
      descrLink: expect.any(String),
      fileName: 'ubuntu.iso',
      fileSize: 5_000_000_000,
      fileUrl: 'https://example.com/t/1',
      nbLeechers: 4,
      nbSeeders: 12,
      siteUrl: 'https://example.com',
    });

    // Plugins: typed array; supportedCategories optional per row
    const gotPlugins = await bridge.qBClient.getSearchPlugins();
    expect(gotPlugins).toEqual(plugins);
    expect(gotPlugins[0].supportedCategories).toBeUndefined();
    expect(gotPlugins[1].supportedCategories).toEqual([
      { id: 'movies', name: 'Movies' },
      { id: 'tv', name: 'TV' },
    ]);

    // Verify wire command names and argument shape
    expect(transport.invoke).toHaveBeenCalledWith('get_search_status', { id: null });
    expect(transport.invoke).toHaveBeenCalledWith('get_search_results', {
      id: 2,
      limit: 50,
      offset: 0,
    });
    expect(transport.invoke).toHaveBeenCalledWith('get_search_plugins');
  });

  it('mobile qBClient returns typed search status/results/plugins (T141.3)', async () => {
    const statuses = [{ id: 7, status: 'Running', total: 0 }];
    const results = {
      results: [],
      total: 0,
    };
    const plugins: Array<{
      name: string;
      fullName: string;
      version: string;
      enabled: boolean;
      url: string;
      supportedCategories?: Array<{ id: string; name: string }>;
    }> = [
      {
        name: 'rarbg',
        fullName: 'RARBG',
        version: '1.0.0',
        enabled: true,
        url: 'https://rarbg.to',
      },
    ];
    const transport = createMockTransport((cmd) => {
      switch (cmd) {
        case 'get_search_status':
          return statuses;
        case 'get_search_results':
          return results;
        case 'get_search_plugins':
          return plugins;
        default:
          return { ok: true };
      }
    });
    const bridge = createMobileTauriBridge(transport.transport);

    const gotStatuses = await bridge.qBClient.getSearchStatus(7);
    expect(gotStatuses).toEqual(statuses);
    expect(gotStatuses[0]).toMatchObject({ id: 7, status: 'Running' });

    const gotResults = await bridge.qBClient.getSearchResults(7, 0, 0);
    expect(gotResults).toEqual(results);
    expect(gotResults.results).toEqual([]);
    expect(gotResults.total).toBe(0);

    const gotPlugins = await bridge.qBClient.getSearchPlugins();
    expect(gotPlugins).toEqual(plugins);
    expect(gotPlugins[0].name).toBe('rarbg');

    // Search argument normalization mirrors the shared helper
    expect(transport.invoke).toHaveBeenCalledWith('get_search_status', { id: 7 });
    expect(transport.invoke).toHaveBeenCalledWith('get_search_results', {
      id: 7,
      limit: 0,
      offset: 0,
    });
  });

  // ---------------------------------------------------------------------------
  // RSS typed-envelope contract (T142.4)
  //
  // The Rust backend (qb-core::dto + qb-tauri envelopes from T142.1/T142.2)
  // now returns typed `RssItem[]` / `RssRule[]` payloads inside the
  // `RSSItemsResponse` / `RSSRulesResponse` envelopes. The bridge must
  // forward the typed rows as-is — no `unknown` coercion, no synthetic
  // `session_generation: 0` placeholders. The wire command names
  // (`get_rss_items`, `get_rss_rules`) remain stable.
  // ---------------------------------------------------------------------------

  it('desktop qBClient getRssItems returns typed RSSItemsResponse (T142.4)', async () => {
    const rssItemFixture = {
      name: 'Linux Tracker',
      url: 'https://example.com/feed',
      isFolder: false,
      path: 'Folder\\Linux Tracker',
      uid: 'uid-1',
    };
    const transport = createMockTransport(() => ({
      session_generation: 3,
      server_id: 'srv-1',
      items: [rssItemFixture],
    }));
    const bridge = createDesktopBridge(transport.transport);

    const response = await bridge.qBClient.getRssItems();

    // Typed envelope shape: session context + items array.
    expect(response).toEqual({
      session_generation: 3,
      server_id: 'srv-1',
      items: [rssItemFixture],
    });
    // Real session context is forwarded — not the synthetic
    // `session_generation: 0, server_id: null` placeholder the bridge
    // used to emit before T142.3.
    expect(response.session_generation).toBe(3);
    expect(response.server_id).toBe('srv-1');
    // Typed RssItem fields: camelCase `isFolder`, optional `uid`, etc.
    expect(Array.isArray(response.items)).toBe(true);
    expect(response.items[0]).toEqual(rssItemFixture);
    // The wire command name must remain `get_rss_items` (T142.1 invariant).
    expect(transport.invoke).toHaveBeenCalledWith('get_rss_items');
  });

  it('desktop qBClient getRssRules returns typed RSSRulesResponse with all 13 fields (T142.4)', async () => {
    const rssRuleFixture = {
      name: 'Rule 1',
      enabled: true,
      mustContain: 'linux',
      mustNotContain: 'windows',
      useRegex: false,
      episodeFilter: 'ep >= 1',
      smartFilter: true,
      affectedFeeds: ['feed-a', 'feed-b'],
      ignoreDays: 7,
      lastMatch: '2026-05-01',
      addPaused: true,
      assignedCategory: 'movies',
      savePath: '/downloads/movies',
    };
    const transport = createMockTransport(() => ({
      session_generation: 5,
      server_id: 'srv-1',
      rules: [rssRuleFixture],
    }));
    const bridge = createDesktopBridge(transport.transport);

    const response = await bridge.qBClient.getRssRules();

    expect(response).toEqual({
      session_generation: 5,
      server_id: 'srv-1',
      rules: [rssRuleFixture],
    });
    // All 13 rule fields are present and typed.
    const rule = response.rules[0];
    expect(rule.name).toBe('Rule 1');
    expect(typeof rule.enabled).toBe('boolean');
    expect(typeof rule.mustContain).toBe('string');
    expect(typeof rule.mustNotContain).toBe('string');
    expect(typeof rule.useRegex).toBe('boolean');
    expect(typeof rule.episodeFilter).toBe('string');
    expect(typeof rule.smartFilter).toBe('boolean');
    expect(Array.isArray(rule.affectedFeeds)).toBe(true);
    expect(typeof rule.ignoreDays).toBe('number');
    expect(typeof rule.lastMatch).toBe('string');
    expect(typeof rule.addPaused).toBe('boolean');
    expect(typeof rule.assignedCategory).toBe('string');
    expect(typeof rule.savePath).toBe('string');
    // camelCase wire keys are present.
    expect(rule).toHaveProperty('mustContain');
    expect(rule).toHaveProperty('mustNotContain');
    expect(rule).toHaveProperty('useRegex');
    expect(rule).toHaveProperty('episodeFilter');
    expect(rule).toHaveProperty('smartFilter');
    expect(rule).toHaveProperty('affectedFeeds');
    expect(rule).toHaveProperty('ignoreDays');
    expect(rule).toHaveProperty('lastMatch');
    expect(rule).toHaveProperty('addPaused');
    expect(rule).toHaveProperty('assignedCategory');
    expect(rule).toHaveProperty('savePath');
    // snake_case wire keys must NOT be present.
    expect(rule).not.toHaveProperty('must_contain');
    expect(rule).not.toHaveProperty('must_not_contain');
    expect(rule).not.toHaveProperty('use_regex');
    expect(rule).not.toHaveProperty('episode_filter');
    expect(rule).not.toHaveProperty('smart_filter');
    expect(rule).not.toHaveProperty('affected_feeds');
    expect(rule).not.toHaveProperty('ignore_days');
    expect(rule).not.toHaveProperty('last_match');
    expect(rule).not.toHaveProperty('add_paused');
    expect(rule).not.toHaveProperty('assigned_category');
    expect(rule).not.toHaveProperty('save_path');
    expect(transport.invoke).toHaveBeenCalledWith('get_rss_rules');
  });

  it('mobile qBClient getRssItems returns typed RSSItemsResponse (T142.4)', async () => {
    const rssItemFixture = {
      name: 'Top',
      url: 'https://top.example.com/feed',
      isFolder: false,
      path: 'Top',
    };
    const transport = createMockTransport(() => ({
      session_generation: 11,
      server_id: 'srv-mobile',
      items: [rssItemFixture],
    }));
    const bridge = createMobileTauriBridge(transport.transport);

    const response = await bridge.qBClient.getRssItems();

    expect(response).toEqual({
      session_generation: 11,
      server_id: 'srv-mobile',
      items: [rssItemFixture],
    });
    expect(response.items[0]).toEqual(rssItemFixture);
    expect(transport.invoke).toHaveBeenCalledWith('get_rss_items');
  });

  it('mobile qBClient getRssRules returns typed RSSRulesResponse (T142.4)', async () => {
    const rssRuleFixture = {
      name: 'Rule M',
      enabled: false,
      mustContain: '',
      mustNotContain: '',
      useRegex: false,
      episodeFilter: '',
      smartFilter: false,
      affectedFeeds: [],
      ignoreDays: 0,
      lastMatch: '',
      addPaused: false,
      assignedCategory: '',
      savePath: '',
    };
    const transport = createMockTransport(() => ({
      session_generation: 12,
      server_id: 'srv-mobile',
      rules: [rssRuleFixture],
    }));
    const bridge = createMobileTauriBridge(transport.transport);

    const response = await bridge.qBClient.getRssRules();

    expect(response).toEqual({
      session_generation: 12,
      server_id: 'srv-mobile',
      rules: [rssRuleFixture],
    });
    expect(response.rules[0]).toEqual(rssRuleFixture);
    expect(transport.invoke).toHaveBeenCalledWith('get_rss_rules');
  });

  it('desktop qBClient RSS envelope tolerates empty typed arrays (T142.4)', async () => {
    // Empty typed arrays must round-trip cleanly. The bridge must not
    // synthesize a different shape for empty payloads.
    const transport = createMockTransport((cmd) => {
      if (cmd === 'get_rss_items') {
        return { session_generation: 1, server_id: 'srv-1', items: [] };
      }
      if (cmd === 'get_rss_rules') {
        return { session_generation: 1, server_id: 'srv-1', rules: [] };
      }
      return { ok: true };
    });
    const bridge = createDesktopBridge(transport.transport);

    const items = await bridge.qBClient.getRssItems();
    const rules = await bridge.qBClient.getRssRules();

    expect(items.items).toEqual([]);
    expect(rules.rules).toEqual([]);
    expect(Array.isArray(items.items)).toBe(true);
    expect(Array.isArray(rules.rules)).toBe(true);
  });

  it('desktop qBClient RSS envelope preserves camelCase isFolder flag on items (T142.4)', async () => {
    // Folder rows from the legacy { folders } shape carry `isFolder: true`.
    // The bridge must preserve that flag as-is; it does not coerce it.
    const feedRow = {
      name: 'Feed A',
      url: 'https://a.example.com/feed',
      isFolder: false,
      path: 'Feed A',
    };
    const folderRow = {
      name: 'Folder X',
      url: null,
      isFolder: true,
      path: 'Folder X',
    };
    const transport = createMockTransport(() => ({
      session_generation: 2,
      server_id: 'srv-1',
      items: [feedRow, folderRow],
    }));
    const bridge = createDesktopBridge(transport.transport);

    const response = await bridge.qBClient.getRssItems();

    expect(response.items).toEqual([feedRow, folderRow]);
    expect(response.items[0].isFolder).toBe(false);
    expect(response.items[1].isFolder).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Torrent list typed-envelope contract (T143.2)
  //
  // Rust (qb-core::dto::parse_torrent_list from T143.1) now owns the
  // validation boundary for `GET /api/v2/torrents/info`, and the bridge
  // contract exposes the typed `Torrent[]` payload directly. The desktop and
  // mobile `torrents.getList()` methods must:
  //   - invoke the `get_torrent_list` command with the documented
  //     filter/category/tag/sort/reverse/limit/offset/hashes parameter shape
  //     (unchanged from prior slices), defaulting omitted params to `null`.
  //   - resolve to a `TorrentListResponse` envelope whose `torrents` field
  //     is a typed `Torrent[]` — not `unknown`, not a hash-keyed map.
  // Maindata sync/snapshot torrent maps remain out of scope.
  // ---------------------------------------------------------------------------

  function makeTorrentFixture(overrides: Partial<Torrent> = {}): Torrent {
    return {
      added_on: 1_700_000_000,
      amount_left: 0,
      auto_tmm: false,
      availability: 1,
      category: 'videos',
      completed: 1024,
      completion_on: 0,
      content_path: '/downloads/movies/movie.mkv',
      dl_limit: 0,
      dlspeed: 0,
      download_path: '/downloads/movies',
      downloaded: 1024,
      downloaded_session: 1024,
      eta: 0,
      f_l_piece_prio: false,
      force_start: false,
      hash: 'abcdef0123456789abcdef0123456789abcdef01',
      infohash_v1: 'v1-hash',
      infohash_v2: 'v2-hash',
      last_activity: 1_700_000_000,
      magnet_uri: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
      max_ratio: 0,
      max_seeding_time: 0,
      name: 'Movie.mkv',
      num_complete: 0,
      num_incomplete: 0,
      num_leechs: 0,
      num_seeds: 0,
      priority: 0,
      progress: 1,
      ratio: 0,
      ratio_limit: 0,
      save_path: '/downloads/movies',
      seeding_time: 0,
      seeding_time_limit: 0,
      seen_complete: 0,
      seq_dl: false,
      size: 1024,
      state: 'uploading',
      super_seeding: false,
      tags: '',
      time_active: 0,
      total_size: 1024,
      tracker: 'udp://tracker.example/announce',
      trackers_count: 1,
      up_limit: 0,
      uploaded: 0,
      uploaded_session: 0,
      upspeed: 0,
      ...overrides,
    };
  }

  it('desktop torrents.getList returns typed TorrentListResponse with Torrent[] payload (T143.2)', async () => {
    const torrentA = makeTorrentFixture({ hash: 'hash-a', name: 'A' });
    const torrentB = makeTorrentFixture({ hash: 'hash-b', name: 'B' });
    const transport = createMockTransport(() => ({
      session_generation: 7,
      server_id: 'srv-1',
      torrents: [torrentA, torrentB],
    }));
    const bridge = createDesktopBridge(transport.transport);

    const response = await bridge.torrents.getList();

    // Typed envelope shape: session context + Torrent[] payload.
    expect(response).toEqual({
      session_generation: 7,
      server_id: 'srv-1',
      torrents: [torrentA, torrentB],
    });
    // Wire payload is a plain Torrent array, not an unknown map.
    expect(Array.isArray(response.torrents)).toBe(true);
    expect(response.torrents).toHaveLength(2);
    // The typed Torrent shape must be present on each row.
    expect(response.torrents[0].hash).toBe('hash-a');
    expect(response.torrents[0].name).toBe('A');
    expect(response.torrents[0].tags).toBe('');
    expect(response.torrents[1].hash).toBe('hash-b');
    // The drift optional fields are present when supplied and absent when
    // omitted (i.e. the wire shape tolerates the documented qBittorrent
    // version-drift fields).
    expect(response.torrents[0].download_path).toBe('/downloads/movies');
    expect(response.torrents[0].trackers_count).toBe(1);
    // The wire command name and nested query payload shape must remain stable.
    expect(transport.invoke).toHaveBeenCalledWith('get_torrent_list', {
      query: {
        filter: null,
        category: null,
        tag: null,
        sort: null,
        reverse: null,
        limit: null,
        offset: null,
        hashes: null,
      },
    });
  });

  it('desktop torrents.getList forwards all filter/category/tag/sort/reverse/limit/offset/hashes params unchanged (T143.2)', async () => {
    const transport = createMockTransport(() => ({
      session_generation: 1,
      server_id: 'srv-1',
      torrents: [],
    }));
    const bridge = createDesktopBridge(transport.transport);

    await bridge.torrents.getList({
      filter: 'downloading',
      category: 'videos',
      tag: 'tag-a',
      sort: 'name',
      reverse: true,
      limit: 25,
      offset: 50,
      hashes: ['hash-1', 'hash-2'],
    });

    // Every field passes through to the Tauri command unchanged.
    expect(transport.invoke).toHaveBeenCalledWith('get_torrent_list', {
      query: {
        filter: 'downloading',
        category: 'videos',
        tag: 'tag-a',
        sort: 'name',
        reverse: true,
        limit: 25,
        offset: 50,
        hashes: ['hash-1', 'hash-2'],
      },
    });
  });

  it('desktop torrents.getList returns an empty Torrent[] for an empty list (T143.2)', async () => {
    const transport = createMockTransport(() => ({
      session_generation: 1,
      server_id: 'srv-1',
      torrents: [],
    }));
    const bridge = createDesktopBridge(transport.transport);

    const response = await bridge.torrents.getList();

    // Empty lists round-trip as a typed empty array — not a map and not
    // `null` / `undefined` — so downstream consumers can iterate without
    // shape checks.
    expect(Array.isArray(response.torrents)).toBe(true);
    expect(response.torrents).toEqual([]);
  });

  it('desktop torrents.getList tolerates Torrent rows with the drift fields omitted (T143.2)', async () => {
    // qBittorrent may omit download_path / infohash_v1 / infohash_v2 /
    // trackers_count / reannounce / popularity on some versions/rows. The
    // Rust DTO tolerates them as Option<T>; the typed contract on the bridge
    // boundary must too.
    const minimal = makeTorrentFixture({
      hash: 'hash-min',
      name: 'Minimal',
    });
    delete (minimal as Partial<Torrent>).download_path;
    delete (minimal as Partial<Torrent>).infohash_v1;
    delete (minimal as Partial<Torrent>).infohash_v2;
    delete (minimal as Partial<Torrent>).trackers_count;
    delete (minimal as Partial<Torrent>).reannounce;
    delete (minimal as Partial<Torrent>).popularity;

    const transport = createMockTransport(() => ({
      session_generation: 1,
      server_id: 'srv-1',
      torrents: [minimal],
    }));
    const bridge = createDesktopBridge(transport.transport);

    const response = await bridge.torrents.getList();

    expect(response.torrents).toHaveLength(1);
    expect(response.torrents[0].hash).toBe('hash-min');
    // Drift fields absent: typed contract says undefined is acceptable.
    expect(response.torrents[0].download_path).toBeUndefined();
    expect(response.torrents[0].infohash_v1).toBeUndefined();
    expect(response.torrents[0].infohash_v2).toBeUndefined();
    expect(response.torrents[0].trackers_count).toBeUndefined();
    expect(response.torrents[0].reannounce).toBeUndefined();
    expect(response.torrents[0].popularity).toBeUndefined();
  });

  it('mobile torrents.getList returns typed TorrentListResponse with Torrent[] payload (T143.2)', async () => {
    const torrentA = makeTorrentFixture({ hash: 'hash-m-a', name: 'MA' });
    const transport = createMockTransport(() => ({
      session_generation: 9,
      server_id: 'srv-mobile',
      torrents: [torrentA],
    }));
    const bridge = createMobileTauriBridge(transport.transport);

    const response = await bridge.torrents.getList();

    expect(response).toEqual({
      session_generation: 9,
      server_id: 'srv-mobile',
      torrents: [torrentA],
    });
    expect(Array.isArray(response.torrents)).toBe(true);
    expect(response.torrents[0].hash).toBe('hash-m-a');
    // The wire command name + nested query payload shape is identical to the desktop bridge.
    expect(transport.invoke).toHaveBeenCalledWith('get_torrent_list', {
      query: {
        filter: null,
        category: null,
        tag: null,
        sort: null,
        reverse: null,
        limit: null,
        offset: null,
        hashes: null,
      },
    });
  });

  it('mobile torrents.getList forwards all filter/category/tag/sort/reverse/limit/offset/hashes params unchanged (T143.2)', async () => {
    const transport = createMockTransport(() => ({
      session_generation: 1,
      server_id: 'srv-mobile',
      torrents: [],
    }));
    const bridge = createMobileTauriBridge(transport.transport);

    await bridge.torrents.getList({
      filter: 'all',
      category: 'audio',
      tag: 'tag-z',
      sort: 'size',
      reverse: false,
      limit: 10,
      offset: 0,
      hashes: ['hash-x'],
    });

    expect(transport.invoke).toHaveBeenCalledWith('get_torrent_list', {
      query: {
        filter: 'all',
        category: 'audio',
        tag: 'tag-z',
        sort: 'size',
        reverse: false,
        limit: 10,
        offset: 0,
        hashes: ['hash-x'],
      },
    });
  });

  it('mobile torrents.getList tolerates Torrent rows with the drift fields omitted (T143.2)', async () => {
    const minimal = makeTorrentFixture({ hash: 'hash-m-min', name: 'MMin' });
    delete (minimal as Partial<Torrent>).download_path;
    delete (minimal as Partial<Torrent>).infohash_v1;
    delete (minimal as Partial<Torrent>).infohash_v2;
    delete (minimal as Partial<Torrent>).trackers_count;

    const transport = createMockTransport(() => ({
      session_generation: 1,
      server_id: 'srv-mobile',
      torrents: [minimal],
    }));
    const bridge = createMobileTauriBridge(transport.transport);

    const response = await bridge.torrents.getList();

    expect(response.torrents).toHaveLength(1);
    expect(response.torrents[0].hash).toBe('hash-m-min');
    expect(response.torrents[0].download_path).toBeUndefined();
    expect(response.torrents[0].infohash_v1).toBeUndefined();
    expect(response.torrents[0].infohash_v2).toBeUndefined();
    expect(response.torrents[0].trackers_count).toBeUndefined();
  });

  it('desktop getMaindataSnapshot returns Rust-typed envelope (T144.3)', async () => {
    // The Rust backend owns the strict validation boundary for live
    // sync. The snapshot returned by `get_maindata_snapshot` is the
    // accumulated, validated snapshot from `MaindataAccumulator`. The
    // envelope types are defined in `packages/bridge/src/types.ts` and
    // intentionally leave `torrents` / `categories` / `server_state` as
    // `unknown` on the bridge boundary because row-level DTO validation
    // is deferred for the maindata hot path.
    const transport = createMockTransport(() => ({
      session_generation: 7,
      server_id: 'srv-rust',
      revision: 42,
      rid: 100,
      health: { state: 'healthy', consecutive_errors: 0, last_success_ts: 1, last_error_ts: null, last_error_message: null },
      maindata: {
        torrents: {
          // Raw row payload — Rust does not re-shape per-torrent fields
          // and the bridge intentionally does not narrow this map.
          hash_a: { hash: 'hash_a', name: 'A', state: 'uploading', future_field: 1 },
          hash_b: { hash: 'hash_b', name: 'B', state: 'downloading' },
        },
        categories: {
          videos: { name: 'videos', savePath: '/videos' },
        },
        tags: ['tag-a', 'tag-b'],
        server_state: {
          dl_info_speed: 1024,
          dl_info_data: 5000,
          up_info_speed: 512,
          up_info_data: 2500,
          dl_rate_limit: 0,
          up_rate_limit: 0,
          dht_nodes: 7,
          connection_status: 'connected',
          queueing: false,
          use_alt_speed_limits: false,
          refresh_interval: 1500,
        },
      },
    }));
    const bridge = createDesktopBridge(transport.transport);

    const snapshot = await bridge.qBClient.getMaindataSnapshot();

    // The bridge forwards the typed envelope unchanged. Row-level
    // `torrents` map keeps its raw shape and unknown fields pass
    // through.
    expect(snapshot.revision).toBe(42);
    expect(snapshot.rid).toBe(100);
    expect(snapshot.health.state).toBe('healthy');
    expect(snapshot.maindata.torrents).toEqual({
      hash_a: { hash: 'hash_a', name: 'A', state: 'uploading', future_field: 1 },
      hash_b: { hash: 'hash_b', name: 'B', state: 'downloading' },
    });
    // `torrents` is intentionally not narrowed to `Torrent[]` on the
    // bridge boundary; see `packages/bridge/src/types.ts` `SyncMainData`.
    expect(snapshot.maindata.tags).toEqual(['tag-a', 'tag-b']);
  });
});
