// Deterministic local qBittorrent HTTP server for Tauri E2E smoke tests.
// Run as: pnpm --filter taurent fake-qb [scenario] [--port=18080] [--port 18080]
// Scenarios: empty | small-100 (default) | large-1000 | stress-5000

import http from 'http';
import { pathToFileURL } from 'url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryRecord {
  name: string;
  savePath: string;
}

export interface ServerOptions {
  scenario: 'empty' | 'small-100' | 'large-1000' | 'stress-5000';
  port: number;
  quiet?: boolean;
}

interface ServerState {
  scenario: ServerOptions['scenario'];
  torrents: Record<string, Record<string, unknown>>;
  ridCounter: number;
  session: { sid: string; username: string } | null;
  categories: Record<string, CategoryRecord>;
  tags: string[];
  nextSyntheticTorrentId: number;
  syncErrorsRemaining: number;
  syncMalformedRemaining: number;
  protectedEndpoint403Remaining: number;
}

const DEFAULT_CATEGORIES: Record<string, CategoryRecord> = {
  videos: { name: 'videos', savePath: '/data/videos' },
  audio: { name: 'audio', savePath: '/data/audio' },
};

const DEFAULT_TAGS = ['tag-a', 'tag-b', 'tag-c'];

// ---------------------------------------------------------------------------
// Deterministic torrent builders (self-contained — no shared package imports)
// ---------------------------------------------------------------------------

function makeTorrent(index: number): Record<string, unknown> {
  const n = index + 1;
  return {
    added_on: 1000 + n * 100,
    amount_left: (n * 111) % 1000,
    auto_tmm: n % 2 === 0,
    availability: (n % 10) / 10,
    category: n % 3 === 0 ? 'videos' : n % 3 === 1 ? 'audio' : '',
    completed: n * 13,
    completion_on: n * 17,
    content_path: `/data/torrents/${n}/content`,
    dl_limit: n * 10,
    dlspeed: n * 50,
    download_path: `/downloads/${n}`,
    downloaded: n * 1000,
    downloaded_session: n * 500,
    eta: n % 5 === 0 ? -1 : n * 60,
    f_l_piece_prio: false,
    force_start: n % 7 === 0,
    hash: `abcd${String(n).padStart(28, '0')}`,
    infohash_v1: `infohash1-${String(n).padStart(32, '0')}`,
    infohash_v2: `infohash2-${String(n).padStart(64, '0')}`,
    last_activity: 500 + n * 20,
    magnet_uri: `magnet:?xt=urn:btih:${String(n).padStart(32, '0')}`,
    max_ratio: 5.5,
    max_seeding_time: 3600,
    name: `Torrent ${n}`,
    num_complete: n * 2,
    num_incomplete: n * 3,
    num_leechs: n,
    num_seeds: n * 2,
    priority: n % 5,
    progress: (n % 100) / 100,
    ratio: n / 10,
    ratio_limit: 3.0,
    save_path: `/save/path/${n}`,
    seeding_time: n * 120,
    seeding_time_limit: 7200,
    seen_complete: 200 + n * 50,
    seq_dl: false,
    size: n * 1024 * 1024,
    state: ['uploading', 'downloading', 'pausedUP', 'pausedDL', 'stalledUP'][n % 5],
    super_seeding: false,
    tags: n % 2 === 0 ? 'tag-a,tag-b' : 'tag-c',
    time_active: n * 300,
    total_size: n * 1024 * 1024 * 10,
    tracker: `https://tracker${n % 3}.example.com/announce`,
    trackers_count: (n % 3) + 1,
    up_limit: n * 20,
    uploaded: n * 2000,
    uploaded_session: n * 1000,
    upspeed: n * 30,
    reannounce: 30,
    isPrivate: n % 4 === 0,
    popularity: (n % 20) / 10,
  };
}

function buildScenarioTorrents(scenario: ServerOptions['scenario']): Record<string, Record<string, unknown>> {
  let count = 0;
  switch (scenario) {
    case 'empty': count = 0; break;
    case 'small-100': count = 100; break;
    case 'large-1000': count = 1000; break;
    case 'stress-5000': count = 5000; break;
  }
  const map: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < count; i++) {
    const t = makeTorrent(i);
    const hash = t.hash as string;
    delete t.hash;
    map[hash] = t;
  }
  return map;
}

