import { describe, expect, it } from 'vitest';
import { deriveTrackerEntries } from '../deriveTrackerEntries';
import type { Torrent } from '../../types/qbittorrent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTorrent(overrides: Partial<Torrent> = {}): Torrent {
  return {
    added_on: 0,
    amount_left: 0,
    auto_tmm: false,
    availability: 0,
    category: '',
    completed: 0,
    completion_on: 0,
    content_path: '/foo/bar',
    dl_limit: 0,
    dlspeed: 0,
    download_path: '',
    downloaded: 0,
    downloaded_session: 0,
    eta: 0,
    f_l_piece_prio: false,
    force_start: false,
    hash: 'h1',
    infohash_v1: '',
    infohash_v2: '',
    last_activity: 0,
    magnet_uri: '',
    max_ratio: 0,
    max_seeding_time: 0,
    name: 'Test Torrent',
    num_complete: 0,
    num_incomplete: 0,
    num_leechs: 0,
    num_seeds: 0,
    priority: 0,
    progress: 0,
    ratio: 0,
    ratio_limit: 0,
    save_path: '/downloads',
    seeding_time: 0,
    seeding_time_limit: 0,
    seen_complete: 0,
    seq_dl: false,
    size: 0,
    state: 'stoppedDL',
    super_seeding: false,
    tags: '',
    time_active: 0,
    total_size: 0,
    tracker: '',
    trackers_count: 0,
    up_limit: 0,
    uploaded: 0,
    uploaded_session: 0,
    upspeed: 0,
    ...overrides,
  };
}

// ─── deriveTrackerEntries ────────────────────────────────────────────────────

describe('deriveTrackerEntries', () => {
  it('returns an empty array for no torrents', () => {
    expect(deriveTrackerEntries([])).toEqual([]);
  });

  it('derives the hostname from a tracker URL', () => {
    const result = deriveTrackerEntries([
      makeTorrent({ tracker: 'https://tracker.example.com:443/announce' }),
    ]);
    expect(result).toEqual([
      { trackerUrl: 'https://tracker.example.com:443/announce', hostname: 'tracker.example.com', count: 1 },
    ]);
  });

  it('counts torrents sharing the same full tracker URL', () => {
    const result = deriveTrackerEntries([
      makeTorrent({ hash: 'a', tracker: 'https://a.example.com/announce' }),
      makeTorrent({ hash: 'b', tracker: 'https://a.example.com/announce' }),
      makeTorrent({ hash: 'c', tracker: 'https://a.example.com/announce' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it('skips empty and whitespace-only tracker URLs', () => {
    const result = deriveTrackerEntries([
      makeTorrent({ hash: 'a', tracker: '' }),
      makeTorrent({ hash: 'b', tracker: '   ' }),
      makeTorrent({ hash: 'c', tracker: undefined as unknown as string }),
      makeTorrent({ hash: 'd', tracker: 'https://real.example.com/announce' }),
    ]);
    expect(result).toEqual([
      { trackerUrl: 'https://real.example.com/announce', hostname: 'real.example.com', count: 1 },
    ]);
  });

  it('trims surrounding whitespace before counting', () => {
    const result = deriveTrackerEntries([
      makeTorrent({ hash: 'a', tracker: '  https://a.example.com/announce  ' }),
      makeTorrent({ hash: 'b', tracker: 'https://a.example.com/announce' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      trackerUrl: 'https://a.example.com/announce',
      hostname: 'a.example.com',
      count: 2,
    });
  });

  it('falls back to the raw URL as hostname when parsing fails', () => {
    const result = deriveTrackerEntries([makeTorrent({ tracker: 'not a url' })]);
    expect(result).toEqual([{ trackerUrl: 'not a url', hostname: 'not a url', count: 1 }]);
  });

  it('sorts by count descending, then hostname ascending', () => {
    const result = deriveTrackerEntries([
      // zulu: 1
      makeTorrent({ hash: '1', tracker: 'https://zulu.example.com/announce' }),
      // alpha: 2
      makeTorrent({ hash: '2', tracker: 'https://alpha.example.com/announce' }),
      makeTorrent({ hash: '3', tracker: 'https://alpha.example.com/announce' }),
      // bravo: 2
      makeTorrent({ hash: '4', tracker: 'https://bravo.example.com/announce' }),
      makeTorrent({ hash: '5', tracker: 'https://bravo.example.com/announce' }),
    ]);

    expect(result.map((entry) => entry.hostname)).toEqual([
      'alpha.example.com', // count 2, hostname first alphabetically
      'bravo.example.com', // count 2
      'zulu.example.com', // count 1
    ]);
  });
});
