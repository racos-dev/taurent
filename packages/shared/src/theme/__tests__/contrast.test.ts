import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContrastCheck {
  /** Foreground CSS variable token (e.g. `--color-text-primary`) */
  fg: string;
  /** Background CSS variable token – uses the shipped Tailwind path (-rgb variant when applicable) */
  bg: string;
  /** Minimum WCAG contrast ratio */
  minRatio: number;
  /** Human-readable label */
  label: string;
}

/** A pair of token names whose hex and rgb-variant values must agree. */
interface RgbParityPair {
  /** The `--color-X` hex token name */
  hex: string;
  /** The `--color-X-rgb` space-separated variant token name */
  rgb: string;
  /** For error messages */
  label: string;
}

// ─── CSS parsing ─────────────────────────────────────────────────────────────

const THEME_PATTERN = /\.(theme-[\w-]+)\s*\{([^}]+)\}/g;
const PROP_PATTERN = /--([\w-]+)\s*:\s*([^;]+);/g;

/** Extract per-theme token maps from the canonical themes.css file. */
function parseThemeTokens(
  css: string,
): Array<{ name: string; tokens: Record<string, string> }> {
  const themes: Array<{ name: string; tokens: Record<string, string> }> = [];
  let match: RegExpExecArray | null;

  while ((match = THEME_PATTERN.exec(css)) !== null) {
    const [, className, body] = match;
    const name = className.replace(/^theme-/, '');
    const tokens: Record<string, string> = {};
    let propMatch: RegExpExecArray | null;

    while ((propMatch = PROP_PATTERN.exec(body)) !== null) {
      tokens[`--${propMatch[1]}`] = propMatch[2].trim();
    }

    themes.push({ name, tokens });
  }

  return themes;
}

// ─── WCAG contrast helpers ───────────────────────────────────────────────────

function sRGBtoLin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

/** Parse hex (#rrggbb), rgb/rgba, or space-separated "r g b" into [R,G,B]. */
function parseColor(value: string): [number, number, number] | null {
  const v = value.trim();

  // #rrggbb
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    return [
      parseInt(v.slice(1, 3), 16),
      parseInt(v.slice(3, 5), 16),
      parseInt(v.slice(5, 7), 16),
    ];
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10),
    ];
  }

  // "r g b" space-separated (shipped --color-X-rgb: 38 139 210)
  const spacedMatch = v.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (spacedMatch) {
    return [
      parseInt(spacedMatch[1], 10),
      parseInt(spacedMatch[2], 10),
      parseInt(spacedMatch[3], 10),
    ];
  }

  return null;
}

function requireToken(tokens: Record<string, string>, key: string): string {
  const value = tokens[key];
  if (value === undefined) {
    throw new Error(`Expected token ${key} to be defined`);
  }

  return value;
}

function requireColor(value: string): [number, number, number] {
  const color = parseColor(value);
  if (color === null) {
    throw new Error(`Expected parseable color value, received "${value}"`);
  }

  return color;
}