function buildServerStatePayload(): Record<string, unknown> {
  return {
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
    free_space_on_disk: 1024 * 1024 * 1024 * 500,
    alltime_dl: 1024 * 1024 * 1024 * 200,
    alltime_ul: 1024 * 1024 * 1024 * 100,
  };
}

function buildFullDelta(state: ServerState): Record<string, unknown> {
  return {
    rid: state.ridCounter,
    full_update: true,
    torrents: state.torrents,
    categories: state.categories,
    tags: state.tags,
    server_state: buildServerStatePayload(),
  };
}

function buildTorrentArray(torrents: Record<string, Record<string, unknown>>): Record<string, unknown>[] {
  return Object.entries(torrents).map(([hash, t]) => ({ ...t, hash }));
}

function serializeTags(tags: string[]): string {
  return tags.join(',');
}

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getNextSyntheticHash(state: ServerState): string {
  const hash = `ffff${String(state.nextSyntheticTorrentId).padStart(28, '0')}`;
  state.nextSyntheticTorrentId += 1;
  return hash;
}

function ensureUniqueHash(state: ServerState, preferred?: string | null): string {
  const normalized = preferred?.trim().toLowerCase() ?? '';
  if (normalized && !state.torrents[normalized]) return normalized;
  return getNextSyntheticHash(state);
}

