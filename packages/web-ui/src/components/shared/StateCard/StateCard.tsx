import React from 'react';
import { cn } from '@taurent/shared';
import type { StateCardProps } from './types';

/**
 * Inline or contained state message for when a child container has no content.
 *
 * Use `StateCard` when the empty state is a **child of an existing container** —
 * for example, a "No torrents yet" card inside a list panel, or a filter section
 * showing "No results match your filters". It renders a **solid border** with
 * **compact padding** and accepts a single `action` slot.
 *
 * @example
 * ```tsx
 * <StateCard
 *   title="No torrents yet"
 *   message="Add some torrents to get started"
 *   icon={<FolderIcon />}
 *   action={<Button size="sm">Add Torrent</Button>}
 * />
 * ```
 */
export const StateCard = React.memo<StateCardProps>(({ title, message, action, icon, className = '' }) => {
  return (
    <div className={cn('rounded-sm border border-border bg-surface px-3 py-3 text-center', className)}>
      {icon ? (
        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-sm bg-surface-interactive text-text-secondary">
          {icon}
        </div>
      ) : null}
      <h2 className="text-sm font-medium text-text-primary">{title}</h2>
      {message ? <p className="mt-1 text-xs text-text-secondary">{message}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
});

StateCard.displayName = 'StateCard';
