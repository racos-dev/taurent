/**
 * Shared accent color types, normalization, and Midnight accent token derivation.
 *
 * Node-safe: no browser globals (localStorage, window, matchMedia).
 *
 * Single source of truth for:
 * - Validation and normalization of hex color strings
 * - Derivation of Midnight's CSS custom-property override map from a chosen accent
 * - Serialization of the override map to CSS text for inline `<style>` or
 *   build-time injection
 *
 * @packageDocumentation
 */

import type { AccentHex } from './types';

// ── Internal helpers ─────────────────────────────────────────────────────

function sRGBtoLin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): AccentHex {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}` as AccentHex;
}

function mixHex(base: AccentHex, mixWith: AccentHex, weight: number): AccentHex {
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(mixWith);
  return rgbToHex(
    r1 + (r2 - r1) * weight,
    g1 + (g2 - g1) * weight,
    b1 + (b2 - b1) * weight,
  );
}

function darken(base: AccentHex, amount: number): AccentHex {
  const [r, g, b] = hexToRgb(base);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function toRgbSpace(hex: AccentHex): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

function toRgbaString(hex: AccentHex, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Validation & normalization ───────────────────────────────────────────

const HEX6_RE = /^#?([0-9a-fA-F]{6})$/;

/**
 * Normalize a user-supplied color string to a canonical `#rrggbb` hex value.
 *
 * Accepts inputs with or without the leading `#`, case-insensitive.
 * Returns `null` if the input is not a valid 6-digit hex color.
 *
 * @example
 * ```ts
 * normalizeAccent('#FF6600') // => '#ff6600'
 * normalizeAccent('ff6600')  // => '#ff6600'
 * normalizeAccent('xyz')     // => null
 * normalizeAccent('')        // => null
 * ```
 */
export function normalizeAccent(value: string): AccentHex | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(HEX6_RE);
  if (!match) return null;
  return `#${match[1].toLowerCase()}` as AccentHex;
}

/**
 * Type guard that returns `true` if the string is a valid {@link AccentHex}.
 *
 * @example
 * ```ts
 * isAccentValue('#ff6600') // => true
 * isAccentValue('red')     // => false
 * ```
 */
export function isAccentValue(value: string): value is AccentHex {
  return normalizeAccent(value) !== null;
}

// ── Token derivation ─────────────────────────────────────────────────────

/**
 * Derive the full Midnight accent override token map from a chosen accent hex.
 *
 * Returns a flat `Record<string, string>` of CSS custom property names to
 * their computed values. These tokens override the static `.theme-midnight`
 * defaults in `themes.css` when a user selects a custom accent.
 *
 * All values are static strings (hex `#rrggbb`, `rgba()`, or space-separated
 * RGB) suitable for setting via `element.style.setProperty()` or inline
 * `<style>`.
 *
 * Covers the full Midnight alias surface that should follow the accent:
 * primary tokens, semantic aliases (success/warning/error/info), feature
 * colors (download/upload/size/ratio/peers/time), border-focus, state-selected,
 * text-on-color tokens, RGB/alpha aliases, and accent-driven status/connection
 * tokens.
 *
 * @param accent — A valid 6-digit hex color
 */
