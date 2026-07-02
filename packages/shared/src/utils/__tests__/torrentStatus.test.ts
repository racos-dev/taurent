import { describe, expect, it } from 'vitest';
import {
  getTorrentDisplayStatus,
  getStatusLabel,
  getTorrentDetailedStateLabel,
  formatTorrentStatus,
  toStatusBadgeStatus,
  getStatusColorClass,
  TORRENT_STATE_LABELS,
  TORRENT_DETAILED_STATE_LABELS,
  type TorrentDisplayStatus,
} from '../torrentStatus';
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

// ─── getTorrentDisplayStatus ─────────────────────────────────────────────────

describe('getTorrentDisplayStatus', () => {
  const cases: Array<[string, TorrentDisplayStatus]> = [
    ['error', 'error'],
    ['missingFiles', 'error'],
    ['uploading', 'seeding'],
    ['stoppedUP', 'completed'],
    ['queuedUP', 'queued'],
    ['stalledUP', 'seeding'],
    ['checkingUP', 'checking'],
    ['forcedUP', 'seeding'],
    ['allocating', 'checking'],
    ['downloading', 'downloading'],
    ['metaDL', 'downloading'],
    ['stoppedDL', 'paused'],
    ['queuedDL', 'queued'],
    ['stalledDL', 'downloading'],
    ['checkingDL', 'checking'],
    ['forcedDL', 'downloading'],
    ['checkingResumeData', 'checking'],
    ['moving', 'moving'],
    ['unknown', 'error'],
  ];

  it.each(cases)('maps raw state "%s" to display status "%s"', (state, expected) => {
    expect(getTorrentDisplayStatus(makeTorrent({ state }))).toBe(expected);
  });

  it('falls back to "error" for an unrecognised state', () => {
    expect(getTorrentDisplayStatus(makeTorrent({ state: 'totallyBogus' }))).toBe('error');
  });

  it('falls back to "error" for an empty state', () => {
    expect(getTorrentDisplayStatus(makeTorrent({ state: '' }))).toBe('error');
  });
});

// ─── getStatusLabel ──────────────────────────────────────────────────────────

describe('getStatusLabel', () => {
  const cases: Array<[TorrentDisplayStatus, string]> = [
    ['downloading', 'Downloading'],
    ['seeding', 'Seeding'],
    ['paused', 'Paused'],
    ['completed', 'Completed'],
    ['error', 'Error'],
    ['queued', 'Queued'],
    ['checking', 'Checking'],
    ['moving', 'Moving'],
  ];

  it.each(cases)('labels "%s" as "%s"', (status, expected) => {
    expect(getStatusLabel(status)).toBe(expected);
  });
});

// ─── getTorrentDetailedStateLabel ────────────────────────────────────────────

describe('getTorrentDetailedStateLabel', () => {
  it('preserves direction suffix for stopped states', () => {
    expect(getTorrentDetailedStateLabel('stoppedUP')).toBe('Paused (UP)');
    expect(getTorrentDetailedStateLabel('stoppedDL')).toBe('Paused (DL)');
  });

  it('labels forced states distinctly', () => {
    expect(getTorrentDetailedStateLabel('forcedUP')).toBe('Forced Upload');
    expect(getTorrentDetailedStateLabel('forcedDL')).toBe('Forced Download');
  });

  it('returns the raw state unchanged when unknown', () => {
    expect(getTorrentDetailedStateLabel('somethingNew')).toBe('somethingNew');
  });
});

// ─── formatTorrentStatus ─────────────────────────────────────────────────────

describe('formatTorrentStatus', () => {
  it('uses the normalized display-status label when a torrent is provided', () => {
    // forcedUP normalizes to "seeding" -> "Seeding" (not the detailed "Forced Upload")
    expect(formatTorrentStatus('forcedUP', makeTorrent({ state: 'forcedUP' }))).toBe('Seeding');
  });

  it('uses the summary state label when no torrent is provided', () => {
    expect(formatTorrentStatus('stalledDL')).toBe('Stalled');
  });

  it('returns the raw state when no torrent is provided and the state is unknown', () => {
    expect(formatTorrentStatus('mysteryState')).toBe('mysteryState');
  });
});

// ─── toStatusBadgeStatus ─────────────────────────────────────────────────────

describe('toStatusBadgeStatus', () => {
  it('maps "queued" to "inactive"', () => {
    expect(toStatusBadgeStatus('queued')).toBe('inactive');
  });

  it('passes other statuses through unchanged', () => {
    expect(toStatusBadgeStatus('downloading')).toBe('downloading');
    expect(toStatusBadgeStatus('seeding')).toBe('seeding');
    expect(toStatusBadgeStatus('error')).toBe('error');
  });
});

// ─── getStatusColorClass ─────────────────────────────────────────────────────

describe('getStatusColorClass', () => {
  it('returns badge classes with border/bg/text for downloading', () => {
    expect(getStatusColorClass('downloading', 'badge')).toBe(
      'border-status-downloading bg-status-downloading-15 text-status-downloading'
    );
  });

  it('returns a solid background for non-badge variants', () => {
    expect(getStatusColorClass('downloading', 'bar')).toBe('bg-status-downloading');
    expect(getStatusColorClass('downloading', 'progress')).toBe('bg-status-downloading');
  });

  it('treats completed like seeding', () => {
    expect(getStatusColorClass('completed', 'bar')).toBe('bg-status-seeding');
    expect(getStatusColorClass('seeding', 'bar')).toBe('bg-status-seeding');
  });

  it('treats moving like checking', () => {
    expect(getStatusColorClass('moving', 'bar')).toBe('bg-status-checking');
    expect(getStatusColorClass('checking', 'bar')).toBe('bg-status-checking');
  });

  it('uses error tokens for the error status', () => {
    expect(getStatusColorClass('error', 'badge')).toBe('border-error bg-error-20 text-error');
  });

  it('falls back to paused tokens for paused and queued', () => {
    expect(getStatusColorClass('paused', 'bar')).toBe('bg-status-paused');
    expect(getStatusColorClass('queued', 'bar')).toBe('bg-status-paused');
  });
});

// ─── Label table integrity ───────────────────────────────────────────────────

describe('state label tables', () => {
  it('define the same set of raw states', () => {
    expect(Object.keys(TORRENT_DETAILED_STATE_LABELS).sort()).toEqual(
      Object.keys(TORRENT_STATE_LABELS).sort()
    );
  });
});
