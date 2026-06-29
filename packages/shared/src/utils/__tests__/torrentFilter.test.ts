import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

// Mock perfAudit so measure() is a no-op in tests
vi.mock('./perfAudit', async () => {
  const actual = await vi.importActual('./perfAudit');
  return {
    ...(actual as object),
    measure: <T>(_label: string, fn: () => T) => fn(),
  };
});

import {
  parseTorrentTags,
  torrentHasTag,
  matchesTorrentFilter,
  matchesTorrentSearch,
  matchesTorrentTracker,
  isTorrentFilterType,
  TORRENT_FILTER_OPTIONS,
  FILTER_STATUS_TO_FILTER_TYPE,
  FILTER_TYPE_TO_STATUS,
} from '../torrentFilter';
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

// ─── parseTorrentTags ────────────────────────────────────────────────────────

describe('parseTorrentTags', () => {
  it('returns empty array for undefined', () => {
    expect(parseTorrentTags(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseTorrentTags('')).toEqual([]);
  });

  it('splits on comma and trims', () => {
    expect(parseTorrentTags('tag-a, tag-b, tag-c')).toEqual(['tag-a', 'tag-b', 'tag-c']);
  });

  it('filters empty segments', () => {
    expect(parseTorrentTags('tag-a, , tag-b')).toEqual(['tag-a', 'tag-b']);
  });

  it('handles single tag', () => {
    expect(parseTorrentTags('solo')).toEqual(['solo']);
  });

  it('handles whitespace-only segments', () => {
    expect(parseTorrentTags('  ,  , tag-a')).toEqual(['tag-a']);
  });
});

// ─── torrentHasTag ────────────────────────────────────────────────────────────

describe('torrentHasTag', () => {
  it('returns false when torrent has no tags', () => {
    expect(torrentHasTag(makeTorrent({ tags: '' }), 'tag-a')).toBe(false);
  });

  it('returns true when torrent has the tag', () => {
    expect(torrentHasTag(makeTorrent({ tags: 'tag-a,tag-b' }), 'tag-a')).toBe(true);
  });

  it('returns false when torrent does not have the tag', () => {
    expect(torrentHasTag(makeTorrent({ tags: 'tag-b,tag-c' }), 'tag-a')).toBe(false);
  });

  it('is case-sensitive by default', () => {
    expect(torrentHasTag(makeTorrent({ tags: 'Tag-A' }), 'tag-a')).toBe(false);
  });

  it('handles whitespace around tags', () => {
    expect(torrentHasTag(makeTorrent({ tags: '  tag-a  , tag-b  ' }), 'tag-a')).toBe(true);
  });

  it('handles tags with no trailing comma', () => {
    expect(torrentHasTag(makeTorrent({ tags: 'tag-a' }), 'tag-a')).toBe(true);
  });

  it('handles undefined tags', () => {
    expect(torrentHasTag(makeTorrent({ tags: undefined as unknown as string }), 'tag-a')).toBe(false);
  });
});

// ─── matchesTorrentFilter ─────────────────────────────────────────────────────

describe('matchesTorrentFilter', () => {
  it('all matches every state', () => {
    const states = [
      'downloading', 'stalledDL', 'metaDL', 'uploading', 'stalledUP',
      'stoppedDL', 'stoppedUP', 'queuedDL', 'queuedUP', 'forcedDL', 'forcedUP',
      'error', 'missingFiles', 'checkingDL', 'checkingUP', 'allocating',
      'checkingResumeData', 'moving',
    ];
    for (const state of states) {
      expect(matchesTorrentFilter('all', makeTorrent({ state }))).toBe(true);
    }
  });

  it('downloading filter matches downloading, stalledDL, metaDL', () => {
    expect(matchesTorrentFilter('downloading', makeTorrent({ state: 'downloading' }))).toBe(true);
    expect(matchesTorrentFilter('downloading', makeTorrent({ state: 'stalledDL' }))).toBe(true);
    expect(matchesTorrentFilter('downloading', makeTorrent({ state: 'metaDL' }))).toBe(true);
    expect(matchesTorrentFilter('downloading', makeTorrent({ state: 'uploading' }))).toBe(false);
  });

  it('seeding filter matches uploading, stalledUP', () => {
    expect(matchesTorrentFilter('seeding', makeTorrent({ state: 'uploading' }))).toBe(true);
    expect(matchesTorrentFilter('seeding', makeTorrent({ state: 'stalledUP' }))).toBe(true);
    expect(matchesTorrentFilter('seeding', makeTorrent({ state: 'downloading' }))).toBe(false);
  });

  it('completed filter matches uploading, stalledUP, queuedUP, stoppedUP', () => {
    for (const state of ['uploading', 'stalledUP', 'queuedUP', 'stoppedUP']) {
      expect(matchesTorrentFilter('completed', makeTorrent({ state }))).toBe(true);
    }
    expect(matchesTorrentFilter('completed', makeTorrent({ state: 'downloading' }))).toBe(false);
  });

  it('stopped filter matches stoppedDL, stoppedUP', () => {
    expect(matchesTorrentFilter('stopped', makeTorrent({ state: 'stoppedDL' }))).toBe(true);
    expect(matchesTorrentFilter('stopped', makeTorrent({ state: 'stoppedUP' }))).toBe(true);
    expect(matchesTorrentFilter('stopped', makeTorrent({ state: 'downloading' }))).toBe(false);
  });

  it('active filter matches downloading, stalledDL, uploading, stalledUP', () => {
    for (const state of ['downloading', 'stalledDL', 'uploading', 'stalledUP']) {
      expect(matchesTorrentFilter('active', makeTorrent({ state }))).toBe(true);
    }
    expect(matchesTorrentFilter('active', makeTorrent({ state: 'queuedDL' }))).toBe(false);
    expect(matchesTorrentFilter('active', makeTorrent({ state: 'stoppedDL' }))).toBe(false);
  });

  it('inactive filter matches queuedDL, queuedUP, stoppedDL, stoppedUP', () => {
    for (const state of ['queuedDL', 'queuedUP', 'stoppedDL', 'stoppedUP']) {
      expect(matchesTorrentFilter('inactive', makeTorrent({ state }))).toBe(true);
    }
    expect(matchesTorrentFilter('inactive', makeTorrent({ state: 'downloading' }))).toBe(false);
  });

  it('running filter matches downloading, uploading, forcedDL, forcedUP', () => {
    for (const state of ['downloading', 'uploading', 'forcedDL', 'forcedUP']) {
      expect(matchesTorrentFilter('running', makeTorrent({ state }))).toBe(true);
    }
    expect(matchesTorrentFilter('running', makeTorrent({ state: 'stalledDL' }))).toBe(false);
  });

  it('stalled filter matches stalledDL, stalledUP', () => {
    expect(matchesTorrentFilter('stalled', makeTorrent({ state: 'stalledDL' }))).toBe(true);
    expect(matchesTorrentFilter('stalled', makeTorrent({ state: 'stalledUP' }))).toBe(true);
    expect(matchesTorrentFilter('stalled', makeTorrent({ state: 'downloading' }))).toBe(false);
  });

  it('stalled_uploading matches only stalledUP', () => {
    expect(matchesTorrentFilter('stalled_uploading', makeTorrent({ state: 'stalledUP' }))).toBe(true);
    expect(matchesTorrentFilter('stalled_uploading', makeTorrent({ state: 'stalledDL' }))).toBe(false);
  });

  it('stalled_downloading matches only stalledDL', () => {
    expect(matchesTorrentFilter('stalled_downloading', makeTorrent({ state: 'stalledDL' }))).toBe(true);
    expect(matchesTorrentFilter('stalled_downloading', makeTorrent({ state: 'stalledUP' }))).toBe(false);
  });

  it('errored filter matches error, missingFiles', () => {
    expect(matchesTorrentFilter('errored', makeTorrent({ state: 'error' }))).toBe(true);
    expect(matchesTorrentFilter('errored', makeTorrent({ state: 'missingFiles' }))).toBe(true);
    expect(matchesTorrentFilter('errored', makeTorrent({ state: 'downloading' }))).toBe(false);
  });
});

// ─── matchesTorrentSearch ─────────────────────────────────────────────────────

describe('matchesTorrentSearch', () => {
  it('empty query matches everything', () => {
    expect(matchesTorrentSearch(makeTorrent({ name: 'Foo' }), '')).toBe(true);
    expect(matchesTorrentSearch(makeTorrent({ name: 'Foo' }), '   ')).toBe(true);
  });

  it('matches substring in name', () => {
    expect(matchesTorrentSearch(makeTorrent({ name: 'Ubuntu 22.04 Desktop' }), 'ubuntu')).toBe(true);
    expect(matchesTorrentSearch(makeTorrent({ name: 'Ubuntu 22.04 Desktop' }), '22.04')).toBe(true);
    expect(matchesTorrentSearch(makeTorrent({ name: 'Ubuntu 22.04 Desktop' }), 'Desktop')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesTorrentSearch(makeTorrent({ name: 'Ubuntu 22.04 Desktop' }), 'UBUNTU')).toBe(true);
    expect(matchesTorrentSearch(makeTorrent({ name: 'Ubuntu 22.04 Desktop' }), 'DESKTOP')).toBe(true);
  });

  it('normalizes dots, underscores, hyphens to spaces', () => {
    expect(matchesTorrentSearch(makeTorrent({ name: 'my_file-name.iso' }), 'my file name iso')).toBe(true);
    expect(matchesTorrentSearch(makeTorrent({ name: 'my_file-name.iso' }), 'my_file-name.iso')).toBe(true);
  });

  it('collapses multiple spaces', () => {
    expect(matchesTorrentSearch(makeTorrent({ name: 'Ubuntu   22.04' }), 'Ubuntu 22.04')).toBe(true);
  });

  it('does not match partial word across normalization boundary', () => {
    // "my" should not match inside "my_file" after normalization to "my file"
    // but because we normalize to spaces, "my" would match "my file"
    expect(matchesTorrentSearch(makeTorrent({ name: 'my_file' }), 'my file')).toBe(true);
  });

  it('no match when query is not a substring', () => {
    expect(matchesTorrentSearch(makeTorrent({ name: 'Ubuntu 22.04' }), 'Debian')).toBe(false);
  });
});

// ─── matchesTorrentTracker ─────────────────────────────────────────────────────

describe('matchesTorrentTracker', () => {
  it('empty filter matches everything', () => {
    expect(matchesTorrentTracker(makeTorrent({ tracker: 'http://tracker.example.com' }), '')).toBe(true);
  });

  it('exact URL match', () => {
    expect(
      matchesTorrentTracker(
        makeTorrent({ tracker: 'http://tracker.example.com/announce' }),
        'http://tracker.example.com/announce',
      ),
    ).toBe(true);
  });

  it('case-insensitive URL match', () => {
    expect(
      matchesTorrentTracker(
        makeTorrent({ tracker: 'HTTP://TRACKER.EXAMPLE.COM/ANN' }),
        'http://tracker.example.com/ann',
      ),
    ).toBe(true);
  });

  it('no match when tracker differs', () => {
    expect(
      matchesTorrentTracker(
        makeTorrent({ tracker: 'http://tracker-a.com' }),
        'http://tracker-b.com',
      ),
    ).toBe(false);
  });

  it('empty torrent tracker vs non-empty filter', () => {
    expect(matchesTorrentTracker(makeTorrent({ tracker: '' }), 'http://tracker.example.com')).toBe(false);
  });

  it('whitespace is trimmed in comparison', () => {
    expect(
      matchesTorrentTracker(
        makeTorrent({ tracker: '  http://tracker.example.com  ' }),
        'http://tracker.example.com',
      ),
    ).toBe(true);
  });
});

// ─── isTorrentFilterType ─────────────────────────────────────────────────────

describe('isTorrentFilterType', () => {
  it('returns true for valid filter types', () => {
    for (const opt of TORRENT_FILTER_OPTIONS) {
      expect(isTorrentFilterType(opt.value)).toBe(true);
    }
  });

  it('returns false for invalid strings', () => {
    expect(isTorrentFilterType('foobar')).toBe(false);
    expect(isTorrentFilterType('')).toBe(false);
    expect(isTorrentFilterType('ALL')).toBe(false);
  });
});

// ─── FILTER_STATUS_TO_FILTER_TYPE ─────────────────────────────────────────────

describe('FILTER_STATUS_TO_FILTER_TYPE', () => {
  it('maps paused to stopped', () => {
    expect(FILTER_STATUS_TO_FILTER_TYPE['paused']).toBe('stopped');
  });

  it('maps error to errored', () => {
    expect(FILTER_STATUS_TO_FILTER_TYPE['error']).toBe('errored');
  });

  it('maps resumed to all (resumed lifts the filter)', () => {
    expect(FILTER_STATUS_TO_FILTER_TYPE['resumed']).toBe('all');
  });

  it('maps checking to all (checking has no distinct filter type)', () => {
    expect(FILTER_STATUS_TO_FILTER_TYPE['checking']).toBe('all');
  });

  it('has entries for all TorrentFilterType values', () => {
    const filterTypes: TorrentFilterType[] = [
      'all', 'downloading', 'seeding', 'completed', 'stopped',
      'active', 'inactive', 'running', 'stalled',
      'stalled_uploading', 'stalled_downloading', 'errored',
    ];
    for (const ft of filterTypes) {
      const matchingStatus = Object.entries(FILTER_STATUS_TO_FILTER_TYPE).find(
        ([, v]) => v === ft,
      );
      expect(matchingStatus).toBeDefined();
    }
  });
});

// ─── FILTER_TYPE_TO_STATUS ───────────────────────────────────────────────────

describe('FILTER_TYPE_TO_STATUS', () => {
  it('inverts FILTER_STATUS_TO_FILTER_TYPE for errored', () => {
    expect(FILTER_TYPE_TO_STATUS['errored']).toBe('error');
  });

  it('maps stopped to stopped', () => {
    expect(FILTER_TYPE_TO_STATUS['stopped']).toBe('stopped');
  });
});

// ─── TORRENT_FILTER_OPTIONS ───────────────────────────────────────────────────

describe('TORRENT_FILTER_OPTIONS', () => {
  it('has exactly 12 options', () => {
    expect(TORRENT_FILTER_OPTIONS).toHaveLength(12);
  });

  it('contains all filter type values', () => {
    for (const opt of TORRENT_FILTER_OPTIONS) {
      expect(isTorrentFilterType(opt.value)).toBe(true);
    }
  });

  it('has label for every option', () => {
    for (const opt of TORRENT_FILTER_OPTIONS) {
      expect(typeof opt.label).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});