import type { ReactNode } from 'react';

export type ScreenHeaderMobileWidth = 'compact' | 'wide';

export interface ScreenHeaderProps {
  title: string;
  /** Optional subtitle text. Rendered by the mobile variant only. */
  subtitle?: string;
  /** Navigate back handler. Omit to hide the back button. */
  onBack?: () => void;
  /** Right-side action element (button, etc.) */
  rightAction?: ReactNode;
  /** Desktop variant has solid bg, mobile has translucent backdrop blur */
  variant?: 'desktop' | 'mobile';
  /** Constrained mobile content width. Ignored by the desktop variant. */
  mobileWidth?: ScreenHeaderMobileWidth;
  /** Optional left icon element. Shown after the back button (desktop only). */
  leftIcon?: ReactNode;
}
