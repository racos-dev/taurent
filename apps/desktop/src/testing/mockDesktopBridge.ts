// Mock desktop bridge for VITE_AUTOMATION=1 browser automation.
//
// Scenario selection:
//   ?scenario=empty|small-100|large-1000|stress-5000  (URL searchParam takes precedence)
//   localStorage['taurent:scenario']                  (fallback)
//   default: small-100
//
// Delta injection via window.__TAURENT_AUTOMATION__.injectDelta().

import type {
  AppUpdateInfo,
  AppUpdateProgress,
  DesktopBridge,
  ResolveResult,
} from '@taurent/bridge/contracts/interfaces';
import type {
  AddServerInput,
  AddTorrentOptions,
  OperationResponse,
  PathMapping,
  SavedServerSummary,
  SessionSnapshot,
  SessionStatus,
  SyncMainData,
  TestConnectionResult,
  UpdateServerInput,
  MaindataSnapshotResponse,
  MaindataSyncHealth,
  MaindataSyncChangedEvent,
  WorkspaceView,
  WorkspaceViewRequest,
} from '@taurent/bridge/types';
import { DESKTOP_CAPABILITIES } from '@taurent/bridge/contracts/capabilities';
import type { ResourceInvalidatedEvent, SessionChangedEvent } from '@taurent/bridge/events';
import { createMaindataState, createDeltaMaindata } from './fixtures/torrent';
import type { MaindataState, Torrent, TorrentFile, TorrentProperties, Tracker } from '@taurent/shared/types/qbittorrent';
import { isTorrentFilterType, matchesTorrentFilter, matchesTorrentSearch, torrentHasTag, matchesTorrentTracker, parseTorrentTags } from '@taurent/shared/utils/torrentFilter';
import { sortTorrents } from '@taurent/shared/utils/sortTorrents';
import { emitResourceInvalidated, emitSessionChanged, emitMaindataSyncChanged, emitWorkspaceViewChanged } from './mockTauriTransport';

type Scenario = 'empty' | 'small-100' | 'large-1000' | 'stress-5000';
const APP_SCENARIOS = [
  'connected',
  'no-saved-servers',
  'no-saved-servers-failure',
  'saved-server-disconnected',
  'saved-server-unavailable',
  'saved-server-credential-missing',
  'saved-server-credential-unavailable',
] as const;
type AppScenario = (typeof APP_SCENARIOS)[number];
type UpdateScenario = 'none' | 'available' | 'error';

interface RecordedCall {
  name: string;
  args: unknown[];
}

interface MutationFailureConfig {
  operation: string;
  error: string;
}

const DEFAULT_UPDATE: AppUpdateInfo = {
  currentVersion: '1.0.0',
  version: '1.1.0',
  date: '2026-07-01T00:00:00.000Z',
  body: 'Mock update release notes.',
};

function isUpdateScenario(value: string): value is UpdateScenario {
  return value === 'none' || value === 'available' || value === 'error';
}

