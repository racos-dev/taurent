// useNativeMenuSync.ts — desktop-only hook for native menu event handling + state sync
//
// Listens to native menu events emitted from Rust and dispatches them to the
// appropriate handlers. Automatically syncs dynamic menu enabled/disabled
// state to the native macOS menu whenever relevant state changes.

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { BridgeAdapter, type NativeUiAction } from '@taurent/bridge/adapters/desktop'
import type { NativeMenuState } from '@taurent/bridge';
import { reportOperationFailure } from '@taurent/web-core/hooks/operationFailureReporter';
import { useDesktopCommands } from './useDesktopCommands';
import { useShellStore } from '@/stores';
import { useTransferCommandList } from '../torrents/useTransferCommandList';
import { useMaindataSelector } from '../../connection';
import { useQBClient } from '../../connection';
import { openAddTorrentWindow } from '@/windows/dialogs/addTorrentWindow';
import { pickTorrentFiles } from '../../platform';
import { openGlobalSpeedLimitsDialogWindow } from '@/windows/dialogs/transferLimitDialogWindow';

interface NativeMenuHandlers {
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  onAddTorrent?: () => void;
  onNav?: (route: 'search' | 'rss') => void;
  onViewToggle?: (panel: 'toggle-sidebar' | 'toggle-details' | 'toggle-in-window-menubar') => void;
  onAction?: (action: string) => void;
  /** Tray "Add Torrent File..." action */
  onAddTorrentFile?: () => void;
  /** Tray "Add Torrent Link..." action */
  onAddTorrentLink?: () => void;
  /** Tray "Set Global Speed Limits..." action */
  onSetGlobalSpeedLimits?: () => void;
}

function dispatchNativeUiAction(
  action: NativeUiAction,
  handlers: NativeMenuHandlers,
  defaults: {
    openSettings: () => void;
    openAbout: () => void;
    addTorrent: () => void;
    openSearch: () => void;
    openRSS: () => void;
    addTorrentFile: () => void;
    addTorrentLink: () => void;
    setGlobalSpeedLimits: () => void;
  }
) {
  switch (action.type) {
    case 'settings':
      if (handlers.onOpenSettings) {
        handlers.onOpenSettings();
      } else {
        defaults.openSettings();
      }
      break;
    case 'about':
      if (handlers.onOpenAbout) {
        handlers.onOpenAbout();
      } else {
        defaults.openAbout();
      }
      break;
    case 'add-torrent':
      if (handlers.onAddTorrent) {
        handlers.onAddTorrent();
      } else {
        defaults.addTorrent();
      }
      break;
    case 'add-torrent-source':
      if (action.source === 'file') {
        if (handlers.onAddTorrentFile) {
          handlers.onAddTorrentFile();
        } else {
          defaults.addTorrentFile();
        }
      } else if (action.source === 'link') {
        if (handlers.onAddTorrentLink) {
          handlers.onAddTorrentLink();
        } else {
          defaults.addTorrentLink();
        }
      }
      break;
    case 'set-global-speed-limits':
      if (handlers.onSetGlobalSpeedLimits) {
        handlers.onSetGlobalSpeedLimits();
      } else {
        defaults.setGlobalSpeedLimits();
      }
      break;
    case 'nav':
      if (handlers.onNav) {
        handlers.onNav(action.route);
      } else if (action.route === 'search') {
        defaults.openSearch();
      } else {
        defaults.openRSS();
      }
      break;
  }
}

async function drainPendingActions(
  handlers: NativeMenuHandlers,
  defaults: {
    openSettings: () => void;
    openAbout: () => void;
    addTorrent: () => void;
    openSearch: () => void;
    openRSS: () => void;
    addTorrentFile: () => void;
    addTorrentLink: () => void;
    setGlobalSpeedLimits: () => void;
  }
) {
  try {
    const pending = await BridgeAdapter.getPendingNativeUiActions();
    for (const action of pending) {
      dispatchNativeUiAction(action, handlers, defaults);
    }
  } catch {
    // Draining is best-effort; non-fatal if it fails (e.g., cold start before the command is registered).
  }
}

