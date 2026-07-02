// Mock mobile bridge for VITE_AUTOMATION=1 browser automation.
//
// Scenario selection:
//   ?scenario=empty|small-100|large-1000|stress-5000  (URL searchParam takes precedence)
//   localStorage['taurent:scenario']                  (fallback)
//   default: small-100
//
// App state selection:
//   ?mockAppState=connected|no-saved-servers|saved-server-disconnected|saved-server-unavailable|saved-server-credential-missing
//
// Delta injection via window.__TAURENT_AUTOMATION__.injectDelta().

import type { MobileBridge } from '@taurent/bridge/contracts/interfaces';
import type {
  AddServerInput,
  AddTorrentOptions,
  OperationResponse,
  SavedServerSummary,
  SessionSnapshot,
  SessionStatus,
  SyncMainData,
  TestConnectionResult,
  UpdateServerInput,
  ServerCredentialsInput,
  MaindataSnapshotResponse,
  MaindataSyncHealth,
  MaindataSyncChangedEvent,
  WorkspaceView,
  WorkspaceViewRequest,
} from '@taurent/bridge/types';
import { MOBILE_CAPABILITIES } from '@taurent/bridge/contracts/capabilities';
import type { ResourceInvalidatedEvent, SessionChangedEvent } from '@taurent/bridge/events';
import { createMaindataState } from './fixtures/torrent';
import type { MaindataState, Preferences, Torrent, TorrentFile, TorrentProperties, Tracker } from '@taurent/shared/types/qbittorrent';
import { isTorrentFilterType, matchesTorrentFilter, matchesTorrentSearch, torrentHasTag, matchesTorrentTracker, parseTorrentTags } from '@taurent/shared/utils/torrentFilter';
import { sortTorrents } from '@taurent/shared/utils/sortTorrents';
import type { SortField } from '@taurent/shared/utils/sortTorrents';
import { emitResourceInvalidated, emitSessionChanged, emitMaindataSyncChanged, emitWorkspaceViewChanged } from './mockTauriTransport';
import type { Transport } from '@taurent/bridge/transport/transport';

type Scenario = 'empty' | 'small-100' | 'large-1000' | 'stress-5000';
const APP_SCENARIOS = [
  'connected',
  'no-saved-servers',
  'saved-server-disconnected',
  'saved-server-unavailable',
  'saved-server-credential-missing',
] as const;
type AppScenario = (typeof APP_SCENARIOS)[number];

interface RecordedCall {
  name: string;
  args: unknown[];
}

interface MutationFailureConfig {
  operation: string;
  error: string;
}

function isSortField(field: string): field is SortField {
  switch (field) {
    case 'added_on':
    case 'amount_left':
    case 'availability':
    case 'category':
    case 'completed':
    case 'completion_on':
    case 'dl_limit':
    case 'downloaded':
    case 'downloaded_session':
    case 'dlspeed':
    case 'eta':
    case 'force_start':
    case 'last_activity':
    case 'name':
    case 'num_complete':
    case 'num_incomplete':
    case 'num_leechs':
    case 'num_seeds':
    case 'popularity':
    case 'priority':
    case 'progress':
    case 'ratio':
    case 'ratio_limit':
    case 'save_path':
    case 'seeding_time':
    case 'seen_complete':
    case 'size':
    case 'state':
    case 'tags':
    case 'time_active':
    case 'total_size':
    case 'tracker':
    case 'up_limit':
    case 'uploaded':
    case 'uploaded_session':
    case 'upspeed':
      return true;
    default:
      return false;
  }
}

const DEFAULT_SERVER: SavedServerSummary = {
  id: 'mock-server-id',
  name: 'Mock Server',
  url: 'http://localhost:8080',
  username: 'admin',
  credential_status: 'stored',
};

const CREDENTIAL_MISSING_SERVER: SavedServerSummary = {
  ...DEFAULT_SERVER,
  id: 'mock-server-credential-missing',
  name: 'Credential Missing Server',
  credential_status: 'missing',
  credential_warning: 'Saved password missing. Enter it again to reconnect.',
};

const DEFAULT_PREFERENCES: Preferences = {
  locale: 'en',
  create_subfolder_enabled: true,
  start_paused_enabled: false,
  auto_delete_mode: 0,
  preallocate_all: false,
  incomplete_files_ext: true,
  auto_tmm_enabled: 0,
  torrent_changed_tmm_enabled: 0,
  save_path_changed_tmm_enabled: 0,
  category_changed_tmm_enabled: 0,
  save_path: '/downloads',
  temp_path_enabled: false,
  temp_path: '/downloads/incomplete',
  scan_dirs: {},
  export_dir: '',
  export_dir_fin: '',
  mail_notification_enabled: false,
  mail_notification_sender: '',
  mail_notification_email: '',
  mail_notification_smtp: '',
  mail_notification_ssl_enabled: false,
  mail_notification_auth_enabled: false,
  mail_notification_username: '',
  mail_notification_password: '',
  autorun_enabled: false,
  autorun_program: '',
  queueing_enabled: true,
  max_active_downloads: 3,
  max_active_torrents: 8,
  max_active_uploads: 4,
  dont_count_slow_torrents: true,
  slow_torrent_dl_rate_threshold: 2,
  slow_torrent_ul_rate_threshold: 2,
  slow_torrent_inactive_timer: 60,
  max_ratio_enabled: true,
  max_ratio: 2,
  max_ratio_act: 0,
  listen_port: 6881,
  upnp: true,
  random_port: false,
  dl_limit: -1,
  up_limit: -1,
  alt_dl_limit: 512,
  alt_up_limit: 256,
  max_connec: 500,
  max_connec_per_torrent: 100,
  max_uploads: 8,
  max_uploads_per_torrent: 4,
  enable_piece_extent_affinity: false,
  bittorrent_protocol: 0,
  limit_utp_rate: true,
  limit_tcp_overhead: false,
  limit_lan_peers: false,
  scheduler_enabled: false,
  use_alt_speed_limits: false,
  schedule_from_hour: 8,
  schedule_from_min: 0,
  schedule_to_hour: 20,
  schedule_to_min: 0,
  scheduler_days: 0,
  dht: true,
  pex: true,
  lsd: true,
  encryption: 0,
  anonymous_mode: false,
  proxy_type: 0,
  proxy_ip: '',
  proxy_port: 8080,
  proxy_peer_connections: false,
  proxy_auth_enabled: false,
  proxy_username: '',
  proxy_password: '',
  proxy_torrents_only: false,
  ip_filter_enabled: false,
  ip_filter_path: '',
  ip_filter_trackers: false,
  web_ui_domain_list: '*',
  web_ui_address: '*',
  web_ui_port: 8080,
  web_ui_upnp: false,
  web_ui_username: 'admin',
  web_ui_password: '',
  web_ui_csrf_protection_enabled: true,
  web_ui_clickjacking_protection_enabled: true,
  web_ui_secure_cookie_enabled: false,
  web_ui_max_auth_fail_count: 5,
  web_ui_ban_duration: 3600,
  web_ui_session_timeout: 3600,
  web_ui_host_header_validation_enabled: false,
  bypass_local_auth: false,
  bypass_auth_subnet_whitelist_enabled: false,
  bypass_auth_subnet_whitelist: '',
  alternative_webui_enabled: false,
  alternative_webui_path: '',
  use_https: false,
  ssl_key: '',
  ssl_cert: '',
  web_ui_https_key: '',
  web_ui_https_cert: '',
  dyndns_enabled: false,
  dyndns_service: 0,
  dyndns_username: '',
  dyndns_password: '',
  dyndns_domain: '',
  rss_refresh_interval: 30,
  rss_max_articles_per_feed: 50,
  rss_processing_enabled: false,
  rss_auto_downloading_enabled: false,
  rss_download_repack_proper_episodes: false,
  rss_smart_episode_filters: '',
  add_trackers_enabled: false,
  add_trackers: '',
  web_ui_use_custom_http_headers_enabled: false,
  web_ui_custom_http_headers: '',
  max_seeding_time_enabled: false,
  max_seeding_time: 1440,
  announce_to_all_tiers: true,
  announce_to_all_trackers: false,
  async_io_threads: 4,
  hashing_threads: 1,
  file_pool_size: 5000,
  checking_memory_use: 32,
  disk_cache: 64,
  disk_cache_ttl: 60,
  enable_upload_suggestions: false,
  upload_suggestions_interval: 500,
  send_buffer_watermark: 500,
  send_buffer_low_watermark: 10,
  send_buffer_watermark_factor: 50,
  connection_speed: 30,
  socket_backlog_size: 30,
  outgoing_ports_min: 0,
  outgoing_ports_max: 0,
  upnp_lease_duration: 0,
  peer_tos: 4,
  utp_tcp_mixed_mode: 0,
  idn_support_enabled: false,
  enable_multi_connections_from_same_ip: false,
  validate_https_tracker_certificate: true,
  ssrf_mitigation: true,
  block_peers_on_privileged_ports: true,
  enable_embedded_tracker: false,
  embedded_tracker_port: 9000,
  mark_of_the_web: true,
  upload_slots_behavior: 0,
  upload_choking_algorithm: 1,
  announce_ip: '',
  max_concurrent_http_announces: 50,
  stop_tracker_timeout: 1,
  peer_turnover: 4,
  peer_turnover_cutoff: 90,
  peer_turnover_interval: 300,
  request_queue_size: 500,
  dht_bootstrap_nodes: 'router.bittorrent.com:6881',
  i2p_enabled: false,
  i2p_address: '127.0.0.1',
  i2p_port: 7656,
  i2p_mixed_mode: false,
  i2p_inbound_quantity: 3,
  i2p_outbound_quantity: 3,
  i2p_inbound_length: 3,
  i2p_outbound_length: 3,
  torrent_content_layout: 'Original',
  add_to_top_of_queue: false,
  torrent_stop_condition: 'None',
  merge_trackers: false,
  excluded_file_names_enabled: false,
  excluded_file_names: '',
  autorun_on_torrent_added_enabled: false,
  autorun_on_torrent_added_program: '',
  recheck_completed_torrents: false,
  resolve_peer_countries: true,
  reannounce_when_address_changed: false,
  max_active_checking_torrents: 1,
  max_inactive_seeding_time_enabled: false,
  max_inactive_seeding_time: 1440,
  resume_data_storage_type: 'Legacy',
  torrent_file_size_limit: 100,
  save_resume_data_interval: 60,
  save_statistics_interval: 30,
  confirm_torrent_recheck: true,
  refresh_interval: 1500,
  customize_application_instance_name: '',
  python_executable_path: '',
  torrent_content_removing_mode: 'MoveToTrash',
  memory_working_set_limit: 0,
  current_network_interface: '',
  current_ip_address: '',
  disk_queue_size: 1024,
  disk_io_type: 0,
  disk_io_read_mode: 0,
  disk_io_write_mode: 0,
  bdecode_depth_limit: 100,
  bdecode_token_limit: 3000000,
  socket_send_buffer_size: 0,
  socket_receive_buffer_size: 0,
  announce_to_all_trackers_in_tier: false,
  announce_port: 0,
  add_trackers_url: '',
  web_ui_reverse_proxy_enabled: false,
  web_ui_reverse_proxies_list: '',
  ignore_ssl_errors: false,
  enable_port_forwarding_for_embedded_tracker: false,
  use_subcategories: true,
  use_category_paths_in_manual_mode: false,
  delete_torrent_files_afterwards: false,
};

