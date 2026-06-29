import type { ControlDensity } from './ControlDensityProvider';
import type { ButtonSize } from '../components/primitives/Button/types';

/**
 * Static Tailwind class maps for the covered control families.
 *
 * These maps are intentionally statically enumerable so Tailwind's content
 * scanner picks the classes up at build time. Do not assemble class strings
 * dynamically at runtime — always look up a pre-defined class string from one
 * of the maps below.
 *
 * The `desktop` entries preserve the existing compact sizing of every
 * covered primitive. The `mobile` entries provide the larger ~44px hit-area
 * path used by the mobile app.
 */

/* ── Button ────────────────────────────────────────────────────────────── */

/**
 * Per-density size overrides for the shared `Button` primitive.
 * `ButtonSize` keys mirror the existing `size` prop so the density override
 * stacks cleanly on top of the prop-driven base size.
 */
export const BUTTON_CONTROL_SIZE_CLASSES: Record<
  ControlDensity,
  Partial<Record<ButtonSize, string>>
> = {
  desktop: {},
  mobile: {
    sm: 'min-h-11 py-2 text-sm',
    small: 'min-h-11 py-2 text-sm',
    md: 'min-h-11 py-2 text-base',
    medium: 'min-h-11 py-2 text-base',
    lg: 'min-h-11 py-2 text-base',
    large: 'min-h-11 py-2 text-base',
  },
};

/* ── Input ─────────────────────────────────────────────────────────────── */

export const INPUT_CONTROL_SIZE_CLASSES: Record<
  ControlDensity,
  { sm: string; md: string }
> = {
  desktop: {
    sm: 'h-8 px-2 text-xs leading-4',
    md: 'h-9 px-3 text-sm leading-5',
  },
  mobile: {
    sm: 'h-11 px-3 text-sm leading-5',
    md: 'h-11 px-3 text-base leading-6',
  },
};

/** Mobile-only padding helpers for the optional leading icon and clear button. */
export const INPUT_CONTROL_ICON_PADDING: Record<ControlDensity, { sm: string; md: string }> = {
  desktop: {
    sm: 'pl-7',
    md: 'pl-10',
  },
  mobile: {
    sm: 'pl-11',
    md: 'pl-12',
  },
};

export const INPUT_CONTROL_CLEAR_PADDING: Record<ControlDensity, { sm: string; md: string }> = {
  desktop: {
    sm: 'pr-7',
    md: 'pr-9',
  },
  mobile: {
    sm: 'pr-11',
    md: 'pr-12',
  },
};

/** Density-aware absolute offsets for the optional leading icon container. */
export const INPUT_CONTROL_ICON_OFFSET: Record<
  ControlDensity,
  { sm: string; md: string }
> = {
  desktop: {
    sm: 'left-2',
    md: 'left-3',
  },
  mobile: {
    sm: 'left-3',
    md: 'left-4',
  },
};

/** Density-aware absolute offsets for the optional clear button. */
export const INPUT_CONTROL_CLEAR_OFFSET: Record<
  ControlDensity,
  { sm: string; md: string }
> = {
  desktop: {
    sm: 'right-2',
    md: 'right-3',
  },
  mobile: {
    sm: 'right-3',
    md: 'right-4',
  },
};

/* ── Select ────────────────────────────────────────────────────────────── */

export const SELECT_CONTROL_TRIGGER_SIZE_CLASSES: Record<ControlDensity, string> = {
  desktop: 'h-9 px-3 text-sm',
  mobile: 'h-11 px-4 text-base',
};

/* ── Toggle switch ─────────────────────────────────────────────────────── */

export const TOGGLE_CONTROL_WRAPPER_CLASSES: Record<ControlDensity, string> = {
  desktop: '',
  mobile: '',
};

export const TOGGLE_CONTROL_INNER_CLASSES: Record<ControlDensity, string> = {
  desktop: 'relative h-6 w-11 shrink-0 rounded-full transition-colors',
  mobile: 'relative h-8 w-14 shrink-0 rounded-full transition-colors',
};

/* ── Checkbox ──────────────────────────────────────────────────────────── */

/**
 * The checkbox visible box stays the same size; the `mobile` entry adds
 * padded hit area so the interactive target is ~44px while the visual
 * affordance remains a small square.
 */
export const CHECKBOX_CONTROL_WRAPPER_CLASSES: Record<ControlDensity, string> = {
  desktop: '',
  mobile: '-m-3 p-3',
};

/* ── Tab bar ───────────────────────────────────────────────────────────── */

export const TAB_BAR_PILL_ITEM_CLASSES: Record<ControlDensity, string> = {
  desktop: 'rounded-sm px-3 py-2 text-sm font-medium transition-colors',
  mobile: 'rounded-sm px-3 min-h-11 py-2 text-sm font-medium transition-colors',
};

export const TAB_BAR_UNDERLINE_ITEM_CLASSES: Record<ControlDensity, string> = {
  desktop: 'flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
  mobile: 'flex-1 px-3 min-h-11 py-2 text-sm font-medium border-b-2 transition-colors',
};

/* ── Torrent action controls ───────────────────────────────────────────── */

export const ACTION_BUTTON_CONTROL_SIZE_CLASSES: Record<ControlDensity, string> = {
  desktop:
    'flex min-h-7 items-center justify-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:text-text-disabled',
  mobile:
    'flex min-h-11 items-center justify-center gap-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:text-text-disabled',
};

export const ACTION_CHIP_CONTROL_SIZE_CLASSES: Record<ControlDensity, string> = {
  desktop:
    'inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border px-2 text-xs font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:text-text-disabled',
  mobile:
    'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm border px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:text-text-disabled',
};

/* ── Header icon button ────────────────────────────────────────────────── */

/**
 * Shared hit-area sizing for the mobile `ScreenHeader` back/icon buttons and
 * the shared home-screen `IconButton` so the mobile app stops repeating ad
 * hoc `h-8 w-8` classes.
 */
export const HEADER_ICON_BUTTON_SIZE_CLASSES: Record<ControlDensity, string> = {
  desktop: 'h-8 w-8',
  mobile: 'h-11 w-11',
};

/* ── Filter list rows ───────────────────────────────────────────────────── */

/**
 * Density-aware row sizing for mobile filter list items. Desktop keeps the
 * compact sidebar row geometry, while mobile rows get a 44px tap target.
 */
export const FILTER_LIST_ITEM_CONTROL_SIZE_CLASSES: Record<ControlDensity, string> = {
  desktop: 'px-2 py-1 text-xs',
  mobile: 'min-h-11 px-3 py-2 text-sm',
};

export const FILTER_LIST_ITEM_LABEL_SIZE_CLASSES: Record<ControlDensity, string> = {
  desktop: 'text-xs',
  mobile: 'text-sm',
};
