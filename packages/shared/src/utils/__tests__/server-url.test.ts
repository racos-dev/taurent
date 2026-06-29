import { describe, expect, it } from 'vitest';
import { normalizeServerUrl } from '../server-url';

describe('normalizeServerUrl', () => {
  it('removes trailing slash', () => {
    expect(normalizeServerUrl('http://example.com/')).toBe('http://example.com');
    expect(normalizeServerUrl('http://example.com/subdir/')).toBe('http://example.com/subdir');
  });

  it('removes /api/v2 suffix', () => {
    expect(normalizeServerUrl('http://example.com/api/v2')).toBe('http://example.com');
    expect(normalizeServerUrl('http://example.com:8080/api/v2')).toBe('http://example.com:8080');
  });

  it('removes trailing slash before /api/v2', () => {
    expect(normalizeServerUrl('http://example.com/subdir/api/v2')).toBe('http://example.com/subdir');
  });

  it('adds https:// prefix when missing', () => {
    expect(normalizeServerUrl('example.com')).toBe('https://example.com');
    expect(normalizeServerUrl('example.com:8080')).toBe('https://example.com:8080');
    expect(normalizeServerUrl('192.168.1.1')).toBe('https://192.168.1.1');
    expect(normalizeServerUrl('192.168.1.1:8080')).toBe('https://192.168.1.1:8080');
  });

  it('preserves https when specified', () => {
    expect(normalizeServerUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeServerUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeServerUrl('https://example.com/api/v2')).toBe('https://example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeServerUrl('  http://example.com  ')).toBe('http://example.com');
  });

  it('handles full URL with path and trailing slash', () => {
    expect(normalizeServerUrl('http://example.com/qbittorrent/')).toBe('http://example.com/qbittorrent');
  });

  it('handles URL that already has http:// and no trailing issues', () => {
    expect(normalizeServerUrl('http://example.com')).toBe('http://example.com');
  });

  it('does not double-add protocol', () => {
    expect(normalizeServerUrl('http://example.com')).toBe('http://example.com');
  });
});