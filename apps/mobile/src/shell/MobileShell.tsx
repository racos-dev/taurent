/**
 * Mobile authenticated shell — Phase 3 slice 1.
 *
 * Wraps top-level tab destinations (Torrents, Search, RSS, Settings)
 * inside a WorkspaceFrame (mobile variant) with an app-owned bottom tab bar.
 * Drill-in routes (torrent detail, add-torrent, filters, manage-*) live outside
 * this shell but remain within the protected/authenticated branch.
 */

import { NavLink, Outlet } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { WorkspaceFrame } from '@taurent/web-ui';
import { Icon } from '../ui/Icon';
import { MobileConnectionBanner } from './MobileConnectionBanner';

const MOBILE_TAB_BAR_SAFE_HEIGHT = 'calc(4rem + var(--sab, 0px))';

const mobileShellStyle = {
  '--mobile-tab-bar-safe-height': MOBILE_TAB_BAR_SAFE_HEIGHT,
} as CSSProperties;

const mobileTabBarStyle: CSSProperties = {
  minHeight: 'var(--mobile-tab-bar-safe-height)',
  paddingBottom: 'calc(var(--sab, 0px) + 4px)',
};

const TAB_ITEMS = [
  { to: '/', label: 'Torrents', icon: 'layers' as const },
  { to: '/search', label: 'Search', icon: 'search' as const },
  { to: '/rss', label: 'RSS', icon: 'rss' as const },
  { to: '/settings', label: 'Settings', icon: 'settings' as const },
];

function TabBarItem({ to, label, icon }: { to: string; label: string; icon: 'layers' | 'search' | 'rss' | 'settings' }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-sm px-2 py-1 text-sm font-medium transition-colors active:scale-[0.97] active:bg-surface-interactive ${
          isActive
            ? 'text-primary'
            : 'text-text-secondary hover:text-text-primary active:text-text-primary'
        }`
      }
    >
      <Icon name={icon} iconSize="lg" />
      <span>{label}</span>
    </NavLink>
  );
}

function MobileTabBar() {
  return (
    <nav
      className="flex items-center justify-around border-t border-border bg-surface px-2 pt-1"
      style={mobileTabBarStyle}
    >
      {TAB_ITEMS.map((item) => (
        <TabBarItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
      ))}
    </nav>
  );
}

export function MobileShell() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background" style={mobileShellStyle}>
      <MobileConnectionBanner />
      <WorkspaceFrame
        variant="mobile"
        className="min-h-0 flex-1 bg-background"
        footer={<MobileTabBar />}
        content={<Outlet />}
      />
    </div>
  );
}
