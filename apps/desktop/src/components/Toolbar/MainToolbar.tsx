import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Pause,
  Play,
  Plus,
  Rocket,
  Settings,
  Trash2,
  PanelLeft,
  PanelTop,
} from '@taurent/shared';
import { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDesktopCommands } from '../../hooks/shell/useDesktopCommands';
import { useTransferCommandList } from '../../hooks/torrents/useTransferCommandList';
import { cn, ICON_SIZES } from '@taurent/shared';
import { useTorrentStore } from '@taurent/shared/stores';
import { useShellStore } from '@/stores';
import { ToolbarButton } from './ToolbarButton';
import { usePreferences } from '../../hooks';

import { Search } from '@taurent/shared';
import { Input } from '@taurent/web-ui';
import { useQBClient } from '@/connection/useQBClientHooks';

export function MainToolbar() {
  const { addTorrent, openSettings } = useDesktopCommands();
  const { capabilities } = useQBClient();
  const { commands } = useTransferCommandList();
  const navigate = useNavigate();
  const location = useLocation();

  const searchQuery = useTorrentStore((state) => state.filters.search);
  const setSearchFilter = useTorrentStore((state) => state.setSearchFilter);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sidebarVisible = useShellStore((state) => state.sidebarVisible);
  const toggleSidebar = useShellStore((state) => state.toggleSidebar);

  const inWindowMenuBarVisible = useShellStore((state) => state.inWindowMenuBarVisible);
  const toggleInWindowMenuBarVisible = useShellStore((state) => state.toggleInWindowMenuBarVisible);

  const isMacPlatform = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  const { preferences } = usePreferences();
  const queueingEnabled = preferences?.queueing_enabled ?? true;

  const separatorClassName = cn('mx-1 h-5 w-px bg-border');

  const pauseCmd = commands.find((c) => c.id === 'pause');
  const resumeCmd = commands.find((c) => c.id === 'resume');
  const deleteCmd = commands.find((c) => c.id === 'delete');
  const forceStartCmd = commands.find((c) => c.id === 'force-start');
  const queueUpCmd = commands.find((c) => c.id === 'queue-up');
  const queueDownCmd = commands.find((c) => c.id === 'queue-down');
  const moveTopCmd = commands.find((c) => c.id === 'move-top');
  const moveBottomCmd = commands.find((c) => c.id === 'move-bottom');

  const currentPath = location.pathname;
  const navItems = [
    { label: 'Transfers', path: '/' },
    { label: 'Search', path: '/search' },
    { label: 'RSS', path: '/rss' },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Main toolbar"
      data-testid="main-toolbar"
      className="flex h-9 items-center gap-1 border-b border-border bg-surface px-1"
    >
      {/* Left section - Torrent actions */}
      <div className="flex items-center">
        <ToolbarButton
          icon={Plus}
          tooltip="Add torrent"
          dataTestId="toolbar-add"
          onClick={addTorrent}
        />

        <div aria-hidden="true" className={separatorClassName} />

        <ToolbarButton
          icon={Trash2}
          tooltip="Remove selected"
          shortcut={deleteCmd?.shortcut}
          dataTestId="toolbar-remove"
          disabled={!deleteCmd?.enabled}
          onClick={deleteCmd?.onClick}
        />
        <ToolbarButton
          icon={Play}
          tooltip={!capabilities.supportsPauseResume ? 'Pause/Resume was removed in qBittorrent v5.0+' : 'Resume selected'}
          shortcut={resumeCmd?.shortcut}
          dataTestId="toolbar-resume"
          disabled={!resumeCmd?.enabled || !capabilities.supportsPauseResume}
          onClick={resumeCmd?.onClick}
        />
        <ToolbarButton
          icon={Pause}
          tooltip={!capabilities.supportsPauseResume ? 'Pause/Resume was removed in qBittorrent v5.0+' : 'Pause selected'}
          shortcut={pauseCmd?.shortcut}
          dataTestId="toolbar-pause"
          disabled={!pauseCmd?.enabled || !capabilities.supportsPauseResume}
          onClick={pauseCmd?.onClick}
        />
        <ToolbarButton
          icon={Rocket}
          tooltip="Force start selected"
          dataTestId="toolbar-force-start"
          disabled={!forceStartCmd?.enabled}
          onClick={forceStartCmd?.onClick}
        />

        {queueingEnabled && (
          <>
            <ToolbarButton
              icon={ArrowUp}
              tooltip="Queue up"
              dataTestId="toolbar-queue-up"
              disabled={!queueUpCmd?.enabled}
              onClick={queueUpCmd?.onClick}
            />
            <ToolbarButton
              icon={ArrowDown}
              tooltip="Queue down"
              dataTestId="toolbar-queue-down"
              disabled={!queueDownCmd?.enabled}
              onClick={queueDownCmd?.onClick}
            />
            <ToolbarButton
              icon={ArrowUpToLine}
              tooltip="Move to top"
              shortcut={moveTopCmd?.shortcut}
              dataTestId="toolbar-move-top"
              disabled={!moveTopCmd?.enabled}
              onClick={moveTopCmd?.onClick}
            />
            <ToolbarButton
              icon={ArrowDownToLine}
              tooltip="Move to bottom"
              shortcut={moveBottomCmd?.shortcut}
              dataTestId="toolbar-move-bottom"
              disabled={!moveBottomCmd?.enabled}
              onClick={moveBottomCmd?.onClick}
            />
          </>
        )}

        <div aria-hidden="true" className={separatorClassName} />

        <ToolbarButton
          icon={PanelLeft}
          tooltip={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          ariaLabel="Toggle sidebar"
          dataTestId="toolbar-toggle-sidebar"
          onClick={toggleSidebar}
        />

        <ToolbarButton
          icon={Settings}
          tooltip="Settings"
          dataTestId="toolbar-settings"
          onClick={openSettings}
        />

        {isMacPlatform && (
          <ToolbarButton
            icon={PanelTop}
            tooltip={inWindowMenuBarVisible ? 'Hide Menu Bar' : 'Show Menu Bar'}
            dataTestId="toolbar-toggle-menubar"
            onClick={toggleInWindowMenuBarVisible}
          />
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center - Search */}
      <Input
        ref={searchInputRef}
        type="text"
        size="sm"
        clearable
        icon={<Search size={ICON_SIZES.sm} />}
        className="w-40"
        placeholder="Filter torrents..."
        value={searchQuery}
        onChange={(value) => setSearchFilter(value)}
        data-testid="toolbar-search-input"
      />

      <div aria-hidden="true" className={separatorClassName} />

      {/* Right section - View navigation */}
      <div className="flex items-center gap-px">
        {navItems.map((item) => {
          const isActive = item.path === '/' ? currentPath === '/' : currentPath.startsWith(item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => { void navigate(item.path); }}
              className={cn(
                'h-7 rounded-sm px-3 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary text-text-on-primary'
                  : 'text-text-secondary hover:bg-surface-interactive hover:text-text-primary'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
