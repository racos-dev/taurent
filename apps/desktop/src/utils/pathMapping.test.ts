import { describe, expect, it } from 'vitest';
import { buildServerTargetPath, dirname } from './pathMapping';

describe('buildServerTargetPath', () => {
  // -------------------------------------------------------------------------
  // qBittorrent contract (per project specification):
  //   - files[].name  = torrent-relative path
  //   - content_path  = absolute content root for multifile torrents,
  //                     absolute file path for single-file torrents
  //   - repo does NOT expose root_path
  // -------------------------------------------------------------------------

  describe('single-file torrent', () => {
    it('returns contentPath as-is', () => {
      // contentPath points directly to the file
      const result = buildServerTargetPath(
        '/data/torrents/myfile.tar.gz',
        'myfile.tar.gz', // rowPath (unused for single-file)
        true,
      );
      expect(result).toBe('/data/torrents/myfile.tar.gz');
    });
  });

  describe('multi-file torrent — qBittorrent examples', () => {
    // contentPath = '/data/torrents/FolderB'  (torrent root = FolderB)
    // files:
    //   - name: 'FolderB/file1.txt'        → target: /data/torrents/FolderB/file1.txt
    //   - name: 'FolderB/sub/file2.txt'    → target: /data/torrents/FolderB/sub/file2.txt
    //   - name: 'FolderB'                   → target: /data/torrents/FolderB

    it('builds target path for a top-level file', () => {
      const result = buildServerTargetPath(
        '/data/torrents/FolderB',
        'FolderB/file1.txt',
        false,
      );
      expect(result).toBe('/data/torrents/FolderB/file1.txt');
    });

    it('builds target path for a nested file', () => {
      const result = buildServerTargetPath(
        '/data/torrents/FolderB',
        'FolderB/sub/file2.txt',
        false,
      );
      expect(result).toBe('/data/torrents/FolderB/sub/file2.txt');
    });

    it('builds target path when rowPath equals the root segment (top-level folder)', () => {
      const result = buildServerTargetPath(
        '/data/torrents/FolderB',
        'FolderB',
        false,
      );
      expect(result).toBe('/data/torrents/FolderB');
    });

    it('deduplicates the root segment when rowPath starts with it', () => {
      // This is the key regression test: old code did
      //   dirname(contentPath + '/' + rowPath)
      // which for contentPath=/data/torrents/FolderB, rowPath=FolderB/file1.txt
      // would produce /data/torrents/FolderB/FolderB/file1.txt  ← DUPLICATED
      // Target-first via buildServerTargetPath gives: /data/torrents/FolderB/file1.txt  ✓
      const result = buildServerTargetPath(
        '/data/torrents/FolderB',
        'FolderB/file1.txt',
        false,
      );
      expect(result).toBe('/data/torrents/FolderB/file1.txt');
    });

    it('handles deeply nested paths with duplicate root segment', () => {
      const result = buildServerTargetPath(
        '/data/torrents/FolderB',
        'FolderB/sub/deep/file3.txt',
        false,
      );
      expect(result).toBe('/data/torrents/FolderB/sub/deep/file3.txt');
    });
  });

  describe('contentPath with and without trailing slash', () => {
    it('strips trailing slash from contentPath', () => {
      const result = buildServerTargetPath(
        '/data/torrents/FolderB/',
        'FolderB/file1.txt',
        false,
      );
      expect(result).toBe('/data/torrents/FolderB/file1.txt');
    });

    it('handles contentPath without trailing slash', () => {
      const result = buildServerTargetPath(
        '/data/torrents/FolderB',
        'FolderB/file1.txt',
        false,
      );
      expect(result).toBe('/data/torrents/FolderB/file1.txt');
    });
  });

  describe('Windows-style contentPath', () => {
    it('handles Windows backslash separators in contentPath', () => {
      const result = buildServerTargetPath(
        'D:\\Downloads\\FolderB',
        'FolderB/file1.txt',
        false,
      );
      // The function normalizes to forward slashes, so the result uses /
      expect(result).toBe('D:/Downloads/FolderB/file1.txt');
    });

    it('prevents duplicated root segment with Windows contentPath', () => {
      // key regression: contentPath=D:\Downloads\FolderB, rowPath=FolderB/file1.txt
      // must NOT produce D:/Downloads/FolderB/FolderB/file1.txt
      const result = buildServerTargetPath(
        'D:\\Downloads\\FolderB',
        'FolderB/file1.txt',
        false,
      );
      expect(result).toBe('D:/Downloads/FolderB/file1.txt');
    });

    it('prevents duplicated root segment when rowPath equals root segment (Windows)', () => {
      const result = buildServerTargetPath(
        'D:\\Downloads\\FolderB',
        'FolderB',
        false,
      );
      expect(result).toBe('D:/Downloads/FolderB');
    });

    it('deduplicates root segment when contentPath is a nested subfolder (Windows)', () => {
      // contentPath rootName = "deep"; rowPath starts with "deep/" → strip "deep/" prefix
      const result = buildServerTargetPath(
        'D:\\Downloads\\FolderB\\sub\\deep',
        'deep/file3.txt', // rowPath includes the root segment "deep"
        false,
      );
      expect(result).toBe('D:/Downloads/FolderB/sub/deep/file3.txt');
    });

    it('normalizes trailing backslashes in contentPath', () => {
      const result = buildServerTargetPath(
        'D:\\Downloads\\FolderB\\',
        'FolderB/file1.txt',
        false,
      );
      expect(result).toBe('D:/Downloads/FolderB/file1.txt');
    });

    it('returns single-file Windows path as-is', () => {
      const result = buildServerTargetPath(
        'D:\\Downloads\\myfile.tar.gz',
        'myfile.tar.gz',
        true,
      );
      expect(result).toBe('D:/Downloads/myfile.tar.gz');
    });
  });

  describe('dirname helper', () => {
    it('returns directory portion of a path', () => {
      expect(dirname('/data/torrents/FolderB/file1.txt')).toBe('/data/torrents/FolderB');
    });

    it('returns directory of root-level file', () => {
      expect(dirname('/data/torrents/file1.txt')).toBe('/data/torrents');
    });

    it('handles paths without slashes', () => {
      // No slash means the "directory" is the path itself (relative path with no dir component)
      expect(dirname('file1.txt')).toBe('file1.txt');
    });

    it('handles Windows-style backslash separators', () => {
      expect(dirname('D:\\Downloads\\FolderB\\file1.txt')).toBe('D:/Downloads/FolderB');
    });

    it('handles Windows-style path with trailing backslash', () => {
      // path.replace(/[\\/]+$/, '') strips trailing backslashes FIRST, then replace(/\\/g, '/')
      // converts remaining backslashes to forward slashes
      // So 'D:\Downloads\FolderB\' → (strip trailing \) → 'D:\Downloads\FolderB' → (normalize) → 'D:/Downloads/FolderB'
      // dirname of that is the parent of the last segment = 'D:/Downloads'
      expect(dirname('D:\\Downloads\\FolderB\\')).toBe('D:/Downloads');
    });

    it('returns drive root for single-segment Windows path', () => {
      // For "D:\FolderB", after normalize → "D:/FolderB", lastSlash is at index 2 (before "FolderB")
      // dirname is substring(0, 2) = "D:"
      expect(dirname('D:\\FolderB')).toBe('D:');
    });

    it('handles mixed separators', () => {
      expect(dirname('D:\\Downloads/FolderB\\sub\\file.txt')).toBe('D:/Downloads/FolderB/sub');
    });
  });
});