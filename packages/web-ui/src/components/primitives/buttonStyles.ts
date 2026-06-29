/**
 * Shared button-style helpers.
 *
 * Centralizes Tailwind class-string patterns used by Button, IconButton,
 * ActionButton, ActionChip, and any other inline button affordances so that
 * hover/active/disabled behavior stays consistent across the design system.
 */

/** Shared disabled state classes for filled (semantic bg) buttons */
export const FILLED_DISABLED_CLASSES =
  'disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed';

/** Shared disabled state classes for surface/outline buttons */
export const SURFACE_DISABLED_CLASSES =
  'disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled disabled:cursor-not-allowed';

/** Shared disabled state classes for ghost/transparent buttons */
export const GHOST_DISABLED_CLASSES =
  'disabled:text-text-disabled disabled:cursor-not-allowed';

/** Focus ring classes shared by all button types */
export const FOCUS_RING_CLASSES =
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-focus';

/** Common transition base */
export const BUTTON_TRANSITION_CLASSES = 'transition-colors';

/**
 * Build filled variant classes with enabled: guards and disabled overrides.
 * @param semanticBg - e.g. 'bg-primary'
 * @param textOn - e.g. 'text-text-on-primary'
 * @param hoverEffect - e.g. 'enabled:hover:opacity-90' or 'enabled:hover:bg-primary/90'
 * @param activeEffect - e.g. 'enabled:active:opacity-90'
 */
export function filledVariantClasses(
  semanticBg: string,
  textOn: string,
  hoverEffect: string,
  activeEffect: string,
): string {
  return `${semanticBg} ${textOn} ${hoverEffect} ${activeEffect} ${FILLED_DISABLED_CLASSES}`;
}

/**
 * Build surface/outline variant classes with enabled: guards and disabled overrides.
 */
export function surfaceVariantClasses(opts: {
  bg?: string;
  text?: string;
  border?: string;
  hoverBg?: string;
  hoverBorder?: string;
  activeBg?: string;
}): string {
  const parts = [
    opts.bg ?? 'bg-surface',
    opts.text ?? 'text-text-primary',
    opts.border ? `border ${opts.border}` : '',
    opts.hoverBorder ? `enabled:hover:${opts.hoverBorder}` : '',
    opts.hoverBg ? `enabled:hover:${opts.hoverBg}` : '',
    opts.activeBg ? `enabled:active:${opts.activeBg}` : '',
    SURFACE_DISABLED_CLASSES,
  ];
  return parts.filter(Boolean).join(' ');
}
