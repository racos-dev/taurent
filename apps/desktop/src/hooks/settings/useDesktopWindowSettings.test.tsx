import { act, useEffect } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopWindowSettings } from './useDesktopWindowSettings';

type HookResult = ReturnType<typeof useDesktopWindowSettings>;

const mocks = vi.hoisted(() => ({
  getDownloadCompletionNotificationsEnabled: vi.fn(),
  setDownloadCompletionNotificationsEnabled: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@taurent/bridge/adapters/desktop', () => ({
  BridgeAdapter: {
    getDownloadCompletionNotificationsEnabled: mocks.getDownloadCompletionNotificationsEnabled,
    setDownloadCompletionNotificationsEnabled: mocks.setDownloadCompletionNotificationsEnabled,
  },
}));

vi.mock('../../platform', () => ({
  storage: {
    getItem: mocks.getItem,
    setItem: mocks.setItem,
  },
}));

let current: HookResult | null = null;

function SettingsHookHarness({ onValue }: { onValue: (value: HookResult) => void }) {
  const value = useDesktopWindowSettings();

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

async function renderSettingsHook(): Promise<() => HookResult> {
  current = null;
  // Render inside an explicit `act` boundary so that any synchronous React
  // work performed by the hook's first commit is captured, and so any async
  // follow-ups (loadLocalSettings → storage.getItem / autostart / bridge)
  // are flushed before the caller inspects `current`. testing-library v16
  // already wraps `render` in act, but we add an outer act explicitly so
  // the boundary is visible at the call site and matches the wrapper used
  // by `flushReactWork` below.
  await act(async () => {
    render(<SettingsHookHarness onValue={(value) => { current = value; }} />);
  });
  await flushReactWork();
  return () => {
    if (current === null) {
      throw new Error('settings hook did not render');
    }
    return current;
  };
}

async function flushReactWork(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useDesktopWindowSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getItem.mockResolvedValue(null);
    mocks.getDownloadCompletionNotificationsEnabled.mockResolvedValue(true);
    mocks.setItem.mockResolvedValue(undefined);
    mocks.setDownloadCompletionNotificationsEnabled.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    current = null;
  });

  it('defaults downloadCompletionNotifications to true when no value is stored', async () => {
    mocks.getDownloadCompletionNotificationsEnabled.mockResolvedValue(true);

    const result = await renderSettingsHook();

    expect(result().localSettings.downloadCompletionNotifications).toBe(true);
  });

  it('loads downloadCompletionNotifications from the bridge', async () => {
    mocks.getDownloadCompletionNotificationsEnabled.mockResolvedValue(false);

    const result = await renderSettingsHook();

    expect(result().localSettings.downloadCompletionNotifications).toBe(false);
    expect(mocks.getDownloadCompletionNotificationsEnabled).toHaveBeenCalled();
  });

  it('toggles downloadCompletionNotifications off via bridge setter', async () => {
    mocks.getDownloadCompletionNotificationsEnabled.mockResolvedValue(true);

    const result = await renderSettingsHook();

    expect(result().localSettings.downloadCompletionNotifications).toBe(true);

    await act(async () => {
      await result().handleSettingChange('download_completion_notifications', false);
    });

    expect(mocks.setDownloadCompletionNotificationsEnabled).toHaveBeenCalledWith(false);
    expect(result().localSettings.downloadCompletionNotifications).toBe(false);
  });

  it('toggles downloadCompletionNotifications on via bridge setter', async () => {
    mocks.getDownloadCompletionNotificationsEnabled.mockResolvedValue(false);

    const result = await renderSettingsHook();

    expect(result().localSettings.downloadCompletionNotifications).toBe(false);

    await act(async () => {
      await result().handleSettingChange('download_completion_notifications', true);
    });

    expect(mocks.setDownloadCompletionNotificationsEnabled).toHaveBeenCalledWith(true);
    expect(result().localSettings.downloadCompletionNotifications).toBe(true);
  });

  it('still handles existing window settings via storage', async () => {
    mocks.getItem.mockImplementation(async (key: string) => {
      if (key === 'auto_start') return 'true';
      return null;
    });

    const result = await renderSettingsHook();

    expect(result().localSettings.autoStart).toBe(true);

    await act(async () => {
      await result().handleSettingChange('auto_start', false);
    });

    expect(mocks.setItem).toHaveBeenCalledWith('auto_start', 'false');
    expect(mocks.setDownloadCompletionNotificationsEnabled).not.toHaveBeenCalled();
  });

  it('reports bridge errors as localSettingsError', async () => {
    mocks.getDownloadCompletionNotificationsEnabled.mockRejectedValue(new Error('bridge error'));

    const result = await renderSettingsHook();

    expect(result().localSettingsError).toBe('Could not update app settings. Try again.');
  });
});
