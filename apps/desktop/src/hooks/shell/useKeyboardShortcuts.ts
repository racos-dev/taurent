import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop'
import { useTransferCommandList } from '../torrents/useTransferCommandList';
import { useTorrentSelectionStore } from '@/stores';
import { openAddTorrentWindow } from '../../windows/dialogs/addTorrentWindow';

interface KeyboardShortcutsOptions {
  onFocusSearch?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const location = useLocation();
  const { commands } = useTransferCommandList();
  const optionsRef = useRef(options);
  const locationRef = useRef(location.pathname);

  // Keep optionsRef current without causing extra renders
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    if (isTextInput) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') {
        return;
      }
    }

    const modifierKey = e.ctrlKey || e.metaKey;
    const { onFocusSearch } = optionsRef.current;

    const pauseCmd = commands.find((c) => c.id === 'pause');
    const resumeCmd = commands.find((c) => c.id === 'resume');
    const deleteCmd = commands.find((c) => c.id === 'delete');
    const moveTopCmd = commands.find((c) => c.id === 'move-top');
    const moveBottomCmd = commands.find((c) => c.id === 'move-bottom');

    if (modifierKey) {
      switch (e.key.toLowerCase()) {
        case 'q':
          e.preventDefault();
          void BridgeAdapter.exitApp();
          break;
        case 'o':
          e.preventDefault();
          if (!locationRef.current.includes('/add-torrent')) {
            void openAddTorrentWindow();
          }
          break;
        case 'f':
          e.preventDefault();
          onFocusSearch?.();
          break;
        case 's':
          e.preventDefault();
          if (pauseCmd?.enabled) {
            pauseCmd.onClick();
          }
          break;
        case 'enter':
          e.preventDefault();
          if (resumeCmd?.enabled) {
            resumeCmd.onClick();
          }
          break;
        case 'a':
          if (!e.shiftKey && !isTextInput) {
            e.preventDefault();
            useTorrentSelectionStore.getState().selectAll();
          }
          break;
        case 'd':
          if (!isTextInput) {
            e.preventDefault();
            useTorrentSelectionStore.getState().deselectAll();
          }
          break;
      }
    }

    if (e.key === 'Delete') {
      if (!isTextInput && deleteCmd?.enabled) {
        e.preventDefault();
        deleteCmd.onClick();
      }
    }

    if (e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'arrowup':
          if (!isTextInput && moveTopCmd?.enabled) {
            e.preventDefault();
            moveTopCmd.onClick();
          }
          break;
        case 'arrowdown':
          if (!isTextInput && moveBottomCmd?.enabled) {
            e.preventDefault();
            moveBottomCmd.onClick();
          }
          break;
      }
    }

    if (e.key === 'Escape') {
      if (locationRef.current === '/add-torrent') {
        e.preventDefault();
        window.history.back();
      }
    }
  }, [commands]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}
