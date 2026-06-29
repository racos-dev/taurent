export const ICON_SIZES = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export type IconSize = keyof typeof ICON_SIZES;
