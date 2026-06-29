import React from 'react';
import { useTransferCommandList } from '../../hooks/torrents/useTransferCommandList';
import { useDesktopCommands } from '../../hooks/shell/useDesktopCommands';
import { useShellStore } from '@/stores';
import { DropdownMenu } from '@taurent/web-ui';
import type { MenuItem } from '@taurent/web-ui';

const TOP_LEVEL_MENU_TRIGGERS = [
  { label: 'File', testId: 'menu-file' },
  { label: 'Torrent', testId: 'menu-torrent' },
  { label: 'Tools', testId: 'menu-tools' },
  { label: 'View', testId: 'menu-view' },
  { label: 'Help', testId: 'menu-help' },
] as const;

const isMacPlatform = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export function MenuBar() {
  const { commands } = useTransferCommandList();
  const {
    addTorrent,
    openSettings,
    openSearch,
    openRSS,
    openAbout,
    openStatistics,
  } = useDesktopCommands();
  const toggleSidebar = useShellStore((state) => state.toggleSidebar);
  const togglePropertiesPane = useShellStore((state) => state.togglePropertiesPane);
  const inWindowMenuBarVisible = useShellStore((state) => state.inWindowMenuBarVisible);
  const toggleInWindowMenuBarVisible = useShellStore((state) => state.toggleInWindowMenuBarVisible);
  const [openMenuIndex, setOpenMenuIndex] = React.useState<number | null>(null);
  // Debounced close when mouse leaves the entire menubar area (trigger + panel).
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleClose = React.useCallback(() => {
    closeTimerRef.current = setTimeout(() => setOpenMenuIndex(null), 150);
  }, []);
  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);
  const addTorrentShortcut = isMacPlatform ? '⌘O' : 'Ctrl+O';
  const settingsShortcut = isMacPlatform ? '⌘,' : 'Ctrl+,';
  const searchShortcut = isMacPlatform ? '⌘F' : 'Ctrl+F';
  const toggleSidebarShortcut = isMacPlatform ? '⌘B' : 'Ctrl+B';
  const toggleDetailsShortcut = isMacPlatform ? '⌘I' : 'Ctrl+I';

  // Look up transfer commands by id
  const cmd = (id: string) => commands.find((c) => c.id === id);

  // File menu: Add Torrent, Settings
  const fileMenuItems: MenuItem[] = [
    { label: 'Add Torrent…', shortcut: addTorrentShortcut, onClick: addTorrent },
    { separator: true },
    { label: 'Settings…', shortcut: settingsShortcut, onClick: openSettings },
  ];

  // Torrent menu: all selection-dependent commands
  const torrentMenuItems: MenuItem[] = [
    {
      label: 'Pause',
      shortcut: cmd('pause')?.shortcut,
      onClick: () => cmd('pause')?.onClick(),
      disabled: !cmd('pause')?.enabled,
    },
    {
      label: 'Resume',
      shortcut: cmd('resume')?.shortcut,
      onClick: () => cmd('resume')?.onClick(),
      disabled: !cmd('resume')?.enabled,
    },
    {
      label: 'Delete',
      shortcut: cmd('delete')?.shortcut,
      onClick: () => cmd('delete')?.onClick(),
      disabled: !cmd('delete')?.enabled,
    },
    { separator: true },
    {
      label: 'Recheck',
      onClick: () => cmd('recheck')?.onClick(),
      disabled: !cmd('recheck')?.enabled,
    },
    {
      label: 'Reannounce',
      onClick: () => cmd('reannounce')?.onClick(),
      disabled: !cmd('reannounce')?.enabled,
    },
    {
      label: 'Force Start',
      onClick: () => cmd('force-start')?.onClick(),
      disabled: !cmd('force-start')?.enabled,
    },
    { separator: true },
    {
      label: 'Set Category…',
      onClick: () => cmd('set-category')?.onClick(),
      disabled: !cmd('set-category')?.enabled,
    },
    {
      label: 'Set Tags…',
      onClick: () => cmd('set-tags')?.onClick(),
      disabled: !cmd('set-tags')?.enabled,
    },
    { separator: true },
    {
      label: 'Queue Up',
      onClick: () => cmd('queue-up')?.onClick(),
      disabled: !cmd('queue-up')?.enabled,
    },
    {
      label: 'Queue Down',
      onClick: () => cmd('queue-down')?.onClick(),
      disabled: !cmd('queue-down')?.enabled,
    },
    {
      label: 'Move to Top',
      shortcut: cmd('move-top')?.shortcut,
      onClick: () => cmd('move-top')?.onClick(),
      disabled: !cmd('move-top')?.enabled,
    },
    {
      label: 'Move to Bottom',
      shortcut: cmd('move-bottom')?.shortcut,
      onClick: () => cmd('move-bottom')?.onClick(),
      disabled: !cmd('move-bottom')?.enabled,
    },
  ];

  // Tools menu: Search, RSS
  const toolsMenuItems: MenuItem[] = [
    { label: 'Search…', shortcut: searchShortcut, onClick: openSearch },
    { label: 'RSS…', onClick: openRSS },
    { separator: true },
    { label: 'Statistics…', onClick: openStatistics },
  ];

  // View menu: Toggle Sidebar, Toggle Details, [macOS: Toggle In-Window Menu Bar], Settings
  const viewMenuItems: MenuItem[] = [
    {
      label: 'Toggle Sidebar',
      shortcut: toggleSidebarShortcut,
      onClick: toggleSidebar,
    },
    {
      label: 'Toggle Details Panel',
      shortcut: toggleDetailsShortcut,
      onClick: togglePropertiesPane,
    },
  ];

  // On macOS, add the in-window menubar toggle to the View menu
  if (isMacPlatform) {
    viewMenuItems.push(
      { separator: true },
      {
        label: inWindowMenuBarVisible ? 'Hide Menu Bar' : 'Show Menu Bar',
        onClick: toggleInWindowMenuBarVisible,
      }
    );
  }

  // Help menu: About Taurent (opens Settings deep-linked to desktop-about)
  const helpMenuItems: MenuItem[] = [
    { label: 'About Taurent', onClick: openAbout },
  ];

  const menuItemArrays: MenuItem[][] = [
    fileMenuItems,
    torrentMenuItems,
    toolsMenuItems,
    viewMenuItems,
    helpMenuItems,
  ];


  return (
    <div
      role="menubar"
      aria-label="Application menu"
      data-testid="menu-bar"
      className="flex items-center border-b border-border bg-surface px-1 text-sm select-none"
      data-tauri-drag-region
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {TOP_LEVEL_MENU_TRIGGERS.map((menuConfig, index) => (
        <div key={menuConfig.label}>
          <DropdownMenu
            label={menuConfig.label}
            items={menuItemArrays[index]}
            dataTestid={menuConfig.testId}
            open={openMenuIndex === index}
            onOpenChange={(isOpen) => {
              setOpenMenuIndex(isOpen ? index : null);
            }}
            onPanelMouseEnter={cancelClose}
            onPanelMouseLeave={scheduleClose}
          />
        </div>
      ))}
    </div>
  );
}