function extractMagnetHash(value: string): string | null {
  const match = value.match(/xt=urn:btih:([a-zA-Z0-9]{32,40})/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function extractDisplayName(value: string, fallback: string): string {
  const dnMatch = value.match(/[?&]dn=([^&]+)/i);
  if (dnMatch?.[1]) {
    try {
      return decodeURIComponent(dnMatch[1]);
    } catch {
      return dnMatch[1];
    }
  }
  return fallback;
}

function syncDerivedMetadata(state: ServerState): void {
  const tagSet = new Set<string>(DEFAULT_TAGS);
  for (const torrent of Object.values(state.torrents)) {
    for (const tag of parseTags(torrent.tags)) tagSet.add(tag);
  }
  state.tags = [...tagSet].sort();

  const nextCategories: Record<string, CategoryRecord> = { ...DEFAULT_CATEGORIES };
  for (const torrent of Object.values(state.torrents)) {
    const category = typeof torrent.category === 'string' ? torrent.category.trim() : '';
    if (!category) continue;
    nextCategories[category] ??= { name: category, savePath: `/data/${category}` };
  }
  state.categories = nextCategories;
}

function initializeState(scenario: ServerOptions['scenario']): ServerState {
  const torrents = buildScenarioTorrents(scenario);
  const highestExisting = Object.keys(torrents).length + 1;
  const state: ServerState = {
    scenario,
    torrents,
    ridCounter: 0,
    session: null,
    categories: { ...DEFAULT_CATEGORIES },
    tags: [...DEFAULT_TAGS],
    nextSyntheticTorrentId: highestExisting,
    syncErrorsRemaining: 0,
    syncMalformedRemaining: 0,
    protectedEndpoint403Remaining: 0,
  };
  syncDerivedMetadata(state);
  return state;
}

function getTorrentOrThrow(state: ServerState, hash: string): Record<string, unknown> {
  const torrent = state.torrents[hash];
  if (!torrent) {
    throw new HttpError(404, `Unknown torrent hash: ${hash}`);
  }
  return torrent;
}

function computePausedState(torrent: Record<string, unknown>): string {
  const current = String(torrent.state ?? 'downloading');
  return current.includes('UP') || current === 'uploading' || current === 'stalledUP'
    ? 'pausedUP'
    : 'pausedDL';
}

function computeRunningState(torrent: Record<string, unknown>): string {
  const progress = Number(torrent.progress ?? 0);
  const current = String(torrent.state ?? 'downloading');
  if (progress >= 1 || current.includes('UP')) return 'uploading';
  return 'downloading';
}

function splitHashes(value: string | null, label = 'hashes'): string[] {
  const hashes = (value ?? '')
    .split('|')
    .map((hash) => hash.trim().toLowerCase())
    .filter(Boolean);
  if (hashes.length === 0) {
    throw new HttpError(400, `Missing ${label} parameter`);
  }
  return hashes;
}

function parseBoolean(value: string | null, label: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new HttpError(400, `Invalid ${label} value`);
}

function parseOptionalInteger(value: string | null): number | null {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMultipartField(body: string, fieldName: string): string | null {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`name="${escaped}"\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n--`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function extractMultipartFileNames(body: string): string[] {
  return [...body.matchAll(/filename="([^"]+)"/g)].map((match) => match[1]).filter(Boolean);
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function sendText(res: http.ServerResponse, status: number, payload: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(payload);
}

function getSidFromCookie(req: http.IncomingMessage): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)SID=([^;]+)/);
  return match?.[1] ?? null;
}

function getExpectedAuthOrigin(req: http.IncomingMessage): string | null {
  const host = req.headers.host;
  if (!host) return null;
  return `http://${host}`;
}

function ensureAuthenticated(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: ServerState,
  log: (msg: string) => void,
): boolean {
  const cookieSid = getSidFromCookie(req);
  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : null;
  const refererHeader = typeof req.headers.referer === 'string' ? req.headers.referer : null;
  const expectedOrigin = getExpectedAuthOrigin(req);
  const expectedReferer = expectedOrigin ? `${expectedOrigin}/` : null;
  log(`[auth-check] cookie_sid=${cookieSid ?? 'null'} state_sid=${state.session?.sid ?? 'null'}`);
  if (!state.session) {
    sendText(res, 403, 'Not logged in.');
    return false;
  }
  if (cookieSid !== state.session.sid) {
    log(`[auth-check] SID mismatch: got ${cookieSid}, expected ${state.session.sid}`);
    sendText(res, 403, 'Invalid SID.');
    return false;
  }
  if (!expectedOrigin) {
    sendText(res, 403, 'Missing Host header.');
    return false;
  }
  if (originHeader !== expectedOrigin) {
    log(`[auth-check] Origin mismatch: got ${originHeader ?? 'null'}, expected ${expectedOrigin}`);
    sendText(res, 403, 'Invalid Origin header.');
    return false;
  }
  if (refererHeader !== expectedReferer) {
    log(`[auth-check] Referer mismatch: got ${refererHeader ?? 'null'}, expected ${expectedReferer}`);
    sendText(res, 403, 'Invalid Referer header.');
    return false;
  }
  if (state.protectedEndpoint403Remaining > 0) {
    state.protectedEndpoint403Remaining -= 1;
    log(`[auth-check] forcing protected-endpoint 403, remaining=${state.protectedEndpoint403Remaining}`);
    sendText(res, 403, 'Forced protected-endpoint regression.');
    return false;
  }
  return true;
}

async function applyTestControls(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: ServerState,
  pathname: string,
  query: Record<string, string | string[]>,
): Promise<boolean> {
  const delayRaw = query.__delayMs;
  const delayMs = Number(Array.isArray(delayRaw) ? delayRaw[0] : delayRaw);
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await sleep(delayMs);
  }

  const syncErrorRaw = query.__syncErrorCount;
  if (pathname === '/api/v2/sync/maindata' && syncErrorRaw !== undefined) {
    const nextCount = Number(Array.isArray(syncErrorRaw) ? syncErrorRaw[0] : syncErrorRaw);
    state.syncErrorsRemaining = Number.isFinite(nextCount) && nextCount > 0 ? nextCount : 0;
  }

  const malformedSyncRaw = query.__malformedSyncCount;
  if (pathname === '/api/v2/sync/maindata' && malformedSyncRaw !== undefined) {
    const nextCount = Number(Array.isArray(malformedSyncRaw) ? malformedSyncRaw[0] : malformedSyncRaw);
    state.syncMalformedRemaining = Number.isFinite(nextCount) && nextCount > 0 ? nextCount : 0;
  }

  if (pathname === '/api/v2/sync/maindata' && state.syncErrorsRemaining > 0) {
    state.syncErrorsRemaining -= 1;
    sendText(res, 500, 'Repeated sync error');
    return true;
  }

  if (pathname === '/api/v2/sync/maindata' && state.syncMalformedRemaining > 0) {
    state.syncMalformedRemaining -= 1;
    sendJson(res, 200, {
      full_update: true,
      torrents: { ...state.torrents },
      categories: { ...state.categories },
      tags: [...state.tags],
      server_state: {
        connection_status: 'connected',
        refresh_interval: 1500,
      },
    });
    return true;
  }

  const failRaw = query.__fail;
  const failMode = Array.isArray(failRaw) ? failRaw[0] : failRaw;
  if (failMode === 'transient-network') {
    req.socket.destroy();
    return true;
  }

  return false;
}

function createAddedTorrent(
  state: ServerState,
  source: string,
  options: {
    category: string;
    savepath: string;
    tags: string[];
    paused: boolean;
    dlLimit: number | null;
    upLimit: number | null;
  },
): { hash: string; torrent: Record<string, unknown> } {
  const baseIndex = state.nextSyntheticTorrentId + 1000;
  const template = makeTorrent(baseIndex);
  const hash = ensureUniqueHash(state, extractMagnetHash(source));
  delete template.hash;

  const fallbackName = `Added Torrent ${state.nextSyntheticTorrentId}`;
  const torrent: Record<string, unknown> = {
    ...template,
    name: extractDisplayName(source, fallbackName),
    magnet_uri: source.startsWith('magnet:') ? source : template.magnet_uri,
    category: options.category,
    tags: serializeTags(options.tags),
    state: options.paused ? 'pausedDL' : 'downloading',
    save_path: options.savepath || template.save_path,
    download_path: options.savepath || template.download_path,
    content_path: options.savepath || template.content_path,
    dl_limit: options.dlLimit ?? template.dl_limit,
    up_limit: options.upLimit ?? template.up_limit,
    reannounce: 30,
    last_activity: Math.floor(Date.now() / 1000),
    added_on: Math.floor(Date.now() / 1000),
  };

  return { hash, torrent };
}

function addTorrentFromForm(state: ServerState, params: URLSearchParams): void {
  const urls = (params.get('urls') ?? '').trim();
  if (!urls) {
    throw new HttpError(400, 'Missing urls parameter');
  }

  const sources = urls.split(/\r?\n+/).map((value) => value.trim()).filter(Boolean);
  if (sources.length === 0) {
    throw new HttpError(400, 'Missing urls parameter');
  }

  const category = (params.get('category') ?? '').trim();
  const savepath = (params.get('savepath') ?? '').trim();
  const tags = parseTags(params.get('tags'));
  const paused = params.get('paused') === 'true';
  const dlLimit = parseOptionalInteger(params.get('dlLimit'));
  const upLimit = parseOptionalInteger(params.get('upLimit'));

  for (const source of sources) {
    const { hash, torrent } = createAddedTorrent(state, source, {
      category,
      savepath,
      tags,
      paused,
      dlLimit,
      upLimit,
    });
    state.torrents[hash] = torrent;
  }

  syncDerivedMetadata(state);
}

function addTorrentFromMultipart(state: ServerState, body: string): void {
  const urls = extractMultipartField(body, 'urls') ?? '';
  const fileNames = extractMultipartFileNames(body);
  if (!urls.trim() && fileNames.length === 0) {
    throw new HttpError(400, 'Missing torrent payload');
  }

  const category = (extractMultipartField(body, 'category') ?? '').trim();
  const savepath = (extractMultipartField(body, 'savepath') ?? '').trim();
  const tags = parseTags(extractMultipartField(body, 'tags'));
  const paused = (extractMultipartField(body, 'paused') ?? 'false') === 'true';
  const dlLimit = parseOptionalInteger(extractMultipartField(body, 'dlLimit'));
  const upLimit = parseOptionalInteger(extractMultipartField(body, 'upLimit'));

  const sources = [
    ...urls.split(/\r?\n+/).map((value) => value.trim()).filter(Boolean),
    ...fileNames.map((fileName) => `file://${fileName}`),
  ];

  for (const source of sources) {
    const { hash, torrent } = createAddedTorrent(state, source, {
      category,
      savepath,
      tags,
      paused,
      dlLimit,
      upLimit,
    });
    if (source.startsWith('file://')) {
      torrent.name = source.replace('file://', '').replace(/\.torrent$/i, '');
    }
    state.torrents[hash] = torrent;
  }

  syncDerivedMetadata(state);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function parseRequestUrl(rawUrl: string): { pathname: string; query: Record<string, string | string[]> } {
  const url = new URL(rawUrl, 'http://127.0.0.1');
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }

  return { pathname: url.pathname, query };
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: ServerState,
  log: (msg: string) => void,
): Promise<void> {
  const { pathname, query } = parseRequestUrl(req.url ?? '/');
  const method = req.method?.toUpperCase() ?? 'GET';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (await applyTestControls(req, res, state, pathname, query)) {
    return;
  }

if (method === 'POST' && pathname === '/api/v2/auth/login') {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    const username = params.get('username') ?? '';
    const password = params.get('password') ?? '';
    log(`[auth/login] username=${username} password_valid=${password === 'adminadmin'}`);
    if (username === 'admin' && password === 'adminadmin') {
      const postLogin403Raw = query.__postLogin403Count;
      const nextProtected403Count = Number(Array.isArray(postLogin403Raw) ? postLogin403Raw[0] : postLogin403Raw);
      // Use a deterministic SID for the same username so multiple logins (app + test)
      // produce the same session cookie and don't invalidate each other's sessions.
      state.session = { sid: `fake-sid-${username}`, username };
      state.protectedEndpoint403Remaining = Number.isFinite(nextProtected403Count) && nextProtected403Count > 0
        ? nextProtected403Count
        : 0;
      res.setHeader('Set-Cookie', `SID=${state.session.sid}; HttpOnly; Path=/`);
      log(`[auth/login] success SID=${state.session.sid} forced_post_login_403=${state.protectedEndpoint403Remaining}`);
      sendText(res, 200, 'Ok.');
    } else {
      log(`[auth/login] failed for username=${username}`);
      sendText(res, 403, 'Wrong username or password.');
    }
    return;
  }

if (!ensureAuthenticated(req, res, state, log)) {
    return;
  }

  // Test-only endpoint: read current torrent state directly without authentication.
  // Used by the E2E test to verify torrent state changes made by the app, since
  // both the app's session and the test's session share the same SID.
  if (method === 'GET' && pathname === '/__test/torrents') {
    sendJson(res, 200, buildTorrentArray(state.torrents));
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/sync/maindata') {
    const ridParam = query.rid;
    const rid = ridParam !== undefined ? Number(Array.isArray(ridParam) ? ridParam[0] : ridParam) : 0;
    state.ridCounter = Number.isFinite(rid) ? Math.max(state.ridCounter + 1, rid + 1) : state.ridCounter + 1;
    const delta = buildFullDelta(state);
    const torrentNames = Object.values(state.torrents).slice(0, 3).map((t: Record<string, unknown>) => t.name);
    log(`[sync/maindata] rid=${rid} -> delta.rid=${delta.rid} first_torrents=${JSON.stringify(torrentNames)}`);
    sendJson(res, 200, delta);
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/torrents/info') {
    const torrents = buildTorrentArray(state.torrents);
    log(`[info] returning ${torrents.length} torrents, first 3: ${JSON.stringify(torrents.slice(0,3).map(t => ({name: t.name, state: t.state, hash: t.hash})))}`);
    sendJson(res, 200, torrents);
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/add') {
    const body = await readBody(req);
    const contentType = String(req.headers['content-type'] ?? '');
    if (contentType.includes('multipart/form-data')) {
      addTorrentFromMultipart(state, body);
    } else {
      addTorrentFromForm(state, new URLSearchParams(body));
    }
    log('[command] /api/v2/torrents/add');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/pause') {
    const params = new URLSearchParams(await readBody(req));
    const hashes = params.get('hashes') ?? '';
    log(`[command] /api/v2/torrents/pause hashes=${hashes}`);
    // If multiple hashes, process all of them
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      log(`[command] pausing torrent hash=${hash} name=${torrent.name} state_before=${torrent.state}`);
      torrent.state = computePausedState(torrent);
      log(`[command] torrent hash=${hash} state_after=${torrent.state}`);
    }
    log('[command] /api/v2/torrents/pause done');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/resume') {
    const params = new URLSearchParams(await readBody(req));
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      torrent.state = computeRunningState(torrent);
    }
    log('[command] /api/v2/torrents/resume');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/delete') {
    const params = new URLSearchParams(await readBody(req));
    parseBoolean(params.get('deleteFiles'), 'deleteFiles');
    for (const hash of splitHashes(params.get('hashes'))) {
      getTorrentOrThrow(state, hash);
      delete state.torrents[hash];
    }
    syncDerivedMetadata(state);
    log('[command] /api/v2/torrents/delete');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/recheck') {
    const params = new URLSearchParams(await readBody(req));
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      torrent.state = Number(torrent.progress ?? 0) >= 1 ? 'checkingUP' : 'checkingDL';
      torrent.last_activity = Math.floor(Date.now() / 1000);
    }
    log('[command] /api/v2/torrents/recheck');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/reannounce') {
    const params = new URLSearchParams(await readBody(req));
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      torrent.reannounce = 0;
      torrent.last_activity = Math.floor(Date.now() / 1000);
    }
    log('[command] /api/v2/torrents/reannounce');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/setForceStart') {
    const params = new URLSearchParams(await readBody(req));
    const value = parseBoolean(params.get('value'), 'value');
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      torrent.force_start = value;
      if (value) torrent.state = computeRunningState(torrent);
    }
    log('[command] /api/v2/torrents/setForceStart');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/setCategory') {
    const params = new URLSearchParams(await readBody(req));
    const category = (params.get('category') ?? '').trim();
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      torrent.category = category;
    }
    syncDerivedMetadata(state);
    log('[command] /api/v2/torrents/setCategory');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/addTags') {
    const params = new URLSearchParams(await readBody(req));
    const tags = parseTags(params.get('tags'));
    if (tags.length === 0) throw new HttpError(400, 'Missing tags parameter');
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      const nextTags = new Set(parseTags(torrent.tags));
      for (const tag of tags) nextTags.add(tag);
      torrent.tags = serializeTags([...nextTags].sort());
    }
    syncDerivedMetadata(state);
    log('[command] /api/v2/torrents/addTags');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/removeTags') {
    const params = new URLSearchParams(await readBody(req));
    const tags = new Set(parseTags(params.get('tags')));
    if (tags.size === 0) throw new HttpError(400, 'Missing tags parameter');
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      torrent.tags = serializeTags(parseTags(torrent.tags).filter((tag) => !tags.has(tag)));
    }
    syncDerivedMetadata(state);
    log('[command] /api/v2/torrents/removeTags');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/setSuperSeeding') {
    const params = new URLSearchParams(await readBody(req));
    const value = parseBoolean(params.get('value'), 'value');
    for (const hash of splitHashes(params.get('hashes'))) {
      const torrent = getTorrentOrThrow(state, hash);
      torrent.super_seeding = value;
    }
    log('[command] /api/v2/torrents/setSuperSeeding');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'POST' && pathname === '/api/v2/torrents/setShareLimit') {
    const params = new URLSearchParams(await readBody(req));
    splitHashes(params.get('hashes'));
    log('[command] /api/v2/torrents/setShareLimit');
    sendText(res, 200, 'Ok.');
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/app/version') {
    sendText(res, 200, 'v4.6.1.0');
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/app/webapiVersion') {
    sendText(res, 200, '2.8');
    return;
  }

