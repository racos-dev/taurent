import React from 'react';
import { useTransferCommandList } from '../../hooks/torrents/useTransferCommandList';
import { useDesktopCommands } from '../../hooks/shell/useDesktopCommands';
import { useShellStore } from '@/stores';
import { DropdownMenu } from '@taurent/web-ui';
import type { MenuItem } from '@taurent/web-ui';
import { useTaurentTranslation } from '@taurent/shared/i18n';

const TOP_LEVEL_MENU_TRIGGERS = [
  { labelKey: 'menu.file', testId: 'menu-file' },
  { labelKey: 'menu.torrent', testId: 'menu-torrent' },
  { labelKey: 'menu.tools', testId: 'menu-tools' },
  { labelKey: 'menu.view', testId: 'menu-view' },
  { labelKey: 'menu.help', testId: 'menu-help' },
] as const;

const isMacPlatform = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export function MenuBar() {
  const { t } = useTaurentTranslation('desktop');
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
    { label: t('menu.addTorrent'), shortcut: addTorrentShortcut, onClick: addTorrent },
    { separator: true },
    { label: t('menu.settings'), shortcut: settingsShortcut, onClick: openSettings },
  ];

  // Torrent menu: all selection-dependent commands
  const torrentMenuItems: MenuItem[] = [
    {
      label: t('menu.pause'),
      shortcut: cmd('pause')?.shortcut,
      onClick: () => cmd('pause')?.onClick(),
      disabled: !cmd('pause')?.enabled,
    },
    {
      label: t('menu.resume'),
      shortcut: cmd('resume')?.shortcut,
      onClick: () => cmd('resume')?.onClick(),
      disabled: !cmd('resume')?.enabled,
    },
    {
      label: t('menu.delete'),
      shortcut: cmd('delete')?.shortcut,
      onClick: () => cmd('delete')?.onClick(),
      disabled: !cmd('delete')?.enabled,
    },
    { separator: true },
    {
      label: t('menu.recheck'),
      onClick: () => cmd('recheck')?.onClick(),
      disabled: !cmd('recheck')?.enabled,
    },
    {
      label: t('menu.reannounce'),
      onClick: () => cmd('reannounce')?.onClick(),
      disabled: !cmd('reannounce')?.enabled,
    },
    {
      label: t('menu.forceStart'),
      onClick: () => cmd('force-start')?.onClick(),
      disabled: !cmd('force-start')?.enabled,
    },
    { separator: true },
    {
      label: t('menu.setCategory'),
      onClick: () => cmd('set-category')?.onClick(),
      disabled: !cmd('set-category')?.enabled,
    },
    {
      label: t('menu.setTags'),
      onClick: () => cmd('set-tags')?.onClick(),
      disabled: !cmd('set-tags')?.enabled,
    },
    { separator: true },
    {
      label: t('menu.queueUp'),
      onClick: () => cmd('queue-up')?.onClick(),
      disabled: !cmd('queue-up')?.enabled,
    },
    {
      label: t('menu.queueDown'),
      onClick: () => cmd('queue-down')?.onClick(),
      disabled: !cmd('queue-down')?.enabled,
    },
    {
      label: t('menu.moveTop'),
      shortcut: cmd('move-top')?.shortcut,
      onClick: () => cmd('move-top')?.onClick(),
      disabled: !cmd('move-top')?.enabled,
    },
    {
      label: t('menu.moveBottom'),
      shortcut: cmd('move-bottom')?.shortcut,
      onClick: () => cmd('move-bottom')?.onClick(),
      disabled: !cmd('move-bottom')?.enabled,
    },
  ];

  // Tools menu: Search, RSS
  const toolsMenuItems: MenuItem[] = [
    { label: t('menu.search'), shortcut: searchShortcut, onClick: openSearch },
    { label: t('menu.rss'), onClick: openRSS },
    { separator: true },
    { label: t('menu.statistics'), onClick: openStatistics },
  ];

  // View menu: Toggle Sidebar, Toggle Details, [macOS: Toggle In-Window Menu Bar], Settings
  const viewMenuItems: MenuItem[] = [
    {
      label: t('menu.toggleSidebar'),
      shortcut: toggleSidebarShortcut,
      onClick: toggleSidebar,
    },
    {
      label: t('menu.toggleDetails'),
      shortcut: toggleDetailsShortcut,
      onClick: togglePropertiesPane,
    },
  ];

  // On macOS, add the in-window menubar toggle to the View menu
  if (isMacPlatform) {
    viewMenuItems.push(
      { separator: true },
      {
        label: inWindowMenuBarVisible ? t('menu.hideMenuBar') : t('menu.showMenuBar'),
        onClick: toggleInWindowMenuBarVisible,
      }
    );
  }

  // Help menu: About Taurent (opens Settings deep-linked to desktop-about)
  const helpMenuItems: MenuItem[] = [
    { label: t('menu.about'), onClick: openAbout },
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
      aria-label={t('accessibility.applicationMenu')}
      data-testid="menu-bar"
      className="flex items-center border-b border-border bg-surface px-1 text-sm select-none"
      data-tauri-drag-region
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {TOP_LEVEL_MENU_TRIGGERS.map((menuConfig, index) => (
        <div key={menuConfig.testId}>
          <DropdownMenu
            label={t(menuConfig.labelKey)}
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
