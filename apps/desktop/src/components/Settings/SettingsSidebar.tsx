import React, { type ComponentType } from 'react';
import { cn } from '@taurent/shared';
import type { SettingsNavGroup, SectionId } from './SettingsNavConfig';

interface SettingsSidebarProps {
  navigationGroups: SettingsNavGroup[];
  activeSection: SectionId;
  onSelectSection: (id: SectionId) => void;
  dirtySections?: Set<string>;
}

function NavButton({
  icon: Icon,
  label,
  badge,
  active,
  dirty,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  active: boolean;
  dirty?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm transition-colors select-none',
        active
          ? 'bg-primary text-text-on-primary'
          : 'text-text-primary hover:bg-surface-interactive'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate" title={label}>{label}</span>
      {dirty ? (
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
      ) : null}
      {badge && (
        <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-text-muted">
          {badge}
        </span>
      )}
    </button>
  );
}

export const SettingsSidebar = React.memo<SettingsSidebarProps>(({
  navigationGroups,
  activeSection,
  onSelectSection,
  dirtySections,
}) => {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-3 py-2">
        <h1 className="text-sm font-semibold text-text-primary">Settings</h1>
      </div>

      <nav className="flex-1 overflow-auto px-2 py-2">
        {navigationGroups.map((group) => {
          if (group.items.length === 0) return null;
          return (
            <div key={group.id} className="mb-3">
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavButton
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    active={activeSection === item.id}
                    dirty={dirtySections?.has(item.id)}
                    onClick={() => onSelectSection(item.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
});

SettingsSidebar.displayName = 'SettingsSidebar';