export function deriveMidnightAccentTokens(accent: AccentHex): Record<string, string> {
  const hover = mixHex(accent, '#ffffff', 0.15);
  const light = darken(accent, 0.35);
  const textOnPrimary = getContrastText(accent);
  const rgb = toRgbSpace(accent);
  const rg = (a: number) => toRgbaString(accent, a);

  // Helper: space-separated R G B from contrast text
  const textRgb = (hex: '#000000' | '#ffffff') => toRgbSpace(hex);

  return {
    // ── Primary accent tokens ────────────────────────────────────────────
    '--color-primary': accent,
    '--color-primary-hover': hover,
    '--color-primary-light': light,
    '--color-text-on-primary': textOnPrimary,
    '--color-primary-rgb': rgb,
    '--color-primary-10': rg(0.1),
    '--color-primary-20': rg(0.2),
    '--color-primary-30': rg(0.3),
    '--color-primary-40': rg(0.4),
    '--color-state-selected': rg(0.16),
    '--color-text-on-primary-rgb': textRgb(textOnPrimary),

    // ── Border focus ─────────────────────────────────────────────────────
    '--color-border-focus': accent,

    // ── Semantic alias colors ────────────────────────────────────────────
    '--color-success': accent,
    '--color-success-rgb': rgb,
    '--color-success-20': rg(0.2),
    '--color-text-on-success': textOnPrimary,
    '--color-warning': accent,
    '--color-warning-rgb': rgb,
    '--color-warning-20': rg(0.2),
    '--color-text-on-warning': textOnPrimary,
    '--color-error': accent,
    '--color-error-rgb': rgb,
    '--color-error-20': rg(0.2),
    '--color-text-on-error': textOnPrimary,
    '--color-info': accent,
    '--color-info-rgb': rgb,
    '--color-info-20': rg(0.2),
    '--color-text-on-info': textOnPrimary,
    '--color-text-on-danger': textOnPrimary,

    // ── Feature colors ───────────────────────────────────────────────────
    '--color-download': accent,
    '--color-upload': accent,
    '--color-upload-20': rg(0.2),
    '--color-size': accent,
    '--color-ratio': accent,
    '--color-peers': accent,
    '--color-time': accent,

    // ── Status colors (accent-driven in Midnight) ────────────────────────
    '--color-status-downloading': accent,
    '--color-status-downloading-15': rg(0.15),
    '--color-status-seeding': accent,
    '--color-status-seeding-15': rg(0.15),
    '--color-status-stalled': accent,
    '--color-status-stalled-15': rg(0.15),
    '--color-status-queued': accent,
    '--color-status-queued-15': rg(0.15),
    '--color-status-checking': accent,
    '--color-status-checking-15': rg(0.15),
    '--color-status-metadata': accent,
    '--color-status-metadata-15': rg(0.15),

    // ── Connection status (accent-driven in Midnight) ────────────────────
    '--color-status-connected': accent,
    '--color-status-connected-15': rg(0.15),
    '--color-status-firewalled': accent,
    '--color-status-firewalled-15': rg(0.15),
    '--color-status-connecting': accent,
    '--color-status-connecting-15': rg(0.15),
    '--color-status-reconnecting': accent,
    '--color-status-reconnecting-15': rg(0.15),
  };
}

/**
 * Return the optimal text color for good WCAG AA contrast on a given
 * background color. Returns `#000000` for light backgrounds and `#ffffff`
 * for dark backgrounds, using the luminance threshold that guarantees
 * at least 4.5:1 contrast ratio.
 */
export function getContrastText(bgHex: AccentHex): '#000000' | '#ffffff' {
  const [r, g, b] = hexToRgb(bgHex);
  const l = relativeLuminance(r, g, b);
  // Threshold ~0.179 yields 4.58:1 at the boundary, satisfying WCAG AA.
  return l > 0.179 ? '#000000' : '#ffffff';
}

// ── Serialization ────────────────────────────────────────────────────────

/**
 * Serialize the Midnight accent override tokens to a CSS string suitable for
 * a `<style>` element or direct injection into `document.documentElement.style`.
 *
 * The output is a single `:root { ... }` rule with all derived custom properties.
 *
 * @example
 * ```ts
 * serializeAccentCss('#ff6600')
 * // => ':root{--color-primary:#ff6600;--color-primary-hover:#ff944d;...}'
 * ```
 */
export function serializeAccentCss(accent: AccentHex): string {
  const tokens = deriveMidnightAccentTokens(accent);
  const declarations = Object.entries(tokens)
    .map(([prop, value]) => `${prop}:${value};`)
    .join('');
  return `:root{${declarations}}`;
}
