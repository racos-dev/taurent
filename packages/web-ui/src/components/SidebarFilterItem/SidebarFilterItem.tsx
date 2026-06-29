import { cn } from '@taurent/shared';
import type { SidebarFilterItemProps } from './types';

export function SidebarFilterItem({
  icon,
  label,
  count,
  active,
  onClick,
  onContextMenu,
  ariaPressed,
  title,
  className,
}: SidebarFilterItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-pressed={ariaPressed}
      title={title}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors select-none',
        active ? 'bg-primary text-text-on-primary' : 'text-text-primary hover:bg-surface-interactive',
        className,
      )}
    >
      <span className="w-3 h-3 shrink-0 [&>svg]:w-3 [&>svg]:h-3">{icon}</span>
      <span className="min-w-0 truncate text-xs text-left" title={label}>{label}</span>
      {count !== undefined && (
        <span
          className={`shrink-0 text-xs tabular-nums ${active ? 'text-text-on-primary/70' : 'text-text-muted'}`}
        >
          {count}
        </span>
      )}
      <span className="flex-1" aria-hidden="true" />
    </button>
  );
}