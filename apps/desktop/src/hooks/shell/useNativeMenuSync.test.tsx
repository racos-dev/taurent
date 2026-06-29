import { act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeMenuState, NativeUiAction } from '@taurent/bridge';
import { useNativeMenuSync } from './useNativeMenuSync';

const mocks = vi.hoisted(() => ({
  listen: vi.fn(async () => vi.fn()),
  syncMenuState: vi.fn(async (state: NativeMenuState) => void(state)),
  getPendingNativeUiActions: vi.fn(async () => [] as NativeUiAction[]),
  getPendingViewActions: vi.fn(async () => [] as string[]),
  setViewListenersReady: vi.fn(async () => {}),
  resetViewListenersReady: vi.fn(async () => {}),
  reportOperationFailure: vi.fn(),
  commands: [] as Array<{ id: string; enabled: boolean; onClick: () => void }>,
  torrents: [] as Array<{ state: string }>,
  isConnected: true,
  useAltSpeedLimits: false,
  shellState: {
    sidebarVisible: true,
    propertiesPaneVisible: false,
    inWindowMenuBarVisible: true,
    toggleSidebar: vi.fn(),
    togglePropertiesPane: vi.fn(),
    toggleInWindowMenuBarVisible: vi.fn(),
  },
  desktopCommands: {
    openSettings: vi.fn(),
    openAbout: vi.fn(),
    addTorrent: vi.fn(),
    openSearch: vi.fn(),
    openRSS: vi.fn(),
    openStatistics: vi.fn(),
  },
  pickTorrentFiles: vi.fn(async () => ['/downloads/one.torrent', '/downloads/two.torrent']),
  openAddTorrentWindow: vi.fn(async () => {}),
  openGlobalSpeedLimitsDialogWindow: vi.fn(async () => {}),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listen,
}));

vi.mock('@taurent/bridge/adapters/desktop', () => ({
  BridgeAdapter: {
    syncMenuState: mocks.syncMenuState,
    getPendingNativeUiActions: mocks.getPendingNativeUiActions,
    getPendingViewActions: mocks.getPendingViewActions,
    setViewListenersReady: mocks.setViewListenersReady,
    resetViewListenersReady: mocks.resetViewListenersReady,
  },
}));

vi.mock('@taurent/web-core/hooks/operationFailureReporter', () => ({
  reportOperationFailure: mocks.reportOperationFailure,
}));

vi.mock('./useDesktopCommands', () => ({
  useDesktopCommands: () => mocks.desktopCommands,
}));

vi.mock('../torrents/useTransferCommandList', () => ({
  useTransferCommandList: () => ({ commands: mocks.commands }),
}));

vi.mock('../../connection', () => ({
  useQBClient: () => ({ isConnected: mocks.isConnected }),
  useMaindataSelector: (selector: (state: { server_state: { use_alt_speed_limits: boolean } }) => unknown) =>
    selector({ server_state: { use_alt_speed_limits: mocks.useAltSpeedLimits } }),
}));

vi.mock('@/stores', () => ({
  useShellStore: <T,>(selector: (state: typeof mocks.shellState) => T) => selector(mocks.shellState),
}));

vi.mock('@/windows/dialogs/addTorrentWindow', () => ({
  openAddTorrentWindow: mocks.openAddTorrentWindow,
}));

vi.mock('../../platform', () => ({
  pickTorrentFiles: mocks.pickTorrentFiles,
}));

vi.mock('@/windows/dialogs/transferLimitDialogWindow', () => ({
  openGlobalSpeedLimitsDialogWindow: mocks.openGlobalSpeedLimitsDialogWindow,
}));

function HookConsumer() {
  useNativeMenuSync();
  return null;
}

async function renderAndFlushMenuState() {
  render(<HookConsumer />);
  await act(async () => {});
  await act(async () => {
    await delay(125);
  });
  expect(mocks.syncMenuState).toHaveBeenCalled();
  return mocks.syncMenuState.mock.calls.at(-1)?.[0] as NativeMenuState;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('useNativeMenuSync tray parity', () => {
  beforeEach(() => {
    mocks.listen.mockClear();
    mocks.syncMenuState.mockClear();
    mocks.getPendingNativeUiActions.mockResolvedValue([]);
    mocks.getPendingNativeUiActions.mockClear();
    mocks.getPendingViewActions.mockResolvedValue([]);
    mocks.getPendingViewActions.mockClear();
    mocks.setViewListenersReady.mockClear();
    mocks.resetViewListenersReady.mockClear();
    mocks.reportOperationFailure.mockClear();
    mocks.commands = [];
    mocks.isConnected = true;
    mocks.useAltSpeedLimits = false;
    mocks.pickTorrentFiles.mockResolvedValue(['/downloads/one.torrent', '/downloads/two.torrent']);
    mocks.pickTorrentFiles.mockClear();
    mocks.openAddTorrentWindow.mockClear();
    mocks.openGlobalSpeedLimitsDialogWindow.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('syncs disconnected tray state and alternate-speed checked state', async () => {
    mocks.isConnected = false;
    mocks.useAltSpeedLimits = true;

    const state = await renderAndFlushMenuState();

    expect(state).toMatchObject({
      tray_alt_speed_active: true,
      tray_connected: false,
    });
  });

  
});
