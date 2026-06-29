import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Torrent, TorrentProperties, Tracker } from '@taurent/shared/types/qbittorrent';
import { TorrentDetailsOverviewSection } from './TorrentDetailsOverviewSection';
import { TorrentDetailsTrackersSection } from './TorrentDetailsTrackersSection';

function makeTorrent(overrides: Partial<Torrent> = {}): Torrent {
  return {
    added_on: 0,
    amount_left: 0,
    auto_tmm: false,
    availability: 1,
    category: '',
    completed: 0,
    completion_on: 0,
    content_path: '/downloads/test.iso',
    dl_limit: 0,
    dlspeed: 0,
    downloaded: 0,
    downloaded_session: 0,
    eta: -1,
    f_l_piece_prio: false,
    force_start: false,
    hash: 'hash',
    last_activity: 0,
    magnet_uri: '',
    max_ratio: -1,
    max_seeding_time: -1,
    name: 'Test torrent',
    num_complete: -1,
    num_incomplete: -1,
    num_leechs: -1,
    num_seeds: -1,
    priority: 0,
    progress: 0,
    ratio: -1,
    ratio_limit: -1,
    save_path: '/downloads',
    seeding_time: 0,
    seeding_time_limit: -1,
    seen_complete: 0,
    seq_dl: false,
    size: 0,
    state: 'downloading',
    super_seeding: false,
    tags: '',
    time_active: 0,
    total_size: 0,
    tracker: '',
    up_limit: 0,
    uploaded: 0,
    uploaded_session: 0,
    upspeed: 0,
    ...overrides,
  };
}

function makeProperties(overrides: Partial<TorrentProperties> = {}): TorrentProperties {
  return {
    save_path: '/downloads',
    creation_date: 0,
    piece_size: 0,
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
    nb_connections: -1,
    nb_connections_limit: -1,
    share_ratio: -1,
    addition_date: 0,
    completion_date: 0,
    created_by: '',
    dl_speed_avg: 0,
    dl_speed: 0,
    eta: -1,
    last_seen: 0,
    peers: -1,
    peers_total: -1,
    pieces_have: -1,
    pieces_num: -1,
    reannounce: -1,
    seeds: -1,
    seeds_total: -1,
    total_size: 0,
    up_speed_avg: 0,
    up_speed: 0,
    isPrivate: false,
    ...overrides,
  };
}

describe('torrent detail formatting', () => {
  it('masks unavailable mobile overview values', () => {
    const { container, getByText } = render(
      <TorrentDetailsOverviewSection
        variant="mobile"
        torrent={makeTorrent({ availability: -1 })}
        properties={makeProperties()}
      />,
    );

    expect(getByText('Availability').parentElement?.textContent).toBe('Availability-');
    expect(container.textContent).not.toContain('-1.00x');
  });

  it('masks unavailable tracker stats on mobile cards', () => {
    const trackers: Tracker[] = [{
      url: 'udp://tracker.example.test:1337/announce',
      status: 2,
      tier: -1,
      num_peers: -1,
      num_seeds: -1,
      num_leeches: -1,
      num_downloaded: -1,
      msg: '',
    }];

    const { container, getByText } = render(
      <TorrentDetailsTrackersSection variant="mobile" trackers={trackers} />,
    );

    expect(getByText('Tier -')).toBeTruthy();
    expect(getByText('Seeds -')).toBeTruthy();
    expect(getByText('Peers -')).toBeTruthy();
    expect(getByText('Downloads -')).toBeTruthy();
    expect(container.textContent).not.toContain('Tier -1');
  });
});
