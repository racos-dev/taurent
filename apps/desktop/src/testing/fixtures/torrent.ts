// Deterministic torrent/maindata fixture factory for tests.
// All fields required by the Torrent type are populated.

import type {
  Torrent,
  SyncMainData,
  MaindataState,
  Category,
  SyncServerState,
} from '@taurent/shared/types/qbittorrent';

/**
 * Creates a single Torrent with all fields populated.
 * Hash is deterministic per index, name reflects index.
 */
export function createTorrent(index: number): Torrent {
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
    hash: `abcd${String(n).padStart(32 - 4, '0')}`,
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
    state: ['uploading', 'downloading', 'pausedUP', 'pausedDL', 'stalledUP'][
      n % 5
    ],
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

/**
 * Creates a list of n torrents with deterministic, incrementing content.
 */
export function createTorrentList(count: number): Torrent[] {
  const list: Torrent[] = [];
  for (let i = 0; i < count; i++) {
    list.push(createTorrent(i));
  }
  return list;
}

/**
 * Builds a SyncMainData full-update delta containing `count` torrents.
 */
export function createFullMaindataDelta(count: number): SyncMainData {
  const torrents: Record<string, Torrent> = {};
  for (let i = 0; i < count; i++) {
    const t = createTorrent(i);
    const rawTorrent = { ...t } as Partial<Torrent>;
    delete rawTorrent.hash;
    torrents[t.hash] = rawTorrent as Torrent;
  }
  return {
    rid: 1,
    full_update: true,
    torrents,
    categories: {
      videos: { name: 'videos', savePath: '/data/videos' },
      audio: { name: 'audio', savePath: '/data/audio' },
    },
    tags: ['tag-c', 'tag-a', 'tag-b'],
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
      free_space_on_disk: 1024 * 1024 * 1024 * 500,
      alltime_dl: 1024 * 1024 * 1024 * 200,
      alltime_ul: 1024 * 1024 * 1024 * 100,
    },
  };
}

/**
 * Builds a MaindataState — the accumulated form after one full merge.
 */
export function createMaindataState(count: number): MaindataState {
  const delta = createFullMaindataDelta(count);
  return {
    rid: delta.rid,
    torrents: delta.torrents ?? {},
    categories: (delta.categories ?? {}) as Record<string, Category>,
    tags: delta.tags ? [...delta.tags].sort() : [],
    server_state: delta.server_state as SyncServerState,
  };
}

/**
 * Incremental delta: modifies modifyHash, removes removeHash, adds addedHash with addedTorrent.
 */
export function createDeltaMaindata(
  current: MaindataState,
  modifyHash: string,
  newName: string,
  removeHash: string,
  addedHash: string,
  addedTorrent: Torrent,
): SyncMainData {
  const delta: SyncMainData = {
    rid: (current.rid ?? 0) + 1,
    full_update: false,
    torrents: {},
    torrents_removed: [],
  };

  if (modifyHash && current.torrents[modifyHash]) {
    delta.torrents![modifyHash] = {
      ...current.torrents[modifyHash],
      name: newName,
    };
  }

  if (removeHash) {
    delta.torrents_removed!.push(removeHash);
  }

  if (addedHash && addedTorrent) {
    delta.torrents![addedHash] = addedTorrent;
  }

  delta.categories = {
    'new-category': { name: 'new-category', savePath: '/data/new' },
  };
  delta.categories_removed = ['audio'];

  delta.tags = ['tag-d', 'tag-e'];
  delta.tags_removed = ['tag-c'];

  delta.server_state = {
    dl_info_speed: 2048 * 1024,
    dl_info_data: 1024 * 1024 * 200,
    up_info_speed: 1024 * 1024,
    up_info_data: 1024 * 1024 * 100,
    dl_rate_limit: 0,
    up_rate_limit: 0,
    dht_nodes: 50,
    connection_status: 'connected',
    queueing: true,
    use_alt_speed_limits: false,
    refresh_interval: 3000,
  };

  return delta;
}
