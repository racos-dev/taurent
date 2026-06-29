import type { ReactNode } from 'react';

interface ContextMenuGroupProps {
  /** Optional group heading label rendered above the children. */
  label?: string;
  /** Content items in the group. */
  children: ReactNode;
}

/**
 * Wraps a set of related menu items under an optional label heading.
 * Applies a top border and spacing conventions consistent with
 * ContextMenuSeparator.
 */
export function ContextMenuGroup({ label, children }: ContextMenuGroupProps) {
  return (
    <div className={label ? 'border-t border-border first:border-0' : ''}>
      {label && (
        <div className="px-2 pt-2 pb-0">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        </div>
      )}
      <div className="pb-0">{children}</div>
    </div>
  );
}
