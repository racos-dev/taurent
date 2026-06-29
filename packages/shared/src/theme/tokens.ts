/**
 * Shared Tailwind color tokens.
 *
 * Both desktop and mobile Tailwind configs import and spread this object
 * into their `theme.extend.colors` section. App-specific extras can be
 * added after spreading.
 *
 * This ensures both apps use the same CSS variable token names and values,
 * while allowing each app to have a few extras if truly necessary.
 *
 * Colors that use opacity modifiers (bg-primary/10, border-error/30, etc.)
 * must be defined using the `<alpha-value>` pattern with separate -rgb channel
 * variables so Tailwind's JIT can compute the opacity correctly.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const tailwindColorTokens: Record<string, any> = {
  // Surface Colors
  background: 'rgb(var(--color-background-rgb) / <alpha-value>)',
  surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
  'surface-elevated': 'var(--color-surface-elevated)',
  'surface-interactive': 'var(--color-surface-interactive)',

  // Text Colors
  'text-primary': 'var(--color-text-primary)',
  'text-secondary': 'var(--color-text-secondary)',
  'text-muted': 'var(--color-text-muted)',
  'text-placeholder': 'var(--color-text-placeholder)',

  // Semantic Colors
  primary: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
  'primary-hover': 'var(--color-primary-hover)',
  'primary-light': 'var(--color-primary-light)',
  'text-on-primary': 'rgb(var(--color-text-on-primary-rgb) / <alpha-value>)',
  success: 'rgb(var(--color-success-rgb) / <alpha-value>)',
  warning: 'rgb(var(--color-warning-rgb) / <alpha-value>)',
  error: 'rgb(var(--color-error-rgb) / <alpha-value>)',
  info: 'rgb(var(--color-info-rgb) / <alpha-value>)',

  // Feature Colors
  download: 'var(--color-download)',
  upload: 'var(--color-upload)',
  size: 'var(--color-size)',
  ratio: 'var(--color-ratio)',
  peers: 'var(--color-peers)',
  time: 'var(--color-time)',

  // Border Colors
  border: 'var(--color-border)',
  'border-focus': 'var(--color-border-focus)',
  'border-elevated': 'var(--color-border-elevated)',
  'border-subtle': 'var(--color-border-subtle)',

  // Overlays
  overlay: 'var(--color-overlay)',
  backdrop: 'var(--color-backdrop)',

  // Interactive States
  'state-selected': 'var(--color-state-selected)',

  // Text-on-color tokens (no rgb variants needed)
  'text-on-success': 'var(--color-text-on-success)',
  'text-on-warning': 'var(--color-text-on-warning)',
  'text-on-info': 'var(--color-text-on-info)',
  'text-on-error': 'var(--color-text-on-error)',
  'text-on-danger': 'var(--color-text-on-danger)',

  // Input/border tokens
  'border-input': 'var(--color-border-input)',
  'border-interactive': 'var(--color-border-interactive)',

  // Disabled state tokens
  'text-disabled': 'var(--color-text-disabled)',
  'bg-disabled': 'var(--color-bg-disabled)',
  'border-disabled': 'var(--color-border-disabled)',

  // Alpha Variants
  'primary-10': 'var(--color-primary-10)',
  'primary-20': 'var(--color-primary-20)',
  'primary-30': 'var(--color-primary-30)',
  'primary-40': 'var(--color-primary-40)',
  'success-20': 'var(--color-success-20)',
  'warning-20': 'var(--color-warning-20)',
  'error-20': 'var(--color-error-20)',
  'info-20': 'var(--color-info-20)',
  'upload-20': 'var(--color-upload-20)',

  // Text Alpha
  'text-muted-30': 'var(--color-text-muted-30)',
  'text-50': 'var(--color-text-50)',
  'text-70': 'var(--color-text-70)',

  // UI Elements
  divider: 'var(--color-divider)',

  // Status Colors (torrent states — base and -15 variants)
  'status-downloading': 'var(--color-status-downloading)',
  'status-downloading-15': 'var(--color-status-downloading-15)',
  'status-seeding': 'var(--color-status-seeding)',
  'status-seeding-15': 'var(--color-status-seeding-15)',
  'status-stalled': 'var(--color-status-stalled)',
  'status-stalled-15': 'var(--color-status-stalled-15)',
  'status-paused': 'var(--color-status-paused)',
  'status-paused-15': 'var(--color-status-paused-15)',
  'status-queued': 'var(--color-status-queued)',
  'status-queued-15': 'var(--color-status-queued-15)',
  'status-checking': 'var(--color-status-checking)',
  'status-checking-15': 'var(--color-status-checking-15)',
  'status-metadata': 'var(--color-status-metadata)',
  'status-metadata-15': 'var(--color-status-metadata-15)',
  'status-error': 'var(--color-status-error)',
  'status-error-15': 'var(--color-status-error-15)',
  'status-inactive': 'var(--color-status-inactive)',
  'status-inactive-15': 'var(--color-status-inactive-15)',

  // Connection Status
  'status-connected': 'var(--color-status-connected)',
  'status-connected-15': 'var(--color-status-connected-15)',
  'status-firewalled': 'var(--color-status-firewalled)',
  'status-firewalled-15': 'var(--color-status-firewalled-15)',
  'status-disconnected': 'var(--color-status-disconnected)',
  'status-disconnected-15': 'var(--color-status-disconnected-15)',
  'status-idle': 'var(--color-status-idle)',
  'status-idle-15': 'var(--color-status-idle-15)',
  'status-connecting': 'var(--color-status-connecting)',
  'status-connecting-15': 'var(--color-status-connecting-15)',
  'status-reconnecting': 'var(--color-status-reconnecting)',
  'status-reconnecting-15': 'var(--color-status-reconnecting-15)',
  'status-unreachable': 'var(--color-status-unreachable)',
  'status-unreachable-15': 'var(--color-status-unreachable-15)',
  'status-auth-failed': 'var(--color-status-auth-failed)',
  'status-auth-failed-15': 'var(--color-status-auth-failed-15)',
};
/* eslint-enable @typescript-eslint/no-explicit-any */
