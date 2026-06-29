export type ColorVariant = 'lighter' | 'light' | 'default' | 'dark' | 'darker';

/**
 * Type-safe theme color helper for dynamic color access
 *
 * Returns CSS variable references that work with NativeWind.
 *
 * @example
 * ```tsx
 * // Get color string for style prop
 * const backgroundColor = getColor('primary');
 * // Returns: 'var(--color-primary)'
 *
 * // Get color with opacity suffix
 * const overlayColor = getColor('primary', 0.2);
 * // Returns: 'var(--color-primary-20)'
 *
 * // For components that require dynamic colors
 * <View style={{ backgroundColor: getColor('primary') }} />
 * ```
 */
export function getColor(
  key: string,
  opacity?: number
): string {
  const cssVar = `--color-${key}`;
  
  if (opacity === undefined) {
    return `var(${cssVar})`;
  }

  // Add opacity suffix for common alpha values
  const alphaPercent = Math.round(opacity * 100);
  return `var(${cssVar}-${alphaPercent})`;
}

/**
 * Type-safe alpha color helper
 *
 * @example
 * ```tsx
 * const overlayBackground = getAlphaColor('primary', 0.1);
 * // Returns: 'var(--color-primary-10)'
 * ```
 */
export function getAlphaColor(
  key: string,
  alpha: 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9
): string {
  const alphaPercent = Math.round(alpha * 100);
  return `var(--color-${key}-${alphaPercent})`;
}

/**
 * Status color mapping for consistent semantic colors
 */
export const statusColors = {
  downloading: 'download' as const,
  seeding: 'upload' as const,
  paused: 'text-secondary' as const,
  completed: 'success' as const,
  error: 'error' as const,
  connecting: 'info' as const,
  stalled: 'warning' as const,
} as const;

export type StatusColorKey = keyof typeof statusColors;

/**
 * Get color for a status (typed)
 *
 * @example
 * ```tsx
 * const statusColorKey = getStatusColor('downloading'); // returns 'download'
 * const colorString = getColor(statusColorKey);
 * // Returns: 'var(--color-download)'
 * <IconSymbol color={colorString} />
 * ```
 */
export function getStatusColor(status: StatusColorKey): string {
  return statusColors[status];
}
