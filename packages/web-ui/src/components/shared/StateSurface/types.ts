import type { ReactNode } from 'react';

export type StateSurfaceTone = 'loading' | 'empty' | 'error' | 'offline' | 'unsupported';

export interface StateSurfaceProps {
  /** Semantic tone controlling border/icon treatment. */
  tone?: StateSurfaceTone;
  /** Primary message headline. */
  title?: string;
  /** Optional descriptive sub-message. */
  message?: string;
  /** Optional icon node rendered in a circular background. */
  icon?: ReactNode;
  /** Optional action area (buttons, links, etc.). */
  actions?: ReactNode;
  className?: string;
}