function getUpdateScenario(): UpdateScenario {
  if (typeof window === 'undefined') return 'none';
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlScenario = urlParams.get('mockUpdate');
    if (urlScenario && isUpdateScenario(urlScenario)) {
      return urlScenario;
    }
    const stored = window.localStorage.getItem('taurent:mock-update');
    if (stored && isUpdateScenario(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'none';
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

const CREDENTIAL_UNAVAILABLE_SERVER: SavedServerSummary = {
  ...DEFAULT_SERVER,
  id: 'mock-server-credential-unavailable',
  name: 'Credential Unavailable Server',
  credential_status: 'unavailable',
  credential_warning: 'Stored password unavailable on this device. Enter it again to reconnect.',
};

function cloneServer(server: SavedServerSummary): SavedServerSummary {
  return { ...server };
}

function cloneServers(servers: SavedServerSummary[]): SavedServerSummary[] {
  return servers.map(cloneServer);
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
    // Mock renders a connected qBittorrent and reports 5.x — supports all
    // capabilities by default. Tests that need to gate a specific feature
    // can override the snapshot via `setAppState` or direct mutation.
    api_version: status === 'connected' ? '5.1.0' : null,
    capabilities: {
      supports_search: true,
      supports_rss: true,
      supports_webseed_management: true,
    },
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
    case 'no-saved-servers-failure':
      return {
        appScenario,
        servers: [] as SavedServerSummary[],
        activeServerId: null,
        snapshot: buildSnapshot('disconnected', null),
        connectBehavior: 'success' as const,
        connectError: 'Unable to connect',
        connectDelayMs: 0,
        savedServerTestResult: { success: false, error: 'Unable to reach server' } as TestConnectionResult,
        serverTestResult: { success: false, error: 'Unable to reach server' } as TestConnectionResult,
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
    case 'saved-server-credential-unavailable':
      return {
        appScenario,
        servers: [cloneServer(CREDENTIAL_UNAVAILABLE_SERVER)],
        activeServerId: CREDENTIAL_UNAVAILABLE_SERVER.id,
        snapshot: buildSnapshot('disconnected', CREDENTIAL_UNAVAILABLE_SERVER),
        connectBehavior: 'success' as const,
        connectError: 'Stored password unavailable on this device',
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
let _deltaCounter = 0;

// Track syncMaindata calls so tests can assert polling happened
let _syncCallCount = 0;

// When a delta is injected, we return it on the NEXT syncMaindata call
// (simulating the server responding to a poll with fresh data)
let _pendingDelta: SyncMainData | null = null;

// ─── Phase 5 automation controls ────────────────────────────────────────────

// Simulated response delay (ms) — set via setSyncDelayMs()
let _syncDelayMs = 0;

// Number of consecutive errors to throw before recovering — set via setSyncErrorCount()
let _syncErrorRemaining = 0;

// Number of malformed sync payloads to emit before recovering.
let _syncMalformedRemaining = 0;

// In-flight tracking for overlap guard assertions
let _syncInFlightCount = 0;
let _maxSyncInFlightCount = 0;
let _syncGeneration = 0;

// Track RIDs returned per call for RID-sequence assertions
const _syncRids: (number | undefined)[] = [];

// Visibility override for document.visibilityState
let _visibilityOverride: 'visible' | 'hidden' | null = null;
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
let _recordedCalls: RecordedCall[] = [];
let _nextMutationFailure: MutationFailureConfig | null = null;
let _availableUpdate: AppUpdateInfo | null = getUpdateScenario() === 'available' ? { ...DEFAULT_UPDATE } : null;
let _updateError: string | null = getUpdateScenario() === 'error' ? 'Mock update check failed.' : null;

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

// Build a full-update SyncMainData from the current state
function buildFullUpdate(state: MaindataState): SyncMainData {
  // Deep-copy the torrents to avoid mutation aliasing
  const torrents: Record<string, typeof state.torrents[string]> = {};
  for (const [h, t] of Object.entries(state.torrents)) {
    torrents[h] = { ...t };
  }
  return {
    rid: state.rid,
    full_update: true,
    torrents,
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
      use_alt_speed_limits: false,
      refresh_interval: 1500,
    },
  };
}

// ─── Automation control ────────────────────────────────────────────────────────

interface AutomationControl {
  getState: () => MaindataState;
  getAppScenario: () => AppScenario;
  setAppScenario: (appScenario: AppScenario) => void;
  injectDelta: () => SyncMainData;
  injectCustomDelta: (delta: SyncMainData) => void;
  deltaCount: () => number;
  syncCallCount: () => number;
  getRecordedCalls: () => RecordedCall[];
  clearRecordedCalls: () => void;
  setUpdateAvailable: (update?: Partial<AppUpdateInfo> | null) => void;
  setUpdateError: (message: string | null) => void;
  setNextMutationFailure: (operation: string, error: string) => void;
  getPendingMutationFailure: () => { operation: string; error: string } | null;
  clearMutationFaults: () => void;
  emitSessionChanged: (event: SessionChangedEvent) => void;
  emitResourceInvalidated: (event: ResourceInvalidatedEvent) => void;
  emitMaindataSyncChanged: (event: MaindataSyncChangedEvent) => void;
  emitWorkspaceViewChanged: (event: WorkspaceView) => void;
  // Phase 5 controls
  setSyncDelayMs: (ms: number) => void;
  setSyncErrorCount: (count: number) => void;
  setMalformedSyncCount: (count: number) => void;
  clearSyncFaults: () => void;
  syncInFlightCount: () => number;
  maxSyncInFlightCount: () => number;
  syncRids: () => (number | undefined)[];
  // Visibility override — controls document.visibilityState for useMaindataSync polling
  setVisibilityState: (state: 'visible' | 'hidden') => void;
  getVisibilityState: () => 'visible' | 'hidden';
  // /Phase 5
  reset: () => void;
  scenario: Scenario;
}

const _ctrl: AutomationControl = {
  getState: () => _currentState,
  getAppScenario: () => _appScenario,
  setAppScenario: (appScenario: AppScenario) => {
    setAppState(appScenario);
  },
  injectDelta: () => {
    _deltaCounter++;
    const hashes = Object.keys(_currentState.torrents);
    const firstHash = hashes[0] ?? 'abcd0000000000000000000000000001';
    const lastHash = hashes.at(-1) ?? 'abcd0000000000000000000000000100';
    const delta = createDeltaMaindata(
      _currentState,
      firstHash,
      `Torrent ${_deltaCounter} [updated]`,
      lastHash,
      `abcd${String(_deltaCounter + 1000).padStart(32 - 4, '0')}`,
      {
        added_on: 2000 + _deltaCounter * 100,
        amount_left: 50,
        auto_tmm: false,
        availability: 0.5,
        category: '',
        completed: 10,
        completion_on: 0,
        content_path: `/data/torrents/${_deltaCounter}/content`,
        dl_limit: 0,
        dlspeed: 100,
        download_path: `/downloads/${_deltaCounter}`,
        downloaded: 200,
        downloaded_session: 100,
        eta: -1,
        f_l_piece_prio: false,
        force_start: false,
        hash: `abcd${String(_deltaCounter + 1000).padStart(32 - 4, '0')}`,
        infohash_v1: `infohash1-${String(_deltaCounter).padStart(32, '0')}`,
        infohash_v2: `infohash2-${String(_deltaCounter).padStart(64, '0')}`,
        last_activity: 100,
        magnet_uri: `magnet:?xt=urn:btih:${String(_deltaCounter).padStart(32, '0')}`,
        max_ratio: 3.0,
        max_seeding_time: 3600,
        name: `Injected Torrent ${_deltaCounter}`,
        num_complete: 0,
        num_incomplete: 0,
        num_leechs: 0,
        num_seeds: 1,
        priority: 0,
        progress: 0.05,
        ratio: 0.01,
        ratio_limit: 3.0,
        save_path: `/save/path/${_deltaCounter}`,
        seeding_time: 0,
        seeding_time_limit: 7200,
        seen_complete: 0,
        seq_dl: false,
        size: 1024 * 1024,
        state: 'downloading',
        super_seeding: false,
        tags: '',
        time_active: 10,
        total_size: 1024 * 1024,
        tracker: 'https://tracker.example.com/announce',
        trackers_count: 1,
        up_limit: 0,
        uploaded: 20,
        uploaded_session: 10,
        upspeed: 50,
        reannounce: 30,
        isPrivate: false,
        popularity: 1.0,
      },
    );

    // Apply delta to internal state
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

    // Queue the delta to be returned on the next syncMaindata poll
    _pendingDelta = delta;
    return delta;
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
    _pendingDelta = delta;
  },
  deltaCount: () => _deltaCounter,
  syncCallCount: () => _syncCallCount,
  getRecordedCalls: () => _recordedCalls.map((call) => ({ ...call, args: [...call.args] })),
  clearRecordedCalls: () => {
    _recordedCalls = [];
  },
  setUpdateAvailable: (update: Partial<AppUpdateInfo> | null = DEFAULT_UPDATE) => {
    _availableUpdate = update ? { ...DEFAULT_UPDATE, ...update } : null;
    _updateError = null;
  },
  setUpdateError: (message: string | null) => {
    _updateError = message;
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
  // Phase 5 controls
  setSyncDelayMs: (ms: number) => { _syncDelayMs = ms; },
  setSyncErrorCount: (count: number) => {
    _syncErrorRemaining = count;
  },
  setMalformedSyncCount: (count: number) => {
    _syncMalformedRemaining = count;
  },
  clearSyncFaults: () => {
    _syncDelayMs = 0;
    _syncErrorRemaining = 0;
    _syncMalformedRemaining = 0;
  },
  syncInFlightCount: () => _syncInFlightCount,
  maxSyncInFlightCount: () => _maxSyncInFlightCount,
  syncRids: () => [..._syncRids],
  // Visibility override
  setVisibilityState: (state: 'visible' | 'hidden') => {
    _visibilityOverride = state;
    if (typeof document !== 'undefined') {
      Object.defineProperty(document, 'visibilityState', {
        value: state,
        writable: true,
        configurable: true,
      });
    }
  },
  getVisibilityState: () => {
    if (_visibilityOverride) return _visibilityOverride;
    if (typeof document !== 'undefined') {
      return document.visibilityState as 'visible' | 'hidden';
    }
    return 'visible';
  },
  // /Phase 5
  reset: () => {
    _syncGeneration++;
    _currentState = createMaindataState(torrentCount(getScenario()));
    setAppState(getAppScenario());
    _deltaCounter = 0;
    _syncCallCount = 0;
    _pendingDelta = null;
    _recordedCalls = [];
    _nextMutationFailure = null;
    _availableUpdate = null;
    _updateError = null;
    _syncDelayMs = 0;
    _syncErrorRemaining = 0;
    _syncMalformedRemaining = 0;
    _syncInFlightCount = 0;
    _maxSyncInFlightCount = 0;
    _syncRids.length = 0;
    // Clear any registered maindata sync listeners so a stale scenario
    // cannot leak listeners into the next run.
    _maindataSyncListeners.clear();
    // Clear workspace view listeners so a stale scenario cannot leak
    // listeners into the next run.
    _workspaceViewListeners.clear();
    // Restore visibility state to 'visible' on reset
    _visibilityOverride = null;
    if (typeof document !== 'undefined') {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
    }
  },
  scenario: getScenario(),
};

// Expose on window for Playwright
if (typeof window !== 'undefined') {
  (window as unknown as { __TAURENT_AUTOMATION__?: AutomationControl }).__TAURENT_AUTOMATION__ = _ctrl;
}

// ─── Safe async no-op ──────────────────────────────────────────────────────────

const OK = (): OperationResponse => ({ session_generation: 0, server_id: null, success: true });

// ─── Concrete torrent detail fixtures (T140.3) ─────────────────────────────────
// Rust (qb-core::dto) now owns the validation boundary for these endpoints, so
// the bridge returns plain typed payloads. The desktop automation mock mirrors
// the post-unwrap contract: typed TorrentProperties, Tracker[], and TorrentFile[]
// fixtures that automation scripts can rely on.

const MOCK_TORRENT_PROPERTIES: TorrentProperties = {
  save_path: '/downloads/mock',
  creation_date: 1_700_000_000,
  piece_size: 16384,
  comment: 'taurent mock fixture',
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
  created_by: 'taurent mock',
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
    url: 'udp://tracker.mock.example:1337/announce',
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
    name: 'mock-file.mkv',
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
  const sorted_hashes = request.include_sorted_hashes
    ? sortTorrents(
        filtered as Torrent[],
        sort.field as any,
        sort.direction,
      ).map(t => (t as Torrent & { hash: string }).hash)
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
    const tags = parseTorrentTags((t as any).tags);
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
    const tracker = (t as any).tracker;
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

function createMockBridge(): DesktopBridge {
  const GEN = 1;

  return {
    capabilities: DESKTOP_CAPABILITIES,

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
    sessionSwitchServer() { return Promise.resolve(GEN); },
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
    sessionSetError() { return Promise.resolve(GEN); },
    sessionClearError() { return Promise.resolve(GEN); },
    sessionSetConnecting() { return Promise.resolve(GEN); },
    getSessionGeneration() { return Promise.resolve(GEN); },
    getSessionStatus() { return Promise.resolve(_sessionSnapshot.status); },
    sessionHealthCheck() {
      recordCall('sessionHealthCheck', []);
      if (getSavedCredentialError(getActiveServer())) {
        return Promise.resolve(false);
      }
      return Promise.resolve(_healthCheckResult);
    },

    // ── Torrents ──────────────────────────────────────────────────────────────

    torrents: {
      getList() {
        const state = _ctrl.getState();
        // T143.1: Rust owns the list-row validation boundary and returns a
        // typed `Torrent[]`. The desktop mock mirrors that contract by
        // returning the accumulated maindata torrents as an array of typed
        // `Torrent` rows rather than a hash-keyed map. Maindata sync/snapshot
        // responses elsewhere still return torrent maps — only the explicit
        // list command shape changed here.
        return Promise.resolve({
          session_generation: GEN,
          server_id: 'mock-server-id',
          torrents: Object.values(state.torrents),
        });
      },
      pause(hashes: string[]) {
        recordCall('torrents.pause', [hashes]);
        return Promise.resolve(OK());
      },
      resume(hashes: string[]) {
        recordCall('torrents.resume', [hashes]);
        return Promise.resolve(OK());
      },
      delete(hashes: string[], deleteFiles: boolean) {
        recordCall('torrents.delete', [hashes, deleteFiles]);
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
      setCategory(hashes: string[], category: string) {
        recordCall('torrents.setCategory', [hashes, category]);
        return Promise.resolve(OK());
      },
      setName(hash: string, name: string) {
        recordCall('torrents.setName', [hash, name]);
        const error = maybeFail('torrents.setName');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      setLocation(hashes: string[], location: string) {
        recordCall('torrents.setLocation', [hashes, location]);
        const error = maybeFail('torrents.setLocation');
        if (error) {
          return Promise.reject(error);
        }
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
      addTags(hashes: string[], tags: string[]) {
        recordCall('torrents.addTags', [hashes, tags]);
        return Promise.resolve(OK());
      },
      removeTags(hashes: string[], tags: string[]) {
        recordCall('torrents.removeTags', [hashes, tags]);
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
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      addTrackers() { return Promise.resolve(OK()); },
      editTracker() { return Promise.resolve(OK()); },
      removeTrackers() { return Promise.resolve(OK()); },
      getWebSeeds() { return Promise.resolve({ webseeds: [], session_generation: GEN, server_id: null }); },
      addWebSeeds(hash: string, urls: string) {
        recordCall('torrents.addWebSeeds', [hash, urls]);
        const error = maybeFail('torrents.addWebSeeds');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      editWebSeed(hash: string, origUrl: string, newUrl: string) {
        recordCall('torrents.editWebSeed', [hash, origUrl, newUrl]);
        const error = maybeFail('torrents.editWebSeed');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      removeWebSeeds(hash: string, urls: string) {
        recordCall('torrents.removeWebSeeds', [hash, urls]);
        const error = maybeFail('torrents.removeWebSeeds');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      setDownloadLimit(hashes: string[], limit: number) {
        recordCall('torrents.setDownloadLimit', [hashes, limit]);
        const error = maybeFail('torrents.setDownloadLimit');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      setUploadLimit(hashes: string[], limit: number) {
        recordCall('torrents.setUploadLimit', [hashes, limit]);
        const error = maybeFail('torrents.setUploadLimit');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      setFilePriority() { return Promise.resolve(OK()); },
      renameFile() { return Promise.resolve(OK()); },
      renameFolder() { return Promise.resolve(OK()); },
      getDownloadLimit() { return Promise.resolve({ limit: 0, session_generation: GEN, server_id: null } as never); },
      getUploadLimit() { return Promise.resolve({ limit: 0, session_generation: GEN, server_id: null } as never); },
      syncTorrentPeers() { return Promise.resolve({ rid: 0, full_update: true } as never); },
      setAutoManagement() { return Promise.resolve(OK()); },
      setShareLimits(hashes: string[], ratioLimit: number, seedingLimit: number) {
        recordCall('torrents.setShareLimits', [hashes, ratioLimit, seedingLimit]);
        const error = maybeFail('torrents.setShareLimits');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      setSequentialDownload() { return Promise.resolve(OK()); },
      setFirstLastPiecePriority() { return Promise.resolve(OK()); },
      setSuperSeeding() { return Promise.resolve(OK()); },
      exportTorrent() { return Promise.resolve(OK()); },
      addPeers() { return Promise.resolve(OK()); },
    },

    // ── Transfer ──────────────────────────────────────────────────────────────

    transfer: {
      getInfo() {
        return Promise.resolve({
          session_generation: GEN, server_id: 'mock-server-id',
          info: { dl_info_speed: 0, dl_info_data: 0, up_info_speed: 0, up_info_data: 0, dl_rate_limit: 0, up_rate_limit: 0, dht_nodes: 0, connection_status: 'connected', queueing: false, use_alt_speed_limits: false, refresh_interval: 1500 },
        });
      },
      getSpeedLimitsMode() { return Promise.resolve({ mode: false, session_generation: GEN, server_id: null } as never); },
      toggleSpeedLimitsMode() { return Promise.resolve(OK()); },
      getDownloadLimit() { return Promise.resolve({ limit: 0, session_generation: GEN, server_id: null } as never); },
      setDownloadLimit(limit: number) {
        recordCall('transfer.setDownloadLimit', [limit]);
        const error = maybeFail('transfer.setDownloadLimit');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      getUploadLimit() { return Promise.resolve({ limit: 0, session_generation: GEN, server_id: null } as never); },
      setUploadLimit(limit: number) {
        recordCall('transfer.setUploadLimit', [limit]);
        const error = maybeFail('transfer.setUploadLimit');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      banPeers() { return Promise.resolve(OK()); },
      getCookies() { return Promise.resolve({}); },
      setCookies() { return Promise.resolve(OK()); },
    },

    // ── Categories ───────────────────────────────────────────────────────────

    categories: {
      getCategories() {
        return Promise.resolve({
          session_generation: GEN, server_id: 'mock-server-id',
          categories: { videos: { name: 'videos', savePath: '/data/videos' }, audio: { name: 'audio', savePath: '/data/audio' } },
        });
      },
      createCategory(name: string, savePath: string) {
        recordCall('categories.createCategory', [name, savePath]);
        return Promise.resolve(OK());
      },
      editCategory(name: string, savePath: string) {
        recordCall('categories.editCategory', [name, savePath]);
        const error = maybeFail('categories.editCategory');
        if (error) {
          return Promise.reject(error);
        }
        return Promise.resolve(OK());
      },
      removeCategories(names: string[]) {
        recordCall('categories.removeCategories', [names]);
        return Promise.resolve(OK());
      },
    },

    // ── Tags ───────────────────────────────────────────────────────────────────

    tags: {
      getTags() {
        return Promise.resolve({
          session_generation: GEN, server_id: 'mock-server-id',
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
      addTorrentTags() { return Promise.resolve(OK()); },
      removeTorrentTags() { return Promise.resolve(OK()); },
    },

    // ── Application ──────────────────────────────────────────────────────────

    application: {
      getPreferences() {
        recordCall('application.getPreferences', []);
        return Promise.resolve({ session_generation: GEN, server_id: null, preferences: {} });
      },
      setPreferences(preferences: Record<string, unknown>) {
        recordCall('application.setPreferences', [preferences]);
        return Promise.resolve(OK());
      },
      getDefaultSavePath() {
        recordCall('application.getDefaultSavePath', []);
        return Promise.resolve({ path: '/downloads', session_generation: GEN, server_id: null });
      },
      shutdown() {
        recordCall('application.shutdown', []);
        return Promise.resolve(OK());
      },
    },

    // ── QB Client ─────────────────────────────────────────────────────────────

    qBClient: {
      syncMaindata(_rid?: number) {
        const syncGeneration = _syncGeneration;
        _syncCallCount++;
        _syncInFlightCount++;
        if (_syncInFlightCount > _maxSyncInFlightCount) {
          _maxSyncInFlightCount = _syncInFlightCount;
        }

        // Simulate error if errors are configured
        if (_syncErrorRemaining > 0) {
          _syncErrorRemaining--;
          if (syncGeneration === _syncGeneration) _syncInFlightCount--;
          return Promise.reject(new Error('MockSyncError'));
        }

        // Simulate slow response
        const delayMs = _syncDelayMs;
        const requestedRid = _rid;

        return new Promise<SyncMainData>((resolve) => {
          setTimeout(() => {
            if (syncGeneration !== _syncGeneration) {
              resolve(buildFullUpdate(_currentState));
              return;
            }

            _syncInFlightCount--;
            _syncRids.push(requestedRid);

            if (_syncMalformedRemaining > 0) {
              _syncMalformedRemaining--;
              resolve(null as unknown as SyncMainData);
              return;
            }

            // If a delta was injected, return it on the next poll call
            // so the app's React Query polling picks it up and re-renders
            if (_pendingDelta) {
              const d = _pendingDelta;
              _pendingDelta = null;
              resolve(d);
            } else {
              // Otherwise return a full update reflecting current state
              resolve(buildFullUpdate(_currentState));
            }
          }, delayMs);
        });
      },
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
              use_alt_speed_limits: false,
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
          _currentState,
        );
        return Promise.resolve(view);
      },
      addWorkspaceViewListener(handler: (event: WorkspaceView) => void): () => void {
        recordCall('qBClient.addWorkspaceViewListener', []);
        // Synchronous listener registration. We do not need the
        // async-unlisten pattern from sharedBridge here — the listener
        // is already wired into our own Set, so a synchronous unsubscribe
        // is straightforward and matches the contract documented on
        // QBClientBridge.addWorkspaceViewListener.
        _workspaceViewListeners.add(handler);
        return () => {
          _workspaceViewListeners.delete(handler);
        };
      },
      getRssItems() { return Promise.resolve({ items: [] as never[], session_generation: GEN, server_id: null }); },
      getRssRules() { return Promise.resolve({ rules: [] as never[], session_generation: GEN, server_id: null }); },
      addRssFeed() { return Promise.resolve(OK()); },
      setRssFeedUrl() { return Promise.resolve(OK()); },
      removeRssItem() { return Promise.resolve(OK()); },
      setRssRule() { return Promise.resolve(OK()); },
      renameRssRule() { return Promise.resolve(OK()); },
      removeRssRule() { return Promise.resolve(OK()); },
      logout() { return Promise.resolve(OK()); },
      startSearch() { return Promise.resolve({ id: 0 }); },
      stopSearch() { return Promise.resolve(OK()); },
      getSearchStatus() { return Promise.resolve({}); },
      getSearchResults() { return Promise.resolve({}); },
      deleteSearch() { return Promise.resolve(OK()); },
      getSearchPlugins() { return Promise.resolve({}); },
      installSearchPlugin() { return Promise.resolve(OK()); },
      uninstallSearchPlugin() { return Promise.resolve(OK()); },
      enableSearchPlugin() { return Promise.resolve(OK()); },
      updateSearchPlugins() { return Promise.resolve(OK()); },
    },

    // ── Servers ────────────────────────────────────────────────────────────────

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
          // Atomic failure: reject without mutating session state or emitting an event.
          // The current connected session remains intact.
          return Promise.reject(new Error(_connectError));
        }
        _activeServerId = serverId;
        emitSession('connected', server, null);
        return Promise.resolve(GEN);
      },
      testServerConnection(serverUrl: string, credentials: { username: string; password: string }) {
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
        const normalized = url.replace(/\/+$/, '').replace(/\/api\/v2\/?$/, '');
        if (!_serverTestResult.success) {
          return Promise.resolve({
            success: false,
            normalizedUrl: null,
            error: _serverTestResult.error ?? 'Connection failed',
          });
        }
        return Promise.resolve({
          success: true,
          normalizedUrl: /^[a-z]+:\/\//.test(normalized) ? normalized : `http://${normalized}`,
          error: null,
        });
      },
    },

    // ── App ────────────────────────────────────────────────────────────────────

    async getPathMappings(_serverId: string): Promise<PathMapping[]> {
      return [];
    },
    async setPathMappings(_serverId: string, _mappings: PathMapping[]): Promise<void> {
      return;
    },
    async resolveLocalPath(_serverId: string, serverPath: string): Promise<ResolveResult> {
      return { kind: 'unmapped', serverPath };
    },
    async openLocalPath(_path: string): Promise<void> {
      return;
    },
    async revealLocalItem(_path: string): Promise<void> {
      return;
    },
    async checkForUpdate(): Promise<AppUpdateInfo | null> {
      recordCall('checkForUpdate', []);
      if (_updateError) {
        throw new Error(_updateError);
      }
      return _availableUpdate ? { ..._availableUpdate } : null;
    },
    async downloadAndInstallUpdate(onProgress?: (event: AppUpdateProgress) => void): Promise<void> {
      recordCall('downloadAndInstallUpdate', []);
      if (_updateError) {
        throw new Error(_updateError);
      }
      if (!_availableUpdate) {
        throw new Error('No update is available.');
      }

      onProgress?.({ event: 'Started', contentLength: 100 });
      onProgress?.({ event: 'Progress', chunkLength: 40, downloaded: 40, contentLength: 100 });
      onProgress?.({ event: 'Progress', chunkLength: 60, downloaded: 100, contentLength: 100 });
      onProgress?.({ event: 'Finished', downloaded: 100, contentLength: 100 });
    },
    async relaunchApp(): Promise<void> {
      recordCall('relaunchApp', []);
    },

    syncMenuState(state: import('@taurent/bridge/contracts/interfaces').NativeMenuState) {
      recordCall('syncMenuState', [state]);
      return Promise.resolve();
    },
    getPendingNativeUiActions() { return Promise.resolve([]); },
    exitApp() { return Promise.resolve(); },
    getPendingViewActions() { return Promise.resolve([]); },
    setViewListenersReady() { return Promise.resolve(); },
    resetViewListenersReady() { return Promise.resolve(); },
    getDownloadCompletionNotificationsEnabled() { return Promise.resolve(true); },
    setDownloadCompletionNotificationsEnabled(_enabled: boolean) { return Promise.resolve(); },
  } as unknown as DesktopBridge;
}

const BridgeAdapter = createMockBridge();

export { BridgeAdapter, createMockBridge as createDesktopBridge };
export default BridgeAdapter;
