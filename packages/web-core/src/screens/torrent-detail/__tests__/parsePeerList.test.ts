import { describe, expect, it } from 'vitest';
import { parsePeerList } from '../useTorrentDetailController';

describe('parsePeerList', () => {
  it('parses a single host:port entry', () => {
    expect(parsePeerList('1.2.3.4:6881')).toEqual(['1.2.3.4:6881']);
  });

  it('splits on commas, whitespace, and newlines', () => {
    expect(parsePeerList('1.2.3.4:6881, 5.6.7.8:1234\n9.10.11.12:51413')).toEqual([
      '1.2.3.4:6881',
      '5.6.7.8:1234',
      '9.10.11.12:51413',
    ]);
  });

  it('trims surrounding whitespace on each entry', () => {
    expect(parsePeerList('  1.2.3.4:6881  ')).toEqual(['1.2.3.4:6881']);
  });

  it('de-duplicates repeated peers while preserving first-seen order', () => {
    expect(parsePeerList('1.2.3.4:6881, 5.6.7.8:1234, 1.2.3.4:6881')).toEqual([
      '1.2.3.4:6881',
      '5.6.7.8:1234',
    ]);
  });

  it('keeps bracketed IPv6 host:port entries', () => {
    expect(parsePeerList('[2001:db8::1]:6881')).toEqual(['[2001:db8::1]:6881']);
  });

  it('drops entries without a port', () => {
    expect(parsePeerList('1.2.3.4, 5.6.7.8:1234')).toEqual(['5.6.7.8:1234']);
  });

  it('drops entries with a non-numeric port', () => {
    expect(parsePeerList('1.2.3.4:abc, 5.6.7.8:1234')).toEqual(['5.6.7.8:1234']);
  });

  it('drops entries with a trailing empty port', () => {
    expect(parsePeerList('1.2.3.4:, 5.6.7.8:1234')).toEqual(['5.6.7.8:1234']);
  });

  it('returns an empty array for empty or whitespace-only input', () => {
    expect(parsePeerList('')).toEqual([]);
    expect(parsePeerList('   \n  ')).toEqual([]);
  });
});
