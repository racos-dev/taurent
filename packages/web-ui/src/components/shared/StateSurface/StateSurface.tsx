import React from 'react';
import type { StateSurfaceProps, StateSurfaceTone } from './types';
import { cn } from '@taurent/shared';

const toneStyles: Record<StateSurfaceTone, { wrapper: string; icon?: string }> = {
  loading: { wrapper: 'border-border' },
  empty: { wrapper: 'border-border' },
  error: { wrapper: 'border-error/30' },
  offline: { wrapper: 'border-border' },
  unsupported: { wrapper: 'border-border' },
};

/**
 * Full-area or section-level placeholder for when an entire content region is empty, loading, or errored.
 *
 * Use `StateSurface` when the empty state **fills the primary content area** — for example,
 * a whole screen showing "No search results" or an entire section indicating the content
 * failed to load. It renders a **dashed double border** with **spacious padding** and
 * **tone-aware border coloring** (`@see StateSurfaceTone`). Accepts multiple `actions`.
 *
 * @example
 * ```tsx
 * <StateSurface
 *   tone="empty"
 *   title="No results"
 *   message="Try a different search term"
 *   icon={<SearchXIcon />}
 *   actions={<><Button>Clear Search</Button><Button variant="outline">Browse All</Button></>}
 * />
 * ```
 */
export const StateSurface = React.memo<StateSurfaceProps>(({
  tone = 'empty',
  title,
  message,
  icon,
  actions,
  className = '',
}) => {
  const { wrapper } = toneStyles[tone];

  return (
    <div className={cn('flex flex-col items-center justify-center rounded-sm border-2 border-dashed bg-surface px-3 py-6 text-center', wrapper, className)}>
      {icon && (
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-sm bg-surface-interactive text-text-secondary">
          {icon}
        </div>
      )}
      {title && <h2 className="text-sm font-medium text-text-primary">{title}</h2>}
      {message && <p className="mt-1 text-xs text-text-secondary">{message}</p>}
      {actions && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
});

StateSurface.displayName = 'StateSurface';
