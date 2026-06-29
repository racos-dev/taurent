import { useState, useEffect } from 'react';

/**
 * Motion constants for use across the codebase.
 * Provides duration, easing, scale, and transition class constants
 * compatible with Tailwind CSS utility classes.
 */
export const motion = {
  duration: {
    fast: 'duration-150',
    normal: 'duration-200',
    slow: 'duration-300',
  },
  easing: {
    out: 'ease-out',
    default: '',
  },
  scale: {
    button: 'active:scale-[0.98]',
    card: 'active:scale-[0.99]',
  },
  transition: {
    colors: 'transition-colors',
    transform: 'transition-transform',
    all: 'transition-all',
  },
};

/**
 * React hook that reads the `prefers-reduced-motion: reduce` media query.
 * Returns `true` when the user has requested reduced motion.
 *
 * SSR-safe: returns `false` when `window` is not available.
 * Subscribes to preference changes and cleans up on unmount.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}