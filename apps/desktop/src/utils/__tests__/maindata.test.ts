import { describe, it, expect } from 'vitest';
import { mergeMaindata } from '@taurent/shared/utils/maindata';
import {
  createFullMaindataDelta,
  createMaindataState,
} from '../../testing/fixtures/torrent';

describe('mergeMaindata', () => {
  describe('full update', () => {
    it('normalizes hash onto every torrent', () => {
      const delta = createFullMaindataDelta(5);
      // delta torrents don't have hash inside them — mergeMaindata injects it
      const result = mergeMaindata(null, delta);

      for (const [hash, torrent] of Object.entries(result.torrents)) {
        expect(torrent.hash).toBe(hash);
      }
    });

    it('sorts tags', () => {
      const delta = createFullMaindataDelta(0);
      expect(delta.tags).toEqual(['tag-c', 'tag-a', 'tag-b']);
      const result = mergeMaindata(null, delta);
      expect(result.tags).toEqual(['tag-a', 'tag-b', 'tag-c']);
    });

    it('replaces all torrents on full_update=true', () => {
      const state = createMaindataState(3);
      const newDelta = createFullMaindataDelta(5);
      const result = mergeMaindata(state, newDelta);

      expect(Object.keys(result.torrents)).toHaveLength(5);
    });
  });

  describe('incremental delta', () => {
    it('preserves unchanged torrent object identity when unrelated torrent changes', () => {
      const state = createMaindataState(5);
      const unmodifiedHash = Object.keys(state.torrents)[0];
      const unmodifiedTorrent = state.torrents[unmodifiedHash];

      // Delta that modifies a different hash
      const modifyHash = Object.keys(state.torrents)[1];
      const delta = {
        rid: 2,
        full_update: false,
        torrents: {
          [modifyHash]: { ...state.torrents[modifyHash], name: 'Modified Name' },
        },
        torrents_removed: [],
        server_state: {
          dl_info_speed: 1024 * 1024,
          dl_info_data: 0,
          up_info_speed: 0,
          up_info_data: 0,
          dl_rate_limit: 0,
          up_rate_limit: 0,
          dht_nodes: 0,
          connection_status: 'connected',
          queueing: false,
          use_alt_speed_limits: false,
          refresh_interval: 1500,
        },
      };

      const result = mergeMaindata(state, delta);

      // Unrelated torrent reference must be preserved
      expect(result.torrents[unmodifiedHash]).toBe(unmodifiedTorrent);
    });

    it('removes torrents via torrents_removed', () => {
      const state = createMaindataState(5);
      const hashes = Object.keys(state.torrents);
      const toRemove = hashes[1];

      const delta = {
        rid: 2,
        full_update: false,
        torrents: {},
        torrents_removed: [toRemove],
        server_state: {
          dl_info_speed: 0,
          dl_info_data: 0,
          up_info_speed: 0,
          up_info_data: 0,
          dl_rate_limit: 0,
          up_rate_limit: 0,
          dht_nodes: 0,
          connection_status: 'connected',
          queueing: false,
          use_alt_speed_limits: false,
          refresh_interval: 1500,
        },
      };

      const result = mergeMaindata(state, delta);

      expect(result.torrents[toRemove]).toBeUndefined();
      expect(Object.keys(result.torrents)).toHaveLength(4);
    });

    it('removes categories via categories_removed', () => {
      const state = createMaindataState(0);
      expect(state.categories['audio']).toBeDefined();

      const delta = {
        rid: 2,
        full_update: false,
        categories: {},
        categories_removed: ['audio'],
        server_state: {
          dl_info_speed: 0,
          dl_info_data: 0,
          up_info_speed: 0,
          up_info_data: 0,
          dl_rate_limit: 0,
          up_rate_limit: 0,
          dht_nodes: 0,
          connection_status: 'connected',
          queueing: false,
          use_alt_speed_limits: false,
          refresh_interval: 1500,
        },
      };

      const result = mergeMaindata(state, delta);

      expect(result.categories['audio']).toBeUndefined();
    });

    it('removes tags via tags_removed', () => {
      const state = createMaindataState(0);
      expect(state.tags).toContain('tag-c');

      const delta = {
        rid: 2,
        full_update: false,
        tags: [],
        tags_removed: ['tag-c'],
        server_state: {
          dl_info_speed: 0,
          dl_info_data: 0,
          up_info_speed: 0,
          up_info_data: 0,
          dl_rate_limit: 0,
          up_rate_limit: 0,
          dht_nodes: 0,
          connection_status: 'connected',
          queueing: false,
          use_alt_speed_limits: false,
          refresh_interval: 1500,
        },
      };

      const result = mergeMaindata(state, delta);

      expect(result.tags).not.toContain('tag-c');
    });

    it('merges server_state fields incrementally', () => {
      const state = createMaindataState(0);

      const delta = {
        rid: 2,
        full_update: false,
        server_state: {
          dl_info_speed: 999 * 1024,
          dl_info_data: 0,
          up_info_speed: 0,
          up_info_data: 0,
          dl_rate_limit: 0,
          up_rate_limit: 0,
          dht_nodes: 0,
          connection_status: 'connected',
          queueing: false,
          use_alt_speed_limits: false,
          refresh_interval: 3000,
        },
      };

      const result = mergeMaindata(state, delta);

      expect(result.server_state!.dl_info_speed).toBe(999 * 1024);
      // Other fields from original state are preserved
      expect(result.server_state!.refresh_interval).toBe(3000);
    });
  });

  describe('performance — structural assertions', () => {
    it('output size correct for 1000 torrents', () => {
      const state = createMaindataState(0);
      const delta = createFullMaindataDelta(1000);
      const result = mergeMaindata(state, delta);
      expect(Object.keys(result.torrents)).toHaveLength(1000);
    });

    it('output size correct for 5000 torrents', () => {
      const state = createMaindataState(0);
      const delta = createFullMaindataDelta(5000);
      const result = mergeMaindata(state, delta);
      expect(Object.keys(result.torrents)).toHaveLength(5000);
    });

    it('incremental delta on 5000 torrents preserves identity for unchanged entries', () => {
      const state = createMaindataState(5000);
      const unmodifiedHash = Object.keys(state.torrents)[0];
      const unmodifiedTorrent = state.torrents[unmodifiedHash];

      const modifyHash = Object.keys(state.torrents)[1];
      const delta = {
        rid: 2,
        full_update: false,
        torrents: {
          [modifyHash]: { ...state.torrents[modifyHash], name: 'Changed' },
        },
        torrents_removed: [],
        server_state: {
          dl_info_speed: 0,
          dl_info_data: 0,
          up_info_speed: 0,
          up_info_data: 0,
          dl_rate_limit: 0,
          up_rate_limit: 0,
          dht_nodes: 0,
          connection_status: 'connected',
          queueing: false,
          use_alt_speed_limits: false,
          refresh_interval: 1500,
        },
      };

      const result = mergeMaindata(state, delta);

      expect(result.torrents[unmodifiedHash]).toBe(unmodifiedTorrent);
      expect(result.torrents[modifyHash].name).toBe('Changed');
    });
  });
});
