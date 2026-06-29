import { ChevronDown } from '@taurent/shared';
import { cn } from '@taurent/shared';

interface SidebarSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function SidebarSection({ title, expanded, onToggle, children }: SidebarSectionProps) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2 py-1 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-interactive transition-colors"
      >
        <ChevronDown className={cn('w-3 h-3 transition-transform', !expanded && '-rotate-90')} />
        {title}
      </button>
      {expanded && <div className="mt-1">{children}</div>}
    </div>
  );
}
