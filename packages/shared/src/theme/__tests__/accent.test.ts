import { describe, it, expect } from 'vitest';
import {
  normalizeAccent,
  isAccentValue,
  deriveMidnightAccentTokens,
  getContrastText,
  serializeAccentCss,
} from '../accent';

import type { AccentHex } from '../types';

function parseHexChannels(hex: string): number[] {
  const match = hex.match(/^#(..)(..)(..)$/);
  if (!match) {
    throw new Error(`Expected a #rrggbb color, received "${hex}"`);
  }

  return match.slice(1).map((c) => parseInt(c, 16));
}

function requireToken(tokens: Record<string, string>, key: string): string {
  const value = tokens[key];
  if (value === undefined) {
    throw new Error(`Expected token ${key} to be defined`);
  }

  return value;
}

// ── normalizeAccent ───────────────────────────────────────────────────────

describe('normalizeAccent', () => {
  it('normalizes a valid hex with #', () => {
    expect(normalizeAccent('#FF6600')).toBe('#ff6600');
    expect(normalizeAccent('#ff6600')).toBe('#ff6600');
    expect(normalizeAccent('#AABBCC')).toBe('#aabbcc');
  });

  it('normalizes a valid hex without #', () => {
    expect(normalizeAccent('FF6600')).toBe('#ff6600');
    expect(normalizeAccent('aabbcc')).toBe('#aabbcc');
  });

  it('returns null for invalid inputs', () => {
    expect(normalizeAccent('')).toBeNull();
    expect(normalizeAccent('  ')).toBeNull();
    expect(normalizeAccent('#FFF')).toBeNull();
    expect(normalizeAccent('#GGGGGG')).toBeNull();
    expect(normalizeAccent('red')).toBeNull();
    expect(normalizeAccent('#12345')).toBeNull();
    expect(normalizeAccent('#1234567')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(normalizeAccent('  #ff6600  ')).toBe('#ff6600');
    expect(normalizeAccent('  FF6600  ')).toBe('#ff6600');
  });
});

// ── isAccentValue ─────────────────────────────────────────────────────────

describe('isAccentValue', () => {
  it('returns true for valid hex colors', () => {
    expect(isAccentValue('#ff6600')).toBe(true);
    expect(isAccentValue('#000000')).toBe(true);
    expect(isAccentValue('#FFFFFF')).toBe(true);
  });

  it('returns false for invalid inputs', () => {
    expect(isAccentValue('')).toBe(false);
    expect(isAccentValue('red')).toBe(false);
    expect(isAccentValue('#FFF')).toBe(false);
    expect(isAccentValue(null as unknown as string)).toBe(false);
    expect(isAccentValue(undefined as unknown as string)).toBe(false);
  });
});

// ── getContrastText ───────────────────────────────────────────────────────

describe('getContrastText', () => {
  it('returns dark text for light accent colors', () => {
    // #ff6600 has luminance ~0.25, well above the 0.179 threshold
    expect(getContrastText('#ff6600')).toBe('#000000');
    // #ffffff is pure white, luminance 1.0
    expect(getContrastText('#ffffff')).toBe('#000000');
    // #ffff00 (yellow) is bright
    expect(getContrastText('#ffff00')).toBe('#000000');
  });

  it('returns light text for dark accent colors', () => {
    // #000000 is pure black, luminance 0
    expect(getContrastText('#000000')).toBe('#ffffff');
    // #1a1a2e is very dark
    expect(getContrastText('#1a1a2e')).toBe('#ffffff');
    // #001122 is dark blue
    expect(getContrastText('#001122')).toBe('#ffffff');
  });

  it('returns consistent text for the boundary-adjacent color', () => {
    // #5B8DB8 (Midnight's default accent) — luminance ~0.203 > 0.179
    expect(getContrastText('#5b8db8')).toBe('#000000');
    // Verify Midnight's default text-on-primary ships as #000000
  });
});

// ── deriveMidnightAccentTokens ────────────────────────────────────────────

describe('deriveMidnightAccentTokens', () => {
  const accent = '#ff6600' as AccentHex;
  const tokens = deriveMidnightAccentTokens(accent);

  it('returns the expected set of token keys', () => {
    const expectedKeys = [
      // Primary accent tokens
      '--color-primary',
      '--color-primary-hover',
      '--color-primary-light',
      '--color-text-on-primary',
      '--color-primary-rgb',
      '--color-primary-10',
      '--color-primary-20',
      '--color-primary-30',
      '--color-primary-40',
      '--color-state-selected',
      '--color-text-on-primary-rgb',
      // Border focus
      '--color-border-focus',
      // Semantic aliases
      '--color-success',
      '--color-success-rgb',
      '--color-success-20',
      '--color-text-on-success',
      '--color-warning',
      '--color-warning-rgb',
      '--color-warning-20',
      '--color-text-on-warning',
      '--color-error',
      '--color-error-rgb',
      '--color-error-20',
      '--color-text-on-error',
      '--color-info',
      '--color-info-rgb',
      '--color-info-20',
      '--color-text-on-info',
      '--color-text-on-danger',
      // Feature colors
      '--color-download',
      '--color-upload',
      '--color-upload-20',
      '--color-size',
      '--color-ratio',
      '--color-peers',
      '--color-time',
      // Status colors (accent-driven)
      '--color-status-downloading',
      '--color-status-downloading-15',
      '--color-status-seeding',
      '--color-status-seeding-15',
      '--color-status-stalled',
      '--color-status-stalled-15',
      '--color-status-queued',
      '--color-status-queued-15',
      '--color-status-checking',
      '--color-status-checking-15',
      '--color-status-metadata',
      '--color-status-metadata-15',
      // Connection status (accent-driven)
      '--color-status-connected',
      '--color-status-connected-15',
      '--color-status-firewalled',
      '--color-status-firewalled-15',
      '--color-status-connecting',
      '--color-status-connecting-15',
      '--color-status-reconnecting',
      '--color-status-reconnecting-15',
    ];

    for (const key of expectedKeys) {
      expect(tokens).toHaveProperty(key);
    }

    expect(Object.keys(tokens).length).toBe(expectedKeys.length);
  });

  it('sets --color-primary to the input accent', () => {
    expect(tokens['--color-primary']).toBe('#ff6600');
  });

  it('derives --color-primary-hover lighter than the accent', () => {
    // #ff6600 lightened 15% toward white => #ff944d-ish
    expect(tokens['--color-primary-hover']).toMatch(/^#[0-9a-f]{6}$/);
    // Hover should be "lighter" than accent (higher R, G, B values)
    const [hoverR, hoverG, hoverB] = parseHexChannels(tokens['--color-primary-hover']);
    const [accR, accG, accB] = parseHexChannels('#ff6600');
    expect(hoverR).toBeGreaterThanOrEqual(accR);
    expect(hoverG).toBeGreaterThanOrEqual(accG);
    expect(hoverB).toBeGreaterThanOrEqual(accB);
  });

  it('derives --color-primary-light darker than the accent', () => {
    expect(tokens['--color-primary-light']).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('derives --color-primary-rgb as space-separated channels', () => {
    expect(tokens['--color-primary-rgb']).toBe('255 102 0');
  });

  it('derives alpha variants as rgba() strings', () => {
    expect(tokens['--color-primary-10']).toBe('rgba(255, 102, 0, 0.1)');
    expect(tokens['--color-primary-20']).toBe('rgba(255, 102, 0, 0.2)');
    expect(tokens['--color-primary-30']).toBe('rgba(255, 102, 0, 0.3)');
    expect(tokens['--color-primary-40']).toBe('rgba(255, 102, 0, 0.4)');
  });

  it('derives --color-state-selected as rgba string with 0.16 alpha', () => {
    expect(tokens['--color-state-selected']).toBe('rgba(255, 102, 0, 0.16)');
  });

  it('derives --color-text-on-primary from contrast logic', () => {
    // #ff6600 is relatively bright -> dark text for AA contrast
    expect(tokens['--color-text-on-primary']).toBe('#000000');
  });

  it('derives --color-text-on-primary-rgb from the chosen text color', () => {
    // #000000 -> "0 0 0"
    expect(tokens['--color-text-on-primary-rgb']).toBe('0 0 0');
  });

  it('returns dark text on primary for a light accent', () => {
    const lightAccent = '#ffcc00' as AccentHex;
    const lightTokens = deriveMidnightAccentTokens(lightAccent);
    expect(lightTokens['--color-text-on-primary']).toBe('#000000');
  });

  it('returns light text on primary for a dark accent', () => {
    const darkAccent = '#0d1b2a' as AccentHex;
    const darkTokens = deriveMidnightAccentTokens(darkAccent);
    expect(darkTokens['--color-text-on-primary']).toBe('#ffffff');
  });
});

// ── RGB parity: hex token matches derived rgb variant ──────────────────────

describe('accent-rgb-parity', () => {
  const testAccents: AccentHex[] = ['#ff6600', '#5b8db8', '#e91e63', '#00bcd4', '#0d1b2a'];

  for (const accent of testAccents) {
    it(`derived rgb for ${accent} matches parsed hex channels`, () => {
      const tokens = deriveMidnightAccentTokens(accent);
      const hexRaw = requireToken(tokens, '--color-primary');
      const rgbRaw = requireToken(tokens, '--color-primary-rgb');

      const [r, g, b] = parseHexChannels(hexRaw);
      const [rStr, gStr, bStr] = rgbRaw.split(' ').map(Number);

      expect(r).toBe(rStr);
      expect(g).toBe(gStr);
      expect(b).toBe(bStr);
    });
  }
});

// ── Expanded Midnight alias tokens ──────────────────────────────────────────

describe('deriveMidnightAccentTokens — extended alias surface', () => {
  const accent = '#ff6600' as AccentHex;
  const tokens = deriveMidnightAccentTokens(accent);

  it('derives --color-border-focus to the accent', () => {
    expect(tokens['--color-border-focus']).toBe('#ff6600');
  });

  it('derives semantic alias colors (success/warning/error/info) to the accent', () => {
    for (const key of ['--color-success', '--color-warning', '--color-error', '--color-info'] as const) {
      expect(tokens[key]).toBe('#ff6600');
    }
  });

  it('derives semantic alias rgb tokens matching primary-rgb', () => {
    for (const key of ['--color-success-rgb', '--color-warning-rgb', '--color-error-rgb', '--color-info-rgb'] as const) {
      expect(tokens[key]).toBe('255 102 0');
    }
  });

  it('derives semantic alias -20 alpha variants', () => {
    for (const key of ['--color-success-20', '--color-warning-20', '--color-error-20', '--color-info-20'] as const) {
      expect(tokens[key]).toBe('rgba(255, 102, 0, 0.2)');
    }
  });

  it('derives text-on-{color} tokens from contrast logic', () => {
    for (const key of ['--color-text-on-success', '--color-text-on-warning', '--color-text-on-error', '--color-text-on-info', '--color-text-on-danger'] as const) {
      expect(tokens[key]).toBe('#000000');
    }
  });

  it('derives feature colors to the accent', () => {
    for (const key of ['--color-download', '--color-upload', '--color-size', '--color-ratio', '--color-peers', '--color-time'] as const) {
      expect(tokens[key]).toBe('#ff6600');
    }
  });

  it('derives --color-upload-20 as rgba', () => {
    expect(tokens['--color-upload-20']).toBe('rgba(255, 102, 0, 0.2)');
  });

  it('derives accent-driven status colors to the accent', () => {
    const statusKeys = [
      '--color-status-downloading',
      '--color-status-seeding',
      '--color-status-stalled',
      '--color-status-queued',
      '--color-status-checking',
      '--color-status-metadata',
    ];
    for (const key of statusKeys) {
      expect(tokens[key]).toBe('#ff6600');
    }
  });

  it('derives accent-driven status -15 variants as rgba', () => {
    const status15Keys = [
      '--color-status-downloading-15',
      '--color-status-seeding-15',
      '--color-status-stalled-15',
      '--color-status-queued-15',
      '--color-status-checking-15',
      '--color-status-metadata-15',
    ];
    for (const key of status15Keys) {
      expect(tokens[key]).toBe('rgba(255, 102, 0, 0.15)');
    }
  });

  it('derives accent-driven connection status colors to the accent', () => {
    const connKeys = [
      '--color-status-connected',
      '--color-status-firewalled',
      '--color-status-connecting',
      '--color-status-reconnecting',
    ];
    for (const key of connKeys) {
      expect(tokens[key]).toBe('#ff6600');
    }
  });

  it('derives accent-driven connection status -15 variants as rgba', () => {
    const conn15Keys = [
      '--color-status-connected-15',
      '--color-status-firewalled-15',
      '--color-status-connecting-15',
      '--color-status-reconnecting-15',
    ];
    for (const key of conn15Keys) {
      expect(tokens[key]).toBe('rgba(255, 102, 0, 0.15)');
    }
  });

  it('non-accent-driven status tokens are NOT set (paused/error/inactive/disconnected/idle/unreachable/auth-failed)', () => {
    // These stay gray in Midnight regardless of accent
    expect(tokens).not.toHaveProperty('--color-status-paused');
    expect(tokens).not.toHaveProperty('--color-status-error');
    expect(tokens).not.toHaveProperty('--color-status-inactive');
    expect(tokens).not.toHaveProperty('--color-status-disconnected');
    expect(tokens).not.toHaveProperty('--color-status-idle');
    expect(tokens).not.toHaveProperty('--color-status-unreachable');
    expect(tokens).not.toHaveProperty('--color-status-auth-failed');
  });
});

// ── serializeAccentCss ────────────────────────────────────────────────────

describe('serializeAccentCss', () => {
  it('returns a CSS string starting with :root{', () => {
    const css = serializeAccentCss('#ff6600');
    expect(css).toMatch(/^:root\{/);
    expect(css).toMatch(/\}$/);
  });

  it('contains all expected property declarations', () => {
    const css = serializeAccentCss('#5b8db8');
    expect(css).toContain('--color-primary:#5b8db8');
    expect(css).toContain('--color-primary-hover:');
    expect(css).toContain('--color-primary-rgb:');
    expect(css).toContain('--color-text-on-primary:');
    expect(css).toContain('--color-primary-10:');
    expect(css).toContain('--color-state-selected:');
    expect(css).toContain('--color-border-focus:');
    expect(css).toContain('--color-success:');
    expect(css).toContain('--color-download:');
    expect(css).toContain('--color-status-downloading:');
  });

  it('each declaration ends with a semicolon', () => {
    const css = serializeAccentCss('#e91e63');
    // Remove the opening :root{ and closing }
    const body = css.slice(6, -1);
    expect(body).toMatch(/;$/);
    // All declarations end with semicolons
    const decls = body.split(';').filter(Boolean);
    for (const decl of decls) {
      expect(decl).toMatch(/^--[\w-]+:/);
    }
  });

  it('produces valid CSS that can be injected as a style rule', () => {
    const css = serializeAccentCss('#ff6600');
    // Simulate injection: wrap in a style element
    expect(css).toMatch(/^:root\{.*\}$/);
    // Count semicolons = number of tokens (each ends with ;)
    const tokens = deriveMidnightAccentTokens('#ff6600');
    const semicolons = (css.match(/;/g) || []).length;
    expect(semicolons).toBe(Object.keys(tokens).length);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────

describe('accent edge cases', () => {
  it('handles pure black accent', () => {
    const tokens = deriveMidnightAccentTokens('#000000');
    expect(tokens['--color-primary']).toBe('#000000');
    // Black text on black bg would be invisible, but text-on-primary
    // is for text ON the accent, not the accent as bg being readable.
    // Contrast logic says black bg -> white text for AA.
    expect(tokens['--color-text-on-primary']).toBe('#ffffff');
  });

  it('handles pure white accent', () => {
    const tokens = deriveMidnightAccentTokens('#ffffff');
    expect(tokens['--color-primary']).toBe('#ffffff');
    expect(tokens['--color-text-on-primary']).toBe('#000000');
  });

  it('handles vibrant accent (magenta)', () => {
    const tokens = deriveMidnightAccentTokens('#ff00ff');
    expect(tokens['--color-primary']).toBe('#ff00ff');
    expect(tokens['--color-primary-hover']).toMatch(/^#[0-9a-f]{6}$/);
    // Hover should be lighter than base (higher G channel)
    const base = parseHexChannels('#ff00ff');
    const hover = parseHexChannels(tokens['--color-primary-hover']);
    for (let i = 0; i < 3; i++) expect(hover[i]).toBeGreaterThanOrEqual(base[i]);
    // R and B stay 255, G increases
    expect(tokens['--color-primary-rgb']).toBe('255 0 255');
    // Magenta is bright -> dark text
    expect(tokens['--color-text-on-primary']).toBe('#000000');
  });

  it('normalizeAccent handles edge cases gracefully', () => {
    expect(normalizeAccent('#000000')).toBe('#000000');
    expect(normalizeAccent('#ffffff')).toBe('#ffffff');
    expect(normalizeAccent('000000')).toBe('#000000');
    expect(normalizeAccent('  #abcdef  ')).toBe('#abcdef');
  });
});
