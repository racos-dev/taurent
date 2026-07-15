import { ChevronDown } from '@taurent/shared';
import { cn } from '@taurent/shared';

interface SidebarSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** When true, disable the toggle button and hide children. */
  disabled?: boolean;
  /** Tooltip shown on disabled header. */
  disabledTitle?: string;
}

export function SidebarSection({
  title,
  expanded,
  onToggle,
  children,
  disabled,
  disabledTitle,
}: SidebarSectionProps) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        className="w-full flex items-center gap-1 px-2 py-1 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-interactive transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <ChevronDown className={cn('w-3 h-3 transition-transform', !expanded && '-rotate-90')} />
        {title}
      </button>
      {expanded && !disabled && <div className="mt-1">{children}</div>}
    </div>
  );
}
