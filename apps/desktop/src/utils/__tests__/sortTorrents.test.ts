import { describe, it, expect } from 'vitest';
import { sortTorrents } from '@taurent/shared/utils/sortTorrents';
import { createTorrent, createTorrentList } from '../../testing/fixtures/torrent';
import type { Torrent } from '@taurent/shared/types/qbittorrent';

describe('sortTorrents', () => {
  it('does not mutate input array', () => {
    const list = createTorrentList(10);
    const originalRefs = list.map((t) => t);
    sortTorrents(list, 'name', 'asc');
    // Input array is unchanged
    expect(list.map((t) => t)).toEqual(originalRefs);
  });

  describe('eta -1 sorts as Infinity behavior', () => {
    it('eta -1 sorts last (Infinity) in asc order', () => {
      const torrents: Torrent[] = [
        { ...createTorrent(0), eta: 60 },
        { ...createTorrent(1), eta: -1 },
        { ...createTorrent(2), eta: 30 },
      ];
      const result = sortTorrents(torrents, 'eta', 'asc');
      expect(result[result.length - 1].eta).toBe(-1);
    });

    it('eta -1 sorts last (Infinity) in desc order', () => {
      const torrents: Torrent[] = [
        { ...createTorrent(0), eta: 60 },
        { ...createTorrent(1), eta: -1 },
        { ...createTorrent(2), eta: 30 },
      ];
      const result = sortTorrents(torrents, 'eta', 'desc');
      // desc: largest first, so -1/Infinity should be first
      expect(result[0].eta).toBe(-1);
    });
  });

  describe('expected ordering — name', () => {
    it('sorts name asc correctly', () => {
      const list: Torrent[] = [
        { ...createTorrent(0), name: 'Zebra' },
        { ...createTorrent(1), name: 'Apple' },
        { ...createTorrent(2), name: 'Mango' },
      ];
      const result = sortTorrents(list, 'name', 'asc');
      expect(result[0].name).toBe('Apple');
      expect(result[1].name).toBe('Mango');
      expect(result[2].name).toBe('Zebra');
    });

    it('sorts name desc correctly', () => {
      const list: Torrent[] = [
        { ...createTorrent(0), name: 'Zebra' },
        { ...createTorrent(1), name: 'Apple' },
        { ...createTorrent(2), name: 'Mango' },
      ];
      const result = sortTorrents(list, 'name', 'desc');
      expect(result[0].name).toBe('Zebra');
      expect(result[1].name).toBe('Mango');
      expect(result[2].name).toBe('Apple');
    });
  });

  describe('expected ordering — progress', () => {
    it('sorts progress asc correctly', () => {
      const list: Torrent[] = [
        { ...createTorrent(0), progress: 0.8 },
        { ...createTorrent(1), progress: 0.1 },
        { ...createTorrent(2), progress: 0.5 },
      ];
      const result = sortTorrents(list, 'progress', 'asc');
      expect(result[0].progress).toBe(0.1);
      expect(result[1].progress).toBe(0.5);
      expect(result[2].progress).toBe(0.8);
    });

    it('sorts progress desc correctly', () => {
      const list: Torrent[] = [
        { ...createTorrent(0), progress: 0.8 },
        { ...createTorrent(1), progress: 0.1 },
        { ...createTorrent(2), progress: 0.5 },
      ];
      const result = sortTorrents(list, 'progress', 'desc');
      expect(result[0].progress).toBe(0.8);
      expect(result[1].progress).toBe(0.5);
      expect(result[2].progress).toBe(0.1);
    });
  });

  describe('expected ordering — size', () => {
    it('sorts size asc correctly', () => {
      const list: Torrent[] = [
        { ...createTorrent(0), size: 500 },
        { ...createTorrent(1), size: 100 },
        { ...createTorrent(2), size: 300 },
      ];
      const result = sortTorrents(list, 'size', 'asc');
      expect(result[0].size).toBe(100);
      expect(result[1].size).toBe(300);
      expect(result[2].size).toBe(500);
    });
  });

  describe('performance structural assertions', () => {
    function relativeMs(cb: () => void): number {
      const start = performance.now();
      cb();
      return performance.now() - start;
    }

    it('sortTorrents 1000 items under 60ms', () => {
      const list = createTorrentList(1000);
      const elapsed = relativeMs(() => sortTorrents(list, 'name', 'asc'));
      expect(elapsed).toBeLessThan(60);
    });

    it('sortTorrents 5000 items under 200ms', () => {
      const list = createTorrentList(5000);
      const elapsed = relativeMs(() => sortTorrents(list, 'name', 'asc'));
      expect(elapsed).toBeLessThan(200);
    });

    it('output length correct for 1000 items', () => {
      const list = createTorrentList(1000);
      const result = sortTorrents(list, 'name', 'asc');
      expect(result).toHaveLength(1000);
    });

    it('output length correct for 5000 items', () => {
      const list = createTorrentList(5000);
      const result = sortTorrents(list, 'name', 'asc');
      expect(result).toHaveLength(5000);
    });

    it('returns new array (does not mutate input)', () => {
      const list = createTorrentList(100);
      const result = sortTorrents(list, 'name', 'asc');
      expect(result).not.toBe(list);
    });
  });
});