import { describe, expect, it, vi } from 'vitest';
import { openAuxWindow } from './auxWindowManager';

const mocks = vi.hoisted(() => ({
  show: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(async () => undefined),
  listen: vi.fn(async () => () => undefined),
}));

vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalPosition: class LogicalPosition {},
  LogicalSize: class LogicalSize {},
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    outerPosition: async () => ({ x: 0, y: 0 }),
    outerSize: async () => ({ width: 1200, height: 800 }),
    scaleFactor: async () => 1,
  }),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => {
  class MockWebviewWindow {
    static async getByLabel() {
      return null;
    }

    private handlers = new Map<string, () => void>();

    constructor(public label: string) {
      queueMicrotask(() => this.handlers.get('tauri://created')?.());
    }

    once(eventName: string, handler: () => void) {
      this.handlers.set(eventName, handler);
    }

    show = mocks.show;

    async hide() {}
    async close() {}
    async unminimize() {}
    async setFocus() {}
    async setTitle() {}
    async setSize() {}
    async setResizable() {}
    async setMinSize() {}
    async setPosition() {}
  }

  return {
    WebviewWindow: MockWebviewWindow,
    getAllWebviewWindows: async () => [],
  };
});

vi.mock('@taurent/shared/theme/backgroundRuntime', () => ({
  resolveSystemThemeBackgroundRgba: () => [0, 0, 0, 255],
}));

describe('openAuxWindow', () => {
  it('keeps a cold window hidden until its renderer layout commits', async () => {
    await openAuxWindow({
      label: 'cold-window-test',
      route: '/cold-window-test',
      title: 'Cold window test',
      width: 600,
      height: 400,
    });

    expect(mocks.show).not.toHaveBeenCalled();
  });
});