/** WCAG 2.1 contrast ratio between two sRGB colours. */
function calcContrast(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const l1 = relativeLuminance(...fg);
  const l2 = relativeLuminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Test configuration ──────────────────────────────────────────────────────

/**
 * WCAG AA thresholds:
 *   - Normal text: 4.5:1
 *   - Large text (≥18px or ≥14px bold): 3:1
 *
 * Shipped semantic button/badge text in this app is small/normal text, so the
 * enforced threshold for those pairs is 4.5:1.
 *
 * Token names below use the **shipped Tailwind path**:
 *   - Background colours that Tailwind resolves through
 *     `rgb(var(--color-X-rgb) / <alpha-value>)` reference the `--color-X-rgb`
 *     token directly.
 *   - Foreground text colours that Tailwind resolves through
 *     `var(--color-Y)` reference the `--color-Y` hex token directly.
 */
const CHECKS: ContrastCheck[] = [
  // Normal text on page background – WCAG AA normal text (4.5:1)
  {
    fg: '--color-text-primary',
    bg: '--color-background-rgb',
    minRatio: 4.5,
    label: 'primary text on background',
  },
  {
    fg: '--color-text-secondary',
    bg: '--color-background-rgb',
    minRatio: 4.5,
    label: 'secondary text on background',
  },
  // Semantic badge/button text – shipped usages are small/normal text
  // (Button.web.tsx uses text-xs/text-sm), so WCAG AA normal text (4.5:1)
  // applies rather than large text (3:1).
  {
    fg: '--color-text-on-primary',
    bg: '--color-primary-rgb',
    minRatio: 4.5,
    label: 'text on primary',
  },
  {
    fg: '--color-text-on-success',
    bg: '--color-success-rgb',
    minRatio: 4.5,
    label: 'text on success',
  },
  {
    fg: '--color-text-on-warning',
    bg: '--color-warning-rgb',
    minRatio: 4.5,
    label: 'text on warning',
  },
  {
    fg: '--color-text-on-error',
    bg: '--color-error-rgb',
    minRatio: 4.5,
    label: 'text on error',
  },
  {
    fg: '--color-text-on-info',
    bg: '--color-info-rgb',
    minRatio: 4.5,
    label: 'text on info',
  },
  // Shipped UI pairs bg-error with text-text-on-danger rather than text-on-error.
  {
    fg: '--color-text-on-danger',
    bg: '--color-error-rgb',
    minRatio: 4.5,
    label: 'text on danger',
  },
  // Disabled text on disabled background — both stored as plain hex
  // (no `-rgb` variant exists for these tokens). WCAG large text minimum (3:1)
  // applies since disabled text is inherently non-essential and the visual
  // affordance is the dimming itself.
  {
    fg: '--color-text-disabled',
    bg: '--color-bg-disabled',
    minRatio: 3.0,
    label: 'text-disabled on bg-disabled',
  },
];

/**
 * Tokens that exist as both a hex `--color-X` and a space-separated
 * `--color-X-rgb` variant. The two must always agree.
 */
const RGB_PARITY_PAIRS: RgbParityPair[] = [
  { hex: '--color-primary', rgb: '--color-primary-rgb', label: 'primary' },
  { hex: '--color-error', rgb: '--color-error-rgb', label: 'error' },
  { hex: '--color-success', rgb: '--color-success-rgb', label: 'success' },
  { hex: '--color-info', rgb: '--color-info-rgb', label: 'info' },
  { hex: '--color-warning', rgb: '--color-warning-rgb', label: 'warning' },
  { hex: '--color-background', rgb: '--color-background-rgb', label: 'background' },
  { hex: '--color-surface', rgb: '--color-surface-rgb', label: 'surface' },
  { hex: '--color-text-on-primary', rgb: '--color-text-on-primary-rgb', label: 'text-on-primary' },
];

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('theme-wcag-contrast', () => {
  const cssPath = path.resolve(__dirname, '../themes.css');
  const css = fs.readFileSync(cssPath, 'utf-8');
  const themes = parseThemeTokens(css);

  // ── discovery ────────────────────────────────────────────────────────────

  it('discovers all expected themes', () => {
    expect(themes.length).toBeGreaterThanOrEqual(8);
    const names = themes.map((t) => t.name);
    expect(names).toContain('solarized-light');
    expect(names).toContain('solarized-dark');
    expect(names).toContain('midnight');
    expect(names).toContain('catppuccin-latte');
    expect(names).toContain('catppuccin-mocha');
    expect(names).toContain('nord');
    expect(names).toContain('dracula');
    expect(names).toContain('gruvbox-light');
    expect(names).toContain('gruvbox-dark');
    expect(names).toContain('tokyonight');
    expect(names).toContain('monokai');
    expect(names).toContain('onedark');
  });

  // ── parity: hex ↔ rgb-variant ────────────────────────────────────────────

  describe('rgb-parity: --color-X hex matches --color-X-rgb', () => {
    for (const theme of themes) {
      describe(`${theme.name}`, () => {
        for (const pair of RGB_PARITY_PAIRS) {
          it(`${pair.label}`, () => {
            const hexColor = requireColor(requireToken(theme.tokens, pair.hex));
            const rgbColor = requireColor(requireToken(theme.tokens, pair.rgb));

            expect(hexColor[0], `${pair.label} R`).toBe(rgbColor[0]);
            expect(hexColor[1], `${pair.label} G`).toBe(rgbColor[1]);
            expect(hexColor[2], `${pair.label} B`).toBe(rgbColor[2]);
          });
        }
      });
    }
  });

  // ── WCAG AA contrast assertions ──────────────────────────────────────────

  describe('wcag-aa-contrast', () => {
    for (const theme of themes) {
      describe(`${theme.name}`, () => {
        for (const check of CHECKS) {
          it(`${check.label} — ratio ≥ ${check.minRatio}:1`, () => {
            const fgColor = requireColor(requireToken(theme.tokens, check.fg));
            const bgColor = requireColor(requireToken(theme.tokens, check.bg));

            const ratio = calcContrast(fgColor, bgColor);
            expect(ratio).toBeGreaterThanOrEqual(check.minRatio);
          });
        }
      });
    }
  });
});
