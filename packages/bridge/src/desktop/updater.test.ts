import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: mocks.check,
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: mocks.relaunch,
}));

function makeUpdate(version = '1.1.0') {
  return {
    currentVersion: '1.0.0',
    version,
    date: '2026-07-01T00:00:00.000Z',
    body: 'Release notes',
    close: vi.fn().mockResolvedValue(undefined),
    downloadAndInstall: vi.fn(async (onProgress: (event: unknown) => void) => {
      onProgress({ event: 'Started', data: { contentLength: 100 } });
      onProgress({ event: 'Progress', data: { chunkLength: 25 } });
      onProgress({ event: 'Finished' });
    }),
  };
}

describe('desktop updater bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.check.mockReset();
    mocks.relaunch.mockReset();
  });

  it('maps a native update into bridge update info', async () => {
    const update = makeUpdate();
    mocks.check.mockResolvedValue(update);
    const updater = await import('./updater');

    await expect(updater.checkForUpdate()).resolves.toEqual({
      currentVersion: '1.0.0',
      version: '1.1.0',
      date: '2026-07-01T00:00:00.000Z',
      body: 'Release notes',
    });
  });

  it('returns null when no update is available', async () => {
    mocks.check.mockResolvedValue(null);
    const updater = await import('./updater');

    await expect(updater.checkForUpdate()).resolves.toBeNull();
  });

  it('installs the checked update and reports normalized progress', async () => {
    const update = makeUpdate('1.2.0');
    mocks.check.mockResolvedValue(update);
    const updater = await import('./updater');

    await updater.checkForUpdate();
    const progress = vi.fn();
    await updater.downloadAndInstallUpdate(progress);

    expect(update.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls.map((call) => call[0])).toEqual([
      { event: 'Started', contentLength: 100 },
      { event: 'Progress', chunkLength: 25, downloaded: 25, contentLength: 100 },
      { event: 'Finished', downloaded: 25, contentLength: 100 },
    ]);
  });

  it('relaunches through the process plugin', async () => {
    mocks.relaunch.mockResolvedValue(undefined);
    const updater = await import('./updater');

    await updater.relaunchApp();

    expect(mocks.relaunch).toHaveBeenCalledTimes(1);
  });
});
