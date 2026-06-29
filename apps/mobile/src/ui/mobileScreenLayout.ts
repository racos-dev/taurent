import { cn } from '@taurent/shared';

export type MobileScreenWidth = 'compact' | 'wide';
export type MobileScreenHeight = 'full' | 'screen';
export type MobileScreenBottomSpacing = 'none' | 'content' | 'tab' | 'fab';

/**
 * Safe-area-aware bottom padding class strings.
 *
 * Tailwind's `theme(spacing.X)` would be the natural choice, but the mobile
 * tailwind preset only defines a small spacing scale (1–8), so `spacing.20`
 * and `spacing.24` resolve to `undefined` and break the calc(). We use
 * literal rem values inside Tailwind arbitrary-value classes:
 *
 * - `content` (2rem = 32px): breathing room above any chrome.
 * - `tab` (4rem = 64px): clears the mobile bottom tab bar, whose visible
 *   height is `calc(4rem + var(--sab, 0px))` (see MobileShell).
 * - `fab` (5rem = 80px): clears a FAB (≈56–64px) plus the tab bar.
 *
 * The class strings must be full static literals so Tailwind's JIT scanner
 * can detect them — interpolated template literals are not reliably picked
 * up by the scanner. Combined with `var(--sab)`
 * (env(safe-area-inset-bottom)) declared in `apps/mobile/src/index.css`.
 */
const MOBILE_SCREEN_WIDTH_CLASSES: Record<MobileScreenWidth, string> = {
  compact: 'max-w-lg',
  wide: 'max-w-3xl',
};

const MOBILE_SCREEN_HEIGHT_CLASSES: Record<MobileScreenHeight, string> = {
  full: 'min-h-full',
  screen: 'min-h-screen',
};

const MOBILE_SAFE_AREA_BOTTOM_CLASSES: Record<MobileScreenBottomSpacing, string> = {
  none: '',
  content: 'pb-[calc(2rem+var(--sab))]',
  tab: 'pb-[calc(4rem+var(--sab))]',
  fab: 'pb-[calc(5rem+var(--sab))]',
};

export function mobileScreenWidthClassName(width: MobileScreenWidth = 'compact') {
  return MOBILE_SCREEN_WIDTH_CLASSES[width];
}

export function mobileScreenRootClassName({
  height = 'screen',
  bottomSpacing = 'none',
  className,
}: {
  height?: MobileScreenHeight;
  bottomSpacing?: MobileScreenBottomSpacing;
  className?: string;
} = {}) {
  return cn(
    MOBILE_SCREEN_HEIGHT_CLASSES[height],
    'overflow-y-auto overscroll-none bg-background',
    MOBILE_SAFE_AREA_BOTTOM_CLASSES[bottomSpacing],
    className,
  );
}

export function mobileScreenContentClassName({
  width = 'compact',
  bottomSpacing = 'none',
  className,
}: {
  width?: MobileScreenWidth;
  bottomSpacing?: MobileScreenBottomSpacing;
  className?: string;
} = {}) {
  return cn(
    'mx-auto w-full overscroll-none px-2 py-4',
    MOBILE_SCREEN_WIDTH_CLASSES[width],
    MOBILE_SAFE_AREA_BOTTOM_CLASSES[bottomSpacing],
    className,
  );
}

export function mobileScreenHeaderInnerClassName({
  width = 'compact',
  className,
}: {
  width?: MobileScreenWidth;
  className?: string;
} = {}) {
  return cn('mx-auto w-full', MOBILE_SCREEN_WIDTH_CLASSES[width], className);
}

export function mobileCenteredStateClassName({
  width = 'compact',
  height = 'screen',
  className,
}: {
  width?: MobileScreenWidth;
  height?: MobileScreenHeight;
  className?: string;
} = {}) {
  return cn(
    'mx-auto flex w-full items-center justify-center px-2 py-8',
    MOBILE_SCREEN_HEIGHT_CLASSES[height],
    MOBILE_SCREEN_WIDTH_CLASSES[width],
    MOBILE_SAFE_AREA_BOTTOM_CLASSES.content,
    className,
  );
}