if (method === 'GET' && pathname === '/api/v2/app/webapiVersion') {
    sendText(res, 200, '2.8');
    return;
  }

  // Handle camelCase variant that real qBittorrent client uses
  if (method === 'GET' && pathname === '/api/v2/app/buildInfo') {
    sendJson(res, 200, {
      api: '2.8',
      qbittorrent: '4.6.1.0',
      libtorrent: '2.0.9',
      boost: '1.87',
      openssl: '3.1.7',
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/app/buildinfo') {
    sendJson(res, 200, {
      api: '2.8',
      qbittorrent: '4.6.1.0',
      libtorrent: '2.0.9',
      boost: '1.87',
      openssl: '3.1.7',
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/app/preferences') {
    sendJson(res, 200, {
      default_save_path: '/downloads',
      listen_port: 6881,
      max_connec: 500,
      max_connec_per_torrent: 100,
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/app/defaultSavePath') {
    sendText(res, 200, '/downloads');
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/categories') {
    sendJson(res, 200, state.categories);
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/tags') {
    sendJson(res, 200, state.tags);
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/transfer/info') {
    sendJson(res, 200, buildServerStatePayload());
    return;
  }

  if (method === 'GET' && pathname === '/api/v2/torrents/properties') {
    // Return generic torrent properties (actual qBittorrent returns per-torrent data)
    const hash = query.hash;
    log(`[torrents/properties] hash=${Array.isArray(hash) ? hash[0] : hash}`);
    sendJson(res, 200, {
      distributed_copies: 0,
      download_limit: -1,
      upload_limit: -1,
      peers_total: 5,
      peers_from: { from_cache: 2, from_dht: 1, from_peerdb: 1, from_trackers: 1 },
      seeding_time: 3600,
      seeding_time_limit: -1,
      info_hash_v1: '',
      info_hash_v2: '',
      is_auto_tmm: false,
      avg_download: 1024 * 1024,
      avg_upload: 512 * 1024,
    });
    return;
  }

  sendText(res, 404, 'Not Found');
}

// ---------------------------------------------------------------------------
// Server start
// ---------------------------------------------------------------------------

export function startFakeQBittorrentServer(
  options: Partial<ServerOptions> = {},
): Promise<{ url: string; stop: () => void }> {
  const opts: ServerOptions = {
    scenario: options.scenario ?? 'small-100',
    port: options.port ?? 18080,
    quiet: options.quiet ?? false,
  };

  const state = initializeState(opts.scenario);
  const log = (msg: string) => {
    if (!opts.quiet) {
      console.info(`[fake-qb] ${msg}`);
    }
  };

  const server = http.createServer((req, res) => {
    void handleRequest(req, res, state, log).catch((err) => {
      if (err instanceof HttpError) {
        sendText(res, err.status, err.message);
        return;
      }

      console.error('[fake-qb] Request failed:', err);
      if (!res.headersSent) {
        sendText(res, 500, (err as Error).message);
      } else {
        res.end();
      }
    });
  });

  return new Promise<{ url: string; stop: () => void }>((resolve, reject) => {
    server.on('error', reject);
    server.listen(opts.port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${opts.port}`;
      log(`Fake qBittorrent server running at ${url}`);
      log(`Scenario: ${opts.scenario}`);
      resolve({
        url,
        stop: () => {
          server.close();
          log('Server stopped');
        },
      });
    });
  });
}

// ---------------------------------------------------------------------------
// CLI mode
// ---------------------------------------------------------------------------

function parseKeyValueArg(args: string[], key: string): number | null {
  const eq = args.find((a) => a.startsWith(`--${key}=`));
  if (eq) return Number(eq.split('=')[1]);
  const idx = args.indexOf(`--${key}`);
  if (idx !== -1 && idx + 1 < args.length) {
    const val = args[idx + 1];
    if (!val.startsWith('--')) return Number(val);
  }
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scenarioArg = args.find((a) => !a.startsWith('--')) ?? 'small-100';
  const scenario = (['empty', 'small-100', 'large-1000', 'stress-5000'].includes(scenarioArg))
    ? scenarioArg as ServerOptions['scenario']
    : 'small-100';

  const port = parseKeyValueArg(args, 'port') ?? 18080;

  const { url, stop } = await startFakeQBittorrentServer({ scenario, port });

  console.info(`\n[fake-qb] Server ready: ${url}`);
  console.info(`[fake-qb] Scenario: ${scenario}`);
  console.info('[fake-qb] Press Ctrl+C to stop.\n');

  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error('[fake-qb] Fatal:', err);
    process.exit(1);
  });
}