function cloneServer(server: SavedServerSummary): SavedServerSummary {
  return { ...server };
}

function cloneServers(servers: SavedServerSummary[]): SavedServerSummary[] {
  return servers.map(cloneServer);
}

function clonePreferences(preferences: Preferences): Preferences {
  return {
    ...preferences,
    scan_dirs: { ...preferences.scan_dirs },
  };
}

function buildSnapshot(
  status: SessionStatus,
  server: SavedServerSummary | null,
  lastError: string | null = null,
): SessionSnapshot {
  return {
    session_generation: 1,
    server_id: server?.id ?? null,
    server_name: server?.name ?? null,
    server_url: server?.url ?? null,
    status,
    last_error: lastError,
  };
}

function isAppScenario(value: string): value is AppScenario {
  return (APP_SCENARIOS as readonly string[]).includes(value);
}

function getAppScenario(): AppScenario {
  if (typeof window === 'undefined') return 'connected';
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlScenario = urlParams.get('mockAppState');
    if (urlScenario && isAppScenario(urlScenario)) {
      return urlScenario;
    }
    const stored = window.localStorage.getItem('taurent:mock-app-state');
    if (stored && isAppScenario(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'connected';
}

function createInitialAppState(appScenario: AppScenario) {
  switch (appScenario) {
    case 'no-saved-servers':
      return {
        appScenario,
        servers: [] as SavedServerSummary[],
        activeServerId: null,
        snapshot: buildSnapshot('disconnected', null),
        connectBehavior: 'success' as const,
        connectError: 'Unable to connect',
        connectDelayMs: 0,
        savedServerTestResult: { success: true } as TestConnectionResult,
        serverTestResult: { success: true } as TestConnectionResult,
        healthCheckResult: true,
      };
    case 'saved-server-disconnected':
      return {
        appScenario,
        servers: [cloneServer(DEFAULT_SERVER)],
        activeServerId: DEFAULT_SERVER.id,
        snapshot: buildSnapshot('disconnected', DEFAULT_SERVER),
        connectBehavior: 'success' as const,
        connectError: 'Unable to connect',
        connectDelayMs: 0,
        savedServerTestResult: { success: true } as TestConnectionResult,
        serverTestResult: { success: true } as TestConnectionResult,
        healthCheckResult: true,
      };
    case 'saved-server-unavailable':
      return {
        appScenario,
        servers: [cloneServer(DEFAULT_SERVER)],
        activeServerId: DEFAULT_SERVER.id,
        snapshot: buildSnapshot('disconnected', DEFAULT_SERVER),
        connectBehavior: 'failure' as const,
        connectError: 'Saved server is unavailable',
        connectDelayMs: 0,
        savedServerTestResult: { success: false, error: 'Saved server is unavailable' } as TestConnectionResult,
        serverTestResult: { success: false, error: 'Unable to reach server' } as TestConnectionResult,
        healthCheckResult: false,
      };
    case 'saved-server-credential-missing':
      return {
        appScenario,
        servers: [cloneServer(CREDENTIAL_MISSING_SERVER)],
        activeServerId: CREDENTIAL_MISSING_SERVER.id,
        snapshot: buildSnapshot('disconnected', CREDENTIAL_MISSING_SERVER),
        connectBehavior: 'success' as const,
        connectError: 'Saved password missing',
        connectDelayMs: 0,
        savedServerTestResult: { success: true } as TestConnectionResult,
        serverTestResult: { success: true } as TestConnectionResult,
        healthCheckResult: true,
      };
    case 'connected':
    default:
      return {
        appScenario: 'connected' as const,
        servers: [cloneServer(DEFAULT_SERVER)],
        activeServerId: DEFAULT_SERVER.id,
        snapshot: buildSnapshot('connected', DEFAULT_SERVER),
        connectBehavior: 'success' as const,
        connectError: 'Unable to connect',
        connectDelayMs: 0,
        savedServerTestResult: { success: true } as TestConnectionResult,
        serverTestResult: { success: true } as TestConnectionResult,
        healthCheckResult: true,
      };
  }
}

// ─── Scenario helpers ────────────────────────────────────────────────────────────

function getScenario(): Scenario {
  if (typeof window === 'undefined') return 'small-100';
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlScenario = urlParams.get('scenario');
    if (urlScenario && ['empty', 'small-100', 'large-1000', 'stress-5000'].includes(urlScenario)) {
      return urlScenario as Scenario;
    }
    const stored = window.localStorage.getItem('taurent:scenario');
    if (stored && ['empty', 'small-100', 'large-1000', 'stress-5000'].includes(stored)) {
      return stored as Scenario;
    }
  } catch {
    // ignore
  }
  return 'small-100';
}

function torrentCount(s: Scenario): number {
  switch (s) {
    case 'empty':        return 0;
    case 'small-100':   return 100;
    case 'large-1000':  return 1000;
    case 'stress-5000': return 5000;
  }
}

// ─── Shared mutable state ──────────────────────────────────────────────────────

let _currentState: MaindataState = createMaindataState(torrentCount(getScenario()));
let _staticWorkspaceViewState: MaindataState = createMaindataState(torrentCount(getScenario()));
let _deltaCounter = 0;

let _appScenario: AppScenario = getAppScenario();
let _servers: SavedServerSummary[] = [];
let _activeServerId: string | null = null;
let _sessionSnapshot: SessionSnapshot = buildSnapshot('connected', DEFAULT_SERVER);
let _connectBehavior: 'success' | 'failure' = 'success';
let _connectError = 'Unable to connect';
let _connectDelayMs = 0;
let _savedServerTestResult: TestConnectionResult = { success: true };
let _serverTestResult: TestConnectionResult = { success: true };
let _healthCheckResult = true;
let _preferences: Preferences = clonePreferences(DEFAULT_PREFERENCES);
let _recordedCalls: RecordedCall[] = [];
let _nextMutationFailure: MutationFailureConfig | null = null;

// Maindata sync listeners for qBClient.addMaindataSyncListener
const _maindataSyncListeners = new Set<(event: MaindataSyncChangedEvent) => void>();

// Workspace view listeners for qBClient.addWorkspaceViewListener
const _workspaceViewListeners = new Set<(event: WorkspaceView) => void>();

function setAppState(appScenario: AppScenario) {
  const next = createInitialAppState(appScenario);
  _appScenario = next.appScenario;
  _servers = cloneServers(next.servers);
  _activeServerId = next.activeServerId;
  _sessionSnapshot = { ...next.snapshot };
  _connectBehavior = next.connectBehavior;
  _connectError = next.connectError;
  _connectDelayMs = next.connectDelayMs;
  _savedServerTestResult = { ...next.savedServerTestResult };
  _serverTestResult = { ...next.serverTestResult };
  _healthCheckResult = next.healthCheckResult;
}

function getActiveServer(): SavedServerSummary | null {
  if (!_activeServerId) return null;
  return _servers.find((server) => server.id === _activeServerId) ?? null;
}

function getSavedCredentialError(server: SavedServerSummary | null | undefined): string | null {
  if (!server) return null;
  if (server.credential_status === 'missing') {
    return server.credential_warning ?? 'Saved password missing';
  }
  if (server.credential_status === 'unavailable') {
    return server.credential_warning ?? 'Stored password unavailable on this device';
  }
  return null;
}

function recordCall(name: string, args: unknown[]) {
  _recordedCalls.push({ name, args });
}

function maybeFail(operation: string) {
  if (_nextMutationFailure?.operation !== operation) return null;
  const error = new Error(_nextMutationFailure.error);
  _nextMutationFailure = null;
  return error;
}

function updateSnapshot(
  status: SessionStatus,
  server: SavedServerSummary | null,
  lastError: string | null = null,
) {
  _sessionSnapshot = buildSnapshot(status, server, lastError);
}

function emitSession(status: SessionStatus, server: SavedServerSummary | null, lastError: string | null = null) {
  updateSnapshot(status, server, lastError);
  emitSessionChanged({
    session_generation: _sessionSnapshot.session_generation,
    server_id: server?.id ?? null,
    status,
    last_error: lastError,
  } satisfies SessionChangedEvent);
}

setAppState(_appScenario);

// ─── Automation control ────────────────────────────────────────────────────────

interface AutomationControl {
  getState: () => MaindataState;
  getAppScenario: () => AppScenario;
  setAppScenario: (appScenario: AppScenario) => void;
  injectCustomDelta: (delta: SyncMainData) => void;
  deltaCount: () => number;
  getPreferences: () => Preferences;
  resetPreferences: () => void;
  getRecordedCalls: () => RecordedCall[];
  clearRecordedCalls: () => void;
  setNextMutationFailure: (operation: string, error: string) => void;
  getPendingMutationFailure: () => { operation: string; error: string } | null;
  clearMutationFaults: () => void;
  emitSessionChanged: (event: SessionChangedEvent) => void;
  emitResourceInvalidated: (event: ResourceInvalidatedEvent) => void;
  emitMaindataSyncChanged: (event: MaindataSyncChangedEvent) => void;
  emitWorkspaceViewChanged: (event: WorkspaceView) => void;
  reset: () => void;
  scenario: Scenario;
}

const _ctrl: AutomationControl = {
  getState: () => _currentState,
  getAppScenario: () => _appScenario,
  setAppScenario: (appScenario: AppScenario) => {
    setAppState(appScenario);
  },
  injectCustomDelta: (delta: SyncMainData) => {
    if (delta.torrents) {
      for (const [hash, t] of Object.entries(delta.torrents)) {
        _currentState.torrents[hash] = t as typeof _currentState.torrents[string];
      }
    }
    if (delta.torrents_removed) {
      for (const h of delta.torrents_removed) {
        delete _currentState.torrents[h];
      }
    }
    _currentState.rid = (delta.rid ?? _currentState.rid) + 1;
  },
  deltaCount: () => _deltaCounter,
  getPreferences: () => clonePreferences(_preferences),
  resetPreferences: () => {
    _preferences = clonePreferences(DEFAULT_PREFERENCES);
  },
  getRecordedCalls: () => _recordedCalls.map((call) => ({ ...call, args: [...call.args] })),
  clearRecordedCalls: () => {
    _recordedCalls = [];
  },
  setNextMutationFailure: (operation: string, error: string) => {
    _nextMutationFailure = { operation, error };
  },
  getPendingMutationFailure: () =>
    _nextMutationFailure ? { ..._nextMutationFailure } : null,
  clearMutationFaults: () => {
    _nextMutationFailure = null;
  },
  emitSessionChanged: (event: SessionChangedEvent) => {
    const server = event.server_id
      ? _servers.find((candidate) => candidate.id === event.server_id) ?? null
      : null;
    emitSession(event.status, server, event.last_error);
  },
  emitResourceInvalidated: (event: ResourceInvalidatedEvent) => {
    emitResourceInvalidated(event);
  },
  emitMaindataSyncChanged: (event: MaindataSyncChangedEvent) => {
    emitMaindataSyncChanged(event);
    // Also notify qBClient maindata sync listeners
    for (const listener of _maindataSyncListeners) {
      listener(event);
    }
  },
  emitWorkspaceViewChanged: (event: WorkspaceView) => {
    emitWorkspaceViewChanged(event);
    // Also notify qBClient workspace view listeners
    for (const listener of _workspaceViewListeners) {
      listener(event);
    }
  },
  reset: () => {
    _currentState = createMaindataState(torrentCount(getScenario()));
    _staticWorkspaceViewState = createMaindataState(torrentCount(getScenario()));
    setAppState(getAppScenario());
    _deltaCounter = 0;
    _preferences = clonePreferences(DEFAULT_PREFERENCES);
    _recordedCalls = [];
    _nextMutationFailure = null;
    // Clear any registered maindata sync listeners so a stale scenario
    // cannot leak listeners into the next run.
    _maindataSyncListeners.clear();
    // Clear workspace view listeners so a stale scenario cannot leak
    // listeners into the next run.
    _workspaceViewListeners.clear();
  },
  scenario: getScenario(),
};

// Expose on window for Playwright
if (typeof window !== 'undefined') {
  (window as unknown as { __TAURENT_AUTOMATION__?: AutomationControl }).__TAURENT_AUTOMATION__ = _ctrl;
}

// ─── Safe async no-op ──────────────────────────────────────────────────────────

const GEN = 1;
const OK = (): OperationResponse => ({ session_generation: GEN, server_id: null, success: true });

// ─── Concrete torrent detail fixtures (T140.3) ─────────────────────────────────
// Rust (qb-core::dto) now owns the validation boundary for these endpoints, so
// the bridge returns plain typed payloads. The mobile automation mock mirrors
// the post-unwrap contract: typed TorrentProperties, Tracker[], and TorrentFile[]
// fixtures that automation scripts can rely on.

const MOCK_TORRENT_PROPERTIES: TorrentProperties = {
  save_path: '/downloads/mock-mobile',
  creation_date: 1_700_000_000,
  piece_size: 16384,
  comment: 'taurent mobile mock fixture',
  total_wasted: 0,
  total_uploaded: 0,
  total_uploaded_session: 0,
  total_downloaded: 1024,
  total_downloaded_session: 1024,
  up_limit: 0,
  dl_limit: 0,
  time_elapsed: 60,
  seeding_time: 0,
  nb_connections: 1,
  nb_connections_limit: 100,
  share_ratio: 0.5,
  addition_date: 1_700_000_000,
  completion_date: 0,
  created_by: 'taurent mobile mock',
  dl_speed_avg: 0,
  dl_speed: 0,
  eta: 0,
  last_seen: 0,
  peers: 1,
  peers_total: 1,
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

const MOCK_TORRENT_TRACKERS: Tracker[] = [
  {
    url: 'udp://tracker.mock-mobile.example:1337/announce',
    status: 2,
    tier: 0,
    num_peers: 1,
    num_seeds: 1,
    num_leeches: 0,
    num_downloaded: 0,
    msg: '',
  },
];

const MOCK_TORRENT_FILES: TorrentFile[] = [
  {
    index: 0,
    name: 'mock-mobile-file.mkv',
    size: 1024,
    progress: 0,
    priority: 1,
    is_seed: false,
    piece_range: [0, 0],
    availability: 1,
  },
];

// ─── Workspace view derivation ──────────────────────────────────────────────────
//
// Derives a `WorkspaceView` from the mock's internal `MaindataState`.
// This is the mock equivalent of the Rust `WorkspaceViewEngine` — it applies
// the request's filters, sort, and locale to produce a complete view.
// This allows E2E tests to exercise the full bridge contract path without
// depending on the retired JS derivation utilities.

function computeWorkspaceView(request: WorkspaceViewRequest, state: MaindataState): WorkspaceView {
  const { filters, sort, locale } = request;
  const { torrents: torrentsMap, categories, tags: allTags, rid } = state;
  void locale;
  void allTags;

  // Convert Record<string, Torrent> → Torrent[] with hash injected
  const torrents: Array<Torrent & { hash: string }> = Object.entries(torrentsMap).map(
    ([hash, t]) => ({ ...t, hash }),
  );

  // ── Filter by status ──
  const statusFilter = filters.status;
  let filtered = torrents;
  if (statusFilter && statusFilter !== 'all' && isTorrentFilterType(statusFilter)) {
    filtered = filtered.filter(t => matchesTorrentFilter(statusFilter, t));
  }

  // ── Filter by category ──
  const catFilter = filters.category;
  if (catFilter !== null) {
    if (catFilter === '') {
      filtered = filtered.filter(t => t.category === '');
    } else {
      filtered = filtered.filter(t => t.category === catFilter);
    }
  }

  // ── Filter by tag ──
  const tagFilter = filters.tag;
  if (tagFilter !== null && tagFilter !== '') {
    filtered = filtered.filter(t => torrentHasTag(t, tagFilter));
  }

  // ── Filter by tracker ──
  const trackerFilter = filters.tracker;
  if (trackerFilter !== null && trackerFilter !== '') {
    filtered = filtered.filter(t => matchesTorrentTracker(t, trackerFilter));
  }

  // ── Filter by search ──
  const searchFilter = filters.search;
  if (searchFilter !== '' && searchFilter.length > 0) {
    filtered = filtered.filter(t => matchesTorrentSearch(t, searchFilter));
  }

  // ── Sort ──
  const sortField = isSortField(sort.field) ? sort.field : 'name';
  const sorted_hashes = request.include_sorted_hashes
    ? sortTorrents(filtered, sortField, sort.direction).map(t => t.hash)
    : [];
  const filtered_count = filtered.length;
  const total_count = torrents.length;

  // Speed totals (over all torrents, unfiltered)
  const total_dl_speed = torrents.reduce((sum, t) => sum + (t.dlspeed ?? 0), 0);
  const total_ul_speed = torrents.reduce((sum, t) => sum + (t.upspeed ?? 0), 0);

  // ── Status counts (unfiltered) ──
  const status_counts: Record<string, number> = {
    all: total_count,
    downloading: 0,
    seeding: 0,
    completed: 0,
    stopped: 0,
    active: 0,
    inactive: 0,
    running: 0,
    stalled: 0,
    stalled_uploading: 0,
    stalled_downloading: 0,
    errored: 0,
  };
  for (const t of torrents) {
    switch (t.state) {
      case 'downloading': status_counts.downloading++; status_counts.active++; status_counts.running++; break;
      case 'seeding': status_counts.seeding++; status_counts.active++; status_counts.running++; break;
      case 'completed': status_counts.completed++; status_counts.inactive++; break;
      case 'stopped': status_counts.stopped++; status_counts.inactive++; break;
      case 'stalledUP': status_counts.stalled_uploading++; status_counts.active++; status_counts.running++; break;
      case 'stalledDL': status_counts.stalled_downloading++; status_counts.active++; status_counts.running++; break;
      case 'error': status_counts.errored++; status_counts.inactive++; break;
      case 'pausedUP': status_counts.completed++; status_counts.inactive++; break;
      case 'pausedDL': status_counts.stopped++; status_counts.inactive++; break;
      default: break;
    }
  }

  // ── Category counts (cross-filtered: honor status/tag/tracker/search, ignore category) ──
  let crossFiltered = torrents;
  if (statusFilter && statusFilter !== 'all' && isTorrentFilterType(statusFilter)) {
    crossFiltered = crossFiltered.filter(t => matchesTorrentFilter(statusFilter, t));
  }
  if (tagFilter !== null && tagFilter !== '') {
    crossFiltered = crossFiltered.filter(t => torrentHasTag(t, tagFilter));
  }
  if (trackerFilter !== null && trackerFilter !== '') {
    crossFiltered = crossFiltered.filter(t => matchesTorrentTracker(t, trackerFilter));
  }
  if (searchFilter !== '' && searchFilter.length > 0) {
    crossFiltered = crossFiltered.filter(t => matchesTorrentSearch(t, searchFilter));
  }

  const category_counts: Record<string, number> = {};
  for (const t of crossFiltered) {
    const cat = t.category || '';
    category_counts[cat] = (category_counts[cat] || 0) + 1;
  }

  // ── Tag counts (cross-filtered: honor status/category/tracker/search, ignore tag) ──
  crossFiltered = torrents;
  if (statusFilter && statusFilter !== 'all' && isTorrentFilterType(statusFilter)) {
    crossFiltered = crossFiltered.filter(t => matchesTorrentFilter(statusFilter, t));
  }
  if (catFilter !== null) {
    if (catFilter === '') {
      crossFiltered = crossFiltered.filter(t => t.category === '');
    } else {
      crossFiltered = crossFiltered.filter(t => t.category === catFilter);
    }
  }
  if (trackerFilter !== null && trackerFilter !== '') {
    crossFiltered = crossFiltered.filter(t => matchesTorrentTracker(t, trackerFilter));
  }
  if (searchFilter !== '' && searchFilter.length > 0) {
    crossFiltered = crossFiltered.filter(t => matchesTorrentSearch(t, searchFilter));
  }

  const tag_counts: Record<string, number> = {};
  for (const t of crossFiltered) {
    const tags = parseTorrentTags(t.tags);
    for (const tag of tags) {
      if (tag) tag_counts[tag] = (tag_counts[tag] || 0) + 1;
    }
  }

  // ── Tracker counts (cross-filtered: honor status/category/tag/search, ignore tracker) ──
  crossFiltered = torrents;
  if (statusFilter && statusFilter !== 'all' && isTorrentFilterType(statusFilter)) {
    crossFiltered = crossFiltered.filter(t => matchesTorrentFilter(statusFilter, t));
  }
  if (catFilter !== null) {
    if (catFilter === '') {
      crossFiltered = crossFiltered.filter(t => t.category === '');
    } else {
      crossFiltered = crossFiltered.filter(t => t.category === catFilter);
    }
  }
  if (tagFilter !== null && tagFilter !== '') {
    crossFiltered = crossFiltered.filter(t => torrentHasTag(t, tagFilter));
  }
  if (searchFilter !== '' && searchFilter.length > 0) {
    crossFiltered = crossFiltered.filter(t => matchesTorrentSearch(t, searchFilter));
  }

  const tracker_counts: Record<string, number> = {};
  const trackerHostnames = new Map<string, string>();
  for (const t of crossFiltered) {
    const tracker = t.tracker;
    if (tracker && tracker.length > 0) {
      tracker_counts[tracker] = (tracker_counts[tracker] || 0) + 1;
      if (!trackerHostnames.has(tracker)) {
        try {
          trackerHostnames.set(tracker, new URL(tracker).hostname);
        } catch {
          trackerHostnames.set(tracker, tracker);
        }
      }
    }
  }

  // ── Sidebar arrays ──
  const sidebar_categories = Object.entries(categories).map(([name, cat]) => ({
    name,
    save_path: cat.savePath,
    count: category_counts[name] || 0,
  }));
  if (category_counts[''] !== undefined) {
    sidebar_categories.unshift({
      name: '',
      save_path: '',
      count: category_counts[''],
    });
  }

  const sidebar_tags = Object.entries(tag_counts).map(([tag, count]) => ({
    tag,
    count,
  }));

  const sidebar_trackers = Object.entries(tracker_counts).map(([tracker_url, count]) => ({
    tracker_url,
    hostname: trackerHostnames.get(tracker_url) || tracker_url,
    count,
  }));

  const is_filtered =
    (statusFilter !== '' && statusFilter !== 'all') ||
    catFilter !== null ||
    (tagFilter !== null && tagFilter !== '') ||
    (trackerFilter !== null && trackerFilter !== '') ||
    (searchFilter !== '' && searchFilter.length > 0);

  return {
    request_id: request.request_id,
    revision: rid,
    sorted_hashes,
    filtered_count,
    total_count,
    total_dl_speed,
    total_ul_speed,
    status_counts,
    category_counts,
    tag_counts,
    tracker_counts,
    sidebar_categories,
    sidebar_tags,
    sidebar_trackers,
    is_filtered,
  };
}

// ─── Mock bridge ────────────────────────────────────────────────────────────────

function createMockMobileBridge(transport?: Transport): MobileBridge {
  // Transport is accepted for API compatibility but not used in mock mode
  void transport;

  return {
    capabilities: MOBILE_CAPABILITIES,

    // ── Session ────────────────────────────────────────────────────────────────

    getSessionSnapshot() {
      return Promise.resolve({
        ..._sessionSnapshot,
        session_generation: GEN,
      });
    },

    sessionConnectById(serverId: string) {
      recordCall('sessionConnectById', [serverId]);
      const server = _servers.find((candidate) => candidate.id === serverId) ?? getActiveServer();
      const credentialError = getSavedCredentialError(server);
      if (credentialError) {
        updateSnapshot('error', server ?? null, credentialError);
        return Promise.reject(new Error(credentialError));
      }
      if (_connectBehavior === 'failure') {
        updateSnapshot('error', server ?? null, _connectError);
        return Promise.reject(new Error(_connectError));
      }
      window.setTimeout(() => {
        emitSession('connected', server ?? null, null);
      }, _connectDelayMs);
      return Promise.resolve(GEN);
    },

    sessionDisconnect() {
      recordCall('sessionDisconnect', []);
      emitSession('disconnected', null, null);
      return Promise.resolve(GEN);
    },

    sessionReconnect() {
      recordCall('sessionReconnect', []);
      const server = getActiveServer();
      const credentialError = getSavedCredentialError(server);
      if (credentialError) {
        emitSession('error', server, credentialError);
        return Promise.reject(new Error(credentialError));
      }
      if (_connectBehavior === 'failure') {
        emitSession('error', server, _connectError);
        return Promise.reject(new Error(_connectError));
      }
      window.setTimeout(() => {
        emitSession('connected', server, null);
      }, _connectDelayMs);
      return Promise.resolve(GEN);
    },

    sessionSwitchServer(
      serverId: string,
      serverName: string,
      serverUrl: string,
      serverUsername: string,
      serverPassword: string,
    ) {
      recordCall('sessionSwitchServer', [serverId, serverName, serverUrl, serverUsername, serverPassword]);
      const server = _servers.find((s) => s.id === serverId);
      if (server) {
        emitSession('connected', server, null);
      }
      return Promise.resolve(GEN);
    },

    sessionSwitchServerById(serverId: string) {
      recordCall('sessionSwitchServerById', [serverId]);
      const failError = maybeFail('sessionSwitchServerById');
      if (failError) return Promise.reject(failError);
      const server = _servers.find((s) => s.id === serverId) ?? null;
      const credentialError = getSavedCredentialError(server);
      if (credentialError) {
        return Promise.reject(new Error(credentialError));
      }
      if (_connectBehavior === 'failure') {
        // Atomic failure: reject without mutating session or emitting error event.
        return Promise.reject(new Error(_connectError));
      }
      // Atomic success: switch active server and emit connected
      _activeServerId = serverId;
      emitSession('connected', server, null);
      return Promise.resolve(GEN);
    },

    sessionSetError(error: string) {
      recordCall('sessionSetError', [error]);
      const server = getActiveServer();
      emitSession('error', server, error);
      return Promise.resolve(GEN);
    },

    sessionClearError() {
      recordCall('sessionClearError', []);
      const server = getActiveServer();
      if (server) {
        emitSession('connected', server, null);
      }
      return Promise.resolve(GEN);
    },

    sessionSetConnecting(
      serverId: string,
      serverName: string,
      serverUrl: string,
      serverUsername: string,
      serverPassword: string,
    ) {
      recordCall('sessionSetConnecting', [serverId, serverName, serverUrl, serverUsername, serverPassword]);
      const server = _servers.find((s) => s.id === serverId);
      updateSnapshot('connecting', server ?? null);
      return Promise.resolve(GEN);
    },

    getSessionGeneration() {
      return Promise.resolve(GEN);
    },

    getSessionStatus() {
      return Promise.resolve(_sessionSnapshot.status);
    },

    sessionHealthCheck() {
      recordCall('sessionHealthCheck', []);
      if (getSavedCredentialError(getActiveServer())) {
        return Promise.resolve(false);
      }
      return Promise.resolve(_healthCheckResult);
    },

    // ── Torrents ──────────────────────────────────────────────────────────────

    torrents: {
      getList(params) {
        recordCall('torrents.getList', [params]);
        const state = _ctrl.getState();
        // T143.1: Rust owns the list-row validation boundary and returns a
        // typed `Torrent[]`. The mobile mock mirrors that contract by
        // returning the accumulated maindata torrents as an array of typed
        // `Torrent` rows rather than a hash-keyed map. Maindata sync/snapshot
        // responses elsewhere still return torrent maps — only the explicit
        // list command shape changed here.
        return Promise.resolve({
          session_generation: GEN,
          server_id: _activeServerId,
          torrents: Object.values(state.torrents),
        });
      },

      pause(hashes: string[]) {
        recordCall('torrents.pause', [hashes]);
        const error = maybeFail('torrents.pause');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      resume(hashes: string[]) {
        recordCall('torrents.resume', [hashes]);
        const error = maybeFail('torrents.resume');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      delete(hashes: string[], deleteFiles: boolean) {
        recordCall('torrents.delete', [hashes, deleteFiles]);
        const error = maybeFail('torrents.delete');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      recheck(hashes: string[]) {
        recordCall('torrents.recheck', [hashes]);
        return Promise.resolve(OK());
      },

      reannounce(hashes: string[]) {
        recordCall('torrents.reannounce', [hashes]);
        return Promise.resolve(OK());
      },

      setForceStart(hashes: string[], value: boolean) {
        recordCall('torrents.setForceStart', [hashes, value]);
        return Promise.resolve(OK());
      },

      getProperties(hash: string) {
        recordCall('torrents.getProperties', [hash]);
        return Promise.resolve(MOCK_TORRENT_PROPERTIES);
      },

      getTrackers(hash: string) {
        recordCall('torrents.getTrackers', [hash]);
        return Promise.resolve(MOCK_TORRENT_TRACKERS);
      },

      getFiles(hash: string) {
        recordCall('torrents.getFiles', [hash]);
        return Promise.resolve(MOCK_TORRENT_FILES);
      },

      addTorrent(options: AddTorrentOptions) {
        recordCall('torrents.addTorrent', [options]);
        const error = maybeFail('torrents.addTorrent');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      addTrackers(hash: string, urls: string) {
        recordCall('torrents.addTrackers', [hash, urls]);
        return Promise.resolve(OK());
      },

      editTracker(hash: string, origUrl: string, newUrl: string) {
        recordCall('torrents.editTracker', [hash, origUrl, newUrl]);
        return Promise.resolve(OK());
      },

      removeTrackers(hash: string, urls: string) {
        recordCall('torrents.removeTrackers', [hash, urls]);
        return Promise.resolve(OK());
      },

      getWebSeeds(hash: string) {
        recordCall('torrents.getWebSeeds', [hash]);
        return Promise.resolve({ session_generation: GEN, server_id: null, webseeds: [] });
      },

      addWebSeeds(_hash: string, _urls: string) {
        recordCall('torrents.addWebSeeds', [_hash, _urls]);
        return Promise.resolve(OK());
      },

      editWebSeed(_hash: string, _origUrl: string, _newUrl: string) {
        recordCall('torrents.editWebSeed', [_hash, _origUrl, _newUrl]);
        return Promise.resolve(OK());
      },

      removeWebSeeds(_hash: string, _urls: string) {
        recordCall('torrents.removeWebSeeds', [_hash, _urls]);
        return Promise.resolve(OK());
      },

      setDownloadLimit(hashes: string[], limit: number) {
        recordCall('torrents.setDownloadLimit', [hashes, limit]);
        const error = maybeFail('torrents.setDownloadLimit');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      setUploadLimit(hashes: string[], limit: number) {
        recordCall('torrents.setUploadLimit', [hashes, limit]);
        const error = maybeFail('torrents.setUploadLimit');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      setFilePriority(hash: string, ids: number[], priority: number) {
        recordCall('torrents.setFilePriority', [hash, ids, priority]);
        return Promise.resolve(OK());
      },

      setCategory(hashes: string[], category: string) {
        recordCall('torrents.setCategory', [hashes, category]);
        return Promise.resolve(OK());
      },

      addTags(hashes: string[], tags: string[]) {
        recordCall('torrents.addTags', [hashes, tags]);
        return Promise.resolve(OK());
      },

      removeTags(hashes: string[], tags: string[]) {
        recordCall('torrents.removeTags', [hashes, tags]);
        return Promise.resolve(OK());
      },

      setName(hash: string, name: string) {
        recordCall('torrents.setName', [hash, name]);
        const error = maybeFail('torrents.setName');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      setLocation(hashes: string[], location: string) {
        recordCall('torrents.setLocation', [hashes, location]);
        const error = maybeFail('torrents.setLocation');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      increasePriority(hashes: string[]) {
        recordCall('torrents.increasePriority', [hashes]);
        return Promise.resolve(OK());
      },

      decreasePriority(hashes: string[]) {
        recordCall('torrents.decreasePriority', [hashes]);
        return Promise.resolve(OK());
      },

      topPriority(hashes: string[]) {
        recordCall('torrents.topPriority', [hashes]);
        return Promise.resolve(OK());
      },

      bottomPriority(hashes: string[]) {
        recordCall('torrents.bottomPriority', [hashes]);
        return Promise.resolve(OK());
      },

      renameFile(hash: string, oldPath: string, newPath: string) {
        recordCall('torrents.renameFile', [hash, oldPath, newPath]);
        return Promise.resolve(OK());
      },

      renameFolder(hash: string, oldPath: string, newPath: string) {
        recordCall('torrents.renameFolder', [hash, oldPath, newPath]);
        return Promise.resolve(OK());
      },

      getDownloadLimit(hashes: string[]) {
        recordCall('torrents.getDownloadLimit', [hashes]);
        return Promise.resolve({ session_generation: GEN, server_id: null, limit: 0 });
      },

      getUploadLimit(hashes: string[]) {
        recordCall('torrents.getUploadLimit', [hashes]);
        return Promise.resolve({ session_generation: GEN, server_id: null, limit: 0 });
      },

      syncTorrentPeers(hash: string, rid?: number) {
        recordCall('torrents.syncTorrentPeers', [hash, rid]);
        return Promise.resolve({ rid: rid ?? 0, full_update: true });
      },

      setAutoManagement(hashes: string[], enable: boolean) {
        recordCall('torrents.setAutoManagement', [hashes, enable]);
        return Promise.resolve(OK());
      },
      setShareLimits(hashes: string[], ratioLimit: number, seedingTimeLimit: number) {
        recordCall('torrents.setShareLimits', [hashes, ratioLimit, seedingTimeLimit]);
        return Promise.resolve(OK());
      },
      setSequentialDownload(hashes: string[], value: boolean) {
        recordCall('torrents.setSequentialDownload', [hashes, value]);
        return Promise.resolve(OK());
      },
      setFirstLastPiecePriority(hashes: string[], value: boolean) {
        recordCall('torrents.setFirstLastPiecePriority', [hashes, value]);
        return Promise.resolve(OK());
      },
      setSuperSeeding(hashes: string[], value: boolean) {
        recordCall('torrents.setSuperSeeding', [hashes, value]);
        return Promise.resolve(OK());
      },
      exportTorrent(hash: string, savePath: string) {
        recordCall('torrents.exportTorrent', [hash, savePath]);
        return Promise.resolve(OK());
      },
    },

    // ── Transfer ──────────────────────────────────────────────────────────────

    transfer: {
      getInfo() {
        recordCall('transfer.getInfo', []);
        return Promise.resolve({
          session_generation: GEN,
          server_id: _activeServerId,
          info: {
            dl_info_speed: 0,
            dl_info_data: 0,
            up_info_speed: 0,
            up_info_data: 0,
            dl_rate_limit: 0,
            up_rate_limit: 0,
            dht_nodes: 0,
            connection_status: 'connected',
            queueing: false,
            use_alt_speed_limits: _preferences.use_alt_speed_limits,
            refresh_interval: 1500,
          },
        });
      },

      getSpeedLimitsMode() {
        recordCall('transfer.getSpeedLimitsMode', []);
        return Promise.resolve({ session_generation: GEN, server_id: null, mode: _preferences.use_alt_speed_limits });
      },

      toggleSpeedLimitsMode() {
        recordCall('transfer.toggleSpeedLimitsMode', []);
        _preferences.use_alt_speed_limits = !_preferences.use_alt_speed_limits;
        return Promise.resolve(OK());
      },

      getDownloadLimit() {
        recordCall('transfer.getDownloadLimit', []);
        return Promise.resolve({ session_generation: GEN, server_id: null, limit: 0 });
      },

      setDownloadLimit(limit: number) {
        recordCall('transfer.setDownloadLimit', [limit]);
        const error = maybeFail('transfer.setDownloadLimit');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      getUploadLimit() {
        recordCall('transfer.getUploadLimit', []);
        return Promise.resolve({ session_generation: GEN, server_id: null, limit: 0 });
      },

      setUploadLimit(limit: number) {
        recordCall('transfer.setUploadLimit', [limit]);
        const error = maybeFail('transfer.setUploadLimit');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      banPeers(peers: string[]) {
        recordCall('transfer.banPeers', [peers]);
        return Promise.resolve(OK());
      },

      getCookies() {
        recordCall('transfer.getCookies', []);
        return Promise.resolve({});
      },

      setCookies(url: string, cookies: string) {
        recordCall('transfer.setCookies', [url, cookies]);
        return Promise.resolve(OK());
      },
    },

    // ── Categories ────────────────────────────────────────────────────────────

    categories: {
      getCategories() {
        recordCall('categories.getCategories', []);
        return Promise.resolve({
          session_generation: GEN,
          server_id: _activeServerId,
          categories: {
            videos: { name: 'videos', savePath: '/data/videos' },
            audio: { name: 'audio', savePath: '/data/audio' },
          },
        });
      },

      createCategory(category: string, savePath: string) {
        recordCall('categories.createCategory', [category, savePath]);
        return Promise.resolve(OK());
      },

      editCategory(category: string, savePath: string) {
        recordCall('categories.editCategory', [category, savePath]);
        const error = maybeFail('categories.editCategory');
        if (error) return Promise.reject(error);
        return Promise.resolve(OK());
      },

      removeCategories(categories: string[]) {
        recordCall('categories.removeCategories', [categories]);
        return Promise.resolve(OK());
      },
    },

    // ── Tags ──────────────────────────────────────────────────────────────────

    tags: {
      getTags() {
        recordCall('tags.getTags', []);
        return Promise.resolve({
          session_generation: GEN,
          server_id: _activeServerId,
          tags: ['tag-a', 'tag-b', 'tag-c'],
        });
      },

      createTags(tags: string[]) {
        recordCall('tags.createTags', [tags]);
        return Promise.resolve(OK());
      },

      deleteTags(tags: string[]) {
        recordCall('tags.deleteTags', [tags]);
        return Promise.resolve(OK());
      },

      addTorrentTags(hashes: string[], tags: string[]) {
        recordCall('tags.addTorrentTags', [hashes, tags]);
        return Promise.resolve(OK());
      },

      removeTorrentTags(hashes: string[], tags: string[]) {
        recordCall('tags.removeTorrentTags', [hashes, tags]);
        return Promise.resolve(OK());
      },
    },

    // ── Application ───────────────────────────────────────────────────────────

    application: {
      getDefaultSavePath() {
        recordCall('application.getDefaultSavePath', []);
        return Promise.resolve({ session_generation: GEN, server_id: _activeServerId, path: _preferences.save_path });
      },

      shutdown() {
        recordCall('application.shutdown', []);
        return Promise.resolve(OK());
      },

      getPreferences() {
        recordCall('application.getPreferences', []);
        return Promise.resolve({
          session_generation: GEN,
          server_id: _activeServerId,
          preferences: clonePreferences(_preferences),
        });
      },

      setPreferences(prefs: Partial<Preferences>) {
        recordCall('application.setPreferences', [prefs]);
        _preferences = {
          ..._preferences,
          ...prefs,
          scan_dirs: prefs.scan_dirs ? { ...prefs.scan_dirs } : { ..._preferences.scan_dirs },
        };
        emitResourceInvalidated({
          session_generation: GEN,
          server_id: _activeServerId,
          resource: 'preferences',
        });
        return Promise.resolve(OK());
      },

      getServerCapabilities() {
        recordCall('application.getServerCapabilities', []);
        return Promise.resolve({
          session_generation: GEN,
          server_id: _activeServerId,
          capabilities: {
            supports_search: 'unknown' as const,
            supports_rss: 'unknown' as const,
            supports_pause_resume: 'unknown' as const,
            supports_webseed_management: 'confirmed' as const,
          },
        });
      },
    },

    // ── Servers ───────────────────────────────────────────────────────────────

    servers: {
      listServers() {
        recordCall('servers.listServers', []);
        return Promise.resolve(cloneServers(_servers));
      },

      getActiveServer() {
        recordCall('servers.getActiveServer', []);
        const activeServer = getActiveServer();
        return Promise.resolve(activeServer ? cloneServer(activeServer) : null);
      },

      addServer(input: AddServerInput) {
        recordCall('servers.addServer', [input]);
        const server: SavedServerSummary = {
          id: `mock-server-${_servers.length + 1}`,
          name: input.name,
          url: input.url,
          username: input.username,
          credential_status: input.remember_password === false ? 'session_only' : 'stored',
        };
        _servers = [..._servers, server];
        if (!_activeServerId) {
          _activeServerId = server.id;
        }
        return Promise.resolve(cloneServer(server));
      },

      updateServer(input: UpdateServerInput) {
        recordCall('servers.updateServer', [input]);
        const existing = _servers.find((server) => server.id === input.id);
        if (!existing) {
          return Promise.reject(new Error('Server not found'));
        }
        const passwordProvided = input.password !== undefined;
        const hadCredentialError = getSavedCredentialError(existing) !== null;
        const updated: SavedServerSummary = {
          ...existing,
          name: input.name ?? existing.name,
          url: input.url ?? existing.url,
          username: input.username ?? existing.username,
          ...(passwordProvided
            ? {
                credential_status: input.remember_password !== false ? 'stored' : 'session_only',
                credential_warning: undefined,
              }
            : {}),
        };
        _servers = _servers.map((server) => (server.id === input.id ? updated : server));
        if (passwordProvided && hadCredentialError) {
          _connectBehavior = 'success';
          _connectError = 'Unable to connect';
          _savedServerTestResult = { success: true };
          _serverTestResult = { success: true };
          _healthCheckResult = true;
        }
        if (_sessionSnapshot.server_id === input.id && _sessionSnapshot.status === 'connected') {
          updateSnapshot('connected', updated, null);
        }
        return Promise.resolve(cloneServer(updated));
      },

      removeServer(serverId: string) {
        recordCall('servers.removeServer', [serverId]);
        _servers = _servers.filter((server) => server.id !== serverId);
        if (_activeServerId === serverId) {
          _activeServerId = null;
        }
        if (_sessionSnapshot.server_id === serverId) {
          updateSnapshot('disconnected', null, null);
        }
        return Promise.resolve();
      },

      selectServer(serverId: string) {
        recordCall('servers.selectServer', [serverId]);
        _activeServerId = serverId;
        return Promise.resolve();
      },

      sessionSwitchServerById(serverId: string) {
        recordCall('servers.sessionSwitchServerById', [serverId]);
        const failError = maybeFail('sessionSwitchServerById');
        if (failError) return Promise.reject(failError);
        const server = _servers.find((s) => s.id === serverId) ?? null;
        const credentialError = getSavedCredentialError(server);
        if (credentialError) {
          return Promise.reject(new Error(credentialError));
        }
        if (_connectBehavior === 'failure') {
          // Atomic failure: reject without mutating session or emitting error event.
          return Promise.reject(new Error(_connectError));
        }
        _activeServerId = serverId;
        emitSession('connected', server, null);
        return Promise.resolve(GEN);
      },

      testServerConnection(serverUrl: string, credentials: ServerCredentialsInput) {
        recordCall('servers.testServerConnection', [serverUrl, credentials]);
        return Promise.resolve({ ..._serverTestResult });
      },

      testSavedServerConnection(serverId: string) {
        recordCall('servers.testSavedServerConnection', [serverId]);
        const credentialError = getSavedCredentialError(_servers.find((server) => server.id === serverId));
        if (credentialError) {
          return Promise.resolve({ success: false, error: credentialError });
        }
        return Promise.resolve({ ..._savedServerTestResult });
      },

      normalizeServerUrl(input: { url: string; defaultScheme?: string }) {
        recordCall('servers.normalizeServerUrl', [input]);
        const scheme = input.defaultScheme ?? 'http';
        const stripped = input.url.replace(/\/+$/, '').replace(/\/api\/v2\/?$/, '');
        const normalized = /^[a-z]+:\/\//.test(stripped) ? stripped : `${scheme}://${stripped}`;
        return Promise.resolve({ normalized });
      },
      probeServerScheme(url: string, username: string, password: string) {
        recordCall('servers.probeServerScheme', [url, username, password]);
        return Promise.resolve({ success: true, normalizedUrl: url, error: null });
      },
    },

    // ── qBClient ──────────────────────────────────────────────────────────────

    qBClient: {
      getMaindataSnapshot(): Promise<MaindataSnapshotResponse> {
        recordCall('qBClient.getMaindataSnapshot', []);
        const state = _ctrl.getState();
        return Promise.resolve({
          session_generation: GEN,
          server_id: 'mock-server-id',
          revision: state.rid,
          rid: state.rid,
          health: {
            state: 'healthy',
            consecutive_errors: 0,
            last_success_ts: Math.floor(Date.now() / 1000),
            last_error_ts: null,
            last_error_message: null,
          },
          maindata: {
            torrents: state.torrents,
            categories: {
              videos: { name: 'videos', savePath: '/data/videos' },
              audio: { name: 'audio', savePath: '/data/audio' },
            },
            tags: ['tag-a', 'tag-b', 'tag-c'],
            server_state: {
              dl_info_speed: 1024 * 1024,
              dl_info_data: 1024 * 1024 * 100,
              up_info_speed: 512 * 1024,
              up_info_data: 1024 * 1024 * 50,
              dl_rate_limit: 0,
              up_rate_limit: 0,
              dht_nodes: 42,
              connection_status: 'connected',
              queueing: true,
              use_alt_speed_limits: _preferences.use_alt_speed_limits,
              refresh_interval: 1500,
            },
          },
        });
      },

      getMaindataSyncStatus(): Promise<MaindataSyncHealth> {
        recordCall('qBClient.getMaindataSyncStatus', []);
        return Promise.resolve({
          state: 'healthy',
          consecutive_errors: 0,
          last_success_ts: Math.floor(Date.now() / 1000),
          last_error_ts: null,
          last_error_message: null,
        });
      },

      startMaindataSync(): Promise<void> {
        recordCall('qBClient.startMaindataSync', []);
        return Promise.resolve();
      },

      stopMaindataSync(serverId: string): Promise<void> {
        recordCall('qBClient.stopMaindataSync', [serverId]);
        return Promise.resolve();
      },

      addMaindataSyncListener(handler: (event: MaindataSyncChangedEvent) => void): () => void {
        recordCall('qBClient.addMaindataSyncListener', []);
        _maindataSyncListeners.add(handler);
        return () => {
          _maindataSyncListeners.delete(handler);
        };
      },

      setWorkspaceView(request: WorkspaceViewRequest): Promise<WorkspaceView> {
        recordCall('qBClient.setWorkspaceView', [request]);
        const view = computeWorkspaceView(request, _currentState);
        emitWorkspaceViewChanged(view);
        for (const listener of _workspaceViewListeners) {
          listener(view);
        }
        return Promise.resolve(view);
      },

      getWorkspaceView(): Promise<WorkspaceView | null> {
        recordCall('qBClient.getWorkspaceView', []);
        const view = computeWorkspaceView(
          { request_id: 'default', filters: { status: 'all', category: null, tag: null, tracker: null, search: '' }, sort: { field: 'name', direction: 'asc' }, include_sorted_hashes: true, locale: 'en-US' },
          _staticWorkspaceViewState,
        );
        return Promise.resolve(view);
      },

      addWorkspaceViewListener(handler: (event: WorkspaceView) => void): () => void {
        recordCall('qBClient.addWorkspaceViewListener', []);
        _workspaceViewListeners.add(handler);
        return () => {
          _workspaceViewListeners.delete(handler);
        };
      },

      getRssItems() {
        recordCall('qBClient.getRssItems', []);
        return Promise.resolve({ session_generation: GEN, server_id: null, items: [] as never[] });
      },

      getRssRules() {
        recordCall('qBClient.getRssRules', []);
        return Promise.resolve({ session_generation: GEN, server_id: null, rules: [] as never[] });
      },

      addRssFeed(path: string, url: string) {
        recordCall('qBClient.addRssFeed', [path, url]);
        return Promise.resolve(OK());
      },

      setRssFeedUrl(path: string, url: string) {
        recordCall('qBClient.setRssFeedUrl', [path, url]);
        return Promise.resolve(OK());
      },

      removeRssItem(path: string) {
        recordCall('qBClient.removeRssItem', [path]);
        return Promise.resolve(OK());
      },

      setRssRule(ruleName: string, rule: unknown) {
        recordCall('qBClient.setRssRule', [ruleName, rule]);
        return Promise.resolve(OK());
      },

      renameRssRule(ruleName: string, newRuleName: string) {
        recordCall('qBClient.renameRssRule', [ruleName, newRuleName]);
        return Promise.resolve(OK());
      },

      removeRssRule(ruleName: string) {
        recordCall('qBClient.removeRssRule', [ruleName]);
        return Promise.resolve(OK());
      },

      logout() {
        recordCall('qBClient.logout', []);
        return Promise.resolve(OK());
      },

      startSearch(query: string, plugins: string, category: string) {
        recordCall('qBClient.startSearch', [query, plugins, category]);
        return Promise.resolve({ id: 0 });
      },

      stopSearch(id: number) {
        recordCall('qBClient.stopSearch', [id]);
        return Promise.resolve(OK());
      },

      getSearchStatus(id?: number) {
        recordCall('qBClient.getSearchStatus', [id]);
        return Promise.resolve([]);
      },

      getSearchResults(id: number, limit?: number, offset?: number) {
        recordCall('qBClient.getSearchResults', [id, limit, offset]);
        return Promise.resolve({ results: [], total: 0 });
      },

      deleteSearch(id: number) {
        recordCall('qBClient.deleteSearch', [id]);
        return Promise.resolve(OK());
      },

      getSearchPlugins() {
        recordCall('qBClient.getSearchPlugins', []);
        return Promise.resolve([]);
      },

      installSearchPlugin(sources: string) {
        recordCall('qBClient.installSearchPlugin', [sources]);
        return Promise.resolve(OK());
      },

      uninstallSearchPlugin(names: string) {
        recordCall('qBClient.uninstallSearchPlugin', [names]);
        return Promise.resolve(OK());
      },

      enableSearchPlugin(names: string, enable: boolean) {
        recordCall('qBClient.enableSearchPlugin', [names, enable]);
        return Promise.resolve(OK());
      },

      updateSearchPlugins() {
        recordCall('qBClient.updateSearchPlugins', []);
        return Promise.resolve(OK());
      },
    },
  };
}

/**
 * Creates a mobile Tauri bridge mock with an optional injected transport.
 * Matches the export shape of packages/bridge/src/adapters/mobile-tauri.ts.
 */
export function createMobileTauriBridge(transport?: Transport): MobileBridge {
  return createMockMobileBridge(transport);
}

/**
 * Mobile Tauri bridge mock singleton — uses default (no-op) transport.
 */
export const BridgeAdapter = createMobileTauriBridge();

export default BridgeAdapter;