export function useNativeMenuSync(handlers: NativeMenuHandlers = {}) {
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  const { commands } = useTransferCommandList();
  const toggleSidebar = useShellStore((state) => state.toggleSidebar);
  const togglePropertiesPane = useShellStore((state) => state.togglePropertiesPane);
  const toggleInWindowMenuBarVisible = useShellStore((state) => state.toggleInWindowMenuBarVisible);
  const sidebarVisible = useShellStore((state) => state.sidebarVisible);
  const propertiesPaneVisible = useShellStore((state) => state.propertiesPaneVisible);
  const inWindowMenuBarVisible = useShellStore((state) => state.inWindowMenuBarVisible);

  // Default navigation + file action handlers — used when AppShell doesn't provide overrides
  const { openSettings, openAbout, addTorrent, openSearch, openRSS, openStatistics } =
    useDesktopCommands();

  // Tray state: connection status and alt speed from maindata
  const { isConnected } = useQBClient();
  const useAltSpeedLimits = useMaindataSelector((s) => s.server_state?.use_alt_speed_limits ?? false);

  // Tray action handlers
  const handleAddTorrentFile = useCallback(async () => {
    try {
      const files = await pickTorrentFiles();
      if (files.length === 0) return;
      await openAddTorrentWindow({ files: JSON.stringify(files) });
    } catch {
      // File picker or window open failure — non-fatal
    }
  }, []);

  const handleAddTorrentLink = useCallback(async () => {
    // Open the add torrent window with a source=link hint so the screen
    // starts in the URL/magnet entry path.
    await openAddTorrentWindow({ source: 'link' });
  }, []);

  const handleSetGlobalSpeedLimits = useCallback(async () => {
    await openGlobalSpeedLimitsDialogWindow();
  }, []);

  // Build current menu state from transfer commands + view state + tray state
  const buildMenuState = useCallback((): NativeMenuState => {
    const pauseCmd = commands.find((c) => c.id === 'pause');
    const resumeCmd = commands.find((c) => c.id === 'resume');
    const deleteCmd = commands.find((c) => c.id === 'delete');
    const recheckCmd = commands.find((c) => c.id === 'recheck');
    const reannounceCmd = commands.find((c) => c.id === 'reannounce');
    const forceStartCmd = commands.find((c) => c.id === 'force-start');
    const setCategoryCmd = commands.find((c) => c.id === 'set-category');
    const setTagsCmd = commands.find((c) => c.id === 'set-tags');
    const queueUpCmd = commands.find((c) => c.id === 'queue-up');
    const queueDownCmd = commands.find((c) => c.id === 'queue-down');
    const moveTopCmd = commands.find((c) => c.id === 'move-top');
    const moveBottomCmd = commands.find((c) => c.id === 'move-bottom');

    return {
      can_pause: Boolean(pauseCmd?.enabled),
      can_resume: Boolean(resumeCmd?.enabled),
      can_delete: Boolean(deleteCmd?.enabled),
      can_recheck: Boolean(recheckCmd?.enabled),
      can_reannounce: Boolean(reannounceCmd?.enabled),
      can_force_start: Boolean(forceStartCmd?.enabled),
      can_set_category: Boolean(setCategoryCmd?.enabled),
      can_set_tags: Boolean(setTagsCmd?.enabled),
      can_queue_up: Boolean(queueUpCmd?.enabled),
      can_queue_down: Boolean(queueDownCmd?.enabled),
      can_move_top: Boolean(moveTopCmd?.enabled),
      can_move_bottom: Boolean(moveBottomCmd?.enabled),
      view_sidebar: sidebarVisible,
      view_details: propertiesPaneVisible,
      in_window_menubar: inWindowMenuBarVisible,
      // Tray fields
      tray_alt_speed_active: useAltSpeedLimits,
      tray_connected: isConnected,
    };
  }, [commands, sidebarVisible, propertiesPaneVisible, inWindowMenuBarVisible, isConnected, useAltSpeedLimits]);

  // Keep a ref to the latest buildMenuState so the debounced sync always
  // reads current view state, even though scheduleSync itself is stable.
  const buildMenuStateRef = useRef(buildMenuState);
  useLayoutEffect(() => {
    buildMenuStateRef.current = buildMenuState;
  });

  // Debounced sync: 100 ms after the last relevant state change.
  // scheduleSync stability is maintained by useCallback([commands]).
  // buildMenuState is read via a ref to avoid stale closures.
  const debouncedSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSync = useCallback(() => {
    if (debouncedSyncRef.current !== null) {
      clearTimeout(debouncedSyncRef.current);
    }
    debouncedSyncRef.current = setTimeout(() => {
      try {
        const state = buildMenuStateRef.current();
        BridgeAdapter.syncMenuState(state).catch((error) => {
          reportOperationFailure({ operation: 'native-menu-sync', error });
        });
      } catch {
        // Menu state sync failure is non-fatal
      }
      debouncedSyncRef.current = null;
    }, 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deferred: scheduleSync is intentionally stable; buildMenuState read via ref
  }, [commands]);

  // Auto-sync whenever commands (torrent action enablement), tray state, or view state changes.
  // This ensures the native menu stays current even when the in-window MenuBar
  // is hidden on macOS.
  useEffect(() => {
    scheduleSync();
  }, [commands, sidebarVisible, propertiesPaneVisible, inWindowMenuBarVisible, isConnected, useAltSpeedLimits, scheduleSync]);

  // Keep a ref to the latest commands so the menu:action listener always reads
  // current torrent commands without needing effect re-registration.
  const commandsRef = useRef(commands);
  useLayoutEffect(() => {
    commandsRef.current = commands;
  });

  // Listen for native menu events
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];
    let stale = false;

    const setup = async () => {
      // Reset the Rust-side flag FIRST so events are enqueued during setup
      // rather than emitted into the void before listeners are registered.
      await BridgeAdapter.resetViewListenersReady();
      if (stale) return;

      // Settings / About
      unlisteners.push(
        await listen('menu:settings', () => {
          if (handlersRef.current.onOpenSettings) {
            handlersRef.current.onOpenSettings();
          } else {
            openSettings();
          }
        })
      );
      unlisteners.push(
        await listen('menu:about', () => {
          if (handlersRef.current.onOpenAbout) {
            handlersRef.current.onOpenAbout();
          } else {
            openAbout();
          }
        })
      );

      // File
      unlisteners.push(
        await listen('menu:add-torrent', () => {
          if (handlersRef.current.onAddTorrent) {
            handlersRef.current.onAddTorrent();
          } else {
            addTorrent();
          }
        })
      );

      // Actions — read commands via ref to avoid stale closure
      unlisteners.push(
        await listen<string>('menu:action', (event) => {
          const action = event.payload;
          const cmd = commandsRef.current.find((c) => c.id === action);
          if (cmd?.enabled) {
            cmd.onClick();
          }
          handlersRef.current.onAction?.(action);
        })
      );

      // View toggles
      unlisteners.push(
        await listen<string>('menu:view', (event) => {
          const panel = event.payload as 'toggle-sidebar' | 'toggle-details' | 'toggle-in-window-menubar';
          if (panel === 'toggle-sidebar') {
            toggleSidebar();
          } else if (panel === 'toggle-details') {
            togglePropertiesPane();
          } else if (panel === 'toggle-in-window-menubar') {
            toggleInWindowMenuBarVisible();
          }
          handlersRef.current.onViewToggle?.(panel);
        })
      );

      // Navigation — default to openSearch/openRSS when no handler is provided
      unlisteners.push(
        await listen<string>('menu:nav', (event) => {
          const route = event.payload as 'search' | 'rss';
          if (handlersRef.current.onNav) {
            handlersRef.current.onNav(route);
          } else if (route === 'search') {
            openSearch();
          } else if (route === 'rss') {
            openRSS();
          }
        })
      );

      // Statistics
      unlisteners.push(
        await listen('menu:statistics', () => {
          openStatistics();
        })
      );

      // Tray UI actions: Add Torrent File, Add Torrent Link, Set Global Speed Limits,
      // and the Alternative Speed Limits toggle. route_tray_ui_action (Rust) always
      // enqueues so the drain path handles all cases uniformly.
      unlisteners.push(
        await listen<NativeUiAction>('menu:tray-action', (event) => {
          dispatchNativeUiAction(event.payload, handlersRef.current, {
            openSettings,
            openAbout,
            addTorrent,
            openSearch,
            openRSS,
            addTorrentFile: handleAddTorrentFile,
            addTorrentLink: handleAddTorrentLink,
            setGlobalSpeedLimits: handleSetGlobalSpeedLimits,
          });
        })
      );

      if (stale) return;

      // Drain pending native UI actions after listeners are ready.
      await drainPendingActions(handlersRef.current, {
        openSettings,
        openAbout,
        addTorrent,
        openSearch,
        openRSS,
        addTorrentFile: handleAddTorrentFile,
        addTorrentLink: handleAddTorrentLink,
        setGlobalSpeedLimits: handleSetGlobalSpeedLimits,
      });

      if (stale) return;

      // Signal that view listeners are ready so future events are emitted directly.
      await BridgeAdapter.setViewListenersReady();

      if (stale) return;

      // Drain any buffered view toggle actions that arrived before listeners were ready.
      try {
        const pending = await BridgeAdapter.getPendingViewActions();
        for (const panel of pending) {
          if (stale) return;
          if (panel === 'toggle-sidebar') {
            toggleSidebar();
          } else if (panel === 'toggle-details') {
            togglePropertiesPane();
          } else if (panel === 'toggle-in-window-menubar') {
            toggleInWindowMenuBarVisible();
          }
          handlersRef.current.onViewToggle?.(
            panel as 'toggle-sidebar' | 'toggle-details' | 'toggle-in-window-menubar'
          );
        }
      } catch {
        // Draining is best-effort
      }
    };

    setup();

    return () => {
      stale = true;
      unlisteners.forEach((unlisten) => unlisten());
      // Reset the ready flag so events are re-queued until the next setup() completes.
      BridgeAdapter.resetViewListenersReady().catch(() => {});
      if (debouncedSyncRef.current !== null) {
        clearTimeout(debouncedSyncRef.current);
      }
    };
  }, [
    addTorrent,
    openSettings,
    openAbout,
    openSearch,
    openRSS,
    openStatistics,
    toggleSidebar,
    togglePropertiesPane,
    toggleInWindowMenuBarVisible,
    handleAddTorrentFile,
    handleAddTorrentLink,
    handleSetGlobalSpeedLimits,
  ]);

  return {};
}
